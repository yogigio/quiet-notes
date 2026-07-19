// Persistence layer. Every note lives in browser.storage.local under its own
// key ("note:<id>") so a future sync mirror can copy notes individually
// without touching unrelated data. storage.local never leaves this machine.

const PREFIX = "note:";

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
  await browser.storage.local.remove(PREFIX + id);
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
    if (Object.keys(changes).some((key) => key.startsWith(PREFIX))) callback();
  });
}
