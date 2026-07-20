import {
  newNote,
  loadNotes,
  saveNote,
  deleteNote,
  importNotes,
  onExternalChange,
  loadSettings,
  saveSettings,
  loadHistory,
  pushHistory,
  newFolder,
  loadFolders,
  saveFolder,
  deleteFolder,
} from "./storage.js";
import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);

const ui = {
  topbar: $("topbar"),
  search: $("search"),
  newNote: $("new-note"),
  newMenu: $("new-menu"),
  listView: $("list-view"),
  folderSection: $("folder-section"),
  noteList: $("note-list"),
  emptyHint: $("empty-hint"),
  editorView: $("editor-view"),
  back: $("back"),
  modeWrite: $("mode-write"),
  modePreview: $("mode-preview"),
  findToggle: $("find-toggle"),
  historyBtn: $("history-btn"),
  pin: $("pin"),
  delete: $("delete"),
  more: $("more"),
  moreMenu: $("more-menu"),
  menuCopy: $("menu-copy"),
  menuDuplicate: $("menu-duplicate"),
  menuPrint: $("menu-print"),
  menuTemplate: $("menu-template"),
  menuSite: $("menu-site"),
  findBar: $("find-bar"),
  findInput: $("find-input"),
  findCount: $("find-count"),
  findPrev: $("find-prev"),
  findNext: $("find-next"),
  findClose: $("find-close"),
  historyPanel: $("history-panel"),
  historyClose: $("history-close"),
  historyList: $("history-list"),
  tags: $("tags"),
  lang: $("lang"),
  glossary: $("glossary"),
  toolbar: $("toolbar"),
  glossaryHint: $("glossary-hint"),
  editorWrap: $("editor-wrap"),
  findHighlight: $("find-highlight"),
  editor: $("editor"),
  preview: $("preview"),
  scrollNav: $("scroll-nav"),
  scrollTop: $("scroll-top"),
  scrollBottom: $("scroll-bottom"),
  counts: $("counts"),
  saveState: $("save-state"),
  settingsView: $("settings-view"),
  settingsBack: $("settings-back"),
  syncToggle: $("sync-toggle"),
  quota: $("quota"),
  quotaFill: $("quota-fill"),
  quotaText: $("quota-text"),
  oversizedList: $("oversized-list"),
  siteToggle: $("site-toggle"),
  fontSize: $("font-size"),
  monoToggle: $("mono-toggle"),
  trashList: $("trash-list"),
  emptyTrash: $("empty-trash"),
  undoToast: $("undo-toast"),
  undoBtn: $("undo-btn"),
  menuFolder: $("menu-folder"),
  folderEdit: $("folder-edit"),
  folderEditTitle: $("folder-edit-title"),
  folderName: $("folder-name"),
  folderEmojiGrid: $("folder-emoji-grid"),
  folderColorRow: $("folder-color-row"),
  folderDelete: $("folder-delete"),
  folderCancel: $("folder-cancel"),
  folderSave: $("folder-save"),
  folderPicker: $("folder-picker"),
  folderPickerList: $("folder-picker-list"),
  folderPickerCancel: $("folder-picker-cancel"),
  exportMd: $("export-md"),
  importText: $("import-text"),
  importTextFile: $("import-text-file"),
  importTextStatus: $("import-text-status"),
  export: $("export"),
  import: $("import"),
  importFile: $("import-file"),
  storageNote: $("storage-note"),
  settings: $("settings"),
};

let notes = {};
let folders = {};
let currentFolderId = null; // null = Home
let editingFolderId = null; // folder being edited in the sheet (null = new)
let draftIcon = "📁";
let draftColor = "blue";
let settings = { syncEnabled: false };
let currentId = null;
let mode = "write";
let saveTimer = null;
let deleteArmedUntil = 0;
let lastTrashedId = null;
let toastTimer = null;
let sitePermission = false;
let currentHost = "";
let siteTrackingStarted = false;
let currentHistory = [];
let lastSnapshotAt = 0;
let findMatches = [];
let findIndex = -1;
let quickCaptureHandled = 0;

const SAVE_DELAY_MS = 400;
const SYNC_QUOTA_BYTES = 102400; // Firefox storage.sync total quota
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FONT_SIZES = { s: "13px", m: "14.5px", l: "16.5px" };

// Curated modern palette (readable on light and dark as an accent/dot).
const FOLDER_COLORS = {
  gray: "#6b7280",
  red: "#e5484d",
  orange: "#f76b15",
  amber: "#f5a623",
  green: "#30a46c",
  teal: "#12a594",
  blue: "#3e63dd",
  cyan: "#05a2c2",
  violet: "#6e56cf",
  pink: "#d6409f",
};
const FOLDER_EMOJI = [
  "📁", "📂", "🗂️", "⭐", "📌", "💼", "📚", "📖",
  "📝", "🌐", "⚖️", "🗣️", "✏️", "🔖", "🧾", "💡",
  "🇩🇪", "🇬🇧", "🇺🇸", "🇫🇷", "🇪🇸", "🇮🇹", "🇷🇺", "🇬🇪",
];
const colorHex = (key) => FOLDER_COLORS[key] || FOLDER_COLORS.blue;
// Don't snapshot on every keystroke: keep the version the note had when
// opened, then at most one snapshot per this interval while editing.
const SNAPSHOT_MIN_GAP_MS = 2 * 60 * 1000;

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
const ICON_TPL =
  "M5.5 5.5h7v7h-7z M3 10.5V4.5A1.5 1.5 0 0 1 4.5 3H10";
const ICON_CHEVRON = "M6.5 3.5 11 8l-4.5 4.5";
const ICON_BACK = "M10 3.5 5.5 8l4.5 4.5";

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
  return Object.values(notes)
    .filter((note) => !note.deletedAt)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

