// @ts-check
// File-based sync for the web app.
//
// The user picks one `quiet-notes.json` inside a folder they already sync
// (Dropbox, OneDrive, Syncthing, iCloud…). We read it on start, merge it in,
// and write back — debounced — whenever anything changes. That gives real
// cross-device sync with **zero servers**: their cloud does the moving, and we
// never see the data. See docs/SYNC.md.
//
// Merging is the same recency/union logic the extension's import uses
// (sidebar/backup.js), so two devices editing different notes never collide and
// a re-sync never doubles time entries.
//
// Requires the File System Access API — Chromium desktop only. Firefox and
// Safari fall back to manual export/import (and Firefox users have the
// extension, which has Firefox Sync).

import { buildBackup, applyBackup } from "../sidebar/backup.js";
import { onStorageChange } from "../sidebar/storage.js";

const HANDLE_DB = "quiet-notes-sync";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "backupFile";
const FILENAME = "quiet-notes.json";
const PUSH_DEBOUNCE_MS = 1500;

/** Keys whose changes mean the backup is stale. */
const SYNCED_KEY = /^(note:|folder:|time:)/;

/** @type {any} */
let handle = null;
/** @type {number|undefined} */
let pushTimer;
/** True while we are writing a pull into storage, so it doesn't echo back. */
let applying = false;

const state = {
  supported: isSupported(),
  /** connected | needs-permission | off */
  status: "off",
  name: "",
  lastSync: 0,
  error: "",
};

/** @type {Array<() => void>} */
const watchers = [];

export function isSupported() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export function getState() {
  return { ...state };
}

/** @param {() => void} fn */
export function onChange(fn) {
  watchers.push(fn);
}

function emit() {
  for (const fn of watchers) fn();
}

// ---- Handle persistence (its own tiny IndexedDB, so app storage stays clean) ----

function handleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {any} value */
async function storeHandle(value) {
  /** @type {any} */
  const db = await handleDb();
  const tx = db.transaction(HANDLE_STORE, "readwrite");
  if (value) tx.objectStore(HANDLE_STORE).put(value, HANDLE_KEY);
  else tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

async function readHandle() {
  /** @type {any} */
  const db = await handleDb();
  const store = db.transaction(HANDLE_STORE, "readonly").objectStore(HANDLE_STORE);
  return new Promise((resolve) => {
    const req = store.get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

// ---- Permission ----

/**
 * File handles survive a reload, but the permission grant may not — and
 * re-requesting it needs a user gesture, so on load we only *query*.
 * @param {boolean} interactive
 */
async function ensurePermission(interactive) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if (!interactive) return false;
  return (await handle.requestPermission(opts)) === "granted";
}

// ---- Transfer ----

async function pull() {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return { added: 0, updated: 0 }; // brand-new empty file
  const payload = JSON.parse(text);
  applying = true;
  try {
    return await applyBackup(payload);
  } finally {
    applying = false;
  }
}

async function push() {
  // includeTrashed so a deletion on one device propagates instead of being
  // resurrected by the other device's copy.
  const payload = await buildBackup({ includeTrashed: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    syncNow().catch(() => {});
  }, PUSH_DEBOUNCE_MS);
}

/** Pull then push, so both sides end up holding the union. */
export async function syncNow() {
  if (!handle || state.status !== "connected") return;
  try {
    await pull();
    await push();
    state.lastSync = Date.now();
    state.error = "";
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  }
  emit();
}

// ---- Lifecycle ----

/** Restore a previously chosen file, without prompting. */
export async function init() {
  if (!state.supported) return;
  handle = await readHandle();
  if (!handle) return;
  state.name = handle.name || FILENAME;
  state.status = (await ensurePermission(false)) ? "connected" : "needs-permission";
  if (state.status === "connected") await syncNow();
  emit();

  onStorageChange((changes) => {
    if (applying || state.status !== "connected") return;
    const relevant = Object.keys(changes).some(
      (key) => SYNCED_KEY.test(key) || key === "reminders"
    );
    if (relevant) schedulePush();
  });
}

/** Must be called from a click: both the picker and permission need a gesture. */
export async function chooseFile() {
  if (!state.supported) return;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: FILENAME,
      types: [
        { description: "Quiet Notes backup", accept: { "application/json": [".json"] } },
      ],
    });
    await storeHandle(handle);
    state.name = handle.name || FILENAME;
    state.status = "connected";
    state.error = "";
    await syncNow();
  } catch (error) {
    // AbortError just means the user dismissed the picker.
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      state.error = error instanceof Error ? error.message : String(error);
    }
  }
  emit();
}

/** Re-grant permission for an already-chosen file (also needs a gesture). */
export async function reconnect() {
  if (await ensurePermission(true)) {
    state.status = "connected";
    await syncNow();
  }
  emit();
}

export async function disconnect() {
  clearTimeout(pushTimer);
  handle = null;
  await storeHandle(null);
  state.status = "off";
  state.name = "";
  state.lastSync = 0;
  state.error = "";
  emit();
}
