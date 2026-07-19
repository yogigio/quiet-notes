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
- Mirror layout: `note:<id>` holds a header `{ id, updatedAt, chunkCount }`;
  the JSON-serialized note is split into `note:<id>#N` chunks of ≤ 6000
  chars each, under the 8 KB per-item quota.
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
- **Glossary notes:** any note can be marked 📖; lines of
  `source term = translation` (or tab-separated) render as a two-column
  table where clicking a row copies the translation; lines without a
  separator become section headers
- **Save selection** via right-click context menu (`menus` permission — no
  host access; the selected text arrives in the click event). Selections
  are appended to a pinned Inbox note, created on first use, and the
  sidebar opens
- Per-note language field driving the editor's `lang` attribute (and thus
  the spellcheck dictionary)
- Markdown export from settings (JSON export/import stays in the footer)

Note: sidebar position (left/right) is a browser-level Firefox setting
(Settings → General → Browser Layout); extensions have no API for it.

### v0.4 — writing comfort

- Markdown preview toggle (rendered through bundled DOMPurify — never raw
  `innerHTML`)
- Note templates (e.g., a job header: client / deadline / word count)
- Adjustable editor font and size; monospace option
- Trash with undo instead of hard delete

### v1.0 — release

- UI localization via `_locales` (English, Georgian, …)
- AMO listing: screenshots, privacy statement ("no data collected — see
  the code"), public repo link
- web-ext lint clean; tag releases in git

### Later / maybe

- Master password: AES-GCM via WebCrypto, key from PBKDF2; encrypts note
  bodies at rest and in the sync mirror. Off by default — losing the
  password means losing the notes, which must be stated loudly.
- Note-to-note links (`[[title]]`)
- Full-history export (versioned snapshots)

## Privacy checklist (every release)

- [ ] `permissions` in the manifest is still the minimum
- [ ] Zero network requests (verify in the network panel)
- [ ] All assets bundled; default extension CSP untouched
- [ ] No `innerHTML` with user content anywhere
- [ ] Export produces complete, human-readable data