function trashedNotes() {
  return Object.values(notes)
    .filter((note) => note.deletedAt)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

function templateNotes() {
  return sortedNotes().filter((note) => note.template);
}

function matchesQuery(note, query) {
  if (!query) return true;
  if (query.startsWith("#")) {
    const tag = query.slice(1);
    return (note.tags || []).some((t) => t.toLowerCase().includes(tag));
  }
  return (
    note.body.toLowerCase().includes(query) ||
    (note.site || "").includes(query)
  );
}

// ---- Site notes (optional "tabs" permission, hostname only) ----

function hostOf(url) {
  if (!/^https?:/.test(url || "")) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function refreshHost() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const host = hostOf(tab && tab.url);
    if (host !== currentHost) {
      currentHost = host;
      if (!ui.listView.hidden) renderList();
    }
  } catch {
    currentHost = "";
  }
}

function startSiteTracking() {
  if (siteTrackingStarted) return;
  siteTrackingStarted = true;
  refreshHost();
  browser.tabs.onActivated.addListener(refreshHost);
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.url || info.status === "complete") refreshHost();
  });
}

// ---- Folders ----

function folderNoteCount(id) {
  return Object.values(notes).filter(
    (note) => !note.deletedAt && note.folderId === id
  ).length;
}

function sortedFolders() {
  return Object.values(folders).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );
}

function openFolder(id) {
  currentFolderId = id;
  ui.search.value = "";
  renderList();
}

function goHome() {
  currentFolderId = null;
  ui.search.value = "";
  renderList();
}

// Home: a "Folders" section listing folders. Inside a folder: a colored
// header with a back button. Hidden while searching on Home (search spans
// all notes).
function renderFolderSection() {
  ui.folderSection.textContent = "";
  const query = ui.search.value.trim();

  if (currentFolderId) {
    const folder = folders[currentFolderId];
    if (!folder) {
      currentFolderId = null;
      return renderFolderSection();
    }
    ui.folderSection.hidden = false;
    const bar = document.createElement("div");
    bar.className = "folder-bar";
    bar.style.setProperty("--fc", colorHex(folder.color));

    const back = document.createElement("button");
    back.className = "icon-btn";
    back.title = "Back to all notes";
    back.append(svgIcon(ICON_BACK));
    back.addEventListener("click", goHome);

    const accent = document.createElement("span");
    accent.className = "folder-bar-accent";
    const emoji = document.createElement("span");
    emoji.className = "folder-emoji";
    emoji.textContent = folder.icon || "📁";
    const title = document.createElement("span");
    title.className = "folder-title";
    title.textContent = folder.name || "Untitled folder";

    const edit = document.createElement("button");
    edit.className = "icon-btn";
    edit.title = "Edit folder";
    edit.textContent = "✎";
    edit.addEventListener("click", () => openFolderEdit(folder.id));

    bar.append(back, accent, emoji, title, edit);
    ui.folderSection.append(bar);
    return;
  }

  if (query) {
    ui.folderSection.hidden = true;
    return;
  }
  ui.folderSection.hidden = false;

  const head = document.createElement("div");
  head.className = "folder-head";
  head.append(document.createTextNode("Folders"));
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  const add = document.createElement("button");
  add.className = "folder-add";
  add.textContent = "+ New";
  add.title = "New folder";
  add.addEventListener("click", () => openFolderEdit(null));
  head.append(spacer, add);
  ui.folderSection.append(head);

  for (const folder of sortedFolders()) {
    const row = document.createElement("div");
    row.className = "folder-row";
    row.style.setProperty("--fc", colorHex(folder.color));
    row.addEventListener("click", () => openFolder(folder.id));

    const emoji = document.createElement("span");
    emoji.className = "folder-emoji";
    emoji.textContent = folder.icon || "📁";
    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = folder.name || "Untitled folder";
    const count = document.createElement("span");
    count.className = "folder-count";
    count.textContent = String(folderNoteCount(folder.id));
    const chevron = document.createElement("span");
    chevron.className = "folder-chevron";
    chevron.append(svgIcon(ICON_CHEVRON));

    row.append(emoji, name, count, chevron);
    ui.folderSection.append(row);
  }
}

// ---- List view ----

function renderList() {
  renderFolderSection();
  const query = ui.search.value.trim().toLowerCase();
  const visible = sortedNotes().filter(
    (note) =>
      (currentFolderId ? note.folderId === currentFolderId : true) &&
      matchesQuery(note, query)
  );

  ui.noteList.textContent = "";
  const siteGroup =
    !currentFolderId && sitePermission && currentHost
      ? visible.filter((note) => note.site === currentHost)
      : [];
  if (siteGroup.length) {
    appendGroupLabel(`On ${currentHost}`);
    for (const note of siteGroup) appendCard(note);
    appendGroupLabel("All notes");
    for (const note of visible) {
      if (note.site !== currentHost) appendCard(note);
    }
  } else {
    for (const note of visible) appendCard(note);
  }

  if (!visible.length && currentFolderId) {
    const p = document.createElement("p");
    p.className = "hint folder-empty";
    p.textContent = "No notes in this folder yet.";
    ui.noteList.append(p);
  }
  ui.emptyHint.hidden = sortedNotes().length > 0;
}

function appendGroupLabel(text) {
  const label = document.createElement("li");
  label.className = "group-label";
  label.textContent = text;
  ui.noteList.append(label);
}

