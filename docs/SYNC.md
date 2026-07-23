# Sync — architecture & decisions

How Quiet Notes moves data between devices, and why. Written when the
standalone web app was planned (2026-07-23), so the trade-offs are on record.

## The constraint

`browser.storage.sync` — the Firefox Sync mirror the extension uses — is an
**extension-only API**. A page served from `https://…` cannot touch it: different
origin, no access. So:

- The **extension** keeps Firefox Sync. It is free, end-to-end encrypted by
  Mozilla, and works well for Firefox ↔ Firefox.
- The **web app cannot reuse it** and needs its own transport.
- Extension ↔ web-app sync needs a deliberate bridge; it is not automatic.

## What is already solved

Sync is two problems: **merge semantics** and **transport**. The merge half is
done, and it is transport-agnostic:

- Records are stored per key (`note:<id>`, `folder:<id>`), never as one blob, so
  two devices editing different notes never collide.
- Every note and folder carries `updatedAt`; `importNotes()` merges **by
  recency** — an incoming record wins only if it is newer.
- Deletions use **tombstones**, and a key removal arriving from sync is ignored
  unless a tombstone exists (so turning sync off on one device can never delete
  records on another).
- Time entries de-duplicate by session `start`; reminders by `at`.

Whatever pipe is chosen, this conflict model applies unchanged. Only the
plumbing differs.

## Transport options considered

| Option | Servers | Cross-device | Caveat |
| --- | --- | --- | --- |
| Local-only + JSON export/import | none | manual | Works today, both directions |
| **File-based sync** (a folder the user already cloud-syncs) | none | automatic | File System Access API is **Chromium-only** |
| User's own cloud (Dropbox/Drive API, encrypted blob) | theirs | automatic | OAuth + third-party SDK |
| E2E-encrypted sync service | ours | automatic, incl. mobile | Needs a passphrase; adds a server |
| CRDT + relay (Yjs/Automerge) | relay | automatic | Overkill for last-write-wins data |

## Decisions

1. **The extension keeps Firefox Sync unchanged.** No reason to replace it.
2. **The web app ships local-only first**, with the existing JSON
   export/import as the bridge. It is honest, server-free, and unblocks the app.
3. **File-based sync** — *shipped*, see `web/filesync.js`. The user picks one
   `quiet-notes.json` inside whatever folder they already sync (Dropbox,
   OneDrive, Syncthing, iCloud); the app pulls-and-merges on load and pushes
   debounced (1.5 s) on change. It is the only automatic option that adds
   **zero servers** and leaves the user owning the file.
   - The file handle is kept in its own IndexedDB (`quiet-notes-sync`) so it
     survives reloads. Browsers drop the *permission* on restart and only allow
     re-granting from a user gesture, so on load we merely `queryPermission`
     and, if needed, show a **Reconnect** button.
   - Pushes use `buildBackup({ includeTrashed: true })` so a deletion on one
     device propagates instead of being resurrected by another device's copy.
   - An `applying` flag suppresses the push that a pull's own writes would
     otherwise trigger.
   - Limitation: the File System Access API is Chromium-desktop-only. Firefox
     and Safari fall back to manual export/import — acceptable, because Firefox
     users have the extension (with Firefox Sync), so the two products
     complement rather than duplicate each other.
   - Upside over Firefox Sync: no ~100 KB quota, so a file can carry **time
     entries and reminders** too, which the sync mirror deliberately omits.
4. **No sync server unless it becomes unavoidable.** See the warning below.

## Extension ↔ web app

Three paths, in increasing ambition:

1. **JSON export/import** — works today; the baseline.
2. **Shared file** — the web app writes the sync file, the user imports it into
   the extension. Semi-manual: an extension cannot silently watch a file.
3. **Content-script bridge (server-free)** — the extension takes a host
   permission for *our own* web-app domain only, injects a content script there,
   and the page `postMessage`s with it. Opening the web app in Firefox with the
   extension installed then syncs the two directly, with **no server at all**.
   Cost: a narrowly-scoped host permission, which *does* add an install warning,
   so it must be optional.

⚠️ **If a sync server is ever added**, the extension would have to make network
requests to take part. That breaks the headline claim — "The extension makes no
network requests" — in `README.md` and the AMO privacy story. Any such feature
must be strictly opt-in **and** those claims must be updated honestly.

⚠️ **E2E sync needs a passphrase**, which is effectively the master password
[rejected earlier](DESIGN.md). That rejection was about locking *local* notes,
where a lost password means lost notes. Encrypting data *leaving the device* is
a different trade-off — but the UX cost is the same, so it is a conscious
re-decision, not an oversight.

## Web-app platform mapping

What the shared UI uses, and what backs it on the web (see `web/platform.js`):

| Extension API | Web replacement |
| --- | --- |
| `storage.local` | **IndexedDB** behind the same `storage.js` interface |
| `storage.onChanged` | **BroadcastChannel** (cross-tab) + local dispatch |
| `alarms` | a 1 s due-check over stored alarm times (survives long delays) |
| `notifications` | **Notifications API** |
| `menus` (save selection) | dropped — no web equivalent |
| `commands` | in-page keyboard shortcuts |
| `tabs` + `permissions` (site notes) | dropped — no browsing context |
| `storage.sync` | inert stub; the web app does not use Firefox Sync |

Known limitation: with only a page-lifetime scheduler, reminders and countdowns
fire **while a tab is open**. On load the app catches up any that came due while
it was closed. Firing while fully closed needs a service worker with push or
notification triggers, which is a later step.
