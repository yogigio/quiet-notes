import {
  newNote,
  loadNotes,
  saveNote,
  deleteNote,
  importNotes,
  onExternalChange,
  loadSettings,
  saveSettings,
  loadViewModes,
  saveViewModes,
  loadHistory,
  pushHistory,
  newFolder,
  loadFolders,
  saveFolder,
  deleteFolder,
  loadTimeEntries,
  saveTimeEntries,
  loadAllTimeEntries,
  loadTimers,
  saveTimers,
  loadCountdown,
  saveCountdown,
  loadReminders,
  saveReminders,
} from "./storage.js";
import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);

const ui = {
  topbar: $("topbar"),
  menuToggle: $("menu-toggle"),
  mainMenu: $("main-menu"),
  mmTimers: $("mm-timers"),
  mmAgenda: $("mm-agenda"),
  mmFolder: $("mm-folder"),
  mmSettings: $("mm-settings"),
  mmExport: $("mm-export"),
  mmImport: $("mm-import"),
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
  timerBtn: $("timer-btn"),
  timerChip: $("timer-chip"),
  timerChipTime: $("timer-chip-time"),
  timerPanel: $("timer-panel"),
  timerClose: $("timer-close"),
  timerElsewhere: $("timer-elsewhere"),
  timerDisplay: $("timer-display"),
  timerState: $("timer-state"),
  timerStart: $("timer-start"),
  timerPause: $("timer-pause"),
  timerSave: $("timer-save"),
  timerReset: $("timer-reset"),
  timerTotals: $("timer-totals"),
  timerLogLabel: $("timer-log-label"),
  timerEntries: $("timer-entries"),
  timerTabs: $("timer-tabs"),
  tabStopwatch: $("tab-stopwatch"),
  tabCountdown: $("tab-countdown"),
  timerStopwatch: $("timer-stopwatch"),
  timerCountdown: $("timer-countdown"),
  cdPhase: $("cd-phase"),
  cdDisplay: $("cd-display"),
  cdState: $("cd-state"),
  cdPresets: $("cd-presets"),
  cdCustom: $("cd-custom"),
  cdPomodoro: $("cd-pomodoro"),
  cdStart: $("cd-start"),
  cdPause: $("cd-pause"),
  cdReset: $("cd-reset"),
  cdCycles: $("cd-cycles"),
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
  agendaView: $("agenda-view"),
  agendaBack: $("agenda-back"),
  agendaBody: $("agenda-body"),
  timersView: $("timers-view"),
  timersBack: $("timers-back"),
  timersBody: $("timers-body"),
  syncToggle: $("sync-toggle"),
  quota: $("quota"),
  quotaFill: $("quota-fill"),
  quotaText: $("quota-text"),
  oversizedList: $("oversized-list"),
  siteToggle: $("site-toggle"),
  defaultView: $("default-view"),
  fontSize: $("font-size"),
  monoToggle: $("mono-toggle"),
  homeShowAll: $("home-show-all"),
  timerMode: $("timer-mode"),
  timerModeHint: $("timer-mode-hint"),
  timerSound: $("timer-sound"),
  trashList: $("trash-list"),
  emptyTrash: $("empty-trash"),
  undoToast: $("undo-toast"),
  undoText: $("undo-text"),
  undoBtn: $("undo-btn"),
  selectToggle: $("select-toggle"),
  selectionBar: $("selection-bar"),
  selCancel: $("sel-cancel"),
  selCount: $("sel-count"),
  selAll: $("sel-all"),
  selMove: $("sel-move"),
  selDelete: $("sel-delete"),
  menuFolder: $("menu-folder"),
  menuPin: $("menu-pin"),
  menuHomepin: $("menu-homepin"),
  menuReminder: $("menu-reminder"),
  reminderSheet: $("reminder-sheet"),
  reminderFor: $("reminder-for"),
  reminderList: $("reminder-list"),
  reminderAt: $("reminder-at"),
  reminderQuick: $("reminder-quick"),
  reminderCancel: $("reminder-cancel"),
  reminderSave: $("reminder-save"),
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
  bottombar: $("bottombar"),
};

let notes = {};
let folders = {};
// The list renders in batches: the first LIST_BATCH cards, then more are
// appended as the user scrolls near the bottom (see renderList). listLimit is
// the current cap; lastListKey resets it to a fresh batch whenever the list
// context (folder or search) changes.
let listLimit = 0;
let lastListKey = null;
let currentFolderId = null; // null = Home
let editingFolderId = null; // folder being edited in the sheet (null = new)
let draftIcon = "📁";
let draftColor = "blue";
let settings = { syncEnabled: false };
let viewModes = {}; // noteId -> "write" | "preview" (local-only)
let currentId = null;
let mode = "write";
let saveTimer = null;
let deleteArmedUntil = 0;
let lastTrashedIds = []; // notes moved to trash by the last delete (for Undo)
let toastTimer = null;
// Bulk selection on the list. selectedIds holds the checked note ids;
// currentVisibleIds is the filtered list currently on screen (for "select all").
let selectionMode = false;
let selectedIds = new Set();
let currentVisibleIds = [];
let selDeleteArmed = false;
let sitePermission = false;
let currentHost = "";
let siteTrackingStarted = false;
let currentHistory = [];
let lastSnapshotAt = 0;
let findMatches = [];
let findIndex = -1;
let quickCaptureHandled = 0;
// Time tracking. `timers` maps noteId -> { accumulatedMs, runningSince }; it
// lives in storage.local so timers keep counting while the sidebar is closed.
// How many may run at once depends on settings.timerMode (per-note / single /
// concurrent). `timeEntries` is the open note's saved sessions; `folderTimeMs`
// caches per-folder totals for the list. `tickHandle` is the 1s repaint interval.
let timers = {};
let timeEntries = [];
let folderTimeMs = {};
let tickHandle = null;
let resetArmed = false;
// Countdown/Pomodoro (a single focus timer) and per-note reminders. `countdown`
// mirrors the local-only "countdown" key the background watches; `reminders` is
// the { noteId: { at } } map. `cdDraftMin` is the duration picked while idle.
let countdown = null;
let reminders = {};
let cdDraftMin = 25;
let timerTab = "stopwatch";
let cdResetArmed = false;

const SAVE_DELAY_MS = 400;
const SYNC_QUOTA_BYTES = 102400; // Firefox storage.sync total quota
const LIST_BATCH = 50; // cards rendered per batch in the note list
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
const ICON_HOME = "M2.7 7.8 8 3.3l5.3 4.5M4.3 6.7v5.8h7.4V6.7";
const ICON_PLAY = "M5.5 3.5 12 8l-6.5 4.5z";
const ICON_PAUSE = "M5 3.5h1.8v9H5z M9.2 3.5H11v9H9.2z";

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

// Whether a note is pinned to the top of the Home list. An unfiled pinned note
// pins itself there; a filed note pins to Home only via the explicit
// "Pin to Home" flag (homePinned), which also keeps it in its folder.
function pinnedOnHome(note) {
  return Boolean(note.homePinned) || (!note.folderId && Boolean(note.pinned));
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

    const time = document.createElement("span");
    time.className = "folder-bar-time";
    const fMs = folderTimeMs[folder.id] || 0;
    if (fMs) {
      time.textContent = formatTotal(fMs);
      time.title = "Total time tracked across this project's notes";
    }

    const edit = document.createElement("button");
    edit.className = "icon-btn";
    edit.title = "Edit folder";
    edit.textContent = "✎";
    edit.addEventListener("click", () => openFolderEdit(folder.id));

    bar.append(back, accent, emoji, title, time, edit);
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
    const meta = document.createElement("span");
    meta.className = "folder-count";
    const fMs = folderTimeMs[folder.id] || 0;
    meta.textContent = fMs
      ? `${folderNoteCount(folder.id)} · ${formatTotal(fMs)}`
      : String(folderNoteCount(folder.id));
    const chevron = document.createElement("span");
    chevron.className = "folder-chevron";
    chevron.append(svgIcon(ICON_CHEVRON));

    row.append(emoji, name, meta, chevron);
    ui.folderSection.append(row);
  }
}

// ---- List view ----

