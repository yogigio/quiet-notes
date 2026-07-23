// Web app bootstrap.
//
// Deliberately reuses the extension's own files rather than copying them, so
// there is one source of truth for the markup, styles and logic:
//
//   sidebar/panel.html  -> body markup, injected below
//   sidebar/panel.css   -> linked from index.html
//   background.js       -> alarms + notifications (via web/platform.js)
//   sidebar/panel.js    -> the whole UI
//
// web/platform.js must already have run: it defines window.browser.

import * as filesync from "./filesync.js";

(async () => {
  const fail = (message, error) => {
    console.error(message, error);
    const p = document.createElement("p");
    p.className = "boot-error";
    p.textContent = message;
    document.body.append(p);
  };

  try {
    // 1. Shared markup. The <script type="module"> inside panel.html stays
    //    inert when injected this way, so panel.js is loaded explicitly below.
    const response = await fetch("sidebar/panel.html");
    if (!response.ok) throw new Error(`panel.html: ${response.status}`);
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    document.body.insertAdjacentHTML("beforeend", doc.body.innerHTML);

    // 2. Background logic (reminder/countdown alarms + notifications). It is a
    //    classic script that registers listeners on window.browser.
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "background.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("background.js failed to load"));
      document.head.append(script);
    });

    // 3. The UI itself.
    await import("../sidebar/panel.js");

    // 4. Hide the settings that only mean something inside the extension, and
    //    add the web-only one (file sync).
    hideExtensionOnly();
    mountSyncSettings();

    // 5. Fire anything that came due while the app was closed.
    if (window.__quietNotesCatchUp) window.__quietNotesCatchUp();

    // 6. Reconnect a previously chosen sync file (never prompts on its own).
    filesync.init().catch((error) => console.warn("file sync init failed", error));

    document.body.classList.add("ready");
  } catch (error) {
    fail("Quiet Notes failed to start. See the console for details.", error);
    return;
  }

  // Offline support. Registered last so a broken service worker can never stop
  // the app from starting.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("service worker registration failed", error);
    });
  }
})();

// Firefox Sync and site notes are extension-only capabilities; showing their
// toggles on the web would promise something the app cannot do.
function hideExtensionOnly() {
  for (const id of ["sync-toggle", "site-toggle"]) {
    const input = document.getElementById(id);
    const section = input && input.closest(".setting");
    if (section) section.hidden = true;
  }
}

/** @param {string} label @param {() => any} onClick */
function actionButton(label, onClick) {
  const button = document.createElement("button");
  button.className = "wide-btn";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

// The web app's replacement for Firefox Sync: point it at a JSON file inside a
// folder the user already syncs, and notes merge both ways with no server.
function mountSyncSettings() {
  const body = document.getElementById("settings-body");
  if (!body) return;

  const section = document.createElement("section");
  section.className = "setting";
  const title = document.createElement("strong");
  title.textContent = "Sync file";
  const hint = document.createElement("p");
  hint.className = "hint";
  const actions = document.createElement("div");
  section.append(title, hint, actions);
  body.prepend(section);

  const render = () => {
    const state = filesync.getState();
    actions.textContent = "";

    if (!state.supported) {
      hint.textContent =
        "This browser can't pick a sync file (it needs the File System Access " +
        "API — Chrome, Edge or Opera on desktop). Use Export / Import below to " +
        "move notes between devices.";
      return;
    }

    if (state.status === "off") {
      hint.textContent =
        "Choose a quiet-notes.json inside a folder you already sync (Dropbox, " +
        "OneDrive, Syncthing…). Notes, folders, time entries and reminders " +
        "merge in both directions. No server is involved.";
      actions.append(actionButton("Choose sync file…", () => filesync.chooseFile()));
      return;
    }

    if (state.status === "needs-permission") {
      hint.textContent = `Reconnect to “${state.name}” to resume syncing — browsers ask again after a restart.`;
      actions.append(actionButton("Reconnect", () => filesync.reconnect()));
      actions.append(actionButton("Stop syncing", () => filesync.disconnect()));
      return;
    }

    const last = state.lastSync
      ? new Date(state.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "not yet";
    hint.textContent =
      `Syncing with “${state.name}”. Last sync: ${last}.` +
      (state.error ? ` Last error: ${state.error}` : "");
    actions.append(actionButton("Sync now", () => filesync.syncNow()));
    actions.append(actionButton("Stop syncing", () => filesync.disconnect()));
  };

  filesync.onChange(render);
  render();
}
