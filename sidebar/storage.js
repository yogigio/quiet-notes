// @ts-check
/** @typedef {import("./util.js").Note} Note */
/** @typedef {import("./util.js").Timer} Timer */
/** @typedef {import("./util.js").TimeEntry} TimeEntry */
// Persistence layer. Every note lives in browser.storage.local under its own
// key ("note:<id>") so a future sync mirror can copy notes individually
// without touching unrelated data. storage.local never leaves this machine.
//
// Version-history snapshots live under "history:<id>". They are deliberately
// kept out of the "note:" namespace so the sync engine never mirrors them:
// history is local-only and therefore free of the storage.sync quota.

const PREFIX = "note:";
const FOLDER_PREFIX = "folder:";
const HISTORY_PREFIX = "history:";
const HISTORY_LIMIT = 50;
// Time-tracking entries live under "time:<id>", one array per note. Like
// history, they stay out of the "note:" namespace so the sync engine never
// mirrors them — time logs are local-only and free of the sync quota — but
// they ARE included in JSON export/import, since billable hours are data the
// user must be able to back up. The "timers" key holds the map of active
// (running or paused) timers keyed by note id, so they survive the sidebar
// closing. (v0.10 used a single "timer" object; loadTimers migrates it.)
const TIME_PREFIX = "time:";
const TIMERS_KEY = "timers";

export function newNote() {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    body: "",
    pinned: false,
    tags: [],
    lang: "",
    glossary: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Folders ----
// Folder records live under "folder:<id>". They sync alongside notes; each
// note optionally carries a folderId. See background.js for the mirror.

export function newFolder() {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: "",
    icon: "📁",
    color: "blue",
    createdAt: now,
    updatedAt: now,
  };
}

/** @returns {Promise<Record<string, any>>} every folder by id */
export async function loadFolders() {
  const everything = await browser.storage.local.get(null);
  /** @type {Record<string, any>} */
  const folders = {};
  for (const [key, value] of Object.entries(everything)) {
    if (key.startsWith(FOLDER_PREFIX)) folders[value.id] = value;
  }
  return folders;
}

/** @param {{id: string}} folder */
export async function saveFolder(folder) {
  await browser.storage.local.set({ [FOLDER_PREFIX + folder.id]: folder });
}

/** @param {string} id */
export async function deleteFolder(id) {
  await browser.storage.local.remove(FOLDER_PREFIX + id);
}

// Per-note last-used view mode ("write"/"preview"). Local-only and kept out
// of the note record so toggling a view never bumps updatedAt or syncs.
/** @returns {Promise<Record<string, "write"|"preview">>} */
export async function loadViewModes() {
  const { viewModes } = await browser.storage.local.get("viewModes");
  return viewModes || {};
}

/** @param {Record<string, string>} viewModes */
export async function saveViewModes(viewModes) {
  await browser.storage.local.set({ viewModes });
}

/** @returns {Promise<Record<string, any>>} */
export async function loadSettings() {
  const { settings } = await browser.storage.local.get("settings");
  return settings || { syncEnabled: false };
}

/** @param {Record<string, any>} settings */
export async function saveSettings(settings) {
  await browser.storage.local.set({ settings });
}

/** @returns {Promise<Record<string, Note>>} every live note by id */
export async function loadNotes() {
  const everything = await browser.storage.local.get(null);
  /** @type {Record<string, any>} */
  const notes = {};
  for (const [key, value] of Object.entries(everything)) {
    if (key.startsWith(PREFIX)) notes[value.id] = value;
  }
  return notes;
}

/** @param {Note} note */
export async function saveNote(note) {
  await browser.storage.local.set({ [PREFIX + note.id]: note });
}

/** Removes the note and its local-only history/time entries. @param {string} id */
export async function deleteNote(id) {
  await browser.storage.local.remove([
    PREFIX + id,
    HISTORY_PREFIX + id,
    TIME_PREFIX + id,
  ]);
}

// ---- Time tracking (local-only, but exported for backup) ----

/** @param {string} id @returns {Promise<TimeEntry[]>} */
export async function loadTimeEntries(id) {
  const key = TIME_PREFIX + id;
  const got = await browser.storage.local.get(key);
  return got[key] || [];
}

/** @param {string} id @param {TimeEntry[]} entries */
export async function saveTimeEntries(id, entries) {
  const key = TIME_PREFIX + id;
  if (entries && entries.length) {
    await browser.storage.local.set({ [key]: entries });
  } else {
    await browser.storage.local.remove(key);
  }
}

// Every note's entries at once, as { noteId: entries[] } — used for folder
// (project) totals and for JSON export.
/** @returns {Promise<Record<string, TimeEntry[]>>} */
export async function loadAllTimeEntries() {
  const everything = await browser.storage.local.get(null);
  /** @type {Record<string, any>} */
  const out = {};
  for (const [key, value] of Object.entries(everything)) {
    if (key.startsWith(TIME_PREFIX)) out[key.slice(TIME_PREFIX.length)] = value;
  }
  return out;
}