function appendCard(note) {
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
  if (note.template) {
    const mark = document.createElement("span");
    mark.className = "note-pin";
    mark.title = "Template";
    mark.append(svgIcon(ICON_TPL));
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
  if (!currentFolderId && note.folderId && folders[note.folderId]) {
    const folder = folders[note.folderId];
    const chip = document.createElement("span");
    chip.className = "folder-chip";
    chip.style.setProperty("--fc", colorHex(folder.color));
    chip.textContent = `${folder.icon || "📁"} ${folder.name || "Folder"}`;
    meta.append(chip);
  }
  for (const tag of (note.tags || []).slice(0, 3)) {
    const chip = document.createElement("button");
    chip.className = "tag-chip";
    chip.textContent = tag;
    chip.dataset.tag = tag;
    meta.append(chip);
  }
  if (note.site) {
    const chip = document.createElement("button");
    chip.className = "tag-chip site-chip";
    chip.textContent = note.site;
    chip.dataset.site = note.site;
    meta.append(chip);
  }

  item.append(title, snippet, meta);
  ui.noteList.append(item);
}

// ---- Editor: modes ----

function isGlossary() {
  return Boolean(currentId && notes[currentId] && notes[currentId].glossary);
}

function setMode(next) {
  // Find operates on the textarea, so leave it when switching to Preview.
  if (next === "preview" && !ui.findBar.hidden) closeFind();
  mode = next;
  const write = mode === "write";
  ui.editorWrap.hidden = !write;
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
  updateScrollNav();
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
  renderBacklinks();
}

// Show which other notes link to this one via [[title]]. Built with DOM
// nodes (textContent) so note titles never flow into innerHTML.
function renderBacklinks() {
  const note = notes[currentId];
  if (!note) return;
  const title = titleOf(note);
  const linkers = Object.values(notes).filter(
    (other) =>
      other.id !== currentId &&
      !other.deletedAt &&
      hasWikiLinkTo(other.body, title)
  );
  if (!linkers.length) return;

  const section = document.createElement("div");
  section.className = "backlinks";
  const heading = document.createElement("div");
  heading.className = "backlinks-title";
  heading.textContent = `Linked from ${linkers.length} note${linkers.length > 1 ? "s" : ""}`;
  section.append(heading);
  for (const linker of linkers) {
    const row = document.createElement("button");
    row.className = "backlink";
    row.dataset.id = linker.id;
    row.textContent = titleOf(linker);
    section.append(row);
  }
  ui.preview.append(section);
}

function hasWikiLinkTo(body, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, "i").test(body);
}

async function openByTitle(title) {
  const wanted = title.trim().toLowerCase();
  const match = Object.values(notes).find(
    (note) => !note.deletedAt && titleOf(note).toLowerCase() === wanted
  );
  if (match) {
    await openEditor(match.id);
  } else {
    // Follow a link to a note that doesn't exist yet by creating it.
    const note = newNote();
    note.body = title.trim();
    notes[note.id] = note;
    await saveNote(note);
    await openEditor(note.id);
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

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function renderCounts() {
  const { selectionStart: s, selectionEnd: e, value } = ui.editor;
  const selected = e > s ? value.slice(s, e) : "";
  if (selected && !ui.editorWrap.hidden) {
    ui.counts.textContent = `${wordCount(selected)} words · ${selected.length} chars selected`;
  } else {
    ui.counts.textContent = `${wordCount(value)} words · ${value.length} chars`;
  }
}

function applyLang(value) {
  if (value) ui.editor.setAttribute("lang", value);
  else ui.editor.removeAttribute("lang");
}

function showView(view) {
  // The search bar only filters the list, so it only exists there.
  ui.topbar.hidden = view !== "list";
  ui.listView.hidden = view !== "list";
  ui.editorView.hidden = view !== "editor";
  ui.settingsView.hidden = view !== "settings";
  closeMenus();
}

function closeMenus() {
  ui.newMenu.hidden = true;
  ui.moreMenu.hidden = true;
}

function openList() {
  currentId = null;
  disarmDelete();
  closeFind();
  ui.historyPanel.hidden = true;
  showView("list");
  renderList();
}

async function openEditor(id) {
  currentId = id;
  const note = notes[id];
  ui.editor.value = note.body;
  ui.tags.value = (note.tags || []).join(", ");
  ui.lang.value = note.lang || "";
  applyLang(note.lang);
  ui.pin.classList.toggle("pinned", Boolean(note.pinned));
  ui.menuTemplate.textContent = note.template
    ? "Stop using as template"
    : "Use as template";
  refreshFolderMenuItem();
  renderGlossaryControls(note);
  closeFind();
  ui.historyPanel.hidden = true;
  lastSnapshotAt = 0;
  currentHistory = await loadHistory(id);
  showView("editor");
  ui.saveState.textContent = "";
  renderCounts();
  setMode(note.glossary && note.body.trim() ? "preview" : "write");
}

async function createNote(template) {
  const note = newNote();
  if (template) {
    note.body = template.body;
    note.tags = [...(template.tags || [])];
    note.lang = template.lang || "";
    note.glossary = Boolean(template.glossary);
    if (template.folderId) note.folderId = template.folderId;
  }
  // A new note started while inside a folder is filed there.
  if (!note.folderId && currentFolderId) note.folderId = currentFolderId;
  notes[note.id] = note;
  await saveNote(note);
  await openEditor(note.id);
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

// If `line` begins a list item, describe its marker: how many characters
// the marker occupies and what the next item's marker should be. Task
// items always continue unchecked; numbered items increment.
function listMarker(line) {
  let m = line.match(/^(\s*)- \[[ xX]\]\s/);
  if (m) return { length: m[0].length, next: `${m[1]}- [ ] ` };
  m = line.match(/^(\s*)([-*])\s/);
  if (m) return { length: m[0].length, next: `${m[1]}${m[2]} ` };
  m = line.match(/^(\s*)(\d+)([.)])\s/);
  if (m) return { length: m[0].length, next: `${m[1]}${Number(m[2]) + 1}${m[3]} ` };
  return null;
}

// Enter inside a list item continues the list; Enter on an empty item ends
// it. Returns true if it handled the key.
function handleListEnter() {
  const el = ui.editor;
  if (el.selectionStart !== el.selectionEnd) return false; // let ranges be default
  const pos = el.selectionStart;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);

  const marker = listMarker(line);
  if (!marker) return false;

  if (line.slice(marker.length).trim() === "") {
    // Empty item: remove the marker and end the list.
    el.setRangeText("", lineStart, lineEnd, "end");
  } else {
    // Continue: split at the caret and prefix the new line.
    el.setRangeText("\n" + marker.next, pos, pos, "end");
  }
  notifyEdited();
  return true;
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
  task: () =>
    applyLinePrefix((line) => {
      const done = line.match(/^- \[[ xX]\]\s+(.*)$/);
      if (done) return done[1]; // already a task → back to plain text
      const bullet = line.match(/^- (.*)$/);
      return `- [ ] ${bullet ? bullet[1] : line}`;
    }),
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
  await maybeSnapshot(note);
  note.body = body;
  note.tags = tags;
  note.lang = lang;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.saveState.textContent = "Saved";
}

// Record the note's state *before* this save into version history — the
// first edit after opening always snapshots, then at most one snapshot per
// SNAPSHOT_MIN_GAP_MS so a long editing session leaves a few useful points
// rather than hundreds. Empty notes aren't worth snapshotting.
async function maybeSnapshot(note) {
  const now = Date.now();
  if (lastSnapshotAt && now - lastSnapshotAt < SNAPSHOT_MIN_GAP_MS) return;
  if (!note.body.trim()) {
    lastSnapshotAt = now;
    return;
  }
  lastSnapshotAt = now;
  currentHistory = await pushHistory(note.id, {
    body: note.body,
    tags: [...(note.tags || [])],
    lang: note.lang || "",
    glossary: Boolean(note.glossary),
    at: note.updatedAt,
  });
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
    ui.delete.title = "Click again to move to trash";
    setTimeout(() => {
      if (Date.now() > deleteArmedUntil) disarmDelete();
    }, 3200);
    return;
  }
  const id = currentId;
  disarmDelete();
  clearTimeout(saveTimer);
  currentId = null;
  // Soft delete: the note keeps syncing as a regular update and can be
  // restored from the trash for 30 days. Real removal happens on purge.
  const note = notes[id];
  note.deletedAt = Date.now();
  note.updatedAt = Date.now();
  await saveNote(note);
  openList();
  showUndoToast(id);
}

