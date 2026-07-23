// @ts-check
// The backup payload: one place that knows how to serialize everything worth
// keeping, and how to merge someone else's copy back in.
//
// Used by the extension's Export/Import buttons and by the web app's file sync
// (web/filesync.js), so both share exactly one set of merge rules:
//
//   • notes    — merged by recency (a record wins only if updatedAt is newer)
//   • folders  — same recency rule
//   • time     — union, de-duplicated by session start, so a re-import never
//                doubles billable hours
//   • reminders— union, de-duplicated by time
//
// See docs/SYNC.md for how this fits the wider sync picture.

import {
  loadNotes,
  loadFolders,
  loadAllTimeEntries,
  loadReminders,
  loadTimeEntries,
  saveFolder,
  saveTimeEntries,
  saveReminders,
  importNotes,
} from "./storage.js";
import { normalizeReminderEntry } from "./util.js";

/** @typedef {import("./util.js").Note} Note */

export const BACKUP_FORMAT = 1;

/**
 * Snapshot everything into a portable payload.
 *
 * @param {{ includeTrashed?: boolean }} [options]
 *   includeTrashed keeps soft-deleted notes (they carry `deletedAt`). File sync
 *   sets this so a deletion on one device propagates to the others — a manual
 *   export leaves them out, which is what someone asking for "my notes" means.
 * @returns {Promise<Record<string, any>>}
 */
export async function buildBackup({ includeTrashed = false } = {}) {
  const [notes, folders, allTime, reminders] = await Promise.all([
    loadNotes(),
    loadFolders(),
    loadAllTimeEntries(),
    loadReminders(),
  ]);

  const list = Object.values(notes)
    .filter((note) => includeTrashed || !note.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  /** @type {Record<string, any>} */
  const time = {};
  for (const note of list) {
    if (allTime[note.id] && allTime[note.id].length) time[note.id] = allTime[note.id];
  }

  return {
    app: "quiet-notes",
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    notes: list,
    folders: Object.values(folders),
    time,
    reminders,
  };
}

/**
 * Merge a payload into local storage. Never destructive: records only move
 * forward in time, and nothing is removed that the payload simply omits.
 *
 * @param {any} payload
 * @returns {Promise<{added: number, updated: number}>}
 */
export async function applyBackup(payload) {
  if (!payload || !Array.isArray(payload.notes)) {
    throw new Error("not a Quiet Notes backup");
  }

  const { added, updated } = await importNotes(payload.notes);

  if (Array.isArray(payload.folders)) {
    const existing = await loadFolders();
    for (const folder of payload.folders) {
      const current = existing[folder.id];
      if (!current || folder.updatedAt > current.updatedAt) await saveFolder(folder);
    }
  }

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

  if (payload.reminders && typeof payload.reminders === "object") {
    const merged = { ...(await loadReminders()) };
    for (const [noteId, entry] of Object.entries(payload.reminders)) {
      const incoming = normalizeReminderEntry(entry);
      if (!incoming.length) continue;
      const current = merged[noteId] || [];
      const times = new Set(current.map((r) => r.at));
      merged[noteId] = current.concat(
        incoming
          .filter((r) => !times.has(r.at))
          .map((r) => ({ id: crypto.randomUUID(), at: r.at }))
      );
    }
    await saveReminders(merged);
  }

  return { added, updated };
}