// The active timers, as { noteId: { accumulatedMs, runningSince } }. Each
// timer's runningSince is a Date.now() timestamp while running, or null while
// paused; elapsed = accumulatedMs + (runningSince ? Date.now() - runningSince
// : 0). Depending on the chosen mode there may be one or several entries.
/** @returns {Promise<Record<string, Timer>>} */
export async function loadTimers() {
  const got = await browser.storage.local.get([TIMERS_KEY, "timer"]);
  const map = got[TIMERS_KEY] && typeof got[TIMERS_KEY] === "object" ? got[TIMERS_KEY] : {};
  // Migrate the v0.10 single-timer key into the map, once.
  const legacy = got.timer;
  if (legacy && legacy.noteId) {
    if (!map[legacy.noteId]) {
      map[legacy.noteId] = {
        accumulatedMs: legacy.accumulatedMs || 0,
        runningSince: legacy.runningSince || null,
      };
    }
    await browser.storage.local.remove("timer");
    await browser.storage.local.set({ [TIMERS_KEY]: map });
  }
  return map;
}

/** @param {Record<string, Timer>} timers */
export async function saveTimers(timers) {
  if (timers && Object.keys(timers).length) {
    await browser.storage.local.set({ [TIMERS_KEY]: timers });
  } else {
    await browser.storage.local.remove(TIMERS_KEY);
  }
}

// ---- Countdown / Pomodoro (single, local-only) ----
// The background script schedules the alarm/notification from this state.
/** @returns {Promise<any|null>} */
export async function loadCountdown() {
  const { countdown } = await browser.storage.local.get("countdown");
  return countdown || null;
}

/** @param {any|null} countdown */
export async function saveCountdown(countdown) {
  if (countdown) await browser.storage.local.set({ countdown });
  else await browser.storage.local.remove("countdown");
}

// ---- Reminders (per-note due dates, local-only but exported) ----
// A { noteId: { at } } map under the single "reminders" key. Local-only so it
// never bumps note.updatedAt or syncs (which would risk double-firing across
// devices); included in JSON export for backup. The background fires them.
/** @returns {Promise<Record<string, Array<{id: string, at: number}>>>} */
export async function loadReminders() {
  const { reminders } = await browser.storage.local.get("reminders");
  return reminders || {};
}

/** @param {Record<string, Array<{id: string, at: number}>>} reminders */
export async function saveReminders(reminders) {
  if (reminders && Object.keys(reminders).length) {
    await browser.storage.local.set({ reminders });
  } else {
    await browser.storage.local.remove("reminders");
  }
}

// ---- Version history (local-only) ----

/** @param {string} id @returns {Promise<any[]>} */
export async function loadHistory(id) {
  const key = HISTORY_PREFIX + id;
  const got = await browser.storage.local.get(key);
  return got[key] || [];
}

// Append a snapshot (newest last), trimming to the most recent HISTORY_LIMIT.
/** @param {string} id @param {any} snapshot */
export async function pushHistory(id, snapshot) {
  const history = await loadHistory(id);
  history.push(snapshot);
  const trimmed = history.slice(-HISTORY_LIMIT);
  await browser.storage.local.set({ [HISTORY_PREFIX + id]: trimmed });
  return trimmed;
}

// Merge imported notes into storage. A note wins over an existing one with
// the same id only if it was edited more recently. Returns counts for the UI.
/** @param {Note[]} imported @returns {Promise<{added: number, updated: number}>} */
export async function importNotes(imported) {
  const existing = await loadNotes();
  let added = 0;
  let updated = 0;
  for (const note of imported) {
    const current = existing[note.id];
    if (!current) {
      await saveNote(note);
      added++;
    } else if (note.updatedAt > current.updatedAt) {
      await saveNote(note);
      updated++;
    }
  }
  return { added, updated };
}

// ---- Transient hand-off flags (local-only) ----
// The background script drops these for the panel to act on. Kept behind the
// storage layer so the UI never touches browser.storage directly.

export async function loadQuickCapture() {
  const { quickCapture } = await browser.storage.local.get("quickCapture");
  return quickCapture || null;
}

export async function clearQuickCapture() {
  await browser.storage.local.remove("quickCapture");
}

// Read-and-consume: the flag exists only to be acted on once.
export async function takeOpenNote() {
  const { openNote } = await browser.storage.local.get("openNote");
  if (openNote) await browser.storage.local.remove("openNote");
  return openNote || null;
}

export async function clearOpenNote() {
  await browser.storage.local.remove("openNote");
}

// ---- Sync mirror status ----
// Extension-only: where storage.sync is unavailable (the web app) this reports
// an empty mirror rather than throwing.

export async function syncMirrorBytes() {
  try {
    const mirror = await browser.storage.sync.get(null);
    let bytes = 0;
    for (const [key, value] of Object.entries(mirror)) {
      bytes += key.length + JSON.stringify(value).length;
    }
    return bytes;
  } catch {
    return 0;
  }
}

export async function loadOversized() {
  const { oversized } = await browser.storage.local.get("oversized");
  return oversized || [];
}

// Raw local-storage change subscription, for state the UI mirrors directly
// (timers, countdown, reminders, hand-off flags).
/** @param {(changes: Record<string, any>) => void} callback */
export function onStorageChange(callback) {
  browser.storage.onChanged.addListener((/** @type {Record<string, any>} */ changes, /** @type {string} */ area) => {
    if (area === "local") callback(changes);
  });
}

// Notify the UI when another sidebar window (or, later, sync) changes notes.
/** @param {() => void} callback */
export function onExternalChange(callback) {
  browser.storage.onChanged.addListener((/** @type {Record<string, any>} */ changes, /** @type {string} */ area) => {
    if (area !== "local") return;
    if (
      Object.keys(changes).some(
        (key) => key.startsWith(PREFIX) || key.startsWith(FOLDER_PREFIX)
      )
    ) {
      callback();
    }
  });
}