function showUndoToast(id) {
  lastTrashedId = id;
  ui.undoToast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.undoToast.hidden = true), 6000);
}

async function undoTrash() {
  ui.undoToast.hidden = true;
  clearTimeout(toastTimer);
  const note = notes[lastTrashedId];
  if (!note) return;
  delete note.deletedAt;
  note.updatedAt = Date.now();
  await saveNote(note);
  renderList();
}

async function purgeNote(id) {
  delete notes[id];
  await deleteNote(id);
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

function applyEditorPrefs() {
  document.documentElement.style.setProperty(
    "--note-font",
    FONT_SIZES[settings.fontSize] || FONT_SIZES.m
  );
  document.body.classList.toggle("mono", Boolean(settings.mono));
}

function renderTrash() {
  const trashed = trashedNotes();
  ui.trashList.textContent = "";
  ui.emptyTrash.hidden = trashed.length === 0;
  if (!trashed.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Trash is empty.";
    ui.trashList.append(empty);
    return;
  }
  for (const note of trashed) {
    const row = document.createElement("div");
    row.className = "trash-row";
    const title = document.createElement("span");
    title.className = "t";
    title.textContent = titleOf(note);
    title.title = titleOf(note);
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = relativeTime(note.deletedAt);
    const restore = document.createElement("button");
    restore.textContent = "Restore";
    restore.addEventListener("click", async () => {
      delete note.deletedAt;
      note.updatedAt = Date.now();
      await saveNote(note);
      renderTrash();
    });
    const purge = document.createElement("button");
    purge.textContent = "✕";
    purge.title = "Delete forever";
    purge.className = "danger";
    purge.addEventListener("click", async () => {
      await purgeNote(note.id);
      renderTrash();
    });
    row.append(title, when, restore, purge);
    ui.trashList.append(row);
  }
}

function renderSettingsControls() {
  ui.fontSize.value = settings.fontSize || "m";
  ui.monoToggle.checked = Boolean(settings.mono);
  ui.siteToggle.checked = sitePermission;
}

function openSettings() {
  currentId = null;
  showView("settings");
  renderSettingsControls();
  renderSyncStatus();
  renderTrash();
}

// ---- Folder create / edit / move ----

let pendingMoveNoteId = null;
let folderDeleteArmed = 0;

function buildFolderControls() {
  ui.folderEmojiGrid.textContent = "";
  for (const emoji of FOLDER_EMOJI) {
    const b = document.createElement("button");
    b.textContent = emoji;
    b.dataset.emoji = emoji;
    b.addEventListener("click", () => {
      draftIcon = emoji;
      markFolderControlSelection();
    });
    ui.folderEmojiGrid.append(b);
  }
  ui.folderColorRow.textContent = "";
  for (const key of Object.keys(FOLDER_COLORS)) {
    const b = document.createElement("button");
    b.dataset.color = key;
    b.title = key;
    b.style.setProperty("--sw", FOLDER_COLORS[key]);
    b.addEventListener("click", () => {
      draftColor = key;
      markFolderControlSelection();
    });
    ui.folderColorRow.append(b);
  }
}

function markFolderControlSelection() {
  for (const c of ui.folderEmojiGrid.children) {
    c.classList.toggle("sel", c.dataset.emoji === draftIcon);
  }
  for (const c of ui.folderColorRow.children) {
    c.classList.toggle("sel", c.dataset.color === draftColor);
  }
}

function openFolderEdit(id) {
  editingFolderId = id;
  closeMenus();
  const folder = id ? folders[id] : null;
  draftIcon = folder ? folder.icon || "📁" : "📁";
  draftColor = folder ? folder.color || "blue" : "blue";
  ui.folderName.value = folder ? folder.name || "" : "";
  ui.folderEditTitle.textContent = folder ? "Edit folder" : "New folder";
  ui.folderDelete.hidden = !folder;
  ui.folderDelete.textContent = "Delete";
  folderDeleteArmed = 0;
  markFolderControlSelection();
  ui.folderEdit.hidden = false;
  ui.folderName.focus();
}

function closeFolderEdit() {
  ui.folderEdit.hidden = true;
  pendingMoveNoteId = null;
}

async function saveFolderFromSheet() {
  const name = ui.folderName.value.trim();
  let folder;
  const isNew = !(editingFolderId && folders[editingFolderId]);
  if (isNew) {
    folder = newFolder();
    folders[folder.id] = folder;
  } else {
    folder = folders[editingFolderId];
  }
  folder.name = name || "Untitled folder";
  folder.icon = draftIcon;
  folder.color = draftColor;
  folder.updatedAt = Date.now();
  await saveFolder(folder);

  // Created via "New folder…" in the move picker: file the note here.
  if (isNew && pendingMoveNoteId && notes[pendingMoveNoteId]) {
    const note = notes[pendingMoveNoteId];
    note.folderId = folder.id;
    note.updatedAt = Date.now();
    await saveNote(note);
    refreshFolderMenuItem();
  }
  closeFolderEdit();
  renderList();
}

async function deleteFolderFromSheet() {
  const id = editingFolderId;
  if (!id) return;
  // Unfile the folder's notes so nothing is lost.
  for (const note of Object.values(notes)) {
    if (note.folderId === id) {
      delete note.folderId;
      note.updatedAt = Date.now();
      await saveNote(note);
    }
  }
  delete folders[id];
  await deleteFolder(id);
  if (currentFolderId === id) currentFolderId = null;
  closeFolderEdit();
  renderList();
}

function refreshFolderMenuItem() {
  const note = notes[currentId];
  if (!note) {
    ui.menuFolder.hidden = true;
    return;
  }
  ui.menuFolder.hidden = false;
  const folder = note.folderId && folders[note.folderId];
  ui.menuFolder.textContent = folder
    ? `Folder: ${folder.name || "Untitled"}`
    : "Move to folder…";
}

function openFolderPicker() {
  closeMenus();
  const note = notes[currentId];
  if (!note) return;
  ui.folderPickerList.textContent = "";

  const makeRow = (label, emoji, folderId) => {
    const b = document.createElement("button");
    if ((note.folderId || null) === folderId) b.classList.add("sel");
    const em = document.createElement("span");
    em.className = "pk-emoji";
    em.textContent = emoji;
    const nm = document.createElement("span");
    nm.className = "pk-name";
    nm.textContent = label;
    b.append(em, nm);
    b.addEventListener("click", () => moveNoteToFolder(folderId));
    return b;
  };

  ui.folderPickerList.append(makeRow("Unfiled", "🗒️", null));
  for (const folder of sortedFolders()) {
    ui.folderPickerList.append(
      makeRow(folder.name || "Untitled folder", folder.icon || "📁", folder.id)
    );
  }
  const nf = document.createElement("button");
  const em = document.createElement("span");
  em.className = "pk-emoji";
  em.textContent = "＋";
  const nm = document.createElement("span");
  nm.className = "pk-name";
  nm.textContent = "New folder…";
  nf.append(em, nm);
  nf.addEventListener("click", () => {
    closeFolderPicker();
    pendingMoveNoteId = currentId;
    openFolderEdit(null);
  });
  ui.folderPickerList.append(nf);

  ui.folderPicker.hidden = false;
}

function closeFolderPicker() {
  ui.folderPicker.hidden = true;
}

async function moveNoteToFolder(folderId) {
  const note = notes[currentId];
  if (!note) return;
  if (folderId) note.folderId = folderId;
  else delete note.folderId;
  note.updatedAt = Date.now();
  await saveNote(note);
  refreshFolderMenuItem();
  closeFolderPicker();
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
    folders: Object.values(folders),
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
    if (Array.isArray(payload.folders)) {
      for (const folder of payload.folders) {
        const existing = folders[folder.id];
        if (!existing || folder.updatedAt > existing.updatedAt) await saveFolder(folder);
      }
    }
    [notes, folders] = await Promise.all([loadNotes(), loadFolders()]);
    renderList();
    ui.import.textContent = `+${added} / ~${updated}`;
  } catch {
    ui.import.textContent = "Invalid file";
  }
  setTimeout(() => (ui.import.textContent = "Import"), 2500);
}

