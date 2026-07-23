// @ts-check
// Pure helpers shared by the panel: formatting, parsing, small DOM builders and
// the folder palette. Nothing here reads app state, so each function is
// independently testable and safe to reuse from any surface (sidebar or web).

/** @typedef {{ id: string, body: string, updatedAt: number, createdAt: number,
 *   pinned?: boolean, homePinned?: boolean, folderId?: string, tags?: string[],
 *   lang?: string, glossary?: boolean, template?: boolean, site?: string,
 *   deletedAt?: number, inbox?: boolean }} Note */
/** @typedef {{ accumulatedMs: number, runningSince: number|null }} Timer */
/** @typedef {{ start: number, end: number, ms: number }} TimeEntry */

// ---- Icons ----

const SVG_NS = "http://www.w3.org/2000/svg";

export const ICON_PIN =
  "M8 2.4l1.7 3.4 3.8.6-2.8 2.7.7 3.8L8 11.1l-3.4 1.8.7-3.8-2.8-2.7 3.8-.6z";
export const ICON_BOOK =
  "M8 4C6.8 3 5 2.7 3 3v9.5c2-.3 3.8 0 5 1 1.2-1 3-1.3 5-1V3c-2-.3-3.8 0-5 1zm0 0v9.5";
export const ICON_TPL = "M5.5 5.5h7v7h-7z M3 10.5V4.5A1.5 1.5 0 0 1 4.5 3H10";
export const ICON_CHEVRON = "M6.5 3.5 11 8l-4.5 4.5";
export const ICON_BACK = "M10 3.5 5.5 8l4.5 4.5";
export const ICON_HOME = "M2.7 7.8 8 3.3l5.3 4.5M4.3 6.7v5.8h7.4V6.7";
export const ICON_PLAY = "M5.5 3.5 12 8l-6.5 4.5z";
export const ICON_PAUSE = "M5 3.5h1.8v9H5z M9.2 3.5H11v9H9.2z";

/**
 * @param {string} pathData
 * @param {boolean} [filled]
 * @returns {SVGSVGElement}
 */
export function svgIcon(pathData, filled) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  if (filled) path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

// ---- Folder palette ----

/**
 * Curated modern palette (readable on light and dark as an accent/dot).
 * Indexed by an arbitrary stored key, so typed as a record with a fallback.
 * @type {Record<string, string>}
 */
export const FOLDER_COLORS = {
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

export const FOLDER_EMOJI = [
  "📁", "📂", "🗂️", "⭐", "📌", "💼", "📚", "📖",
  "📝", "🌐", "⚖️", "🗣️", "✏️", "🔖", "🧾", "💡",
  "🇩🇪", "🇬🇧", "🇺🇸", "🇫🇷", "🇪🇸", "🇮🇹", "🇷🇺", "🇬🇪",
];

/** @param {string} key */
export const colorHex = (key) => FOLDER_COLORS[key] || FOLDER_COLORS.blue;

// ---- Note text ----

/** First non-empty line, stripped of heading marks. @param {Note} note */
export function titleOf(note) {
  const firstLine = note.body.split("\n").find((line) => line.trim() !== "");
  return firstLine ? firstLine.trim().replace(/^#+\s*/, "").slice(0, 80) : "Untitled";
}

/** Second non-empty line, for the list card. @param {Note} note */
export function snippetOf(note) {
  const lines = note.body.split("\n").filter((line) => line.trim() !== "");
  return lines.length > 1 ? lines[1].trim().slice(0, 100) : "";
}

/** @param {string} text */
export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Free-text search, or `#tag` to match tags.
 * @param {Note} note @param {string} query
 */
export function matchesQuery(note, query) {
  if (!query) return true;
  if (query.startsWith("#")) {
    const tag = query.slice(1);
    return (note.tags || []).some((t) => t.toLowerCase().includes(tag));
  }
  return note.body.toLowerCase().includes(query) || (note.site || "").includes(query);
}

/**
 * Whether a note is pinned to the top of Home. An unfiled pinned note pins
 * itself there; a filed note pins to Home only via the explicit `homePinned`
 * flag, which also keeps it in its folder.
 * @param {Note} note
 */
export function pinnedOnHome(note) {
  return Boolean(note.homePinned) || (!note.folderId && Boolean(note.pinned));
}

/** HTML-escape for the few places note text reaches innerHTML. @param {string} s */
export function escapeForHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Markdown list continuation ----

/**
 * Describe the list marker a line starts with, and what the next line's marker
 * should be. Returns null for non-list lines.
 * @param {string} line
 * @returns {{ length: number, next: string }|null}
 */
export function listMarker(line) {
  let m = line.match(/^(\s*)- \[[ xX]\]\s/);
  if (m) return { length: m[0].length, next: `${m[1]}- [ ] ` };
  m = line.match(/^(\s*)([-*])\s/);
  if (m) return { length: m[0].length, next: `${m[1]}${m[2]} ` };
  m = line.match(/^(\s*)(\d+)([.)])\s/);
  if (m) return { length: m[0].length, next: `${m[1]}${Number(m[2]) + 1}${m[3]} ` };
  return null;
}

// ---- Glossary ----

/**
 * Split a glossary note into `term == translation` pairs. A line without a
 * separator stays plain text (a single `=` is not a separator — it appears in
 * ordinary prose).
 * @param {string} body
 * @returns {Array<{ text?: string, term?: string, translation?: string }>}
 */
export function parseGlossary(body) {
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

// ---- Time formatting ----

/** H:MM:SS, for live clocks. @param {number} ms */
export function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** Compact human totals: "2h 15m", "45m", "38s". @param {number} ms */
export function formatTotal(ms) {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** @param {number} timestamp */
export function relativeTime(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ---- Timers ----

/**
 * Elapsed time is always derived from timestamps, never a counter we
 * increment, so a closed sidebar loses nothing.
 * @param {Timer|null|undefined} timer
 */
export function timerElapsed(timer) {
  if (!timer) return 0;
  const live = timer.runningSince ? Date.now() - timer.runningSince : 0;
  return timer.accumulatedMs + live;
}

/** @param {Timer|null|undefined} timer */
export const isRunning = (timer) => Boolean(timer && timer.runningSince);

/** @param {TimeEntry[]} entries */
export function entriesTotalMs(entries) {
  return entries.reduce((sum, e) => sum + (e.ms || 0), 0);
}

/** Label for a logged session row. @param {TimeEntry} entry */
export function entryWhen(entry) {
  const d = new Date(entry.end || entry.start || Date.now());
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

// ---- Reminders ----

/**
 * A note's reminders are `{ id, at }[]`; normalize the legacy single `{ at }`
 * object into that shape.
 * @param {any} entry
 * @returns {Array<{ id: string, at: number }>}
 */
export function normalizeReminderEntry(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter((r) => r && r.at);
  if (entry.at) return [{ id: crypto.randomUUID(), at: entry.at }];
  return [];
}

/** datetime-local wants "YYYY-MM-DDTHH:MM" in local time. @param {number} ts */
export function toLocalInput(ts) {
  const d = new Date(ts);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Compact due label for a list chip. @param {number} at */
export function formatReminder(at) {
  const d = new Date(at);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === tomorrow.toDateString()) return `Tmrw ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

/** Full datetime for the reminder sheet. @param {number} at */
export function formatReminderFull(at) {
  return new Date(at).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "When" label for an agenda row. The group header carries the day, but
 * "This week"/"Later" span days, so include enough context.
 * @param {number} at
 */
export function agendaWhen(at) {
  const d = new Date(at);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at < start.getTime() + 7 * 86400000) {
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}
