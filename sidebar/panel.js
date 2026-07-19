import {
  newNote,
  loadNotes,
  saveNote,
  deleteNote,
  importNotes,
  onExternalChange,
} from "./storage.js";

const $ = (id) => document.getElementById(id);

const ui = {
  search: $("search"),
  newNote: $("new-note"),
  listView: $("list-view"),
  noteList: $("note-list"),
  emptyHint: $("empty-hint"),
  editorView: $("editor-view"),
  back: $("back"),
  pin: $("pin"),
  copyNote: $("copy-note"),
  delete: $("delete"),
  editor: $("editor"),
  counts: $("counts"),
  saveState: $("save-state"),
  export: $("export"),
  import: $("import"),
  importFile: $("import-file"),
};

let notes = {};
let currentId = null;
let saveTimer = null;
let deleteArmedUntil = 0;

const SAVE_DELAY_MS = 400;

// ---- Helpers ----

function titleOf(note) {
  const firstLine = note.body.split("\n").find((line) => line.trim() !== "");
  return firstLine ? firstLine.trim().slice(0, 80) : "Untitled";
}

function snippetOf(note) {
  const lines = note.body.split("\n").filter((line) => line.trim() !== "");
  return lines.length > 1 ? lines[1].trim().slice(0, 100) : "";
}

function relativeTime(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function sortedNotes() {
  return Object.values(notes).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

// ---- Rendering ----

function renderList() {
  const query = ui.search.value.trim().toLowerCase();
  const visible = sortedNotes().filter(
    (note) => !query || note.body.toLowerCase().includes(query)
  );

  ui.noteList.textContent = "";
  for (const note of visible) {
    const item = document.createElement("li");
    item.dataset.id = note.id;

    const title = document.createElement("span");
    title.className = "note-title";
    if (note.pinned) {
      const pin = document.createElement("span");
      pin.className = "note-pin";
      pin.textContent = "★";
      title.append(pin);
    }
    title.append(titleOf(note));

    const snippet = document.createElement("span");
    snippet.className = "note-snippet";
    snippet.textContent = snippetOf(note);

    const meta = document.createElement("span");
    meta.className = "note-meta";
    meta.textContent = relativeTime(note.updatedAt);

    item.append(title, snippet, meta);
    ui.noteList.append(item);
  }

  ui.emptyHint.hidden = Object.keys(notes).length > 0;
}

function renderCounts() {
  const text = ui.editor.value;
  const words = text.split(/\s+/).filter(Boolean).length;
  ui.counts.textContent = `${words} words · ${text.length} chars`;
}

function openList() {
  currentId = null;
  ui.editorView.hidden = true;
  ui.listView.hidden = false;
  disarmDelete();
  renderList();
}

function openEditor(id) {
  currentId = id;
  const note = notes[id];
  ui.editor.value = note.body;
  ui.pin.textContent = note.pinned ? "★" : "☆";
  ui.pin.classList.toggle("pinned", note.pinned);
  ui.listView.hidden = true;
  ui.editorView.hidden = false;
  ui.saveState.textContent = "";
  renderCounts();
  ui.editor.focus();
}

// ---- Saving ----

function scheduleSave() {
  ui.saveState.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
}

async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!currentId) return;
  const note = notes[currentId];
  note.body = ui.editor.value;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.saveState.textContent = "Saved";
}

// ---- Delete (two-step confirm, no modal) ----

function disarmDelete() {
  deleteArmedUntil = 0;
  ui.delete.textContent = "🗑";
  ui.delete.title = "Delete note";
}

async function handleDelete() {
  if (Date.now() > deleteArmedUntil) {
    deleteArmedUntil = Date.now() + 3000;
    ui.delete.textContent = "Sure?";
    setTimeout(() => {
      if (Date.now() > deleteArmedUntil) disarmDelete();
    }, 3200);
    return;
  }
  const id = currentId;
  disarmDelete();
  clearTimeout(saveTimer);
  currentId = null;
  delete notes[id];
  await deleteNote(id);
  openList();
}

// ---- Export / import ----

function exportAll() {
  const payload = {
    app: "quiet-notes",
    format: 1,
    exportedAt: new Date().toISOString(),
    notes: sortedNotes(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `quiet-notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importFromFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.notes)) throw new Error("no notes array");
    const { added, updated } = await importNotes(payload.notes);
    notes = await loadNotes();
    renderList();
    ui.saveState.textContent = "";
    ui.emptyHint.hidden = true;
    ui.import.textContent = `+${added} / ~${updated}`;
  } catch {
    ui.import.textContent = "Invalid file";
  }
  setTimeout(() => (ui.import.textContent = "Import"), 2500);
}

// ---- Events ----

ui.newNote.addEventListener("click", async () => {
  const note = newNote();
  notes[note.id] = note;
  await saveNote(note);
  openEditor(note.id);
});

ui.noteList.addEventListener("click", (event) => {
  const item = event.target.closest("li");
  if (item) openEditor(item.dataset.id);
});

ui.search.addEventListener("input", renderList);

ui.back.addEventListener("click", async () => {
  await flushSave();
  openList();
});

ui.editor.addEventListener("input", () => {
  renderCounts();
  scheduleSave();
});

ui.editor.addEventListener("keydown", (event) => {
  if (event.key === "Escape") ui.back.click();
});

ui.pin.addEventListener("click", async () => {
  const note = notes[currentId];
  note.pinned = !note.pinned;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.pin.textContent = note.pinned ? "★" : "☆";
  ui.pin.classList.toggle("pinned", note.pinned);
});

ui.copyNote.addEventListener("click", async () => {
  await navigator.clipboard.writeText(ui.editor.value);
  ui.copyNote.textContent = "✓";
  setTimeout(() => (ui.copyNote.textContent = "⧉"), 1200);
});

ui.delete.addEventListener("click", handleDelete);

ui.export.addEventListener("click", exportAll);
ui.import.addEventListener("click", () => ui.importFile.click());
ui.importFile.addEventListener("change", () => {
  if (ui.importFile.files[0]) importFromFile(ui.importFile.files[0]);
  ui.importFile.value = "";
});

// Flush pending edits if the sidebar is closed mid-typing.
window.addEventListener("blur", flushSave);

onExternalChange(async () => {
  notes = await loadNotes();
  if (currentId && !notes[currentId]) {
    openList();
  } else if (!currentId) {
    renderList();
  }
});

// ---- Init ----

(async function init() {
  notes = await loadNotes();
  openList();
})();
