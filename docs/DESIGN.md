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

## Sync design (v0.2, not yet implemented)

- `storage.local` stays the source of truth; `storage.sync` is a mirror.
- Off by default. A settings toggle enables it; turning it off deletes the
  mirror from `storage.sync`.
- Firefox Sync encrypts end-to-end with keys derived on the user's device,
  so Mozilla only relays ciphertext. No extra crypto needed for transport.
- Quota handling: `storage.sync` allows ~100 KB total / 8 KB per item.
  Notes larger than one item get chunked (`note:<id>:0`, `note:<id>:1`, …).
  A quota meter in settings warns before the ceiling; when full, sync
  pauses per-note (local keeps working) rather than failing writes.
- Conflicts: last-write-wins per note via `updatedAt`. Because keys are
  per-note, two devices editing *different* notes never clobber each other.

## Feature roadmap

### v0.1 — core (scaffolded)

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

### v0.2 — opt-in sync

- Settings pane; sync toggle (default off) as described above
- Quota meter and per-note sync status
- "Storage" indicator in the footer switches from "local-only" to "synced"

### v0.3 — translator toolkit

- **Tags** per note (client, project, language pair) with tag filtering
- **Glossary note type:** term ↔ translation pairs rendered as a two-column
  table; one click copies the target term; search matches either column
- **Save selection to note** via right-click context menu (`menus`
  permission — no host access; the selected text arrives in the click event)
- Per-note language setting driving `lang` and spellcheck dictionary
- Markdown export (in addition to JSON)

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
