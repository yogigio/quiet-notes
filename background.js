// Quiet Notes background (event page).
//
// Responsibilities:
//   1. Toolbar button toggles the sidebar.
//   2. "Save selection" context menu appends the selection to an Inbox note.
//   3. Optional sync engine: mirrors storage.local (the source of truth)
//      into storage.sync while the user has sync turned on. Firefox Sync
//      transports the mirror end-to-end encrypted; this code never talks
//      to any server.
//
// Sync mirror layout (see docs/DESIGN.md):
//   "note:<id>"    header { id, updatedAt, chunkCount, gz }
//   "note:<id>#N"  chunk N of the note: gzip+base64 when gz is true
//                  (raw JSON when compression wouldn't help, or for
//                  mirrors written before v0.6.1)
//   "tomb:<id>"    deletion marker (timestamp)
//
// Safety rule: key *removals* arriving from sync are ignored unless a
// tombstone exists. Turning sync off on one device clears its mirror, and
// that must never delete notes on another device.

const NOTE_PREFIX = "note:";
const TOMB_PREFIX = "tomb:";
const CHUNK_SIZE = 6000; // chars per item, safely under the 8 KB item quota
const TOMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const local = browser.storage.local;
const sync = browser.storage.sync;

// ---- Toolbar button ----

browser.action.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
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
      key.startsWith(NOTE_PREFIX) && value.inbox && !value.deletedAt
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
  await local.set({ [NOTE_PREFIX + inbox.id]: inbox });
}

// ---- Sync engine ----

async function syncEnabled() {
  const { settings } = await local.get("settings");
  return Boolean(settings && settings.syncEnabled);
}

function chunkKeysFor(id, count) {
  return Array.from({ length: count }, (_, i) => `${NOTE_PREFIX}${id}#${i}`);
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

async function pushNote(note) {
  const headerKey = NOTE_PREFIX + note.id;
  const existing = (await sync.get(headerKey))[headerKey];
  if (existing && existing.updatedAt >= note.updatedAt) return;

  const json = JSON.stringify(note);
  const compressed = await gzipToBase64(json);
  // Tiny notes can come out larger after gzip+base64; store those raw.
  const gz = compressed.length < new TextEncoder().encode(json).length;
  const text = gz ? compressed : json;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  const payload = {
    [headerKey]: {
      id: note.id,
      updatedAt: note.updatedAt,
      chunkCount: chunks.length,
      gz,
    },
  };
  chunks.forEach((chunk, i) => (payload[`${headerKey}#${i}`] = chunk));

  try {
    await sync.set(payload);
    if (existing && existing.chunkCount > chunks.length) {
      await sync.remove(chunkKeysFor(note.id, existing.chunkCount).slice(chunks.length));
    }
    await markOversized(note.id, false);
  } catch (error) {
    // Typically quota exhaustion. The local save already happened; the note
    // simply stays local-only and is listed in the settings pane.
    await markOversized(note.id, true);
  }
}

async function pullNote(id) {
  const headerKey = NOTE_PREFIX + id;
  const header = (await sync.get(headerKey))[headerKey];
  if (!header) return;
  const keys = chunkKeysFor(id, header.chunkCount);
  const got = await sync.get(keys);
  let note;
  try {
    const joined = keys.map((key) => got[key]).join("");
    note = JSON.parse(header.gz ? await gunzipFromBase64(joined) : joined);
  } catch {
    return; // partial write still in flight; a later change event retries
  }
  const current = (await local.get(headerKey))[headerKey];
  if (current && current.updatedAt >= note.updatedAt) return;
  await local.set({ [headerKey]: note });
}

async function writeTombstone(id) {
  const headerKey = NOTE_PREFIX + id;
  const got = await sync.get([headerKey, TOMB_PREFIX + id]);
  if (got[TOMB_PREFIX + id]) return;
  const header = got[headerKey];
  if (header) {
    await sync.remove([headerKey, ...chunkKeysFor(id, header.chunkCount)]);
  }
  await sync.set({ [TOMB_PREFIX + id]: Date.now() });
}

async function applyTombstone(id, time) {
  const headerKey = NOTE_PREFIX + id;
  const current = (await local.get(headerKey))[headerKey];
  if (!current) return;
  if (current.updatedAt > time) {
    // The note was edited after being deleted elsewhere: the edit wins.
    await sync.remove(TOMB_PREFIX + id);
    await pushNote(current);
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
    if (!key.startsWith(TOMB_PREFIX)) continue;
    await applyTombstone(key.slice(TOMB_PREFIX.length), time);
    if (now - time > TOMB_TTL_MS) await sync.remove(key);
  }

  for (const [key, header] of Object.entries(remote)) {
    if (!key.startsWith(NOTE_PREFIX) || key.includes("#")) continue;
    const current = everything[key];
    if (!current || header.updatedAt > current.updatedAt) await pullNote(header.id);
  }

  for (const [key, note] of Object.entries(everything)) {
    if (!key.startsWith(NOTE_PREFIX)) continue;
    const tomb = remote[TOMB_PREFIX + note.id];
    if (tomb && tomb >= note.updatedAt) continue;
    await pushNote(note);
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
      if (!key.startsWith(NOTE_PREFIX)) continue;
      if (change.newValue) await pushNote(change.newValue);
      else await writeTombstone(key.slice(NOTE_PREFIX.length));
    }
  } else if (area === "sync") {
    if (!(await syncEnabled())) return;
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(TOMB_PREFIX) && change.newValue) {
        await applyTombstone(key.slice(TOMB_PREFIX.length), change.newValue);
      } else if (
        key.startsWith(NOTE_PREFIX) &&
        !key.includes("#") &&
        change.newValue
      ) {
        await pullNote(change.newValue.id);
      }
    }
  }
});
