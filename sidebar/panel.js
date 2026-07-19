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
import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);

const ui = {
  search: $("search"),
  newNote: $("new-note"),
  listView: $("list-view"),
  noteList: $("note-list"),
  emptyHint: $("empty-hint"),
  editorView: $("editor-view"),
  back: $("back"),
  modeWrite: $("mode-write"),
  modePreview: $("mode-preview"),
  pin: $("pin"),
  copyNote: $("copy-note"),
  delete: $("delete"),
  tags: $("tags"),
  lang: $("lang"),
  glossary: $("glossary"),
  toolbar: $("toolbar"),
  glossaryHint: $("glossary-hint"),
  editor: $("editor"),
  preview: $("preview"),
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
let mode = "write";
let saveTimer = null;
let deleteArmedUntil = 0;

const SAVE_DELAY_MS = 400;
const SYNC_QUOTA_BYTES = 102400; // Firefox storage.sync total quota

const PLACEHOLDER_NOTE =
  "Type your note…\n\n**bold**  *italic*  `code`\n- list item\n# heading";
const PLACEHOLDER_GLOSSARY =
  "source term == translation\nanother term == its translation\n\nPlain lines stay plain text.";

// ---- Small helpers ----

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_PIN =
  "M8 2.4l1.7 3.4 3.8.6-2.8 2.7.7 3.8L8 11.1l-3.4 1.8.7-3.8-2.8-2.7 3.8-.6z";
const ICON_BOOK =
  "M8 4C6.8 3 5 2.7 3 3v9.5c2-.3 3.8 0 5 1 1.2-1 3-1.3 5-1V3c-2-.3-3.8 0-5 1zm0 0v9.5";

function svgIcon(pathData, filled) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  if (filled) path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function titleOf(note) {
  const firstLine = note.body.split("\n").find((line) => line.trim() !== "");
  return firstLine ? firstLine.trim().replace(/^#+\s*/, "").slice(0, 80) : "Untitled";
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
      pin.append(svgIcon(ICON_PIN, true));
      title.append(pin);
    }
    if (note.glossary) {
      const mark = document.createElement("span");
      mark.className = "note-pin";
      mark.append(svgIcon(ICON_BOOK));
      title.append(mark);
    }
    const titleText = document.createElement("span");
    titleText.className = "t-text";
    titleText.textContent = titleOf(note);
    title.append(titleText);

    const snippet = document.createElement("span");
    snippet.className = "note-snippet";
    snippet.textContent = snippetOf(note);

    const meta = document.createElement("span");
    meta.className = "note-meta";
    const time = document.createElement("span");
    time.textContent = relativeTime(note.updatedAt);
    meta.append(time);
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

// ---- Editor: modes ----

function isGlossary() {
  return Boolean(currentId && notes[currentId] && notes[currentId].glossary);
}

function setMode(next) {
  mode = next;
  const write = mode === "write";
  ui.editor.hidden = !write;
  ui.preview.hidden = write;
  ui.toolbar.hidden = !write || isGlossary();
  ui.glossaryHint.hidden =
    !write || !isGlossary() || Boolean(settings.hideGlossaryHint);
  ui.modeWrite.classList.toggle("active", write);
  ui.modePreview.classList.toggle("active", !write);
  if (write) {
    ui.editor.focus();
  } else {
    flushSave();
    renderPreview();
  }
}

function renderPreview() {
  const glossary = isGlossary();
  ui.preview.classList.toggle("md", !glossary);
  if (glossary) {
    ui.preview.textContent = "";
    renderGlossaryTable(ui.preview);
  } else {
    // Safe: renderMarkdown HTML-escapes all input before adding its own tags.
    ui.preview.innerHTML = renderMarkdown(ui.editor.value);
  }
}

// Glossary lines are "source == translation" (or tab-separated, as pasted
// from a spreadsheet). A single "=" is NOT a separator, since it appears
// in ordinary text. Lines without a separator stay plain text.
function parseGlossary(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf("==");
      const tab = line.indexOf("\t");
      let idx = -1;
      let len = 0;
      if (eq !== -1 && (tab === -1 || eq < tab)) {
        idx = eq;
        len = 2;
      } else if (tab !== -1) {
        idx = tab;
        len = 1;
      }
      if (idx === -1) return { text: line };
      return {
        term: line.slice(0, idx).trim(),
        translation: line.slice(idx + len).trim(),
      };
    });
}

