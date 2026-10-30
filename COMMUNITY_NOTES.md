# Community PDF notes (Scribd-style Notes)

Existing admin-written notes (`/api/notes`, block-based) are **untouched** and keep working; they now live under the
"Guides" tab. Community PDFs are a separate collection (`NoteDocument`) so nothing existing had to be migrated.

## What was found in the audit
- Notes: block-based articles, admin-only create/update (`Note` model), public read of `published` notes. No PDFs.
- Auth: JWT bearer, `protect` / `authorize('admin')`, `User.role`, `User.isEmailVerified`.
- Storage: Cloudinary, public assets (images, resume). Not suitable for private PDFs as-is (public CDN URLs; PDF delivery is
  restricted by default on newer Cloudinary accounts; small per-file caps on free plans).
- AI: one Groq call in `aiController` -> moved into `services/aiProvider.js` and reused (behaviour of `/api/ai/chat` unchanged).
- Playground: separate app, browser-held workspace; reused via a reference-based hand-off.
- Client already depended on `react-pdf` (PDF.js), which the reader uses.

## Access policy (single source: `server/src/utils/documentAccess.js`)
| status | owner | admin | public |
|---|---|---|---|
| pending | view, preview, edit, delete | all | no |
| approved + public | all | all | yes (listed) |
| approved + unlisted | all | all | only with the link (never listed / searched / recommended) |
| approved + private | all | all | no |
| rejected | view, edit, resubmit | all | no |
| removed by admin | sees status + reason only | all | no |
| deleted by owner | nothing | all (restorable for the retention period) | no |

Every endpoint (metadata, PDF stream, download, thumbnail, related, code example, AI, bookmarks, reports) goes through
`accessFor`. Hidden notes return the same 404 as missing ones. Status changes only through `transition()` (explicit table,
audited, tested): users can never approve; admins approve / reject (reason required) / remove (reason required) / unpublish / restore.

## Storage
`services/documentStorage.js`: `gridfs` (default, MongoDB GridFS, no public URL exists) or `cloudinary` (authenticated raw
assets, streamed through the API with a signed URL). Bytes are only ever served by `GET /api/documents/:slug/file`
after the access check; responses are `no-store`, `nosniff`, `Content-Security-Policy: sandbox`, with byte-range support.
Storage keys, hashes and owner ids never appear in public responses. Deleted/replaced bytes are removed after the new data is saved;
removed notes are purged after `DOC_RETENTION_DAYS`; orphaned GridFS files (crash mid-upload) are swept every 6 hours.
The Cloudinary driver was written against its documented API but **not exercised against a live account**.

## Upload validation (server)
Extension + MIME + `%PDF-` at byte 0 + `%%EOF` + size + PDF.js parse (page count, password-protected rejected) + raw scan for
JavaScript / Launch / EmbeddedFile / RichMedia / SubmitForm / XFA. Duplicate detection by SHA-256, per-user pending / daily /
storage quotas, rights confirmation required, verified email required (configurable), rate limit 15 uploads/hour/user.
Thumbnails (made in the uploader's browser) are accepted only if real PNG/JPEG/WebP and < 400 KB.
Note: the scan cannot see inside compressed object streams; the viewer also runs PDF.js with scripting off.

## API (all under `/api/documents`)
Public: `GET /` (search/filter/sort/page), `/home`, `/facets`, `/categories`, `/config`, `/:slug`, `/:slug/file`,
`/:slug/thumbnail`, `/:slug/related`, `/:slug/code-example`.
Signed in: `POST /` (multipart `pdf`, optional `thumbnail`), `GET /mine`, `/bookmarks`, `PATCH|DELETE /manage/:id`,
`POST /manage/:id/resubmit`, `POST /manage/:id/file`, `GET /:slug/download`, `POST /:slug/ai|bookmark|report`, `DELETE /:slug/bookmark`.
Admin: `/admin/stats|documents|documents/:id/(approve|reject|remove|unpublish|restore)|reports|reports/:id/resolve|categories|tags`.
Search uses a MongoDB text index (`document_search`, created automatically) plus equality filters; related notes use one indexed
query ranked in code (subject, category, tags, course, code, language, popularity only as a tie-breaker).

## AI assistant
`POST /:slug/ai {action: ask|summarize|explain_page|practice|explain_code, question?, page?, selection?}`. Order: access check ->
quota (30/day/user, refunded on provider failure) -> only relevant pages (<= 14k chars) are read and sent. The document is put in a
delimited "untrusted data" block (never in the system prompt); `[p.N]` citations not among the pages actually sent are stripped.
PDFs without text (scans) get a clear "cannot read" message.

## Playground hand-off
"Try in Playground" appears only when a note has a code example. It links to `/?starter=<slug>`; Playground fetches the example from
the API (same access rules), asks for confirmation, and opens it as a **new, unsaved workspace** (Java file name matched to the class).
Nothing is saved, overwritten or run automatically; no code travels in a URL.

## New environment variables (server) - see `server/.env.example`
`DOCUMENT_STORAGE`, `DOC_MAX_FILE_MB`, `DOC_MAX_PAGES`, `DOC_MAX_PENDING_PER_USER`, `DOC_MAX_UPLOADS_PER_DAY`,
`DOC_USER_STORAGE_MB`, `DOC_RETENTION_DAYS`, `DOC_AI_DAILY_QUOTA`, `DOC_REQUIRE_VERIFIED_EMAIL`. Existing `AI_API_KEY` / `AI_PROVIDER` / `AI_MODEL` are reused.

## Deploy
1. `cd server && npm install` (adds `pdfjs-dist`). No data migration is required; indexes are built on first start.
2. Deploy server, then client (no new client dependencies), then playground.
3. Make sure the API's CORS allows your site (unchanged) - range headers are now exposed automatically.
4. Optional: `DOCUMENT_STORAGE=cloudinary` only after enabling PDF delivery in Cloudinary settings.
5. Admin: Dashboard -> "Community PDF notes" (queue, reports, categories, tags). Admin uploads are published directly.

## Tests
```
cd server && npm test        # 75+ tests incl. access matrix, moderation state machine, uploads, AI, related, wiring
cd playground && npm test    # includes the starter-example tests
```
Browser-level checks (Chromium, real PDF.js): reader (lazy page rendering, zoom, page jump, text selection, mixed page sizes, errors)
and the Notes / reader / upload / contributions / admin pages against a mocked API.

## Known limits
- No screenshot/copy prevention is claimed; access control and signed/streamed delivery are enforced, nothing more.
- Global site search does not include community PDFs yet (the Notes page has its own search).
- The mobile app still shows only the existing notes.
- Thumbnails are generated in the browser at upload time (no server-side rendering dependency).
