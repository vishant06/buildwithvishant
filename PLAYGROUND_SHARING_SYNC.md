# Playground: privacy, sharing and local-folder sync

## Privacy (server-enforced)
- Every project is **private** by default (`visibility: 'private'` in `PlaygroundProject`). Only the exact value `'public'` ever grants access.
- Only the owner can change it: `PATCH /api/playground/:id/visibility` `{ visibility: 'public'|'private', regenerate?: true }` (login required, 30/min). Non-owners (admins too) get the same 404 as for a missing project.
- Going public creates a random 12-character link token (`publicSlug`, not the database id). Going private **deletes** the token, so old links stay dead even if the project is published again. `regenerate` swaps the link.
- Public view: `GET /api/playground/public/:slug` (no login, 60/min, `no-store`, `noindex`). The database is queried on every request with `publicSlug = :slug AND visibility = 'public'`; there is no cache or stored permission, so revoking is immediate. Private / deleted / unknown links all return the same 404.
- The public response is an allow-list: title, language, files, updated time. No owner, no ids (the owner alone also receives `projectId` for "Open in editor"). `.env*`, keys (`*.pem`, `id_rsa`…), `.ssh/`, `.aws/`, credentials files and any file containing a private-key block are **never** returned (`hiddenFileCount` tells visitors that something was withheld). `.env.example` is allowed.
- Visitors have no write route at all (the public router is a single GET). `/execute` is unchanged and never resolves saved projects.
- Changing visibility does not touch `updatedAt`, so an open editor does not get a false "changed elsewhere" conflict.
- Share URL: `https://<playground-domain>/p/<slug>` (read-only viewer page inside the Playground app).

### Migration
The server runs an idempotent migration at start-up: missing/invalid `visibility` becomes `private`, stray public links are removed, nothing is ever made public, files/owners are untouched. Manual dry run / apply / backup:
```
cd server
npm run migrate:visibility                      # report only
node scripts/migratePlaygroundVisibility.js --apply --backup
```

## Local folder sync (browser File System Access API)
**Why this approach:** the workspace lives in the browser and is auto-saved to the server with optimistic concurrency. Running the sync in the same page means the OS folder permission prompt is the only trust boundary, no new server endpoints, no agent to install, no credentials to store. A background agent would only add value when the tab is closed, and then there is nothing to look at.

**Requirements / limits**
- Chrome, Edge or Opera on desktop, HTTPS (or localhost). Firefox, Safari and mobile browsers do not allow it; the panel says so and the rest of the Playground is unaffected.
- Syncing runs while the Playground tab is open. The browser forgets folder permission after a reload: click **Allow access** once (the status shows *Permission required*).
- Changes are found by scanning every ~2.5 s, when you return to the tab, and ~0.7 s after you stop typing. Text files only, UTF-8, ≤100 KB each, ≤200 files/folders, 500 KB total (the existing project limits).
- Needs a login and a saved project (the connection is stored per account + project).

**How it works** (`playground/src/sync/`)
- `engine.js` three-way compare of local folder / Playground / last agreed state (SHA-256, line endings normalised). Only-one-side-changed → copied across; both changed → conflict; no echo loops.
- `controller.js` the loop, safety rules and user decisions. `localFs.js` folder access + path validation. `store.js` IndexedDB (folder handle, last agreed state, recoverable copies; never sent to the server).
- First connection shows a **preview** (what will be added/written/conflicts) and changes nothing until you confirm.
- Create, edit and rename (including files moved between folders) sync both ways; renames keep the Playground file id, tabs and entry file.
- **Conflicts** are never overwritten: Keep Local / Keep Playground / Review Both (side-by-side diff). The losing version is saved under *Recoverable copies*.
- **Deletions** are never applied automatically: they wait for Keep / Delete, with a recoverable copy kept; a large vanish-at-once is flagged. Empty folders are removed only when empty.
- **Filters:** defaults + your `.gitignore` + `.playgroundignore` (root, gitignore syntax; `!pattern` re-includes). node_modules, .git, dist/build/out, caches, OS files, logs, lock files, binaries and sensitive files (`.env`, keys, credentials) are skipped. Sensitive files sync only after an explicit warning/opt-in, and are still never public.
- **Path safety:** every path goes through the same validator as the server (no `..`, absolute paths, backslashes, odd names); the browser itself limits the handle to the chosen folder.

## Tests
```
cd server     && npm test        # privacy, public view, migration, rules, isolation (29)
cd playground && npm test        # sync engine/controller/adapter + storage (23)
```
Not covered by automated tests: the native folder picker dialog (needs a human); everything behind it was run against a real `FileSystemDirectoryHandle` (OPFS) and real IndexedDB in headless Chromium.