function renderList() {
  renderFolderSection();
  const query = ui.search.value.trim().toLowerCase();
  // Reset to a fresh batch whenever the folder or search changes.
  const key = (currentFolderId || "") + "|" + query;
  if (key !== lastListKey) {
    lastListKey = key;
    listLimit = LIST_BATCH;
    ui.listView.scrollTop = 0;
  }

  // On Home, filed notes are tucked away in their folders by default — the
  // browse list shows only unfiled notes. Search still spans everything, so a
  // filed note is always findable (and the "Show filed notes on Home" setting
  // brings them all back).
  const hideFiled = !currentFolderId && !query && !settings.homeShowsAll;
  const visible = sortedNotes().filter((note) => {
    if (currentFolderId) return note.folderId === currentFolderId && matchesQuery(note, query);
    if (!matchesQuery(note, query)) return false;
    // Filed notes are hidden from Home unless explicitly pinned to Home.
    if (hideFiled && note.folderId && !note.homePinned) return false;
    return true;
  });
  // On Home, float notes pinned to Home to the top (in addition to unfiled
  // pinned ones). Inside a folder, sortedNotes already puts pinned notes first.
  if (!currentFolderId) {
    visible.sort((a, b) => {
      const pa = pinnedOnHome(a) ? 1 : 0;
      const pb = pinnedOnHome(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.updatedAt - a.updatedAt;
    });
  }
  currentVisibleIds = visible.map((note) => note.id); // for "select all"

  // Display order: any "on this site" notes first (with labels), then the rest.
  const siteGroup =
    !currentFolderId && sitePermission && currentHost
      ? visible.filter((note) => note.site === currentHost)
      : [];
  const seq = [];
  if (siteGroup.length) {
    seq.push({ label: `On ${currentHost}` });
    for (const note of siteGroup) seq.push({ note });
    seq.push({ label: "All notes" });
    for (const note of visible) {
      if (note.site !== currentHost) seq.push({ note });
    }
  } else {
    for (const note of visible) seq.push({ note });
  }

  // Render up to listLimit cards; labels don't count toward the cap.
  ui.noteList.textContent = "";
  let shown = 0;
  for (const item of seq) {
    if (shown >= listLimit) break;
    if (item.label) appendGroupLabel(item.label);
    else {
      appendCard(item.note);
      shown++;
    }
  }
  const totalCards = seq.reduce((n, item) => n + (item.note ? 1 : 0), 0);
  if (shown < totalCards) appendLoadMore(shown, totalCards);

  if (!visible.length && currentFolderId) {
    const p = document.createElement("p");
    p.className = "hint folder-empty";
    p.textContent = "No notes in this folder yet.";
    ui.noteList.append(p);
  } else if (!visible.length && hideFiled && sortedNotes().length) {
    // Home is empty only because every note is filed — point the way.
    const p = document.createElement("p");
    p.className = "hint folder-empty";
    p.textContent = "All notes are filed. Open a folder above, or search to find any note.";
    ui.noteList.append(p);
  }
  ui.emptyHint.hidden = sortedNotes().length > 0;
}

// A footer row shown when more cards remain. Clicking it loads the next batch;
// scrolling near the bottom does the same (see the #list-view scroll handler).
function appendLoadMore(shown, total) {
  const li = document.createElement("li");
  li.className = "load-more";
  li.textContent = `Showing ${shown} of ${total} — load more`;
  li.addEventListener("click", loadMore);
  ui.noteList.append(li);
}

function loadMore() {
  listLimit += LIST_BATCH;
  renderList();
}

// Auto-load the next batch when the list is scrolled near its bottom.
function maybeLoadMore() {
  if (ui.listView.hidden) return;
  if (!ui.noteList.querySelector(".load-more")) return;
  const el = ui.listView;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore();
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

  if (selectionMode) {
    item.classList.add("selectable");
    if (selectedIds.has(note.id)) item.classList.add("selected");
    const box = document.createElement("span");
    box.className = "sel-box";
    box.append(svgIcon("M3.5 8.2l2.7 2.7 6.3-6.6"));
    item.append(box); // absolutely positioned, so order doesn't matter
  }

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
  if (note.homePinned) {
    const mark = document.createElement("span");
    mark.className = "note-pin home-pin";
    mark.title = "Pinned to Home";
    mark.append(svgIcon(ICON_HOME));
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
  const noteReminders = reminders[note.id];
  if (noteReminders && noteReminders.length) {
    const soonest = noteReminders.reduce((a, b) => (a.at <= b.at ? a : b));
    const chip = document.createElement("span");
    chip.className = "reminder-chip";
    chip.classList.toggle("overdue", soonest.at < Date.now());
    const extra = noteReminders.length > 1 ? ` +${noteReminders.length - 1}` : "";
    chip.textContent = `⏰ ${formatReminder(soonest.at)}${extra}`;
    meta.append(chip);
  }
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

// ---- Bulk selection ----

function enterSelection() {
  selectionMode = true;
  selectedIds.clear();
  document.body.classList.add("selecting");
  ui.selectToggle.classList.add("active");
  ui.bottombar.hidden = true;
  ui.selectionBar.hidden = false;
  renderList();
  updateSelectionBar();
}

function exitSelection() {
  selectionMode = false;
  selectedIds.clear();
  selDeleteArmed = false;
  document.body.classList.remove("selecting");
  ui.selectToggle.classList.remove("active");
  ui.selectionBar.hidden = true;
  ui.bottombar.hidden = false;
  renderList();
}

function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  const li = ui.noteList.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  if (li) li.classList.toggle("selected", selectedIds.has(id));
  selDeleteArmed = false;
  ui.selDelete.textContent = "Delete";
  updateSelectionBar();
}

function toggleSelectAll() {
  const all =
    currentVisibleIds.length > 0 && currentVisibleIds.every((id) => selectedIds.has(id));
  if (all) selectedIds.clear();
  else for (const id of currentVisibleIds) selectedIds.add(id);
  renderList();
  updateSelectionBar();
}

function updateSelectionBar() {
  const n = selectedIds.size;
  ui.selCount.textContent = `${n} selected`;
  ui.selMove.disabled = n === 0;
  ui.selDelete.disabled = n === 0;
  const all =
    currentVisibleIds.length > 0 && currentVisibleIds.every((id) => selectedIds.has(id));
  ui.selAll.textContent = all ? "None" : "All";
}

function bulkMove() {
  if (selectedIds.size) openFolderPicker(true);
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  // Two-step confirm — deleting several notes at once deserves a beat.
  if (!selDeleteArmed) {
    selDeleteArmed = true;
    ui.selDelete.textContent = `Delete ${selectedIds.size}?`;
    setTimeout(() => {
      selDeleteArmed = false;
      ui.selDelete.textContent = "Delete";
    }, 3000);
    return;
  }
  const ids = [...selectedIds];
  for (const id of ids) {
    const note = notes[id];
    if (!note) continue;
    note.deletedAt = Date.now();
    note.updatedAt = Date.now();
    await saveNote(note);
  }
  exitSelection();
  showUndoToast(ids);
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
  ui.agendaView.hidden = view !== "agenda";
  ui.timersView.hidden = view !== "timers";
  closeMenus();
}

function closeMenus() {
  ui.newMenu.hidden = true;
  ui.moreMenu.hidden = true;
  ui.mainMenu.hidden = true;
}

function openList() {
  currentId = null;
  disarmDelete();
  closeFind();
  ui.historyPanel.hidden = true;
  ui.timerPanel.hidden = true;
  showView("list");
  renderList();
}

// Which mode a note opens in, per the "Open notes in" setting. Empty notes
// always open in Write (nothing to preview).
function initialModeFor(note) {
  const pref = settings.defaultView || "remember";
  if (pref === "write") return "write";
  if (pref === "preview") return note.body.trim() ? "preview" : "write";
  // "remember": last-used mode, else glossary-with-content opens in Preview.
  if (viewModes[note.id]) return viewModes[note.id];
  return note.glossary && note.body.trim() ? "preview" : "write";
}

// Record an explicit Write/Preview choice for the current note (local-only).
function rememberMode(next) {
  if (!currentId) return;
  if (viewModes[currentId] === next) return;
  viewModes[currentId] = next;
  saveViewModes(viewModes);
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
  refreshPinItem();
  refreshHomePinItem();
  renderGlossaryControls(note);
  closeFind();
  ui.historyPanel.hidden = true;
  ui.timerPanel.hidden = true;
  lastSnapshotAt = 0;
  [currentHistory, timeEntries] = await Promise.all([
    loadHistory(id),
    loadTimeEntries(id),
  ]);
  showView("editor");
  ui.saveState.textContent = "";
  renderCounts();
  renderTimerChip();
  setMode(initialModeFor(note));
  // Open showing the top of the note — focusing the textarea otherwise leaves
  // the caret at the end and scrolls to the bottom.
  if (mode === "write") ui.editor.setSelectionRange(0, 0);
  ui.editor.scrollTop = 0;
  ui.preview.scrollTop = 0;
  updateScrollNav();
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
  showUndoToast([id]);
}

function showUndoToast(ids) {
  lastTrashedIds = ids;
  ui.undoText.textContent =
    ids.length === 1 ? "Note moved to trash" : `${ids.length} notes moved to trash`;
  ui.undoToast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.undoToast.hidden = true), 6000);
}

