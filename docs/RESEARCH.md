# Competitive research — note-taking extensions (July 2026)

Surveyed: Notefox (websites notes), Note Sidebar for Firefox, Tab Notes,
Web Highlights, Evernote/Zoho web clippers, plus the discontinued Notes by
Firefox. Sources: AMO listings, project GitHub pages, category guides.

## What competitors have that Quiet Notes lacks

| Feature | Who has it | Verdict for Quiet Notes |
|---|---|---|
| Per-website notes (domain/page-attached, shown when you revisit) | Notefox (its flagship) | **Worth doing, privacy-first**: needs the `tabs` permission, so ship it as an *optional* runtime permission (`permissions.request()`), off by default. Planned v0.6. |
| Trash / undo delete | most mature apps | **Shipped in v0.5** (soft delete, undo toast, 30-day auto-purge). |
| Note templates | larger note apps | **Shipped in v0.5** (any note can be marked as a template; + offers them). |
| Checklists / to-dos | most note apps | **Shipped in v0.5** (`- [ ]` Markdown tasks, toggleable in Preview). |
| Font / appearance settings | Note Sidebar (paper styles, colors) | **Shipped in v0.5** (font size S/M/L + monospace). Paper skins: not planned. |
| Password-protected notes | Note Sidebar | **Decided against** (owner, 2026-07-20): Firefox Sync already E2E-encrypts the mirror and disk security is the OS's job; a lost password would mean lost notes. |
| Version history | Simplenote, Evernote | **Shipped in v0.7** (local-only snapshots, restore). |
| Note-to-note links / backlinks | Obsidian | **Shipped in v0.7** (`[[title]]` + backlinks). |
| Markdown tables | most Markdown apps | **Shipped in v0.7**. |
| Find in note | most editors | **Shipped in v0.7** (Ctrl+F). |
| Quick capture hotkey | many capture tools | **Shipped in v0.7** (Ctrl+Alt+Shift+N). |
| Bulk import of files | most note apps | **Shipped in v0.7** (.md / .txt). |
| Print / PDF a note | most note apps | **Shipped in v0.7** (browser print, no permissions). |
| Page highlighting / sticky notes overlaid on pages | Web Highlights, Notefox | **Deliberate non-goal**: requires content scripts injected into every page — exactly the access Quiet Notes promises never to ask for. |
| Web clipping into cloud services | Evernote / Zoho clippers | **Non-goal** (cloud accounts). Our right-click "save selection" covers the lightweight case with zero page access. |
| AI summaries | Web Highlights | **Non-goal**: would require sending page/note content to a remote service. |
| Text-to-speech | Note Sidebar | Niche; skip unless requested. |
| Firefox for Android support | Notefox, Note Sidebar | Sidebars don't exist on Android; would need a popup/tab UI variant. Recorded as a possible v1.x direction. |
| Own-account cloud sync | Notefox (optional account) | **Non-goal**: Firefox Sync (E2E) already covers multi-device without us running servers. |

## Where Quiet Notes is already ahead

- Zero page access, zero network, two harmless permissions — none of the
  surveyed extensions can claim all three.
- Markdown formatting with safe preview (Note Sidebar's rich text is
  HTML-based; clippers require accounts).
- Translator toolkit: glossary tables with click-to-copy, per-note
  spellcheck language, tags with `#tag` search, word/char counts.
- Opt-in E2E sync with quota meter and safe deletion semantics.

## Priority order (feeds the roadmap)

1. ~~Trash, templates, checklists, editor prefs~~ → v0.5
2. ~~Per-site notes via optional `tabs` permission~~ → v0.6
3. ~~History, wiki-links, tables, find, quick capture, bulk import,
   selection stats, print~~ → v0.7
4. Localization (en, ka), AMO release polish
5. Android exploration (popup UI)

Dropped: master password (owner decision — see the table).
