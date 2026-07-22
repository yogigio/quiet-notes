# Quiet Notes

Private, local-first notes in your Firefox sidebar. No servers, no accounts, no
tracking — your notes never leave your browser unless *you* export them or
opt in to sync through your own Firefox account (end-to-end encrypted).

## Features

- Notes list + editor with autosave, full-text search, pinning, word/char count
- **Rich formatting** with Markdown: toolbar (bold, italic, lists, quotes,
  code, links…) and a Write/Preview switch; notes stay portable plain text
- **Tags** (comma-separated in the editor; search with `#tag`)
- **Glossary notes**: lines of `source term == translation` (or
  tab-separated) render as a two-column table — click a row to copy the
  translation
- **Save selection**: right-click selected text on any page → appended to a
  pinned Inbox note (the extension still has zero access to page content)
- Per-note language for the spellcheck dictionary; RTL/mixed text handled
- **Checklists** (great for shopping/to-do lists): a toolbar checklist
  button, `- [ ]` items that toggle in Preview, and Enter continues the
  list automatically (empty item ends it)
- **Tables**: `| a | b |` pipe tables render in Preview and printouts
- **Wiki-links**: `[[Note title]]` links notes together, with backlinks
- **Version history**: earlier versions are snapshotted locally; restore anytime
- **Find in note** (Ctrl+F) with all matches highlighted; **quick capture**
  (Ctrl+Shift+Y) and single-note **print**
- **Scroll to top / bottom** buttons for long notes (Ctrl+Home / Ctrl+End
  also work in the editor)
- **Trash with undo**: deleted notes are recoverable for 30 days
- **Templates**: mark any note as a template, create new notes from it
- Adjustable note text size, monospace option, and a default view mode
  (a note reopens how you left it — Write or Preview)
- **Folders**: organize notes into color- and emoji-tagged folders you
  navigate into (like Claude/ChatGPT projects); tags stay cross-cutting.
  Filing a note tucks it into its folder — Home lists only unfiled notes
  (search still finds everything). A setting brings filed notes back to Home.
  **Pin** sends a note to the top of its list (the folder's top when filed);
  **Pin to Home** (⋯ menu) also surfaces a filed note at the top of Home while
  it stays in its folder
- **Bulk actions**: a Select button turns the list into checkboxes to move
  or trash many notes at once (with a single Undo)
- **Time tracking**: a per-note stopwatch (start / pause / save / reset)
  that keeps counting in the background — close the sidebar and it resumes.
  Saved sessions roll up into a per-note total (with words/hour) and a
  per-folder *project* total. Each note has its own timer; a setting chooses
  what starting one does to another that's running (pause it — the default —,
  save it, or keep both running). Local-only, but included in export/import
  for your billing records
- **Countdown & Pomodoro**: the timer has a Countdown tab with presets and a
  Pomodoro mode (25/5, auto-cycling) that notifies you when time's up — even
  if the sidebar is closed
- **Reminders & Agenda**: give a note one or several due dates (⋯ →
  Reminders…); a desktop notification fires at each and clicking it opens the
  note. The top-row ☰ menu's **Upcoming** view lists all reminders by day
  (Overdue / Today / Tomorrow / This week / Later). Reminders stay on this
  device and never sync
- **Site notes** (optional): link a note to the site you're on and it
  surfaces on top of the list when you return. Off by default — enabling
  it requests the `tabs` permission at runtime (hostname only, revoked
  instantly when you turn it off)
- **Opt-in sync** via Firefox Sync (off by default; quota meter in settings)
- Export/import as JSON; export as Markdown

Tip: to show the sidebar on the right, use Firefox Settings → General →
Browser Layout → "Show sidebar on the right". Sidebar position is a
browser-level setting extensions cannot (and should not) change.

## Principles

1. **Local-first.** `browser.storage.local` is the single source of truth.
2. **Zero collection.** The extension makes no network requests. Its
   permissions are `storage`, `menus` (the right-click item), and
   `alarms` + `notifications` (for the countdown and reminders) — none of
   which grants access to page content or triggers an install warning.
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
  `manifest.json` with an id you control. (`homepage_url` now points at the
  repo.)
- Run `web-ext lint`.
