# Quiet Notes

Private, local-first notes in your Firefox sidebar. No servers, no accounts, no
tracking — your notes never leave your browser unless *you* export them or
turn on Firefox Sync (planned, opt-in).

## Principles

1. **Local-first.** `browser.storage.local` is the single source of truth.
2. **Zero collection.** The extension makes no network requests. The only
   permission it asks for is `storage`.
3. **Your data, portable.** One-click export/import to plain JSON. No lock-in.
4. **Readable code.** No build step, no framework, no minification — what you
   see in this repo is exactly what runs in the browser.

## Try it

The quickest way, no tooling needed:

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…** and pick `manifest.json` from this folder.
3. Open the sidebar with **Ctrl+Alt+N** (or View → Sidebar → Quiet Notes).

For development with auto-reload, install [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```
npm install --global web-ext
web-ext run
```

## Project layout

```
manifest.json        Extension manifest (MV3, sidebar_action)
sidebar/panel.html   Sidebar UI
sidebar/panel.css    Styling (follows the browser's light/dark theme)
sidebar/panel.js     UI logic
sidebar/storage.js   Persistence layer (storage.local)
docs/DESIGN.md       Architecture and feature roadmap
```

## Before publishing

- Replace the placeholder add-on id `quiet-notes@giorgi.notes` in
  `manifest.json` with an id you control, and `homepage_url` with your repo URL.
- Run `web-ext lint`.
