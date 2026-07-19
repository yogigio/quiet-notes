import {
  newNote,
  loadNotes,
  saveNote,
  deleteNote,
  importNotes,
  onExternalChange,
  loadSettings,
  saveSettings,
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
  glossary: $("glossary"),
  tableToggle: $("table-toggle"),
  pin: $("pin"),
  copyNote: $("copy-note"),
  delete: $("delete"),
  tags: $("tags"),
  lang: $("lang"),
  editor: $("editor"),
  glossaryTable: $("glossary-table"),
  counts: $("counts"),
  saveState: $("save-state"),
  settingsView: $("settings-view"),
  settingsBack: $("settings-back"),
  syncToggle: $("sync-toggle"),
  quota: $("quota"),
  quotaFill: $("quota-fill"),
  quotaText: $("quota-text"),
  oversizedList: $("oversized-list"),
  exportMd: $("export-md"),
  export: $("export"),
  import: $("import"),
  importFile: $("import-file"),
  storageNote: $("storage-note"),
  settings: $("settings"),
};

let notes = {};
let settings = { syncEnabled: false };
let currentId = null;
let saveTimer = null;
let deleteArmedUntil = 0;

const SAVE_DELAY_MS = 400;
const SYNC_QUOTA_BYTES = 102400; // Firefox storage.sync total quota

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

function matchesQuery(note, query) {
  if (!query) return true;
  if (query.startsWith("#")) {
    const tag = query.slice(1);
    return (note.tags || []).some((t) => t.toLowerCase().includes(tag));
  }
  return note.body.toLowerCase().includes(query);
}

// ---- List view ----

function renderList() {
  const query = ui.search.value.trim().toLowerCase();
  const visible = sortedNotes().filter((note) => matchesQuery(note, query));

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
    if (note.glossary) {
      const mark = document.createElement("span");
      mark.className = "note-pin";
      mark.textContent = "📖";
      title.append(mark);
    }
    title.append(titleOf(note));

    const snippet = document.createElement("span");
    snippet.className = "note-snippet";
    snippet.textContent = snippetOf(note);

    const meta = document.createElement("span");
    meta.className = "note-meta";
    meta.textContent = relativeTime(note.updatedAt);
    for (const tag of (note.tags || []).slice(0, 3)) {
      const chip = document.createElement("button");
      chip.className = "tag-chip";
      chip.textContent = tag;
      chip.dataset.tag = tag;
      meta.append(chip);
    }

    item.append(title, snippet, meta);
    ui.noteList.append(item);
  }

  ui.emptyHint.hidden = Object.keys(notes).length > 0;
}

// ---- Editor view ----

function renderCounts() {
  const text = ui.editor.value;
  const words = text.split(/\s+/).filter(Boolean).length;
  ui.counts.textContent = `${words} words · ${text.length} chars`;
}

function renderGlossaryControls(note) {
  ui.glossary.textContent = note.glossary ? "📖" : "📄";
  ui.glossary.title = note.glossary ? "Glossary note (click to unmark)" : "Mark as glossary";
  ui.glossary.classList.toggle("pinned", Boolean(note.glossary));
  ui.tableToggle.hidden = !note.glossary;
  if (!note.glossary) showTable(false);
}

// Glossary lines are "source = translation" (or tab-separated). Lines
// without a separator become section headers in the table.
function parseGlossary(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.search(/[=\t]/);
      if (idx === -1) return { header: line };
      return {
        term: line.slice(0, idx).trim(),
        translation: line.slice(idx + 1).trim(),
      };
    });
}

function renderGlossaryTable() {
  ui.glossaryTable.textContent = "";
  const rows = parseGlossary(ui.editor.value);
  for (const row of rows) {
    const el = document.createElement("div");
    if (row.header) {
      el.className = "gloss-header";
      el.textContent = row.header;
    } else {
      el.className = "gloss-row";
      el.title = "Click to copy the translation";
      const term = document.createElement("span");
      term.textContent = row.term;
      const translation = document.createElement("span");
      translation.textContent = row.translation;
      el.append(term, translation);
      el.addEventListener("click", async () => {
        await navigator.clipboard.writeText(row.translation);
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 700);
      });
    }
    ui.glossaryTable.append(el);
  }
  if (!rows.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "One pair per line: source term = translation";
    ui.glossaryTable.append(hint);
  }
}

function showTable(on) {
  ui.editor.hidden = on;
  ui.glossaryTable.hidden = !on;
  ui.tableToggle.textContent = on ? "✎" : "⊞";
  ui.tableToggle.title = on ? "Edit" : "Table view";
  if (on) renderGlossaryTable();
}

function applyLang(value) {
  if (value) ui.editor.setAttribute("lang", value);
  else ui.editor.removeAttribute("lang");
}

function showView(view) {
  ui.listView.hidden = view !== "list";
  ui.editorView.hidden = view !== "editor";
  ui.settingsView.hidden = view !== "settings";
}

function openList() {
  currentId = null;
  disarmDelete();
  showView("list");
  renderList();
}