function renderGlossaryTable(container) {
  const rows = parseGlossary(ui.editor.value);
  for (const row of rows) {
    const el = document.createElement("div");
    if (row.text) {
      el.className = "gloss-text";
      el.textContent = row.text;
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
    container.append(el);
  }
  if (!rows.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "One pair per line: source term == translation";
    container.append(hint);
  }
}

function renderGlossaryControls(note) {
  ui.glossary.classList.toggle("on", Boolean(note.glossary));
  ui.glossary.setAttribute("aria-pressed", String(Boolean(note.glossary)));
  ui.editor.placeholder = note.glossary ? PLACEHOLDER_GLOSSARY : PLACEHOLDER_NOTE;
}

function renderCounts() {
  const text = ui.editor.value;
  const words = text.split(/\s+/).filter(Boolean).length;
  ui.counts.textContent = `${words} words · ${text.length} chars`;
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
  ui.pin.classList.toggle("pinned", Boolean(note.pinned));
  renderGlossaryControls(note);
  showView("editor");
  ui.saveState.textContent = "";
  renderCounts();
  setMode(note.glossary && note.body.trim() ? "preview" : "write");
}

// ---- Formatting toolbar ----

function notifyEdited() {
  ui.editor.dispatchEvent(new Event("input"));
}

function applyWrap(before, after = before) {
  const el = ui.editor;
  const { selectionStart: s, selectionEnd: e, value } = el;
  const sel = value.slice(s, e) || "text";
  el.setRangeText(before + sel + after, s, e);
  el.selectionStart = s + before.length;
  el.selectionEnd = s + before.length + sel.length;
  el.focus();
  notifyEdited();
}

function applyLink() {
  const el = ui.editor;
  const { selectionStart: s, selectionEnd: e, value } = el;
  const sel = value.slice(s, e) || "link text";
  const url = "https://";
  el.setRangeText(`[${sel}](${url})`, s, e);
  const urlStart = s + 1 + sel.length + 2;
  el.selectionStart = urlStart;
  el.selectionEnd = urlStart + url.length;
  el.focus();
  notifyEdited();
}

function applyLinePrefix(transform) {
  const el = ui.editor;
  const { value } = el;
  const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
  let end = value.indexOf("\n", el.selectionEnd);
  if (end === -1) end = value.length;
  const replaced = value
    .slice(start, end)
    .split("\n")
    .map(transform)
    .join("\n");
  el.setRangeText(replaced, start, end);
  el.selectionStart = start;
  el.selectionEnd = start + replaced.length;
  el.focus();
  notifyEdited();
}

const toolbarActions = {
  bold: () => applyWrap("**"),
  italic: () => applyWrap("*"),
  strike: () => applyWrap("~~"),
  heading: () =>
    applyLinePrefix((line) =>
      line.startsWith("## ") ? line.slice(3) : `## ${line}`
    ),
  ul: () =>
    applyLinePrefix((line) =>
      line.startsWith("- ") ? line.slice(2) : `- ${line}`
    ),
  ol: () =>
    applyLinePrefix((line, i) => {
      const stripped = line.replace(/^\d+[.)]\s+/, "");
      return stripped === line ? `${i + 1}. ${line}` : stripped;
    }),
  quote: () =>
    applyLinePrefix((line) =>
      line.startsWith("> ") ? line.slice(2) : `> ${line}`
    ),
  code: () => {
    const { selectionStart: s, selectionEnd: e, value } = ui.editor;
    if (value.slice(s, e).includes("\n")) applyWrap("```\n", "\n```");
    else applyWrap("`");
  },
  link: applyLink,
};

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
  const body = ui.editor.value;
  const tags = ui.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const lang = ui.lang.value.trim();
  const dirty =
    note.body !== body ||
    note.lang !== lang ||
    JSON.stringify(note.tags || []) !== JSON.stringify(tags);
  if (!dirty) {
    ui.saveState.textContent = "";
    return;
  }
  note.body = body;
  note.tags = tags;
  note.lang = lang;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.saveState.textContent = "Saved";
}

// ---- Delete (two-step confirm, no modal) ----

function disarmDelete() {
  deleteArmedUntil = 0;
  ui.delete.classList.remove("armed");
  ui.delete.title = "Delete note";
}

async function handleDelete() {
  if (Date.now() > deleteArmedUntil) {
    deleteArmedUntil = Date.now() + 3000;
    ui.delete.classList.add("armed");
    ui.delete.title = "Click again to delete";
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
  ui.storageNote.classList.toggle("synced", Boolean(settings.syncEnabled));
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

ui.modeWrite.addEventListener("click", () => setMode("write"));
ui.modePreview.addEventListener("click", () => setMode("preview"));

ui.editor.addEventListener("input", () => {
  renderCounts();
  scheduleSave();
});
ui.tags.addEventListener("input", scheduleSave);
ui.lang.addEventListener("input", () => {
  applyLang(ui.lang.value.trim());
  scheduleSave();
});

ui.editor.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || isGlossary()) return;
  const key = event.key.toLowerCase();
  if (key === "b") {
    event.preventDefault();
    toolbarActions.bold();
  } else if (key === "i") {
    event.preventDefault();
    toolbarActions.italic();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!ui.editorView.hidden) ui.back.click();
  else if (!ui.settingsView.hidden) openList();
});

ui.toolbar.addEventListener("click", (event) => {
  const button = event.target.closest(".tool");
  if (button && toolbarActions[button.dataset.action]) {
    toolbarActions[button.dataset.action]();
  }
});

document
  .getElementById("glossary-hint-close")
  .addEventListener("click", async () => {
    settings.hideGlossaryHint = true;
    ui.glossaryHint.hidden = true;
    await saveSettings(settings);
  });

ui.glossary.addEventListener("click", async () => {
  const note = notes[currentId];
  note.glossary = !note.glossary;
  note.updatedAt = Date.now();
  await saveNote(note);
  renderGlossaryControls(note);
  setMode(mode); // refresh toolbar/hint visibility and preview content
});

ui.pin.addEventListener("click", async () => {
  const note = notes[currentId];
  note.pinned = !note.pinned;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.pin.classList.toggle("pinned", note.pinned);
});

ui.copyNote.addEventListener("click", async () => {
  await navigator.clipboard.writeText(ui.editor.value);
  ui.copyNote.classList.add("ok");
  setTimeout(() => ui.copyNote.classList.remove("ok"), 800);
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
      if (mode === "preview") renderPreview();
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
