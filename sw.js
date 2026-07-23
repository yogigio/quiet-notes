// Service worker: makes Quiet Notes work offline.
//
// Lives at the site root so its scope covers the shared sidebar/ files the web
// app reuses. Notes themselves live in IndexedDB and never touch the network —
// this only caches the app shell.

const CACHE = "quiet-notes-v1";

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "web/platform.js",
  "web/app.js",
  "sidebar/panel.html",
  "sidebar/panel.css",
  "sidebar/panel.js",
  "sidebar/storage.js",
  "sidebar/markdown.js",
  "background.js",
  "icons/note.svg",
];

self.addEventListener("install", (event) => {
  // addAll fails the whole install if any file 404s, so add them individually
  // and let a missing optional file slide.
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => {}))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Cache-first for the shell: the app is static, and this keeps it instant and
// fully usable offline. A new CACHE name on release pulls fresh files.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("index.html"));
    })
  );
});