// Bulk import: one new note per .md/.txt file. The filename becomes the
// title (as a heading) unless the file already starts with one.
async function importTextFiles(files) {
  let count = 0;
  for (const file of files) {
    const text = (await file.text()).replace(/\r\n/g, "\n");
    const base = file.name.replace(/\.[^.]+$/, "");
    const note = newNote();
    if (!text.trim()) note.body = `# ${base}`;
    else if (/^\s*#/.test(text)) note.body = text;
    else note.body = `# ${base}\n\n${text}`.trimEnd();
    notes[note.id] = note;
    await saveNote(note);
    count++;
  }
  return count;
}

// ---- Find in note ----

function openFind() {
  if (mode !== "write") setMode("write");
  ui.findBar.hidden = false;
  ui.findInput.focus();
  ui.findInput.select();
  runFind();
}

function closeFind() {
  ui.findBar.hidden = true;
  findMatches = [];
  findIndex = -1;
  ui.findCount.textContent = "";
  ui.findHighlight.textContent = "";
}

// Close the find bar and drop the caret on the match that was current, so
// the user can keep editing (or type over it) right where they searched.
function finishFind() {
  const start = findIndex >= 0 ? findMatches[findIndex] : null;
  const len = ui.findInput.value.length;
  closeFind();
  ui.editor.focus();
  if (start != null) ui.editor.setSelectionRange(start, start + len);
}

function runFind() {
  const term = ui.findInput.value;
  findMatches = [];
  findIndex = -1;
  if (term) {
    const hay = ui.editor.value.toLowerCase();
    const needle = term.toLowerCase();
    let from = 0;
    let at;
    while ((at = hay.indexOf(needle, from)) !== -1) {
      findMatches.push(at);
      from = at + needle.length;
    }
  }
  if (findMatches.length) {
    gotoMatch(0);
  } else {
    renderFindHighlight();
    updateFindCount();
  }
}

function updateFindCount() {
  if (!ui.findInput.value) ui.findCount.textContent = "";
  else if (!findMatches.length) ui.findCount.textContent = "0/0";
  else ui.findCount.textContent = `${findIndex + 1}/${findMatches.length}`;
}

// Paint a transparent copy of the note behind the textarea with every match
// wrapped in <mark>; the opaque textarea text sits exactly on top, so the
// marks read as highlights. escapeForHtml keeps note text out of raw HTML.
function renderFindHighlight() {
  const len = ui.findInput.value.length;
  if (ui.findBar.hidden || !findMatches.length || !len) {
    ui.findHighlight.textContent = "";
    return;
  }
  const text = ui.editor.value;
  let html = "";
  let pos = 0;
  findMatches.forEach((start, i) => {
    html += escapeForHtml(text.slice(pos, start));
    const cls = i === findIndex ? ' class="current"' : "";
    html += `<mark${cls}>${escapeForHtml(text.slice(start, start + len))}</mark>`;
    pos = start + len;
  });
  html += escapeForHtml(text.slice(pos));
  ui.findHighlight.innerHTML = html;
  syncHighlightScroll();
}

function syncHighlightScroll() {
  ui.findHighlight.scrollTop = ui.editor.scrollTop;
  ui.findHighlight.scrollLeft = ui.editor.scrollLeft;
}

function gotoMatch(index) {
  if (!findMatches.length) {
    renderFindHighlight();
    updateFindCount();
    return;
  }
  findIndex = (index + findMatches.length) % findMatches.length;
  renderFindHighlight();
  // The backdrop mirrors the textarea's layout exactly, so the current
  // mark's offset is the precise scroll target.
  const current = ui.findHighlight.querySelector("mark.current");
  if (current) {
    ui.editor.scrollTop = Math.max(
      0,
      current.offsetTop - ui.editor.clientHeight / 2
    );
    syncHighlightScroll();
  }
  updateFindCount();
}

// ---- Scroll to top / bottom ----

function activeScrollEl() {
  return ui.preview.hidden ? ui.editor : ui.preview;
}

function updateScrollNav() {
  if (ui.editorView.hidden) {
    ui.scrollNav.hidden = true;
    return;
  }
  const el = activeScrollEl();
  const overflow = el.scrollHeight - el.clientHeight;
  if (overflow <= 4) {
    ui.scrollNav.hidden = true;
    return;
  }
  ui.scrollNav.hidden = false;
  // Show only the direction that leads somewhere: hide "up" at the top and
  // "down" at the bottom, show both in between.
  ui.scrollTop.hidden = el.scrollTop <= 4;
  ui.scrollBottom.hidden = el.scrollTop >= overflow - 4;
}

// ---- Version history ----

function openHistory() {
  ui.historyPanel.hidden = false;
  renderHistoryList();
}

function snapshotTitle(snap) {
  const line = snap.body.split("\n").find((l) => l.trim() !== "");
  return line ? line.trim().replace(/^#+\s*/, "").slice(0, 60) : "Empty note";
}

function renderHistoryList() {
  ui.historyList.textContent = "";
  if (!currentHistory.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No earlier versions yet — they're captured as you edit.";
    ui.historyList.append(p);
    return;
  }
  // Newest first.
  [...currentHistory].reverse().forEach((snap) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const info = document.createElement("div");
    info.className = "history-info";
    const when = document.createElement("span");
    when.className = "history-when";
    when.textContent = relativeTime(snap.at);
    const preview = document.createElement("span");
    preview.className = "history-preview";
    preview.textContent = snapshotTitle(snap);
    info.append(when, preview);
    const restore = document.createElement("button");
    restore.textContent = "Restore";
    restore.addEventListener("click", () => restoreSnapshot(snap));
    row.append(info, restore);
    ui.historyList.append(row);
  });
}

async function restoreSnapshot(snap) {
  const note = notes[currentId];
  // Capture the current state first so a restore is itself reversible.
  lastSnapshotAt = 0;
  await maybeSnapshot(note);
  note.body = snap.body;
  note.tags = [...(snap.tags || [])];
  note.lang = snap.lang || "";
  note.glossary = Boolean(snap.glossary);
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.editor.value = note.body;
  ui.tags.value = note.tags.join(", ");
  ui.lang.value = note.lang;
  applyLang(note.lang);
  renderGlossaryControls(note);
  renderCounts();
  ui.historyPanel.hidden = true;
  setMode("write");
}

// ---- Print a single note ----

function escapeForHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function glossaryToHtml(body) {
  const rows = parseGlossary(body)
    .map((r) =>
      r.text
        ? `<tr><td colspan="2" class="gt">${escapeForHtml(r.text)}</td></tr>`
        : `<tr><td>${escapeForHtml(r.term)}</td><td>${escapeForHtml(r.translation)}</td></tr>`
    )
    .join("");
  return `<table>${rows}</table>`;
}

function printNote() {
  const note = notes[currentId];
  ui.moreMenu.hidden = true;
  if (!note) return;
  const bodyHtml = note.glossary
    ? glossaryToHtml(note.body)
    : renderMarkdown(note.body);
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeForHtml(
    titleOf(note)
  )}</title><style>
    body{font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:42em;margin:2em auto;padding:0 1.5em;color:#111}
    h1,h2,h3{line-height:1.25}h1{font-size:1.6em}
    table{border-collapse:collapse;width:100%;margin:1em 0}
    td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:top}
    td.gt{font-weight:600;background:#f3f3f3}
    blockquote{border-left:3px solid #ccc;margin:1em 0;padding:.2em 1em;color:#555}
    code{background:#f3f3f3;padding:1px 5px;border-radius:4px}
    pre{background:#f3f3f3;padding:10px;border-radius:6px;overflow:auto}
    a{color:#0645ad}.wikilink{color:#5b5ef4}
    li.task{list-style:none}
  </style></head><body><main>${bodyHtml}</main>
  <script>window.onload=function(){setTimeout(function(){window.print()},80)}<\/script>
  </body></html>`;
  const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

// ---- Quick capture (from the keyboard command) ----

async function handleQuickCapture(ts) {
  if (!ts || ts <= quickCaptureHandled) return;
  quickCaptureHandled = ts;
  await browser.storage.local.remove("quickCapture");
  if (Date.now() - ts < 8000) await createNote();
}

// ---- Events ----

ui.newNote.addEventListener("click", async (event) => {
  const templates = templateNotes();
  if (!templates.length) {
    await createNote();
    return;
  }
  event.stopPropagation();
  ui.newMenu.textContent = "";
  const blank = document.createElement("button");
  blank.textContent = "Blank note";
  blank.addEventListener("click", () => createNote());
  ui.newMenu.append(blank);
  for (const template of templates) {
    const item = document.createElement("button");
    item.textContent = `From: ${titleOf(template)}`;
    item.addEventListener("click", () => createNote(template));
    ui.newMenu.append(item);
  }
  ui.newMenu.hidden = !ui.newMenu.hidden;
});

function refreshSiteMenuItem() {
  const note = notes[currentId];
  if (!sitePermission || !note || (!note.site && !currentHost)) {
    ui.menuSite.hidden = true;
    return;
  }
  ui.menuSite.hidden = false;
  ui.menuSite.textContent = note.site
    ? `Unlink from ${note.site}`
    : `Link to ${currentHost}`;
}

ui.more.addEventListener("click", (event) => {
  event.stopPropagation();
  refreshSiteMenuItem();
  refreshFolderMenuItem();
  ui.moreMenu.hidden = !ui.moreMenu.hidden;
});

ui.menuFolder.addEventListener("click", openFolderPicker);

// Folder create/edit sheet.
ui.folderSave.addEventListener("click", saveFolderFromSheet);
ui.folderName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveFolderFromSheet();
  }
});
ui.folderCancel.addEventListener("click", closeFolderEdit);
ui.folderDelete.addEventListener("click", async () => {
  if (Date.now() > folderDeleteArmed) {
    folderDeleteArmed = Date.now() + 3000;
    ui.folderDelete.textContent = "Delete folder?";
    setTimeout(() => {
      if (Date.now() > folderDeleteArmed) ui.folderDelete.textContent = "Delete";
    }, 3200);
    return;
  }
  folderDeleteArmed = 0;
  ui.folderDelete.textContent = "Delete";
  await deleteFolderFromSheet();
});
ui.folderPickerCancel.addEventListener("click", closeFolderPicker);
// Click on the dimmed backdrop (outside the card) closes the sheet.
ui.folderEdit.addEventListener("click", (event) => {
  if (event.target === ui.folderEdit) closeFolderEdit();
});
ui.folderPicker.addEventListener("click", (event) => {
  if (event.target === ui.folderPicker) closeFolderPicker();
});

ui.menuSite.addEventListener("click", async () => {
  const note = notes[currentId];
  if (note.site) delete note.site;
  else if (currentHost) note.site = currentHost;
  else return;
  note.updatedAt = Date.now();
  await saveNote(note);
  refreshSiteMenuItem();
  ui.moreMenu.hidden = true;
});

ui.menuDuplicate.addEventListener("click", async () => {
  const source = notes[currentId];
  await flushSave();
  await createNote(source);
});

ui.menuTemplate.addEventListener("click", async () => {
  const note = notes[currentId];
  note.template = !note.template;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.menuTemplate.textContent = note.template
    ? "Stop using as template"
    : "Use as template";
  ui.moreMenu.hidden = true;
});

// Any click outside a menu closes both dropdowns.
document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu") && event.target !== ui.more) closeMenus();
});

ui.noteList.addEventListener("click", (event) => {
  const chip = event.target.closest(".tag-chip");
  if (chip) {
    ui.search.value = chip.dataset.site || `#${chip.dataset.tag}`;
    renderList();
    return;
  }
  const item = event.target.closest("li");
  if (item && item.dataset.id) openEditor(item.dataset.id);
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
  if (!ui.findBar.hidden) runFind();
  updateScrollNav();
});
ui.editor.addEventListener("scroll", () => {
  if (!ui.findBar.hidden) syncHighlightScroll();
  updateScrollNav();
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

ui.editor.addEventListener("keydown", (event) => {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isGlossary()
  ) {
    return;
  }
  if (handleListEnter()) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!ui.folderEdit.hidden) {
    closeFolderEdit();
  } else if (!ui.folderPicker.hidden) {
    closeFolderPicker();
  } else if (!ui.findBar.hidden) {
    finishFind();
  } else if (!ui.historyPanel.hidden) {
    ui.historyPanel.hidden = true;
  } else if (!ui.editorView.hidden) {
    ui.back.click();
  } else if (!ui.settingsView.hidden) {
    openList();
  }
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

ui.menuCopy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(ui.editor.value);
  ui.menuCopy.textContent = "Copied ✓";
  ui.moreMenu.hidden = true;
  setTimeout(() => (ui.menuCopy.textContent = "Copy note text"), 1000);
});

ui.menuPrint.addEventListener("click", printNote);

ui.delete.addEventListener("click", handleDelete);
ui.undoBtn.addEventListener("click", undoTrash);

// Find in note.
ui.findToggle.addEventListener("click", () => {
  if (ui.findBar.hidden) openFind();
  else finishFind();
});
ui.findInput.addEventListener("input", runFind);
ui.findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    gotoMatch(findIndex + (event.shiftKey ? -1 : 1));
  }
});
ui.findPrev.addEventListener("click", () => gotoMatch(findIndex - 1));
ui.findNext.addEventListener("click", () => gotoMatch(findIndex + 1));
ui.findClose.addEventListener("click", finishFind);

