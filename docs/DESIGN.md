# Quiet Notes — design & roadmap

## Goals

A sidebar note-taker for Firefox that the author (a translator) uses daily.
Privacy is the product: the extension stores nothing outside the user's
browser, collects nothing, and requests the minimum possible permissions.
Sync across devices is strictly opt-in and rides on Firefox Sync's
end-to-end encryption — no third-party or first-party servers, ever.

## Architecture

- **Manifest V3**, Firefox ≥ 115, `sidebar_action` panel. The UI runs in
  the sidebar page; a background event page (`background.js`) handles the
  toolbar button, the context menu, the quick-capture command, and the
  sync engine.
- **Persistence:** each note is stored under its own `storage.local` key
  (`note:<id>`); folders under `folder:<id>`. Per-record keys keep writes
  small, make `storage.onChanged` events precise, and map 1:1 onto sync
  mirroring. Sibling namespaces that are intentionally **not** synced (the
  mirror only copies `note:`/`folder:` keys): `history:<id>` (version
  snapshots), `time:<id>` (tracked sessions), `timers`/`countdown` (active
  timers), `countdownEnded`, `reminders`, `viewModes`, `settings`, `oversized`,
  `quickCapture`, `openNote`.
- **No build step.** Vanilla ES modules, loaded directly by the sidebar page.
  The shipped code is the source code — trivially auditable, and AMO review
  needs no source submission.
- **Note model:**

  ```json
  {
    "id": "uuid",
    "body": "full text; first non-empty line doubles as the title",
    "pinned": false,
    "createdAt": 0,
    "updatedAt": 0
  }
  ```

  Optional fields added over time (all additive, so old exports import
  cleanly): `tags`, `lang`, `glossary`, `pinned`, `template`, `deletedAt`,
  `site`, `folderId`. `format` in the export envelope is the migration
  handle; the JSON export also carries a `folders` array.

  **Folder model:** `{ id, name, icon (emoji), color (palette key),
  createdAt, updatedAt }`. A note belongs to at most one folder via
  `folderId`; tags remain the cross-cutting axis.

## Sync design (implemented in background.js)

- `storage.local` stays the source of truth; `storage.sync` is a mirror.
- Off by default. A settings toggle enables it; turning it off clears the
  mirror from `storage.sync`.
- Firefox Sync encrypts end-to-end with keys derived on the user's device,
  so Mozilla only relays ciphertext. No extra crypto needed for transport.
- Mirror layout: `note:<id>` holds a header
  `{ id, updatedAt, chunkCount, gz }`; the JSON-serialized note is split
  into `note:<id>#N` chunks of ≤ 6000 chars each, under the 8 KB
  per-item quota.
- Compression (v0.6.1): notes are gzipped (`CompressionStream`, no
  dependencies) and base64-encoded before chunking, typically shrinking
  text 40–90% and stretching the ~100 KB quota accordingly. Notes where
  gzip+base64 wouldn't pay (tiny ones) are stored raw with `gz: false`;
  readers handle both, so mirrors written before v0.6.1 keep working and
  recompress on their next edit.
- Quota handling: total quota is ~100 KB. A quota meter in settings shows
  usage. When a `sync.set` fails (quota), the note is recorded in a local
  `oversized` list, shown in settings, and simply stays local-only — local
  saves never fail because of sync.
- Conflicts: last-write-wins per note via `updatedAt`. Because keys are
  per-note, two devices editing *different* notes never clobber each other.
- Deletions propagate via tombstones (`tomb:<id>` = timestamp). **Key
  removals arriving from sync are ignored unless a tombstone exists** — so
  one device turning sync off (which clears its mirror) can never delete
  notes on another device. An edit newer than a tombstone wins and revives
  the note. Tombstones are pruned after 30 days during full syncs.
- The engine is record-kind-generic (v0.9): the same push/pull/tombstone
  machinery mirrors both notes (`note:`/`tomb:`) and folders
  (`folder:`/`ftomb:`), selected by prefix. Deleting a folder locally
  unfiles its notes (clears `folderId`, which syncs as note updates) and
  tombstones the folder record.
- Full two-way merge runs when sync is enabled and on browser startup;
  incremental pushes/pulls ride `storage.onChanged` in the event page, so
  sync works with the sidebar closed.

