# Quiet Notes

Private, local-first notes in your Firefox sidebar. No servers, no accounts, no
tracking — your notes never leave your browser unless *you* export them or
opt in to sync through your own Firefox account (end-to-end encrypted).

## Features

- Notes list + editor with autosave, full-text search, pinning, word/char count
- **Rich formatting** with Markdown: toolbar (bold, italic, lists, quotes,
  code, links…) and a Write/Preview switch; notes stay portable plain text
- **Tags** (comma-separated in the editor; search with `#tag`)
- **Glossary notes**: lines of `source term = translation` render as a
  two-column table — click a row to copy the translation
- **Save selection**: right-click selected text on any page → appended to a
  pinned Inbox note (the extension still has zero access to page content)
- Per-note language for the spellcheck dictionary; RTL/mixed text handled
- **Opt-in sync** via Firefox Sync (off by default; quota meter in settings)
- Export/import as JSON; export as Markdown

Tip: to show the sidebar on the right, use Firefox Settings → General →
Browser Layout → "Show sidebar on the right". Sidebar position is a
browser-level setting extensions cannot (and should not) change.

## Principles

1. **Local-first.** `browser.storage.local` is the single source of truth.
2. **Zero collection.** The extension makes no network requests. Its only
   permissions are `storage` and `menus` (the right-click item) — neither
   grants access to page content or triggers an install warning.
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
background.js        Toolbar button, context menu, opt-in sync engine
sidebar/panel.html   Sidebar UI
sidebar/panel.css    Styling (follows the browser's light/dark theme)
sidebar/panel.js     UI logic
sidebar/storage.js   Persistence layer (storage.local)
docs/DESIGN.md       Architecture, sync protocol, feature roadmap
```

## Before publishing

- Replace the placeholder add-on id `quiet-notes@giorgi.notes` in
  `manifest.json` with an id you control, and `homepage_url` with your repo URL.
- Run `web-ext lint`.