async function undoTrash() {
  ui.undoToast.hidden = true;
  clearTimeout(toastTimer);
  for (const id of lastTrashedIds) {
    const note = notes[id];
    if (!note) continue;
    delete note.deletedAt;
    note.updatedAt = Date.now();
    await saveNote(note);
  }
  renderList();
}

async function purgeNote(id) {
  delete notes[id];
  if (viewModes[id]) {
    delete viewModes[id];
    await saveViewModes(viewModes);
  }
  // Drop any timer tied to the note being permanently removed.
  if (timers[id]) {
    delete timers[id];
    await saveTimers(timers);
    ensureTick();
    renderTimerChip();
  }
  // Drop any reminder for the removed note.
  if (reminders[id]) {
    const next = { ...reminders };
    delete next[id];
    reminders = next;
    await saveReminders(reminders);
  }
  await deleteNote(id);
  await refreshFolderTimes();
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

// One line describing what the chosen timer mode does, incl. the caveat on
// concurrent tracking (it double-counts real time, which matters for billing).
const TIMER_MODE_HINTS = {
  "per-note": "Each note keeps its own timer. Starting one pauses whatever was running, so only one runs at a time and hours never double-count. Recommended.",
  single: "Only ever one timer: starting a new note's timer saves the previous one as a session.",
  concurrent: "Timers on different notes all keep running at once. Flexible, but overlapping timers double-count your actual time — take care if you bill from this.",
};

function renderTimerModeHint() {
  ui.timerModeHint.textContent = TIMER_MODE_HINTS[timerMode()] || "";
}

function renderSettingsControls() {
  ui.defaultView.value = settings.defaultView || "remember";
  ui.fontSize.value = settings.fontSize || "m";
  ui.monoToggle.checked = Boolean(settings.mono);
  ui.homeShowAll.checked = Boolean(settings.homeShowsAll);
  ui.timerMode.value = timerMode();
  renderTimerModeHint();
  ui.timerSound.checked = Boolean(settings.timerSound);
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
let pendingBulkMove = null; // note ids to file into a folder created mid-move
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
  pendingBulkMove = null;
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

  // Created via "New folder…" in the move picker: file the note(s) here.
  if (isNew && pendingMoveNoteId && notes[pendingMoveNoteId]) {
    const note = notes[pendingMoveNoteId];
    note.folderId = folder.id;
    note.updatedAt = Date.now();
    await saveNote(note);
    refreshFolderMenuItem();
  }
  if (isNew && pendingBulkMove && pendingBulkMove.length) {
    for (const id of pendingBulkMove) {
      const note = notes[id];
      if (!note) continue;
      note.folderId = folder.id;
      note.updatedAt = Date.now();
      await saveNote(note);
    }
    pendingBulkMove = null;
    closeFolderEdit();
    exitSelection();
    return;
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

// The star and this menu item both toggle `pinned`; the label names the list
// the note would pin to (its folder when filed, otherwise Home).
function refreshPinItem() {
  const note = notes[currentId];
  if (!note) return;
  const filed = Boolean(note.folderId);
  if (note.pinned) ui.menuPin.textContent = filed ? "Unpin from folder top" : "Unpin from top";
  else ui.menuPin.textContent = filed ? "Pin to top of folder" : "Pin to top";
}

async function togglePin() {
  const note = notes[currentId];
  note.pinned = !note.pinned;
  note.updatedAt = Date.now();
  await saveNote(note);
  ui.pin.classList.toggle("pinned", note.pinned);
  refreshPinItem();
}

// "Pin to Home" only applies to filed notes (unfiled ones are already on Home).
function refreshHomePinItem() {
  const note = notes[currentId];
  const filed = note && note.folderId;
  ui.menuHomepin.hidden = !filed;
  if (filed) {
    ui.menuHomepin.textContent = note.homePinned ? "Unpin from Home" : "Pin to Home";
  }
}

function openFolderPicker(bulk = false) {
  closeMenus();
  const note = bulk ? null : notes[currentId];
  if (!bulk && !note) return;
  ui.folderPickerList.textContent = "";

  const makeRow = (label, emoji, folderId) => {
    const b = document.createElement("button");
    if (!bulk && (note.folderId || null) === folderId) b.classList.add("sel");
    const em = document.createElement("span");
    em.className = "pk-emoji";
    em.textContent = emoji;
    const nm = document.createElement("span");
    nm.className = "pk-name";
    nm.textContent = label;
    b.append(em, nm);
    b.addEventListener("click", () =>
      bulk ? moveSelectedToFolder(folderId) : moveNoteToFolder(folderId)
    );
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
    if (bulk) pendingBulkMove = [...selectedIds];
    else pendingMoveNoteId = currentId;
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

async function moveSelectedToFolder(folderId) {
  for (const id of selectedIds) {
    const note = notes[id];
    if (!note) continue;
    if (folderId) note.folderId = folderId;
    else delete note.folderId;
    note.updatedAt = Date.now();
    await saveNote(note);
  }
  closeFolderPicker();
  exitSelection();
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

async function exportAll() {
  // Time sessions live outside the note record, so pull them in for backup.
  const allTime = await loadAllTimeEntries();
  const time = {};
  for (const note of sortedNotes()) {
    if (allTime[note.id] && allTime[note.id].length) time[note.id] = allTime[note.id];
  }
  const payload = {
    app: "quiet-notes",
    format: 1,
    exportedAt: new Date().toISOString(),
    notes: sortedNotes(),
    folders: Object.values(folders),
    time,
    reminders,
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
    // Merge time sessions, de-duplicated by their start timestamp so a
    // re-import never doubles logged hours.
    if (payload.time && typeof payload.time === "object") {
      for (const [noteId, incoming] of Object.entries(payload.time)) {
        if (!Array.isArray(incoming) || !incoming.length) continue;
        const current = await loadTimeEntries(noteId);
        const seen = new Set(current.map((e) => e.start));
        const merged = current.concat(incoming.filter((e) => !seen.has(e.start)));
        merged.sort((a, b) => (a.start || 0) - (b.start || 0));
        await saveTimeEntries(noteId, merged);
      }
    }
    // Merge reminders: union each note's reminders, de-duplicated by time so a
    // re-import never doubles them. Handles both the array and legacy shapes.
    if (payload.reminders && typeof payload.reminders === "object") {
      const merged = { ...reminders };
      for (const [noteId, entry] of Object.entries(payload.reminders)) {
        const incoming = normalizeReminderEntry(entry);
        if (!incoming.length) continue;
        const current = merged[noteId] || [];
        const times = new Set(current.map((r) => r.at));
        merged[noteId] = current.concat(
          incoming.filter((r) => !times.has(r.at)).map((r) => ({ id: crypto.randomUUID(), at: r.at }))
        );
      }
      reminders = merged;
      await saveReminders(reminders);
    }
    [notes, folders] = await Promise.all([loadNotes(), loadFolders()]);
    if (currentId) timeEntries = await loadTimeEntries(currentId);
    await refreshFolderTimes();
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

// scrollToMatch: jump the view to the first match (when typing in the find
// box). Editing the note itself re-highlights in place with scrollToMatch
// false, so the view never yanks away from the caret.
function runFind(scrollToMatch = true) {
  const term = ui.findInput.value;
  const prevIndex = findIndex;
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
  if (!findMatches.length) {
    renderFindHighlight();
    updateFindCount();
    return;
  }
  if (scrollToMatch) {
    gotoMatch(0);
  } else {
    // Repaint highlights at their new positions but leave the scroll alone.
    findIndex = Math.min(Math.max(prevIndex, 0), findMatches.length - 1);
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

// ---- Time tracking ----
//
// One global timer at a time (the Toggl/Clockify model). It is attached to a
// note and persisted under the "timer" key, so it keeps counting while the
// sidebar is closed or the user works in other notes. Pause/resume accumulate
// time; Save commits the elapsed span as a session entry under "time:<id>";
// Reset discards it. Elapsed is always derived from timestamps, never from a
// counter we increment — so a closed sidebar loses nothing.

function timerElapsed(timer) {
  if (!timer) return 0;
  const live = timer.runningSince ? Date.now() - timer.runningSince : 0;
  return timer.accumulatedMs + live;
}

const isRunning = (timer) => Boolean(timer && timer.runningSince);
const timerFor = (id) => timers[id] || null;
const anyRunning = () => Object.values(timers).some(isRunning);
// Active timers on notes other than the given one, [ [id, timer], … ].
const otherTimers = (id) => Object.entries(timers).filter(([nid]) => nid !== id);
const timerMode = () => settings.timerMode || "per-note";

// H:MM:SS for the live clock.
function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

// Compact human totals: "2h 15m", "45m", "38s". Used for rollups and the chip.
function formatTotal(ms) {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function entriesTotalMs(entries) {
  return entries.reduce((sum, e) => sum + (e.ms || 0), 0);
}

// Total tracked time for a note = saved sessions + its live timer, if any.
function noteTotalMs(id, entries) {
  return entriesTotalMs(entries || []) + timerElapsed(timerFor(id));
}

function titleFor(id) {
  const note = notes[id];
  return note ? titleOf(note) : "a note";
}

// Keep exactly one ticking interval alive while any timer — a stopwatch or the
// countdown — is running.
function needsTick() {
  return anyRunning() || Boolean(countdown && countdown.running);
}

function ensureTick() {
  if (needsTick() && !tickHandle) {
    tickHandle = setInterval(paintTimer, 1000);
  } else if (!needsTick() && tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

// Repaint only the live numbers (cheap; runs every second). Full control
// state is repainted by renderTimer on state changes.
function paintTimer() {
  const cur = timerFor(currentId);
  if (cur && !ui.timerPanel.hidden && timerTab === "stopwatch") {
    ui.timerDisplay.textContent = formatClock(timerElapsed(cur));
  }
  if (countdown && countdown.running && !ui.timerPanel.hidden && timerTab === "countdown") {
    ui.cdDisplay.textContent = formatClock(countdownRemaining());
  }
  if (!ui.timersView.hidden) paintTimersView();
  renderTimerChip();
}

// The always-visible footer chip. Shows the current note's timer when it has
// one; otherwise summarizes timers running on other notes. A pulsing dot means
// running. Never lets tracking run invisibly.
function renderTimerChip() {
  const cur = timerFor(currentId);
  const others = currentId ? otherTimers(currentId) : Object.entries(timers);
  if (!cur && !others.length) {
    ui.timerChip.hidden = true;
    ui.timerBtn.classList.remove("active");
    return;
  }
  ui.timerChip.hidden = false;
  if (cur) {
    ui.timerChip.classList.toggle("running", isRunning(cur));
    ui.timerChip.classList.remove("other");
    ui.timerChipTime.textContent = formatClock(timerElapsed(cur));
    ui.timerChip.title = isRunning(cur)
      ? "Timer running — open time tracker"
      : "Timer paused — open time tracker";
  } else if (others.length === 1) {
    const [oid, t] = others[0];
    ui.timerChip.classList.toggle("running", isRunning(t));
    ui.timerChip.classList.add("other");
    ui.timerChipTime.textContent = formatClock(timerElapsed(t));
    ui.timerChip.title = `Timer ${isRunning(t) ? "running" : "paused"} on "${titleFor(oid)}" — go to it`;
  } else {
    const runningCount = others.filter(([, t]) => isRunning(t)).length;
    ui.timerChip.classList.toggle("running", runningCount > 0);
    ui.timerChip.classList.add("other");
    ui.timerChipTime.textContent = `${others.length}×`;
    ui.timerChip.title = `${others.length} timers on other notes (${runningCount} running) — open tracker`;
  }
  ui.timerBtn.classList.toggle("active", Boolean(cur));
}

async function persistTimers() {
  await saveTimers(timers);
  await refreshFolderTimes();
  ensureTick();
  if (!ui.timersView.hidden) renderTimers();
}

// Pause (park) a note's timer in place, keeping its accumulated time.
function parkTimer(id) {
  const t = timers[id];
  if (!t || !t.runningSince) return;
  t.accumulatedMs = timerElapsed(t);
  t.runningSince = null;
}

// Commit a note's timer as a saved session, then remove it from the map.
// Sessions under a minute are dropped as accidental taps. Returns elapsed ms.
async function commitTimer(id) {
  const t = timers[id];
  if (!t) return 0;
  const ms = timerElapsed(t);
  delete timers[id];
  if (ms >= 60000) {
    const entries = id === currentId ? timeEntries : await loadTimeEntries(id);
    entries.push({ start: Date.now() - ms, end: Date.now(), ms });
    await saveTimeEntries(id, entries);
    if (id === currentId) timeEntries = entries;
  }
  return ms;
}

// Start (or resume) tracking the open note. What happens to timers already
// running on OTHER notes depends on the mode:
//   • per-note  — park them (kept, paused), so only one runs at a time
//   • single    — commit them (auto-save), so there is ever only one timer
//   • concurrent— leave them running
async function startTimer() {
  if (!currentId) return;
  const mode = timerMode();
  if (mode === "single") {
    for (const [id] of otherTimers(currentId)) await commitTimer(id);
  } else if (mode === "per-note") {
    for (const [id, t] of otherTimers(currentId)) if (t.runningSince) parkTimer(id);
  }
  const cur = timers[currentId];
  if (!cur) timers[currentId] = { accumulatedMs: 0, runningSince: Date.now() };
  else if (!cur.runningSince) cur.runningSince = Date.now(); // resume from pause
  await persistTimers();
  renderTimer();
}

async function pauseTimer() {
  const cur = timers[currentId];
  if (!isRunning(cur)) return;
  parkTimer(currentId);
  await persistTimers();
  renderTimer();
}

async function saveTimerSession() {
  if (!timers[currentId]) return;
  const ms = await commitTimer(currentId);
  await persistTimers();
  renderTimer();
  if (ms < 60000) {
    // Too short to log; tell the user rather than silently dropping it.
    ui.timerState.textContent = "Under a minute — not logged.";
  }
}

async function resetTimer() {
  if (!timers[currentId]) return;
  if (!resetArmed) {
    resetArmed = true;
    ui.timerReset.textContent = "Discard?";
    setTimeout(() => {
      resetArmed = false;
      ui.timerReset.textContent = "Reset";
    }, 3000);
    return;
  }
  resetArmed = false;
  delete timers[currentId];
  await persistTimers();
  renderTimer();
}

function openTimer() {
  ui.historyPanel.hidden = true;
  ui.timerPanel.hidden = false;
  switchTimerTab(timerTab);
}

// Full repaint of the timer panel for the open note.
function renderTimer() {
  resetArmed = false;
  ui.timerReset.textContent = "Reset";
  const cur = timerFor(currentId);
  const others = currentId ? otherTimers(currentId) : [];

  // Banner listing timers active on other notes — a header plus one row per
  // note (title, state, elapsed), stacked vertically so long titles never
  // overflow. Each row jumps to that note.
  ui.timerElsewhere.hidden = others.length === 0;
  if (others.length) {
    ui.timerElsewhere.textContent = "";
    const head = document.createElement("div");
    head.className = "timer-notice-head";
    head.textContent =
      others.length === 1
        ? `${isRunning(others[0][1]) ? "Running" : "Paused"} on another note`
        : `${others.length} timers on other notes`;
    ui.timerElsewhere.append(head);
    for (const [oid, t] of others) {
      const row = document.createElement("button");
      row.className = "timer-other-row";
      row.title = `Go to “${titleFor(oid)}”`;
      const dot = document.createElement("span");
      dot.className = "to-dot" + (isRunning(t) ? " running" : "");
      const name = document.createElement("span");
      name.className = "to-name";
      name.textContent = titleFor(oid);
      const time = document.createElement("span");
      time.className = "to-time";
      time.textContent = formatClock(timerElapsed(t));
      row.append(dot, name, time);
      row.addEventListener("click", () => openEditor(oid));
      ui.timerElsewhere.append(row);
    }
  }

  ui.timerDisplay.textContent = formatClock(timerElapsed(cur));
  ui.timerDisplay.classList.toggle("live", isRunning(cur));

  // Controls reflect this note's timer state.
  const running = isRunning(cur);
  const paused = cur && !running;
  ui.timerStart.hidden = running;
  ui.timerStart.textContent = paused ? "Resume" : "Start";
  ui.timerPause.hidden = !running;
  ui.timerSave.hidden = !cur;
  ui.timerReset.hidden = !cur;
  ui.timerState.textContent = running ? "Tracking…" : paused ? "Paused" : "";

  renderTimerTotals();
  renderTimerEntries();
  renderTimerChip();
}

function renderTimerTotals() {
  const note = notes[currentId];
  const totalMs = noteTotalMs(currentId, timeEntries);
  ui.timerTotals.textContent = "";
  if (!totalMs) {
    const p = document.createElement("span");
    p.className = "hint";
    p.textContent = "No time logged on this note yet.";
    ui.timerTotals.append(p);
    return;
  }
  const total = document.createElement("div");
  total.className = "timer-total";
  total.textContent = `${formatTotal(totalMs)} on this note`;
  ui.timerTotals.append(total);

  // Words per hour — pairs the existing word count with tracked time.
  const words = note ? wordCount(note.body) : 0;
  const hours = totalMs / 3600000;
  if (words && hours > 0.0167) {
    const wph = Math.round(words / hours);
    const rate = document.createElement("div");
    rate.className = "hint";
    rate.textContent = `${words} words · ~${wph} words/hour`;
    ui.timerTotals.append(rate);
  }

  // Project (folder) rollup.
  if (note && note.folderId && folders[note.folderId]) {
    const fMs = folderTimeMs[note.folderId] || 0;
    if (fMs) {
      const proj = document.createElement("div");
      proj.className = "hint";
      const f = folders[note.folderId];
      proj.textContent = `${f.icon || "📁"} ${f.name || "Folder"}: ${formatTotal(fMs)} total`;
      ui.timerTotals.append(proj);
    }
  }
}

function renderTimerEntries() {
  ui.timerEntries.textContent = "";
  ui.timerLogLabel.hidden = timeEntries.length === 0;
  // Newest first.
  [...timeEntries]
    .map((e, i) => ({ e, i }))
    .reverse()
    .forEach(({ e, i }) => {
      const row = document.createElement("div");
      row.className = "timer-entry";
      const when = document.createElement("span");
      when.className = "te-when";
      when.textContent = entryWhen(e);
      const dur = document.createElement("span");
      dur.className = "te-dur";
      dur.textContent = formatTotal(e.ms);
      const del = document.createElement("button");
      del.className = "te-del";
      del.title = "Delete session";
      del.textContent = "✕";
      del.addEventListener("click", () => deleteEntry(i));
      row.append(when, dur, del);
      ui.timerEntries.append(row);
    });
}

function entryWhen(entry) {
  const d = new Date(entry.end || entry.start || Date.now());
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

async function deleteEntry(index) {
  timeEntries.splice(index, 1);
  await saveTimeEntries(currentId, timeEntries);
  await refreshFolderTimes();
  renderTimer();
}

// Recompute per-folder totals from all notes' time entries (for the list).
async function refreshFolderTimes() {
  const all = await loadAllTimeEntries();
  folderTimeMs = {};
  for (const [noteId, entries] of Object.entries(all)) {
    const note = notes[noteId];
    if (!note || !note.folderId || note.deletedAt) continue;
    folderTimeMs[note.folderId] =
      (folderTimeMs[note.folderId] || 0) + entriesTotalMs(entries);
  }
  // Fold in every live timer so folder totals tick up in real time.
  for (const [noteId, t] of Object.entries(timers)) {
    const note = notes[noteId];
    if (note && note.folderId && !note.deletedAt) {
      folderTimeMs[note.folderId] =
        (folderTimeMs[note.folderId] || 0) + timerElapsed(t);
    }
  }
}

// ---- Countdown / Pomodoro ----
//
// A single focus timer (one at a time — it's a kitchen timer, not billing).
// The panel owns the UI and writes the "countdown" state; the background
// schedules the alarm and, on expiry, fires the notification and (for
// Pomodoro) advances the phase. Remaining time is derived from endsAt so a
// closed sidebar stays accurate.

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;

// A short two-tone chime generated with WebAudio — no bundled asset, no
// permission. The context is created/resumed during a click (see
// startCountdown) so later playback isn't blocked by the autoplay policy.
// Only used while the sidebar is open; a closed sidebar relies on the OS
// notification sound.
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function playChime() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [freq, t] of [[880, 0], [1174.7, 0.16]]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.36);
  }
}

// A countdown is "active" only while running or paused with time left; a
// finished one is treated as idle (back to a fresh draft).
function countdownActive() {
  return Boolean(countdown && (countdown.running || (countdown.remainingMs || 0) > 0));
}

function countdownRemaining() {
  if (countdown && countdown.running && countdown.endsAt) {
    return Math.max(0, countdown.endsAt - Date.now());
  }
  if (countdown && (countdown.remainingMs || 0) > 0) return countdown.remainingMs;
  return cdDraftMin * 60000; // idle draft
}

async function persistCountdown() {
  await saveCountdown(countdown);
  ensureTick();
  if (!ui.timersView.hidden) renderTimers();
}

async function startCountdown() {
  // Prime the audio context during this click gesture so the end-of-phase
  // chime can play later without the autoplay policy blocking it.
  if (settings.timerSound) ensureAudio();
  const pomodoro = ui.cdPomodoro.checked;
  if (countdown && !countdown.running && countdown.remainingMs > 0) {
    // Resume a paused countdown.
    countdown.endsAt = Date.now() + countdown.remainingMs;
    countdown.running = true;
  } else {
    const dur = pomodoro ? FOCUS_MS : cdDraftMin * 60000;
    countdown = {
      phase: "focus",
      pomodoro,
      focusMs: FOCUS_MS,
      breakMs: BREAK_MS,
      endsAt: Date.now() + dur,
      remainingMs: dur,
      running: true,
      cycles: 0,
      noteId: currentId || null,
    };
  }
  await persistCountdown();
  renderCountdown();
}

async function pauseCountdown() {
  if (!countdown || !countdown.running) return;
  countdown.remainingMs = countdownRemaining();
  countdown.running = false;
  countdown.endsAt = null;
  await persistCountdown();
  renderCountdown();
}

async function resetCountdown() {
  if (countdown && countdown.running && !cdResetArmed) {
    cdResetArmed = true;
    ui.cdReset.textContent = "Stop?";
    setTimeout(() => {
      cdResetArmed = false;
      ui.cdReset.textContent = "Reset";
    }, 3000);
    return;
  }
  cdResetArmed = false;
  ui.cdReset.textContent = "Reset";
  countdown = null;
  await persistCountdown();
  renderCountdown();
}

function setCountdownPreset(min) {
  cdDraftMin = min;
  ui.cdPomodoro.checked = false;
  if (!countdown || !countdown.running) {
    countdown = null; // back to an idle draft of the chosen length
    renderCountdown();
  }
}

function renderCountdown() {
  cdResetArmed = false;
  ui.cdReset.textContent = "Reset";
  const active = countdownActive();
  const running = active && countdown.running;
  const paused = active && !countdown.running;
  // While active the mode comes from the countdown; while idle it's the user's
  // checkbox choice for the next start (never overwritten from a stale timer).
  const pomodoro = active ? countdown.pomodoro : ui.cdPomodoro.checked;

  ui.cdDisplay.textContent = formatClock(countdownRemaining());
  ui.cdDisplay.classList.toggle("live", running);

  // Phase pill (Pomodoro only, while active).
  const showPhase = pomodoro && active;
  ui.cdPhase.hidden = !showPhase;
  if (showPhase) {
    ui.cdPhase.textContent = countdown.phase === "focus" ? "Focus" : "Break";
    ui.cdPhase.classList.toggle("break", countdown.phase === "break");
  }

  ui.cdStart.hidden = running;
  ui.cdStart.textContent = paused ? "Resume" : "Start";
  ui.cdPause.hidden = !running;
  ui.cdReset.hidden = !active;
  // Presets/custom don't apply while a timer is active or in Pomodoro mode.
  const lockDuration = active || pomodoro;
  ui.cdPresets.classList.toggle("disabled", lockDuration);
  ui.cdCustom.disabled = lockDuration;
  ui.cdPomodoro.disabled = active;
  ui.cdPomodoro.checked = pomodoro;
  // Keep the custom field showing the current draft length while idle.
  if (!active && document.activeElement !== ui.cdCustom) {
    ui.cdCustom.value = String(cdDraftMin);
  }

  // Highlight the active preset while idle.
  for (const b of ui.cdPresets.querySelectorAll("button")) {
    b.classList.toggle("sel", !pomodoro && !active && Number(b.dataset.min) === cdDraftMin);
  }

  ui.cdState.textContent = running
    ? pomodoro
      ? countdown.phase === "focus"
        ? "Focus — stay on task"
        : "Break — step away"
      : "Counting down…"
    : paused
      ? "Paused"
      : "";

  ui.cdCycles.textContent =
    pomodoro && countdown && countdown.cycles
      ? `${countdown.cycles} focus session${countdown.cycles > 1 ? "s" : ""} done`
      : "";
}

function switchTimerTab(tab) {
  timerTab = tab;
  const sw = tab === "stopwatch";
  ui.tabStopwatch.classList.toggle("active", sw);
  ui.tabCountdown.classList.toggle("active", !sw);
  ui.timerStopwatch.hidden = !sw;
  ui.timerCountdown.hidden = sw;
  if (sw) renderTimer();
  else renderCountdown();
}

// ---- Timers overview (all active timers, from the hamburger menu) ----

// Pause/resume a specific note's stopwatch from the overview (resume respects
// the timer mode, like starting from the panel does).
async function pauseTimerFor(id) {
  if (!isRunning(timers[id])) return;
  parkTimer(id);
  await persistTimers();
  if (id === currentId && !ui.timerPanel.hidden) renderTimer();
}

async function resumeTimerFor(id) {
  const mode = timerMode();
  if (mode === "single") {
    for (const [oid] of otherTimers(id)) await commitTimer(oid);
  } else if (mode === "per-note") {
    for (const [oid, t] of otherTimers(id)) if (t.runningSince) parkTimer(oid);
  }
  const t = timers[id];
  if (t && !t.runningSince) t.runningSince = Date.now();
  await persistTimers();
  if (id === currentId && !ui.timerPanel.hidden) renderTimer();
}

function activeTimerCount() {
  return Object.keys(timers).length + (countdownActive() ? 1 : 0);
}

function openTimers() {
  closeMenus();
  currentId = null;
  showView("timers");
  renderTimers();
}

// Open a note and drop straight into its time tracker on the given tab.
async function openNoteTimer(id, tab) {
  await openEditor(id);
  timerTab = tab;
  openTimer();
}

function timerRowMarkup(opts) {
  const row = document.createElement("div");
  row.className = "timer-row" + (opts.countdown ? " cd" : "");
  if (opts.countdown) row.dataset.cd = "1";
  else row.dataset.note = opts.noteId;

  const toggle = document.createElement("button");
  toggle.className = "tr-toggle";
  toggle.title = opts.running ? "Pause" : "Resume";
  toggle.append(svgIcon(opts.running ? ICON_PAUSE : ICON_PLAY, true));
  toggle.classList.toggle("running", opts.running);
  toggle.addEventListener("click", opts.onToggle);

  const open = document.createElement("button");
  open.className = "tr-open";
  const title = document.createElement("span");
  title.className = "tr-title";
  title.textContent = opts.title;
  const time = document.createElement("span");
  time.className = "tr-time";
  time.textContent = opts.time;
  open.append(title, time);
  open.addEventListener("click", opts.onOpen);

  row.append(toggle, open);
  return row;
}

function renderTimers() {
  ui.timersBody.textContent = "";
  const entries = Object.entries(timers).filter(
    ([noteId]) => notes[noteId] && !notes[noteId].deletedAt
  );
  const cdActive = countdownActive();
  if (!entries.length && !cdActive) {
    const p = document.createElement("p");
    p.className = "hint agenda-empty";
    p.textContent = "No active timers. Start one from a note’s ⏱ time tracker.";
    ui.timersBody.append(p);
    return;
  }

  if (cdActive) {
    const running = Boolean(countdown && countdown.running);
    const label = countdown.pomodoro
      ? countdown.phase === "focus"
        ? "Countdown · Focus"
        : "Countdown · Break"
      : "Countdown";
    ui.timersBody.append(
      timerRowMarkup({
        countdown: true,
        running,
        title: label,
        time: formatClock(countdownRemaining()),
        onToggle: () => (running ? pauseCountdown() : startCountdown()),
        onOpen: () => {
          if (countdown && countdown.noteId && notes[countdown.noteId]) {
            openNoteTimer(countdown.noteId, "countdown");
          }
        },
      })
    );
  }

  // Stopwatch timers: running first, then longest-elapsed first.
  entries.sort((a, b) => {
    const ra = isRunning(a[1]) ? 1 : 0;
    const rb = isRunning(b[1]) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return timerElapsed(b[1]) - timerElapsed(a[1]);
  });
  for (const [noteId, t] of entries) {
    const running = isRunning(t);
    ui.timersBody.append(
      timerRowMarkup({
        noteId,
        running,
        title: titleOf(notes[noteId]),
        time: formatClock(timerElapsed(t)),
        onToggle: () => (running ? pauseTimerFor(noteId) : resumeTimerFor(noteId)),
        onOpen: () => openNoteTimer(noteId, "stopwatch"),
      })
    );
  }
}

// Cheap per-second update of just the live time labels (no rebuild).
function paintTimersView() {
  for (const row of ui.timersBody.querySelectorAll(".timer-row")) {
    const timeEl = row.querySelector(".tr-time");
    if (!timeEl) continue;
    if (row.dataset.cd) {
      if (countdown) timeEl.textContent = formatClock(countdownRemaining());
    } else {
      const t = timers[row.dataset.note];
      if (t) timeEl.textContent = formatClock(timerElapsed(t));
    }
  }
}

// ---- Reminders (per-note due dates; a note may have several) ----

// Each note's reminders are an array of { id, at }. Normalize the legacy
// single { at } object into that shape.
function normalizeReminderEntry(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter((r) => r && r.at);
  if (entry.at) return [{ id: crypto.randomUUID(), at: entry.at }];
  return [];
}

function remindersFor(id) {
  return (reminders[id] || []).slice().sort((a, b) => a.at - b.at);
}

// All reminders across notes, flattened and sorted — for the Agenda view.
function allReminders() {
  const out = [];
  for (const [noteId, arr] of Object.entries(reminders)) {
    const note = notes[noteId];
    if (!note || note.deletedAt) continue;
    for (const r of arr) out.push({ noteId, id: r.id, at: r.at });
  }
  return out.sort((a, b) => a.at - b.at);
}

// datetime-local expects "YYYY-MM-DDTHH:MM" in the user's local time.
function toLocalInput(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Compact due label for the list chip: time if today, "Tmrw HH:MM", else "MMM D".
function formatReminder(at) {
  const d = new Date(at);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === tomorrow.toDateString()) return `Tmrw ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

// Full datetime for the sheet's reminder list rows.
function formatReminderFull(at) {
  const d = new Date(at);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refreshReminderMenuItem() {
  const n = (reminders[currentId] || []).length;
  ui.menuReminder.textContent = n ? `Reminders (${n})…` : "Set reminder…";
}

function openReminderSheet() {
  ui.moreMenu.hidden = true;
  if (!currentId) return;
  const note = notes[currentId];
  ui.reminderFor.textContent = note ? `“${titleOf(note)}”` : "";
  ui.reminderAt.value = toLocalInput(Date.now() + 3600000);
  renderReminderList();
  ui.reminderSheet.hidden = false;
  ui.reminderAt.focus();
}

function renderReminderList() {
  ui.reminderList.textContent = "";
  const arr = remindersFor(currentId);
  if (!arr.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No reminders yet.";
    ui.reminderList.append(p);
    return;
  }
  for (const r of arr) {
    const row = document.createElement("div");
    row.className = "reminder-row";
    row.classList.toggle("overdue", r.at < Date.now());
    const when = document.createElement("span");
    when.className = "rr-when";
    when.textContent = formatReminderFull(r.at);
    const del = document.createElement("button");
    del.className = "rr-del";
    del.title = "Remove reminder";
    del.textContent = "✕";
    del.addEventListener("click", () => removeReminder(r.id));
    row.append(when, del);
    ui.reminderList.append(row);
  }
}

function closeReminderSheet() {
  ui.reminderSheet.hidden = true;
}

// "Add" appends a reminder and keeps the sheet open so several can be added.
async function addReminder() {
  if (!currentId || !ui.reminderAt.value) return;
  const at = new Date(ui.reminderAt.value).getTime();
  if (Number.isNaN(at)) return;
  const arr = (reminders[currentId] || []).concat({ id: crypto.randomUUID(), at });
  reminders = { ...reminders, [currentId]: arr };
  await saveReminders(reminders);
  refreshReminderMenuItem();
  renderReminderList();
  ui.reminderAt.value = toLocalInput(at + 3600000); // ready for the next
}

async function removeReminder(rid) {
  const arr = (reminders[currentId] || []).filter((r) => r.id !== rid);
  const next = { ...reminders };
  if (arr.length) next[currentId] = arr;
  else delete next[currentId];
  reminders = next;
  await saveReminders(reminders);
  refreshReminderMenuItem();
  renderReminderList();
}

// ---- Agenda / Upcoming ----

function openAgenda() {
  closeMenus();
  currentId = null;
  showView("agenda");
  renderAgenda();
}

// A compact "when" label for an agenda row (the group header carries the day,
// but This week / Later span days, so include enough context).
function agendaWhen(at) {
  const d = new Date(at);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at < start.getTime() + 7 * 86400000)
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function renderAgenda() {
  ui.agendaBody.textContent = "";
  const items = allReminders();
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "hint agenda-empty";
    p.textContent = "No reminders scheduled. Add one from a note’s ⋯ menu → Reminders.";
    ui.agendaBody.append(p);
    return;
  }
  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayStart = start.getTime();
  const tomorrowStart = todayStart + 86400000;
  const dayAfter = tomorrowStart + 86400000;
  const weekEnd = todayStart + 7 * 86400000;
  const order = ["Overdue", "Today", "Tomorrow", "This week", "Later"];
  const groups = { Overdue: [], Today: [], Tomorrow: [], "This week": [], Later: [] };
  for (const it of items) {
    if (it.at < now) groups.Overdue.push(it);
    else if (it.at < tomorrowStart) groups.Today.push(it);
    else if (it.at < dayAfter) groups.Tomorrow.push(it);
    else if (it.at < weekEnd) groups["This week"].push(it);
    else groups.Later.push(it);
  }
  for (const name of order) {
    const list = groups[name];
    if (!list.length) continue;
    const head = document.createElement("div");
    head.className = "agenda-head";
    head.classList.toggle("overdue", name === "Overdue");
    head.textContent = name;
    ui.agendaBody.append(head);
    for (const it of list) {
      const row = document.createElement("button");
      row.className = "agenda-row";
      const when = document.createElement("span");
      when.className = "ag-when";
      when.textContent = agendaWhen(it.at);
      const title = document.createElement("span");
      title.className = "ag-title";
      title.textContent = titleOf(notes[it.noteId]);
      row.append(when, title);
      row.addEventListener("click", () => openEditor(it.noteId));
      ui.agendaBody.append(row);
    }
  }
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
  refreshPinItem();
  refreshHomePinItem();
  refreshReminderMenuItem();
  ui.moreMenu.hidden = !ui.moreMenu.hidden;
});

ui.menuPin.addEventListener("click", async () => {
  await togglePin();
  ui.moreMenu.hidden = true;
});

ui.menuHomepin.addEventListener("click", async () => {
  const note = notes[currentId];
  note.homePinned = !note.homePinned;
  note.updatedAt = Date.now();
  await saveNote(note);
  refreshHomePinItem();
  ui.moreMenu.hidden = true;
});

ui.menuFolder.addEventListener("click", () => openFolderPicker());
ui.menuReminder.addEventListener("click", openReminderSheet);
ui.reminderSave.addEventListener("click", addReminder);
ui.reminderCancel.addEventListener("click", closeReminderSheet);
ui.reminderAt.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addReminder();
  }
});
ui.reminderQuick.addEventListener("click", (event) => {
  const b = event.target.closest("button[data-mins]");
  if (b) ui.reminderAt.value = toLocalInput(Date.now() + Number(b.dataset.mins) * 60000);
});
ui.reminderSheet.addEventListener("click", (event) => {
  if (event.target === ui.reminderSheet) closeReminderSheet();
});

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
  const item = event.target.closest("li");
  if (selectionMode) {
    if (item && item.dataset.id) toggleSelect(item.dataset.id);
    return;
  }
  const chip = event.target.closest(".tag-chip");
  if (chip) {
    ui.search.value = chip.dataset.site || `#${chip.dataset.tag}`;
    renderList();
    return;
  }
  if (item && item.dataset.id) openEditor(item.dataset.id);
});

// Bulk selection.
ui.selectToggle.addEventListener("click", () =>
  selectionMode ? exitSelection() : enterSelection()
);
ui.selCancel.addEventListener("click", exitSelection);
ui.selAll.addEventListener("click", toggleSelectAll);
ui.selMove.addEventListener("click", bulkMove);
ui.selDelete.addEventListener("click", bulkDelete);

ui.search.addEventListener("input", renderList);
// Infinite scroll: load the next batch as the list nears its bottom.
ui.listView.addEventListener("scroll", maybeLoadMore, { passive: true });

// Hamburger menu (top row).
ui.menuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = ui.mainMenu.hidden;
  closeMenus();
  const n = activeTimerCount();
  ui.mmTimers.textContent = n ? `Timers (${n})` : "Timers";
  ui.mainMenu.hidden = !open;
});
ui.mmTimers.addEventListener("click", openTimers);
ui.mmAgenda.addEventListener("click", openAgenda);
ui.mmFolder.addEventListener("click", () => {
  closeMenus();
  openFolderEdit(null);
});
ui.mmSettings.addEventListener("click", openSettings);
ui.mmExport.addEventListener("click", () => {
  closeMenus();
  exportAll();
});
ui.mmImport.addEventListener("click", () => {
  closeMenus();
  ui.importFile.click();
});

ui.back.addEventListener("click", async () => {
  await flushSave();
  openList();
});
ui.settingsBack.addEventListener("click", openList);
ui.agendaBack.addEventListener("click", openList);
ui.timersBack.addEventListener("click", openList);

ui.modeWrite.addEventListener("click", () => {
  setMode("write");
  rememberMode("write");
});
ui.modePreview.addEventListener("click", () => {
  setMode("preview");
  rememberMode("preview");
});

ui.editor.addEventListener("input", () => {
  renderCounts();
  scheduleSave();
  if (!ui.findBar.hidden) runFind(false);
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
  if (!ui.reminderSheet.hidden) {
    closeReminderSheet();
  } else if (!ui.folderEdit.hidden) {
    closeFolderEdit();
  } else if (!ui.folderPicker.hidden) {
    closeFolderPicker();
  } else if (!ui.findBar.hidden) {
    finishFind();
  } else if (!ui.historyPanel.hidden) {
    ui.historyPanel.hidden = true;
  } else if (!ui.timerPanel.hidden) {
    ui.timerPanel.hidden = true;
  } else if (selectionMode) {
    exitSelection();
  } else if (!ui.editorView.hidden) {
    ui.back.click();
  } else if (!ui.settingsView.hidden || !ui.agendaView.hidden || !ui.timersView.hidden) {
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

ui.pin.addEventListener("click", togglePin);

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
ui.findInput.addEventListener("input", () => runFind());
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

// Time tracker.
ui.timerBtn.addEventListener("click", () => {
  if (ui.timerPanel.hidden) openTimer();
  else ui.timerPanel.hidden = true;
});
ui.timerClose.addEventListener("click", () => (ui.timerPanel.hidden = true));
ui.timerChip.addEventListener("click", () => {
  // If the chip reflects a single timer on another note, jump to it; otherwise
  // (current note's timer, or several elsewhere) open the panel.
  const others = currentId ? otherTimers(currentId) : Object.entries(timers);
  if (!timerFor(currentId) && others.length === 1) openEditor(others[0][0]);
  else openTimer();
});
ui.timerStart.addEventListener("click", startTimer);
ui.timerPause.addEventListener("click", pauseTimer);
ui.timerSave.addEventListener("click", saveTimerSession);

// Stopwatch / Countdown tabs and countdown controls.
ui.tabStopwatch.addEventListener("click", () => switchTimerTab("stopwatch"));
ui.tabCountdown.addEventListener("click", () => switchTimerTab("countdown"));
ui.cdStart.addEventListener("click", startCountdown);
ui.cdPause.addEventListener("click", pauseCountdown);
ui.cdReset.addEventListener("click", resetCountdown);
ui.cdPomodoro.addEventListener("change", renderCountdown);
ui.cdPresets.addEventListener("click", (event) => {
  const b = event.target.closest("button[data-min]");
  if (b) setCountdownPreset(Number(b.dataset.min));
});
// Custom minutes: update the draft length live without fighting the typist.
ui.cdCustom.addEventListener("input", () => {
  const v = parseInt(ui.cdCustom.value, 10);
  if (Number.isNaN(v)) return;
  cdDraftMin = Math.min(600, Math.max(1, v));
  ui.cdPomodoro.checked = false;
  if (!countdownActive()) {
    countdown = null;
    ui.cdDisplay.textContent = formatClock(cdDraftMin * 60000);
    for (const b of ui.cdPresets.querySelectorAll("button")) {
      b.classList.toggle("sel", Number(b.dataset.min) === cdDraftMin);
    }
  }
});
ui.cdCustom.addEventListener("change", () => {
  ui.cdCustom.value = String(cdDraftMin); // normalize to the clamped value
  renderCountdown();
});
ui.cdCustom.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    ui.cdCustom.value = String(cdDraftMin);
    startCountdown();
  }
});
ui.timerReset.addEventListener("click", resetTimer);

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

ui.defaultView.addEventListener("change", async () => {
  settings.defaultView = ui.defaultView.value;
  await saveSettings(settings);
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

ui.homeShowAll.addEventListener("change", async () => {
  settings.homeShowsAll = ui.homeShowAll.checked;
  await saveSettings(settings);
});

ui.timerMode.addEventListener("change", async () => {
  settings.timerMode = ui.timerMode.value;
  renderTimerModeHint();
  await saveSettings(settings);
});

ui.timerSound.addEventListener("change", async () => {
  settings.timerSound = ui.timerSound.checked;
  // Enabling it is a user gesture — prime audio and give an audible preview.
  if (settings.timerSound) playChime();
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

// Keep timers coherent if another sidebar window starts/stops one, or if a
// note's sessions change elsewhere.
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if ("timers" in changes) {
    timers = changes.timers.newValue || {};
    await refreshFolderTimes();
    ensureTick();
    if (!ui.timerPanel.hidden) renderTimer();
    else renderTimerChip();
    if (!ui.listView.hidden) renderList();
  }
  if (currentId && `time:${currentId}` in changes) {
    timeEntries = changes[`time:${currentId}`].newValue || [];
    if (!ui.timerPanel.hidden) renderTimer();
  }
  // The background advances/ends the countdown (Pomodoro phase changes, expiry).
  if ("countdown" in changes) {
    countdown = changes.countdown.newValue || null;
    ensureTick();
    if (!ui.timerPanel.hidden && timerTab === "countdown") renderCountdown();
  }
  // The background flags each phase end here; play the optional chime.
  if (changes.countdownEnded && changes.countdownEnded.newValue && settings.timerSound) {
    playChime();
  }
  // Reminders may change when the background fires (and clears) one.
  if ("reminders" in changes) {
    reminders = changes.reminders.newValue || {};
    if (!ui.listView.hidden) renderList();
    if (!ui.agendaView.hidden) renderAgenda();
    if (!ui.reminderSheet.hidden) renderReminderList();
    if (currentId) refreshReminderMenuItem();
  }
  // A clicked reminder notification asks the panel to open a note.
  if (changes.openNote && changes.openNote.newValue) {
    const id = changes.openNote.newValue;
    await browser.storage.local.remove("openNote");
    if (notes[id]) openEditor(id);
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
  [notes, settings, folders, viewModes] = await Promise.all([
    loadNotes(),
    loadSettings(),
    loadFolders(),
    loadViewModes(),
  ]);
  // Drop remembered view modes for notes that no longer exist.
  let prunedViewModes = false;
  for (const id of Object.keys(viewModes)) {
    if (!notes[id]) {
      delete viewModes[id];
      prunedViewModes = true;
    }
  }
  if (prunedViewModes) saveViewModes(viewModes);
  buildFolderControls();
  try {
    sitePermission = await browser.permissions.contains({ permissions: ["tabs"] });
  } catch {
    sitePermission = false;
  }
  if (sitePermission) startSiteTracking();
  renderStorageBadge();
  applyEditorPrefs();
  // Resume any timers left running when the sidebar last closed (migrating the
  // v0.10 single-timer key), dropping any whose note is gone, and seed folder
  // (project) totals.
  timers = await loadTimers();
  let prunedTimers = false;
  for (const id of Object.keys(timers)) {
    if (!notes[id]) {
      delete timers[id];
      prunedTimers = true;
    }
  }
  if (prunedTimers) await saveTimers(timers);
  // Countdown + reminders (both local-only, driven by the background).
  [countdown, reminders] = await Promise.all([loadCountdown(), loadReminders()]);
  // Migrate any legacy single-object reminders to the { id, at }[] shape.
  let remindersMigrated = false;
  for (const [noteId, entry] of Object.entries(reminders)) {
    if (!Array.isArray(entry)) {
      reminders[noteId] = normalizeReminderEntry(entry);
      remindersMigrated = true;
    }
  }
  if (remindersMigrated) await saveReminders(reminders);
  await refreshFolderTimes();
  ensureTick();
  renderTimerChip();
  openList();
  // Purge notes that have sat in the trash longer than 30 days.
  const cutoff = Date.now() - TRASH_TTL_MS;
  for (const note of Object.values(notes)) {
    if (note.deletedAt && note.deletedAt < cutoff) await purgeNote(note.id);
  }
  // If the sidebar was just launched by the quick-capture command, act on it.
  const { quickCapture } = await browser.storage.local.get("quickCapture");
  if (quickCapture) await handleQuickCapture(quickCapture);
  // If a reminder notification was clicked while the sidebar was closed, open
  // the note it points at.
  const { openNote } = await browser.storage.local.get("openNote");
  if (openNote) {
    await browser.storage.local.remove("openNote");
    if (notes[openNote]) await openEditor(openNote);
  }
})();