## Feature roadmap

### v0.1 — core (shipped)

- Sidebar with note list and editor; keyboard shortcut Ctrl+Alt+N
- Autosave with 400 ms debounce, flush on blur; save-state indicator
- Full-text search across all notes
- Pinned notes sort first (glossaries stay on top)
- Word and character count (translators bill by these)
- Copy-whole-note button
- `dir="auto"` and bidi-safe list rendering for RTL/mixed-language text
- Export/import all notes as JSON with merge-by-recency
- Light/dark theme following the browser
- Two-step inline delete confirm (no modal)

### v0.2 — opt-in sync (shipped)

- Settings pane; sync toggle (default off) as described above
- Quota meter and an oversized-notes list in settings
- "Storage" indicator in the footer switches from "local-only" to "synced"

### v0.3 — translator toolkit (shipped)

- **Tags** per note, entered comma-separated in the editor; shown as chips
  in the list; `#tag` in the search box filters by tag, clicking a chip
  fills it in
- **Glossary notes:** any note can be marked as a glossary; lines of
  `source term == translation` (or tab-separated, as pasted from a
  spreadsheet) render as a two-column table where clicking a row copies
  the translation. A single `=` is not a separator (it appears in normal
  text); lines without a separator stay plain text
- **Save selection** via right-click context menu (`menus` permission — no
  host access; the selected text arrives in the click event). Selections
  are appended to a pinned Inbox note, created on first use, and the
  sidebar opens
- Per-note language field driving the editor's `lang` attribute (and thus
  the spellcheck dictionary)
- Markdown export from settings (JSON export/import stays in the footer)

Note: sidebar position (left/right) is a browser-level Firefox setting
(Settings → General → Browser Layout); extensions have no API for it.

### v0.4 — formatting & redesign (shipped)

- Rich formatting via Markdown: a toolbar (bold, italic, strike, heading,
  lists, quote, code, link; Ctrl+B / Ctrl+I) inserts Markdown syntax, and a
  **Write / Preview** segmented switch renders it. Notes stay plain text,
  so search, sync, word counts, and exports are unaffected.
- `sidebar/markdown.js` is a dependency-free renderer that HTML-escapes
  every line *before* transforming, and only emits its own tags; links are
  restricted to http(s). It is the only place user content reaches
  `innerHTML`.
- For glossary notes, Preview renders the copyable two-column table
  instead of Markdown; the Glossary pill and an inline hint in Write mode
  explain the `source term == translation` format. The hint is dismissible
  and the dismissal is remembered (settings.hideGlossaryHint).
- Visual redesign: card-based note list, pill search, segmented controls,
  inline SVG icons (no emoji buttons), refined light/dark palettes, and a
  deliberately compact chrome so most of the sidebar is note content.
### v0.5 — competitive catch-up (shipped)

Informed by the survey in [RESEARCH.md](RESEARCH.md) (Notefox, Note
Sidebar, Tab Notes, Web Highlights, cloud clippers):

- **Trash instead of hard delete.** Soft-deleted notes keep syncing as
  ordinary updates, sit in Settings → Trash for 30 days (restore, delete
  forever, empty trash), and auto-purge on load. Deleting shows a
  6-second Undo toast. Only purging triggers the sync tombstone.
- **Note templates.** "Use as template" in the editor's ⋯ menu; the +
  button then offers "Blank note" or any template. "Duplicate note"
  lives in the same menu.
- **Markdown checklists.** `- [ ]` / `- [x]` render as real checkboxes
  in Preview; toggling writes back to the exact source line (the
  renderer stamps each task with its line number).
- **Appearance settings.** Note text size (S/M/L) and a monospace
  toggle.
- The search bar now exists only in the list view — it only ever
  filtered the list, and removing it elsewhere frees vertical space.

### v0.6 — per-site notes (shipped)

- Notes can be linked to the website you're viewing ("Link to
  {domain}" in the editor's ⋯ menu). When you're back on that site, a
  small "On {domain}" group appears at the top of the list; linked notes
  show the domain as a chip, and plain search also matches domains.