// Scroll to top / bottom of the active pane. Direct scrollTop assignment
// always works; CSS scroll-behavior: smooth animates it where supported
// (and honors prefers-reduced-motion). scrollTo({behavior:"smooth"}) was
// unreliable in some engines, so it is avoided.
ui.scrollTop.addEventListener("click", () => {
  activeScrollEl().scrollTop = 0;
});
ui.scrollBottom.addEventListener("click", () => {
  const el = activeScrollEl();
  el.scrollTop = el.scrollHeight;
});
ui.preview.addEventListener("scroll", updateScrollNav, { passive: true });
window.addEventListener("resize", () => {
  updateScrollNav();
  if (!ui.findBar.hidden) renderFindHighlight();
});
ui.editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    openFind();
  }
});

// Version history.
ui.historyBtn.addEventListener("click", () => {
  if (ui.historyPanel.hidden) openHistory();
  else ui.historyPanel.hidden = true;
});
ui.historyClose.addEventListener("click", () => (ui.historyPanel.hidden = true));

// Wiki-links and backlinks in the preview.
ui.preview.addEventListener("click", (event) => {
  const wl = event.target.closest(".wikilink");
  if (wl) {
    event.preventDefault();
    openByTitle(wl.dataset.title);
    return;
  }
  const bl = event.target.closest(".backlink");
  if (bl) openEditor(bl.dataset.id);
});

