// Quiet Notes background (event page).
//
// Responsibilities:
//   1. Toolbar button toggles the sidebar.
//   2. Quick-capture command opens the sidebar and flags a new note.
//   3. "Save selection" context menu appends the selection to an Inbox note.
//   4. Optional sync engine: mirrors storage.local (the source of truth)
//      into storage.sync while the user has sync turned on. Firefox Sync
//      transports the mirror end-to-end encrypted; this code never talks
//      to any server.
//
// Two record kinds are mirrored, each in its own namespace: notes
// ("note:<id>", tombstone "tomb:<id>") and folders ("folder:<id>",
// tombstone "ftomb:<id>"). Everything else — history:*, time:*, timers,
// countdown, countdownEnded, reminders, viewModes, settings, oversized,
// quickCapture, openNote — is intentionally local-only and never synced.
//
// Mirror layout per record (see docs/DESIGN.md):
//   "<prefix><id>"    header { id, updatedAt, chunkCount, gz }
//   "<prefix><id>#N"  chunk N: gzip+base64 when gz, else raw JSON
//   "<tomb><id>"      deletion marker (timestamp)
//
// Safety rule: key *removals* arriving from sync are ignored unless a
// tombstone exists. Turning sync off on one device clears its mirror, and
// that must never delete records on another device.

const CHUNK_SIZE = 6000; // chars per item, safely under the 8 KB item quota
const TOMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const local = browser.storage.local;
const sync = browser.storage.sync;

// Record kinds mirrored to storage.sync. `track` enables the oversized-note
// list shown in settings (only meaningful for notes).
const KINDS = [
  { prefix: "note:", tomb: "tomb:", track: true },
  { prefix: "folder:", tomb: "ftomb:", track: false },
];

function kindForKey(key) {
  return KINDS.find((k) => key.startsWith(k.prefix)) || null;
}

function kindForTomb(key) {
  if (key.startsWith("ftomb:")) return KINDS[1];
  if (key.startsWith("tomb:")) return KINDS[0];
  return null;
}

// ---- Toolbar button ----

browser.action.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
});

// ---- Quick capture (keyboard command) ----
// Open the sidebar and leave a flag the panel picks up to start a new note.
// sidebarAction.open() must run synchronously within the command gesture.

browser.commands.onCommand.addListener((command) => {
  if (command !== "quick-capture") return;
  browser.sidebarAction.open();
  local.set({ quickCapture: Date.now() });
});

// ---- Save selection to the Inbox note ----

browser.runtime.onInstalled.addListener(async () => {
  await browser.menus.removeAll();
  browser.menus.create({
    id: "save-selection",
    title: "Save selection to Quiet Notes",
    contexts: ["selection"],
  });
});

browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId !== "save-selection" || !info.selectionText) return;
  // Must run before any await: open() only works while handling user input.
  browser.sidebarAction.open();
  appendToInbox(info.selectionText.trim());
});

async function appendToInbox(text) {
  const everything = await local.get(null);
  const found = Object.entries(everything).find(
    ([key, value]) =>
      key.startsWith("note:") && value.inbox && !value.deletedAt
  );
  const now = Date.now();
  const inbox = found
    ? found[1]
    : {
        id: crypto.randomUUID(),
        body: "Inbox\n",
        pinned: true,
        inbox: true,
        tags: [],
        lang: "",
        glossary: false,
        createdAt: now,
        updatedAt: now,
      };
  inbox.body = inbox.body.replace(/\n*$/, "\n\n") + text;
  inbox.updatedAt = now;
  await local.set({ ["note:" + inbox.id]: inbox });
}

// ---- Alarms & notifications (countdown/Pomodoro + reminders) ----
//
// The sidebar page is destroyed when closed, so anything that must fire while
// it's shut lives here. Two bits of local state drive it:
//   • "countdown" — the single focus timer (see panel.js for its shape). When
//     it is running, one "countdown" alarm is scheduled at its endsAt.
//   • "reminders" — a { noteId: { at } } map; each entry gets a
//     "reminder:<noteId>" alarm at its time. Both are local-only (never synced).
// The panel only writes this state; the background reacts to the change,
// schedules/clears alarms, and fires the notifications.

const FOCUS_DEFAULT_MS = 25 * 60 * 1000;
const BREAK_DEFAULT_MS = 5 * 60 * 1000;

async function syncCountdownAlarm() {
  await browser.alarms.clear("countdown");
  const { countdown } = await local.get("countdown");
  if (countdown && countdown.running && countdown.endsAt) {
    browser.alarms.create("countdown", { when: countdown.endsAt });
  }
}

// A note's reminders are an array of { id, at }. Tolerate the legacy single
// { at } object so alarms keep working before the panel migrates the data.
function reminderArray(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter((r) => r && r.at);
  if (entry.at) return [{ id: "legacy", at: entry.at }];
  return [];
}