- Privacy design: the `tabs` permission is declared under
  `optional_permissions` and requested at runtime only when the user
  turns on "Site notes" in settings. Turning it off calls
  `permissions.remove()` immediately. Only the active tab's hostname is
  read (www. stripped, http/https only) — never full URLs, titles, page
  content, or history — and the hostname is stored only on notes the
  user explicitly links. With the toggle off, the extension behaves
  exactly as before: no tab access at all.

### v0.7 — power-user batch (shipped)

Eight features drawn from what mature note apps offer (see RESEARCH.md):

- **Version history.** Snapshots live under `history:<id>` in
  `storage.local` — deliberately outside the `note:` namespace so the sync
  engine never mirrors them: history is local-only and free of the sync
  quota. The version a note had when opened is always snapshotted on the
  first edit, then at most one snapshot per 2 minutes while editing
  (capped at 50). A clock-icon panel lists versions newest-first; Restore
  first snapshots the current state, so a restore is itself reversible.
- **Wiki-links + backlinks.** `[[Title]]` renders as a link (emitted with
  `data-title`); clicking opens the matching note or creates it. Preview
  appends a "Linked from" list of notes that reference the current one.
- **Tables.** GitHub-style `| a | b |` pipe tables with a `---` separator
  row render in Preview (and in printouts). A lone pipe is not a table.
- **Quick capture.** A `quick-capture` command (Ctrl+Shift+Y) opens
  the sidebar and drops a `quickCapture` timestamp the panel reacts to,
  starting a blank note whether the sidebar was open or just launched.
- **Find in note.** Ctrl+F (or the magnifier) opens an in-note find bar;
  matches are selected/scrolled in the textarea with an n/m counter and
  Enter / Shift+Enter to cycle.
- **Bulk import.** Settings → "Import .md / .txt files" makes one note per
  file; the filename becomes the title unless the file starts with a
  heading.
- **Selection stats.** The footer counter switches to the selection's
  word/char count whenever text is selected in the editor.
- **Print a note.** The ⋯ menu opens a self-contained, print-styled HTML
  document (rendered Markdown, or the glossary table) in a new tab via a
  blob URL and triggers the browser print dialog. No permissions.

The renderer (`markdown.js`) still escapes every line before emitting its
own tags; wiki-link titles and table cells go through the same escaping,
so the innerHTML-safety invariant is unchanged.

### v0.8 — find highlighting & scroll navigation (shipped)

- **All-matches highlighting for find.** A transparent backdrop
  (`#find-highlight`) sits behind the editor textarea inside a shared
  `#editor-wrap`; both use identical text metrics (padding, border,
  font, `white-space: pre-wrap`, `scrollbar-gutter: stable`) so the
  `<mark>` elements line up exactly behind the opaque characters. Every
  match is highlighted, the current one emphasized; navigation scrolls
  the current mark to center using its `offsetTop` in the backdrop.
  Verified in-harness: backdrop and textarea report identical
  `scrollHeight`, so wrapping matches.
- **Scroll to top / bottom.** A floating control (`#scroll-nav`) appears
  only when the active pane overflows and works in both Write (textarea)
  and Preview (rendered div). It is context-aware: the up button hides at
  the top, the down button hides at the bottom, both show in between
  (updated on every scroll). Uses direct `scrollTop` assignment with CSS
  `scroll-behavior: smooth` — `scrollTo({behavior:"smooth"})` proved a
  no-op in some engines. Keyboard Ctrl+Home / Ctrl+End already cover the
  textarea; this adds a discoverable, mode-agnostic affordance.

### v0.9 — folders / projects (shipped)

- Notes organize into **folders** (like Claude/ChatGPT projects), a
  navigable container rather than a filter. Home shows a Folders section
  above the full notes list; tapping a folder opens a folder view (colored
  header, back arrow) showing only its notes; the **+ inside a folder
  files the new note there**. Search stays global on Home and scopes to
  the folder when inside one.
- Each folder has a user-chosen **emoji icon** (curated grid incl. flags,
  zero assets, works offline) and a **color** from a curated 10-swatch
  palette (theme-aware). Filed notes show a colored folder chip on Home.
- A note belongs to one folder (`folderId`); **tags stay cross-cutting.**
  Move via the editor ⋯ → "Move to folder…" picker (Unfiled / any folder /
  New folder). Deleting a folder unfiles its notes rather than deleting
  them. Folders are single-level (no nesting) and sync like notes.