// Keep the counter in sync with the current text selection.
document.addEventListener("selectionchange", () => {
  if (document.activeElement === ui.editor) renderCounts();
});

// Toggling a checklist item in Preview writes the change back to the
// Markdown source line it came from.
ui.preview.addEventListener("change", async (event) => {
  const box = event.target.closest(".task-box");
  if (!box) return;
  const lineNo = Number(box.dataset.line);
  const lines = ui.editor.value.split("\n");
  if (lines[lineNo] === undefined) return;
  lines[lineNo] = box.checked
    ? lines[lineNo].replace(/\[[ ]\]/, "[x]")
    : lines[lineNo].replace(/\[[xX]\]/, "[ ]");
  ui.editor.value = lines.join("\n");
  renderCounts();
  await flushSave();
  const scroll = ui.preview.scrollTop;
  renderPreview();
  ui.preview.scrollTop = scroll;
});

ui.settings.addEventListener("click", openSettings);

ui.siteToggle.addEventListener("change", async () => {
  if (ui.siteToggle.checked) {
    let granted = false;
    try {
      granted = await browser.permissions.request({ permissions: ["tabs"] });
    } catch {
      granted = false;
    }
    if (!granted) {
      ui.siteToggle.checked = false;
      return;
    }
    sitePermission = true;
    startSiteTracking();
    refreshHost();
  } else {
    sitePermission = false;
    currentHost = "";
    try {
      await browser.permissions.remove({ permissions: ["tabs"] });
    } catch {
      // Permission may already be gone; the toggle state is what matters.
    }
  }
});

