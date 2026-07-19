# Quiet Notes — design & roadmap

## Goals

A sidebar note-taker for Firefox that the author (a translator) uses daily.
Privacy is the product: the extension stores nothing outside the user's
browser, collects nothing, and requests the minimum possible permissions.
Sync across devices is strictly opt-in and rides on Firefox Sync's
end-to-end encryption — no third-party or first-party servers, ever.

## Architecture

- **Manifest V3**, Firefox ≥ 115, `sidebar_action` panel. No background
  script needed so far; everything runs in the sidebar page.
- **Persistence:** each note is stored under its own `storage.local` key
  (`note:<id>`). Per-note keys keep writes small, make `storage.onChanged`
  events precise, and map 1:1 onto sync mirroring later.
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

  Future fields (tags, language, type) must be additive and optional so old
  exports always import cleanly. `format` in the export envelope is the
  migration handle.

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

### v1.0 — release

- UI localization via `_locales` (English, Georgian, …)
- AMO listing: screenshots, privacy statement ("no data collected — see
  the code"), public repo link
- web-ext lint clean; tag releases in git

### Later / maybe

- Note-to-note links (`[[title]]`) with backlinks
- Per-note version history (local snapshots, restore UI)
- Full-history export (versioned snapshots)

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