- No new permissions. JSON export/import now includes folders.

### v0.9.1 — list ergonomics (shipped)

Rather than a dedicated "list type" (rejected: plain `- [ ]` checklists
already cover shopping/to-do lists, and a new note type wouldn't clear
the bar the glossary type did), the existing checklist was polished as
general editor behavior that helps every note:

- A **checklist button** in the formatting toolbar toggles `- [ ] ` on
  the selected line(s).
- **Enter-continuation:** pressing Enter on a bullet, numbered, or task
  line inserts the next marker (numbers increment, tasks continue
  unchecked); Enter on an empty item removes the marker and ends the
  list. Disabled in glossary notes. Still plain Markdown underneath.

### v0.9.2 — default view mode (shipped)

- A note reopens in the mode you last left it (Write/Preview). New/empty
  notes always open in Write; glossary-with-content opens in Preview when
  there's no remembered mode.
- The last-used mode is stored in a local-only `viewModes` map (noteId →
  mode), deliberately **not** on the note record — so switching views
  never bumps `updatedAt` (no list reorder) and never triggers a sync
  write. Only explicit Write/Preview clicks are recorded; transient
  switches (e.g. find forcing Write) are not. Stale entries are pruned on
  purge and at startup.
- Settings → Appearance → **"Open notes in"**: `Last used` (default),
  `Write`, or `Preview`.

### v0.10 — time tracking (shipped)

A per-note/per-project stopwatch built on standard time-tracker practice
(the Toggl/Clockify/Harvest model), so a translator can log billable time
where the work happens.

- **One global timer, attached to a note.** A stopwatch button in the
  editor bar opens a Timer panel; **Start → Pause/Resume → Save/Reset.**
  Pause/Resume accumulate; **Save** commits the elapsed span as a *session
  entry*, so time is logged, not just cleared; **Reset** is a two-step
  "Discard?" that throws the running span away. Sessions under a minute are
  dropped rather than logged.
- **Runs in the background.** The active timer lives under a single
  `timer` key in `storage.local`, and elapsed is always derived from a
  `runningSince` timestamp — never a counter we increment. Closing the
  sidebar (or the whole browser) loses nothing: on load the timer resumes
  and the 1 s tick restarts. A footer chip shows the live time whenever a
  timer is active (a pulsing dot = running), visible even while a different
  note is open; that note's panel then shows a "Running on '…' — Go to it"
  banner. Starting a timer on a second note auto-commits the first, the
  standard single-timer behavior.
- **Rollups.** The panel shows the note's total plus **words/hour** (reusing
  the existing word count). Folders are projects: each folder row and the
  folder header show the **project's total tracked time**, live-updating.
- **Storage & privacy.** Sessions live under `time:<id>`, deliberately out
  of the `note:` namespace so the sync engine never mirrors them (local-only,
  free of the sync quota) — but they **are** included in JSON export/import,
  since billable hours must be backup-able; import merges by session start
  timestamp so a re-import never doubles hours. Purging a note drops its
  sessions and any running timer. **No new permissions** — pure
  `storage.local`, so the zero-collection/no-install-warning story is intact.

### v0.10.1 — per-note timers + mode setting (shipped)

Generalizes v0.10's single global timer into a **timer per note**, kept in a
`timers` map (`{ noteId: { accumulatedMs, runningSince } }`) under the
`timers` key; the old single `timer` object is migrated in on first load.
Elapsed is still purely timestamp-derived, so the background/resume behavior
is unchanged.

- **Settings → Time tracking → "When you start a timer on another note":**
  - **Pause the current one** (`per-note`, default) — each note keeps its own
    timer; starting one parks (pauses, retains) whatever was running, so only
    one runs at a time and a work session isn't fragmented into many entries.
  - **Save the current one** (`single`) — the original v0.10 behavior: only
    ever one timer, and switching auto-commits the previous session.
  - **Keep both running** (`concurrent`) — timers on different notes all run
    at once. The hint spells out that overlapping timers double-count real
    time, since that matters for billing.
