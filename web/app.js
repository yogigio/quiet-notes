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

    // 4. Hide the settings that only mean something inside the extension.
    hideExtensionOnly();

    // 5. Fire anything that came due while the app was closed.
    if (window.__quietNotesCatchUp) window.__quietNotesCatchUp();

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