async function syncReminderAlarms() {
  const existing = await browser.alarms.getAll();
  for (const a of existing) {
    if (a.name.startsWith("reminder:")) await browser.alarms.clear(a.name);
  }
  const { reminders } = await local.get("reminders");
  for (const [noteId, entry] of Object.entries(reminders || {})) {
    for (const r of reminderArray(entry)) {
      browser.alarms.create(`reminder:${noteId}:${r.id}`, { when: r.at });
    }
  }
}

async function titleForNote(noteId) {
  if (!noteId) return "";
  const rec = (await local.get("note:" + noteId))["note:" + noteId];
  if (!rec) return "";
  const line = rec.body.split("\n").find((l) => l.trim() !== "");
  return line ? line.trim().replace(/^#+\s*/, "").slice(0, 60) : "Untitled";
}

function notify(id, title, message) {
  browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/note.svg"),
    title: "Quiet Notes — " + title,
    message: message || "",
  });
}

async function fireCountdown() {
  const { countdown } = await local.get("countdown");
  if (!countdown || !countdown.running) return;
  // Unambiguous "a phase just ended" signal for the panel's optional chime
  // (distinct from a manual pause/reset, which never touch this key).
  await local.set({ countdownEnded: Date.now() });
  const noteTitle = await titleForNote(countdown.noteId);
  if (countdown.pomodoro) {
    const finishedFocus = countdown.phase === "focus";
    notify(
      "countdown",
      finishedFocus ? "Focus session done" : "Break over",
      finishedFocus
        ? "Time for a break."
        : noteTitle
          ? `Back to: ${noteTitle}`
          : "Back to work."
    );
    // Auto-advance to the next phase and keep running; the storage change
    // reschedules the alarm.
    const nextPhase = finishedFocus ? "break" : "focus";
    const dur =
      nextPhase === "focus"
        ? countdown.focusMs || FOCUS_DEFAULT_MS
        : countdown.breakMs || BREAK_DEFAULT_MS;
    await local.set({
      countdown: {
        ...countdown,
        phase: nextPhase,
        endsAt: Date.now() + dur,
        remainingMs: dur,
        running: true,
        cycles: countdown.cycles + (finishedFocus ? 1 : 0),
      },
    });
  } else {
    notify(
      "countdown",
      "Time's up",
      noteTitle ? `Countdown finished · ${noteTitle}` : "Your countdown finished."
    );
    // Clear it; the panel then shows a fresh idle draft.
    await local.remove("countdown");
  }
}

async function fireReminder(noteId, rid) {
  const { reminders } = await local.get("reminders");
  const arr = reminderArray(reminders && reminders[noteId]);
  if (!arr.length) return;
  const title = await titleForNote(noteId);
  notify(`reminder:${noteId}:${rid || ""}`, "Reminder", title || "A note is due.");
  // One-shot: drop the fired reminder (or all, for a legacy alarm) so it
  // doesn't re-fire on restart.
  const remaining = rid ? arr.filter((r) => r.id !== rid) : [];
  const next = { ...reminders };
  if (remaining.length) next[noteId] = remaining;
  else delete next[noteId];
  await local.set({ reminders: next });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "countdown") return fireCountdown();
  if (alarm.name.startsWith("reminder:")) {
    const rest = alarm.name.slice("reminder:".length);
    const sep = rest.indexOf(":");
    const noteId = sep === -1 ? rest : rest.slice(0, sep);
    const rid = sep === -1 ? null : rest.slice(sep + 1);
    await fireReminder(noteId, rid);
  }
});

// Clicking a notification opens the sidebar (and, for a reminder, flags which
// note to open — the panel reads "openNote"). sidebarAction.open() may be
// rejected outside a user gesture; the flag still gets the note opened next
// time the sidebar is shown.
browser.notifications.onClicked.addListener((id) => {
  try {
    browser.sidebarAction.open();
  } catch {
    // Not a user gesture on this platform; the flag below still applies.
  }
  if (id.startsWith("reminder:")) {
    const rest = id.slice("reminder:".length);
    const noteId = rest.includes(":") ? rest.slice(0, rest.indexOf(":")) : rest;
    local.set({ openNote: noteId });
  }
  browser.notifications.clear(id);
});

// Reschedule when the panel changes the state, and on browser startup.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.countdown) syncCountdownAlarm();
  if (changes.reminders) syncReminderAlarms();
});

browser.runtime.onStartup.addListener(() => {
  syncCountdownAlarm();
  syncReminderAlarms();
});

// ---- Sync engine ----

async function syncEnabled() {
  const { settings } = await local.get("settings");
  return Boolean(settings && settings.syncEnabled);
}

function chunkKeysFor(prefix, id, count) {
  return Array.from({ length: count }, (_, i) => `${prefix}${id}#${i}`);
}

// Compression roughly halves-to-thirds typical text (more for non-Latin
// scripts, which are 3 bytes/char in UTF-8), stretching the ~100 KB
// storage.sync quota. Base64 keeps the chunks JSON-safe.

