# BuildWithVishant — three apps, one backend

```
Portfolio/
├─ client/       Main site            → buildwithvishant.in        (Vercel project 1)
├─ playground/   Full-screen IDE      → code.buildwithvishant.in   (Vercel project 2)
├─ ai/           Full-screen AI chat  → ai.buildwithvishant.in     (Vercel project 3)
├─ shared/       Code used by all three (auth, API helper, theme, search, navbar, config)
├─ server/       Express API (Render) — unchanged endpoints, plus /api/search and /api/auth/sso/*
└─ mobile/       Expo app — untouched
```

`shared/` is imported through the `@shared` alias (see `shared/vite/config.js`). The AI app also imports the note
code-block component from `client/src` through `@client`, so AI answers render exactly like notes.

## Local development

```bash
cd server     && npm install && npm run dev      # API      :5000
cd client     && npm install && npm run dev      # main     :5173
cd playground && npm install && npm run dev      # IDE      :5174
cd ai         && npm install && npm run dev      # AI       :5175
```

Copy each `.env.example` to `.env`. With the defaults, the apps find each other on those ports.
`server/.env` needs `PLAYGROUND_URL=http://localhost:5174` and `AI_URL=http://localhost:5175` (already in `.env.example`).

## Environment variables

| App | Variable | Production value |
|---|---|---|
| client | `VITE_API_URL` | `https://portfolio-3h2m.onrender.com/api` |
| client | `VITE_PLAYGROUND_URL` | `https://code.buildwithvishant.in` |
| client | `VITE_AI_URL` | `https://ai.buildwithvishant.in` |
| playground | `VITE_API_URL` | `https://portfolio-3h2m.onrender.com/api` |
| playground | `VITE_MAIN_SITE_URL` | `https://buildwithvishant.in` |
| playground | `VITE_AI_URL` | `https://ai.buildwithvishant.in` |
| ai | `VITE_API_URL` | `https://portfolio-3h2m.onrender.com/api` |
| ai | `VITE_MAIN_SITE_URL` | `https://buildwithvishant.in` |
| ai | `VITE_PLAYGROUND_URL` | `https://code.buildwithvishant.in` |
| server (Render) | `CLIENT_URL` | `https://buildwithvishant.in` (existing) |
| server (Render) | `PLAYGROUND_URL` | `https://code.buildwithvishant.in` (**new**) |
| server (Render) | `AI_URL` | `https://ai.buildwithvishant.in` (**new**) |
| server (Render) | `EXTRA_ALLOWED_ORIGINS` | optional, comma-separated (e.g. Vercel preview URLs) |

If a `VITE_*` URL is missing, production builds fall back to the `buildwithvishant.in` / `code.` / `ai.` domains above.
Optional: `VITE_COOKIE_DOMAIN` (default: derived from the main-site host, e.g. `.buildwithvishant.in`).
`www.buildwithvishant.in` is added to the CORS allowlist automatically.

## Vercel (create three projects from the same repo)

| Project | Root Directory | Build command | Output |
|---|---|---|---|
| main | `client` | `npm run build` | `dist` |
| playground | `playground` | `npm run build` | `dist` |
| ai | `ai` | `npm run build` | `dist` |

* Framework preset: **Vite**. Each app has a `vercel.json` that rewrites every path to `index.html` (no 404 on refresh).
* In each project's *Settings → General*, keep **"Include source files outside of the Root Directory in the Build Step"
  enabled**, because every app imports `../shared` (and `ai` imports `../client/src`).
* Domains: main → `buildwithvishant.in` (+ `www`), playground → `code.buildwithvishant.in`, ai → `ai.buildwithvishant.in`.

## DNS

Add these in your DNS provider (Vercel shows the exact targets when you add each domain):

| Type | Name | Value |
|---|---|---|
| CNAME | `code` | `cname.vercel-dns.com` |
| CNAME | `ai` | `cname.vercel-dns.com` |

The apex/`www` records for the main site stay as they are.

## Render (backend)

Add `PLAYGROUND_URL`, `AI_URL` (and optionally `EXTRA_ALLOWED_ORIGINS`), then redeploy. No new secrets, no database
migration, no changed endpoints. The boot log prints the CORS allowlist so you can confirm it.

## How single sign-on works

The JWT still lives in each app's own `localStorage` (same keys as before) and is never put in a cookie or a URL.

1. **Shared marker cookie.** On login the main site sets `bwv_sid` — a random, non-secret id — on `.buildwithvishant.in`.
   It is not a credential; it only tells the other apps "a login exists in this browser" and "you logged out".
2. **Opening Playground/AI.** An app with no token but a marker cookie redirects once to
   `buildwithvishant.in/sso/authorize?target=<app>&return=<path>&silent=1`.
3. **One-time code.** The main site calls `POST /api/auth/sso/code` (Bearer auth) and gets a 60-second, single-use code
   bound to the target app's origin, then sends the browser to `<app>/sso/callback?code=…`.
4. **Exchange.** The app strips the code from the URL, calls `POST /api/auth/sso/exchange`, and receives a normal JWT
   (CORS-checked, `Origin` must equal the origin the code was issued for). The code is deleted before it is validated.
5. **Logout anywhere** clears the marker; every other app/tab drops its token the next time it is focused.
6. **Login from Playground/AI**: "Login" → `buildwithvishant.in/login?redirect=<app url>`; after login the main site runs
   step 3 and sends the user back. Redirect targets must be on the allowlist and `return` must be a relative path
   (`//host`, `\host`, absolute URLs are rejected).

Codes are held in server memory — fine for the single Render instance you run; if you ever scale to several instances,
move them to Redis/Mongo (a TTL index) in `authController.js`.

If the browser blocks the cookie (or the domains don't share a parent), the apps fall back to link-based hand-off from
the main site's Playground/AI links, and cross-app logout sync is disabled. Login itself keeps working.

## Search

`GET /api/search?q=` → `{ notes: [], projects: [] }`. Public, read-only, rate-limited (90/min/IP). Notes: published only;
matches title, slug, description, category, tags and heading text; project matches title, description, technologies.
The query is regex-escaped. The palette (`shared/search`) debounces 250 ms, aborts stale requests, caches 60 s, and opens
with Ctrl/⌘+K in all three apps. Project results deep-link to `/projects#<id>`.

## Theme

The theme is mirrored to a `bwv_theme` cookie on the parent domain, so a choice made in one app is picked up by the
others (localStorage and OS preference remain the fallbacks).

## Migration notes

* Existing logins keep working: same `portfolio_token` / `portfolio_user` keys, same JWTs. The first visit to the main
  site adds the marker cookie.
* `/playground`, `/assistant`, `/ai` on the main site now forward to the dedicated apps.
* The Playground/AI React pages moved out of `client/`; their old CSS blocks in `client/src/styles/global.css` are now
  unused and can be deleted whenever you like.