- The mode only changes what happens to *other* timers when you start one
  (park / commit / leave). The footer chip shows the current note's timer, or
  summarizes timers on other notes (`N×`); the panel lists other active timers
  with jump links. Folder (project) totals fold in every live timer. No new
  permissions — still pure `storage.local`.

### v0.11 — countdown, Pomodoro & reminders (shipped)

Adds the two things that must fire while the sidebar is **closed**, so the
scheduling/notification logic lives in the background event page; the panel
only writes local-only state (`countdown`, `reminders`) that the background
watches, (re)scheduling `browser.alarms` and raising `browser.notifications`.
New permissions `alarms` + `notifications` — neither triggers a Firefox
install warning nor grants page access, so the zero-collection story holds.

- **Countdown / Pomodoro.** The timer panel gains a **Stopwatch / Countdown**
  tab. Countdown has presets (5/15/25/45 min) **plus a custom-minutes field
  (1–600)**, Start/Pause/Resume/Reset, and a **Pomodoro** toggle (25 min focus
  / 5 min break, auto-cycling with a focus-session counter). Remaining time is
  derived from an `endsAt` timestamp, so a closed sidebar stays accurate; the
  single "countdown" alarm is (re)scheduled by the background, which on expiry
  fires the notification and, for Pomodoro, advances the phase and reschedules.
  There is one countdown at a time (it's a kitchen timer), but it is
  **independent of the billable stopwatch** — a Pomodoro focus timer and a
  note's stopwatch can run at the same time.
- **Optional end-of-phase chime.** Settings → Time tracking → "Play a sound…"
  (default off) plays a short WebAudio two-tone chime — no bundled asset, no
  permission — when a countdown/Pomodoro phase ends **while the sidebar is
  open**. The background sets a `countdownEnded` timestamp on each real expiry
  (distinct from a manual pause/reset, which never chime) and the panel reacts.
  When the sidebar is closed the OS notification sound is the cue. The audio
  context is created during the Start click so autoplay policy doesn't block it.
- **Reminders / due dates.** A note's ⋯ menu → **Set reminder…** opens a
  sheet (datetime picker + quick "in 1h / 3h / tomorrow / next week"). Each
  reminder gets a `reminder:<noteId>` alarm; on fire the background shows a
  notification and clears the reminder (one-shot). Clicking the notification
  opens the sidebar and the note (via an `openNote` flag the panel reads).
  The list shows a due chip (overdue highlighted). Reminders are a
  `{ noteId: { at } }` map under the local-only `reminders` key — never
  synced (which would risk double-firing across devices) — but **included in
  JSON export/import**. Purging a note drops its reminder.

### v0.11.2 — list batching (shipped)

The note list renders in batches of `LIST_BATCH` (50) rather than all at once,
so a large collection stays fast. The first 50 cards render immediately; a
"Showing N of M — load more" row appends the next batch, either on click or
automatically when `#list-view` is scrolled near its bottom (a plain scroll
handler, not `IntersectionObserver` — one batch per bottom-reach). The cap
(`listLimit`) resets to one batch and scrolls to the top whenever the folder
or search query changes. Numbered pages were rejected: the list is
recency-sorted and search-driven, so "scroll or search" fits better than
paging through pages of notes.

### v1.0 — release

- UI localization via `_locales` (English, Georgian, …)
- AMO listing: screenshots, privacy statement ("no data collected — see
  the code"), public repo link
- web-ext lint clean; tag releases in git

### Later / maybe

- Full-history export (versioned snapshots)
- Manual time-entry editing (adjust or add a session by hand)
- Recurring reminders; a custom countdown length beyond the presets

### Decided against (owner's call, 2026-07-20)

- **Master password**: not needed for this use case — Firefox Sync
  already E2E-encrypts the mirror, disk encryption is the OS's job, and
  a lost password would mean lost notes. Revisit only if profile-sharing
  becomes a concern.
- **Localization**: deferred until an AMO release is actually planned.

## Privacy checklist (every release)

- [ ] `permissions` in the manifest is still the minimum
- [ ] Zero network requests (verify in the network panel)
- [ ] All assets bundled; default extension CSP untouched
- [ ] User content reaches `innerHTML` only through `markdown.js`, which
      escapes all input before emitting its own tags
- [ ] Export produces complete, human-readable data
