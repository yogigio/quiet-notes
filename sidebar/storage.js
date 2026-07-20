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

export async function loadFolders() {
  const everything = await browser.storage.local.get(null);
  const folders = {};
  for (const [key, value] of Object.entries(everything)) {
    if (key.startsWith(FOLDER_PREFIX)) folders[value.id] = value;
  }
  return folders;
}

export async function saveFolder(folder) {
  await browser.storage.local.set({ [FOLDER_PREFIX + folder.id]: folder });
}

export async function deleteFolder(id) {
  await browser.storage.local.remove(FOLDER_PREFIX + id);
}

export async function loadSettings() {
  const { settings } = await browser.storage.local.get("settings");
  return settings || { syncEnabled: false };
}

export async function saveSettings(settings) {
  await browser.storage.local.set({ settings });
}

export async function loadNotes() {
  const everything = await browser.storage.local.get(null);
  const notes = {};
  for (const [key, value] of Object.entries(everything)) {
    if (key.startsWith(PREFIX)) notes[value.id] = value;
  }
  return notes;
}

export async function saveNote(note) {
  await browser.storage.local.set({ [PREFIX + note.id]: note });
}

export async function deleteNote(id) {
  await browser.storage.local.remove([PREFIX + id, HISTORY_PREFIX + id]);
}

// ---- Version history (local-only) ----

export async function loadHistory(id) {
  const key = HISTORY_PREFIX + id;
  const got = await browser.storage.local.get(key);
  return got[key] || [];
}

// Append a snapshot (newest last), trimming to the most recent HISTORY_LIMIT.
export async function pushHistory(id, snapshot) {
  const history = await loadHistory(id);
  history.push(snapshot);
  const trimmed = history.slice(-HISTORY_LIMIT);
  await browser.storage.local.set({ [HISTORY_PREFIX + id]: trimmed });
  return trimmed;
}

// Merge imported notes into storage. A note wins over an existing one with
// the same id only if it was edited more recently. Returns counts for the UI.
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

// Notify the UI when another sidebar window (or, later, sync) changes notes.
export function onExternalChange(callback) {
  browser.storage.onChanged.addListener((changes, area) => {
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