ui.fontSize.addEventListener("change", async () => {
  settings.fontSize = ui.fontSize.value;
  applyEditorPrefs();
  await saveSettings(settings);
});

ui.monoToggle.addEventListener("change", async () => {
  settings.mono = ui.monoToggle.checked;
  applyEditorPrefs();
  await saveSettings(settings);
});

ui.emptyTrash.addEventListener("click", async () => {
  for (const note of trashedNotes()) await purgeNote(note.id);
  renderTrash();
});

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

ui.importText.addEventListener("click", () => ui.importTextFile.click());
ui.importTextFile.addEventListener("change", async () => {
  const files = [...ui.importTextFile.files];
  ui.importTextFile.value = "";
  if (!files.length) return;
  ui.importText.textContent = "Importing…";
  const count = await importTextFiles(files);
  notes = await loadNotes();
  ui.importText.textContent = `Imported ${count} file${count > 1 ? "s" : ""}`;
  setTimeout(() => (ui.importText.textContent = "Import .md / .txt files…"), 2500);
});

// Flush pending edits if the sidebar loses focus mid-typing.
window.addEventListener("blur", flushSave);

// The quick-capture command drops a timestamp the panel reacts to, whether
// it was already open or just launched.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.quickCapture && changes.quickCapture.newValue) {
    handleQuickCapture(changes.quickCapture.newValue);
  }
});

onExternalChange(async () => {
  notes = await loadNotes();
  folders = await loadFolders();
  if (currentId && (!notes[currentId] || notes[currentId].deletedAt)) {
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
  [notes, settings, folders] = await Promise.all([
    loadNotes(),
    loadSettings(),
    loadFolders(),
  ]);
  buildFolderControls();
  try {
    sitePermission = await browser.permissions.contains({ permissions: ["tabs"] });
  } catch {
    sitePermission = false;
  }
  if (sitePermission) startSiteTracking();
  renderStorageBadge();
  applyEditorPrefs();
  openList();
  // Purge notes that have sat in the trash longer than 30 days.
  const cutoff = Date.now() - TRASH_TTL_MS;
  for (const note of Object.values(notes)) {
    if (note.deletedAt && note.deletedAt < cutoff) await purgeNote(note.id);
  }
  // If the sidebar was just launched by the quick-capture command, act on it.
  const { quickCapture } = await browser.storage.local.get("quickCapture");
  if (quickCapture) await handleQuickCapture(quickCapture);
})();