function openEditor(id) {
  currentId = id;
  const note = notes[id];
  ui.editor.value = note.body;
  ui.tags.value = (note.tags || []).join(", ");
  ui.lang.value = note.lang || "";
  applyLang(note.lang);
  ui.pin.textContent = note.pinned ? "★" : "☆";
  ui.pin.classList.toggle("pinned", note.pinned);
  renderGlossaryControls(note);
  showTable(Boolean(note.glossary));
  showView("editor");
  ui.saveState.textContent = "";
  renderCounts();
  if (!note.glossary) ui.editor.focus();
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
  note.tags = ui.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  note.lang = ui.lang.value.trim();
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

// ---- Settings ----

function renderStorageBadge() {
  ui.storageNote.textContent = settings.syncEnabled ? "synced" : "local-only";
  ui.storageNote.title = settings.syncEnabled
    ? "Notes are mirrored through Firefox Sync (end-to-end encrypted)."
    : "All notes stay in this browser. Nothing is sent anywhere.";
}

async function renderSyncStatus() {
  ui.syncToggle.checked = settings.syncEnabled;
  ui.quota.hidden = !settings.syncEnabled;
  ui.oversizedList.hidden = true;
  if (!settings.syncEnabled) return;

  const mirror = await browser.storage.sync.get(null);
  let bytes = 0;
  for (const [key, value] of Object.entries(mirror)) {
    bytes += key.length + JSON.stringify(value).length;
  }
  const percent = Math.min(100, Math.round((bytes / SYNC_QUOTA_BYTES) * 100));
  ui.quotaFill.style.width = `${percent}%`;
  ui.quotaFill.classList.toggle("full", percent > 85);
  ui.quotaText.textContent = `${(bytes / 1024).toFixed(1)} KB of 100 KB sync space used`;

  const { oversized = [] } = await browser.storage.local.get("oversized");
  const titles = oversized
    .filter((id) => notes[id])
    .map((id) => titleOf(notes[id]));
  if (titles.length) {
    ui.oversizedList.textContent = `Too large to sync (kept local): ${titles.join(", ")}`;
    ui.oversizedList.hidden = false;
  }
}

function openSettings() {
  currentId = null;
  showView("settings");
  renderSyncStatus();
}

// ---- Export / import ----

function download(content, type, filename) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportAll() {
  const payload = {
    app: "quiet-notes",
    format: 1,
    exportedAt: new Date().toISOString(),
    notes: sortedNotes(),
  };
  download(
    JSON.stringify(payload, null, 2),
    "application/json",
    `quiet-notes-${new Date().toISOString().slice(0, 10)}.json`
  );
}

function exportMarkdown() {
  const parts = sortedNotes().map((note) => {
    const trimmed = note.body.trim();
    const newline = trimmed.indexOf("\n");
    const rest = newline === -1 ? "" : trimmed.slice(newline + 1).trim();
    const lines = [`# ${titleOf(note)}`];
    if (note.tags && note.tags.length) lines.push(`Tags: ${note.tags.join(", ")}`);
    if (rest) lines.push(rest);
    return lines.join("\n\n");
  });
  download(
    parts.join("\n\n---\n\n") + "\n",
    "text/markdown",
    `quiet-notes-${new Date().toISOString().slice(0, 10)}.md`
  );
}

async function importFromFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.notes)) throw new Error("no notes array");
    const { added, updated } = await importNotes(payload.notes);
    notes = await loadNotes();
    renderList();
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
  const chip = event.target.closest(".tag-chip");
  if (chip) {
    ui.search.value = `#${chip.dataset.tag}`;
    renderList();
    return;
  }
  const item = event.target.closest("li");
  if (item) openEditor(item.dataset.id);
});

ui.search.addEventListener("input", renderList);

ui.back.addEventListener("click", async () => {
  await flushSave();
  openList();
});
ui.settingsBack.addEventListener("click", openList);

ui.editor.addEventListener("input", () => {
  renderCounts();
  scheduleSave();
});
ui.tags.addEventListener("input", scheduleSave);
ui.lang.addEventListener("input", () => {
  applyLang(ui.lang.value.trim());
  scheduleSave();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!ui.editorView.hidden) ui.back.click();
  else if (!ui.settingsView.hidden) openList();
});

ui.glossary.addEventListener("click", async () => {
  const note = notes[currentId];
  note.glossary = !note.glossary;
  note.updatedAt = Date.now();
  await saveNote(note);
  renderGlossaryControls(note);
});

ui.tableToggle.addEventListener("click", async () => {
  const showingTable = ui.editor.hidden;
  if (!showingTable) await flushSave();
  showTable(!showingTable);
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

ui.settings.addEventListener("click", openSettings);

ui.syncToggle.addEventListener("change", async () => {
  settings.syncEnabled = ui.syncToggle.checked;
  await saveSettings(settings);
  renderStorageBadge();
  // Give the background's fullSync a moment before measuring the mirror.
  setTimeout(renderSyncStatus, 1500);
});

ui.exportMd.addEventListener("click", exportMarkdown);
ui.export.addEventListener("click", exportAll);
ui.import.addEventListener("click", () => ui.importFile.click());
ui.importFile.addEventListener("change", () => {
  if (ui.importFile.files[0]) importFromFile(ui.importFile.files[0]);
  ui.importFile.value = "";
});

// Flush pending edits if the sidebar loses focus mid-typing.
window.addEventListener("blur", flushSave);

onExternalChange(async () => {
  notes = await loadNotes();
  if (currentId && !notes[currentId]) {
    openList();
  } else if (currentId) {
    // Refresh the open note (e.g., sync pulled a newer version) unless the
    // user is actively typing in it.
    const note = notes[currentId];
    if (document.activeElement !== ui.editor && ui.editor.value !== note.body) {
      ui.editor.value = note.body;
      renderCounts();
      if (!ui.glossaryTable.hidden) renderGlossaryTable();
    }
  } else if (!ui.listView.hidden) {
    renderList();
  }
});

// ---- Init ----

(async function init() {
  [notes, settings] = await Promise.all([loadNotes(), loadSettings()]);
  renderStorageBadge();
  openList();
})();