async function gzipToBase64(text) {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function gunzipFromBase64(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

async function pushRecord(kind, record) {
  const headerKey = kind.prefix + record.id;
  const existing = (await sync.get(headerKey))[headerKey];
  if (existing && existing.updatedAt >= record.updatedAt) return;

  const json = JSON.stringify(record);
  const compressed = await gzipToBase64(json);
  // Tiny records can come out larger after gzip+base64; store those raw.
  const gz = compressed.length < new TextEncoder().encode(json).length;
  const text = gz ? compressed : json;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  const payload = {
    [headerKey]: {
      id: record.id,
      updatedAt: record.updatedAt,
      chunkCount: chunks.length,
      gz,
    },
  };
  chunks.forEach((chunk, i) => (payload[`${headerKey}#${i}`] = chunk));

  try {
    await sync.set(payload);
    if (existing && existing.chunkCount > chunks.length) {
      await sync.remove(
        chunkKeysFor(kind.prefix, record.id, existing.chunkCount).slice(chunks.length)
      );
    }
    if (kind.track) await markOversized(record.id, false);
  } catch (error) {
    // Typically quota exhaustion. The local save already happened; the note
    // simply stays local-only and is listed in the settings pane.
    if (kind.track) await markOversized(record.id, true);
  }
}

async function pullRecord(kind, id) {
  const headerKey = kind.prefix + id;
  const header = (await sync.get(headerKey))[headerKey];
  if (!header) return;
  const keys = chunkKeysFor(kind.prefix, id, header.chunkCount);
  const got = await sync.get(keys);
  let record;
  try {
    const joined = keys.map((key) => got[key]).join("");
    record = JSON.parse(header.gz ? await gunzipFromBase64(joined) : joined);
  } catch {
    return; // partial write still in flight; a later change event retries
  }
  const current = (await local.get(headerKey))[headerKey];
  if (current && current.updatedAt >= record.updatedAt) return;
  await local.set({ [headerKey]: record });
}

async function writeTombstone(kind, id) {
  const headerKey = kind.prefix + id;
  const tombKey = kind.tomb + id;
  const got = await sync.get([headerKey, tombKey]);
  if (got[tombKey]) return;
  const header = got[headerKey];
  if (header) {
    await sync.remove([headerKey, ...chunkKeysFor(kind.prefix, id, header.chunkCount)]);
  }
  await sync.set({ [tombKey]: Date.now() });
}

async function applyTombstone(kind, id, time) {
  const headerKey = kind.prefix + id;
  const current = (await local.get(headerKey))[headerKey];
  if (!current) return;
  if (current.updatedAt > time) {
    // The record was edited after being deleted elsewhere: the edit wins.
    await sync.remove(kind.tomb + id);
    await pushRecord(kind, current);
  } else {
    await local.remove(headerKey);
  }
}

async function markOversized(id, isOversized) {
  const { oversized = [] } = await local.get("oversized");
  if (oversized.includes(id) === isOversized) return;
  const next = isOversized
    ? [...oversized, id]
    : oversized.filter((x) => x !== id);
  await local.set({ oversized: next });
}

// Two-way merge, run when sync is turned on and on browser startup.
async function fullSync() {
  const [everything, remote] = await Promise.all([local.get(null), sync.get(null)]);
  const now = Date.now();

  for (const [key, time] of Object.entries(remote)) {
    const kind = kindForTomb(key);
    if (!kind) continue;
    await applyTombstone(kind, key.slice(kind.tomb.length), time);
    if (now - time > TOMB_TTL_MS) await sync.remove(key);
  }

  for (const [key, header] of Object.entries(remote)) {
    const kind = kindForKey(key);
    if (!kind || key.includes("#")) continue;
    const current = everything[key];
    if (!current || header.updatedAt > current.updatedAt) {
      await pullRecord(kind, header.id);
    }
  }

  for (const [key, record] of Object.entries(everything)) {
    const kind = kindForKey(key);
    if (!kind) continue;
    const tomb = remote[kind.tomb + record.id];
    if (tomb && tomb >= record.updatedAt) continue;
    await pushRecord(kind, record);
  }
}

browser.runtime.onStartup.addListener(async () => {
  if (await syncEnabled()) await fullSync();
});

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local") {
    if (changes.settings) {
      const was = Boolean(changes.settings.oldValue && changes.settings.oldValue.syncEnabled);
      const is = Boolean(changes.settings.newValue && changes.settings.newValue.syncEnabled);
      if (!was && is) await fullSync();
      if (was && !is) {
        await sync.clear();
        await local.set({ oversized: [] });
      }
    }
    if (!(await syncEnabled())) return;
    for (const [key, change] of Object.entries(changes)) {
      const kind = kindForKey(key);
      if (!kind) continue;
      if (change.newValue) await pushRecord(kind, change.newValue);
      else await writeTombstone(kind, key.slice(kind.prefix.length));
    }
  } else if (area === "sync") {
    if (!(await syncEnabled())) return;
    for (const [key, change] of Object.entries(changes)) {
      const tombKind = kindForTomb(key);
      if (tombKind && change.newValue) {
        await applyTombstone(tombKind, key.slice(tombKind.tomb.length), change.newValue);
        continue;
      }
      const kind = kindForKey(key);
      if (kind && !key.includes("#") && change.newValue) {
        await pullRecord(kind, change.newValue.id);
      }
    }
  }
});
