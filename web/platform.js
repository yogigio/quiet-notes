// Web platform shim for Quiet Notes.
//
// The sidebar UI (sidebar/panel.js) and the background logic (background.js)
// are written against the WebExtension APIs. Rather than fork them for the web,
// this file implements the small slice of those APIs they actually use, backed
// by web standards — so the *same* files run unchanged in a browser tab.
//
//   storage.local      -> IndexedDB
//   storage.onChanged  -> local dispatch + BroadcastChannel (cross-tab)
//   alarms             -> stored due-times checked once a second
//   notifications      -> the Notifications API
//   storage.sync       -> inert (the web app does not use Firefox Sync)
//   menus/commands/tabs/permissions/action/sidebarAction -> inert stubs
//
// See docs/SYNC.md for why, and for the known limitations.
//
// Loaded as a classic script so `window.browser` exists before any module runs.

(function () {
  "use strict";

  // ---- IndexedDB key/value store (mirrors storage.local's shape) ----

  const DB_NAME = "quiet-notes";
  const STORE = "kv";
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function readAll() {
    const store = (await db()).transaction(STORE, "readonly").objectStore(STORE);
    const [keys, values] = await Promise.all([
      request(store.getAllKeys()),
      request(store.getAll()),
    ]);
    const out = {};
    keys.forEach((key, i) => (out[key] = values[i]));
    return out;
  }

  async function readKeys(keys) {
    const store = (await db()).transaction(STORE, "readonly").objectStore(STORE);
    const out = {};
    for (const key of keys) {
      const value = await request(store.get(key));
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  // ---- Change notification (in-page listeners + other tabs) ----

  const changeListeners = [];
  const channel = "BroadcastChannel" in self ? new BroadcastChannel("quiet-notes") : null;

  function dispatch(changes) {
    for (const fn of changeListeners) {
      try {
        fn(changes, "local");
      } catch (error) {
        console.error("storage.onChanged listener failed", error);
      }
    }
  }

  if (channel) {
    // Another tab wrote: apply the same change event locally (but don't echo).
    channel.onmessage = (event) => dispatch(event.data);
  }

  function announce(changes) {
    if (!Object.keys(changes).length) return;
    dispatch(changes);
    if (channel) channel.postMessage(changes);
  }

  const local = {
    async get(keys) {
      if (keys == null) return readAll();
      if (typeof keys === "string") return readKeys([keys]);
      if (Array.isArray(keys)) return readKeys(keys);
      // Object form: keys with default values.
      const got = await readKeys(Object.keys(keys));
      return { ...keys, ...got };
    },

    async set(items) {
      const before = await readKeys(Object.keys(items));
      const tx = (await db()).transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        store.put(value, key);
        changes[key] = { oldValue: before[key], newValue: value };
      }
      await done(tx);
      announce(changes);
    },

    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const before = await readKeys(list);
      const tx = (await db()).transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const changes = {};
      for (const key of list) {
        if (!(key in before)) continue;
        store.delete(key);
        changes[key] = { oldValue: before[key], newValue: undefined };
      }
      await done(tx);
      announce(changes);
    },

    async clear() {
      const tx = (await db()).transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      await done(tx);
    },
  };

  // storage.sync is inert here: the web app has no Firefox Sync. The shape is
  // kept so background.js's mirror never throws if it is somehow enabled.
  const sync = {
    async get() {
      return {};
    },
    async set() {},
    async remove() {},
    async clear() {},
  };

  // ---- Alarms ----
  // Checked against wall-clock time once a second rather than scheduled with
  // setTimeout, so far-future reminders don't overflow the timer and a laptop
  // waking from sleep still fires anything that came due.

  const alarms = new Map(); // name -> when (ms)
  const alarmListeners = [];

  function fireDueAlarms() {
    const now = Date.now();
    for (const [name, when] of [...alarms]) {
      if (when > now) continue;
      alarms.delete(name);
      for (const fn of alarmListeners) {
        try {
          fn({ name, scheduledTime: when });
        } catch (error) {
          console.error("alarm listener failed", error);
        }
      }
    }
  }
  setInterval(fireDueAlarms, 1000);

  // ---- Notifications ----

  const notificationClickListeners = [];

  function showNotification(id, options) {
    if (!("Notification" in self)) return;
    const present = () => {
      try {
        const note = new Notification(options.title || "Quiet Notes", {
          body: options.message || "",
          icon: options.iconUrl,
          tag: id,
        });
        note.onclick = () => {
          self.focus();
          note.close();
          for (const fn of notificationClickListeners) {
            try {
              fn(id);
            } catch (error) {
              console.error("notification click listener failed", error);
            }
          }
        };
      } catch (error) {
        console.error("notification failed", error);
      }
    };
    if (Notification.permission === "granted") present();
    else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => p === "granted" && present());
    }
  }

  // ---- Small helpers for the inert stubs ----

  function registry(list) {
    return { addListener: (fn) => list.push(fn), removeListener() {}, hasListener: () => false };
  }
  const noopEvent = () => registry([]);

  window.browser = {
    storage: {
      local,
      sync,
      onChanged: registry(changeListeners),
    },
    alarms: {
      create(name, info) {
        alarms.set(name, (info && info.when) || Date.now());
      },
      async clear(name) {
        return alarms.delete(name);
      },
      async clearAll() {
        alarms.clear();
        return true;
      },
      async getAll() {
        return [...alarms].map(([name, when]) => ({ name, scheduledTime: when }));
      },
      onAlarm: registry(alarmListeners),
    },
    notifications: {
      create: showNotification,
      clear() {},
      onClicked: registry(notificationClickListeners),
    },
    runtime: {
      // Everything is served relative to the app root on the web.
      getURL: (path) => path,
      onInstalled: noopEvent(),
      onStartup: noopEvent(),
    },
    // Browser-chrome APIs with no web equivalent — inert so shared code runs.
    menus: { create() {}, removeAll() {}, onClicked: noopEvent() },
    commands: { onCommand: noopEvent() },
    action: { onClicked: noopEvent() },
    sidebarAction: { open() {}, toggle() {} },
    tabs: {
      async query() {
        return [];
      },
      onUpdated: noopEvent(),
      onActivated: noopEvent(),
    },
    // "Site notes" needs the tabs permission, which never exists on the web, so
    // reporting false keeps that feature cleanly switched off.
    permissions: {
      async contains() {
        return false;
      },
      async request() {
        return false;
      },
      async remove() {},
    },
  };

  // Catch up on anything that came due while the app was closed, once the
  // background script has registered its alarms.
  window.__quietNotesCatchUp = fireDueAlarms;
})();
