# BuildWithVishant — Mobile App (React Native + Expo SDK 57)

Talks to the same backend as the website. No duplicate API, no mock data,
no second auth system.

## ⚠️ Environment limitations (read before testing)

I don't have network or Android tooling in this sandbox — I could not run
`npm install`, `expo start`, an emulator, or `eas build` here. Every file
below is real code written against your actual backend routes, controllers,
and models (I read them directly, including the ones added in this pass).
Run it locally at least once before trusting it end-to-end.

Two version numbers I could not verify against the npm registry:
`expo-splash-screen` and `expo-web-browser` in `package.json` are set to
`~57.0.3` to match your other `expo-*` packages, but run
`npx expo install expo-splash-screen expo-web-browser` after `npm install`
to let Expo correct them if needed.

## Setup

```bash
cd mobile
npm install
npx expo install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your LAN IP for a physical device
npx expo start
```

Keep `METRO_MAX_WORKERS=1` if you're already setting it — untouched here.

## 1. What was added (features)

- **Google + GitHub sign-in** — reuses your existing backend OAuth flow
  end-to-end (see "Authentication changes" below).
- **AI chat** — full screen: send/receive, loading state, error handling,
  save conversation, new conversation, conversation history (list +
  reopen), delete conversation, fullscreen mode. All via your real
  `/api/ai/chat` + `/api/ai/conversations` endpoints.
- **Theme system** — Light / Dark / System, persisted, applied consistently
  app-wide via a central `ThemeContext` (details below).
- **Branded splash/startup screen** — the real BWV logo, held on screen
  until session + theme restoration finish.
- **Branded navbar** — logo in the header on every screen; Home has a full
  navbar (logo + brand name left, avatar/login right).
- **New screens**: Projects (list), Resume (view/open), Contact (form),
  Settings (theme picker + account + logout) — all wired to real endpoints.
- **Playground "Fit to screen"** — now a real, indication-clear toggle
  (mobile equivalent: expands the editor and hides the stdin/console panels;
  pressing again restores the exact previous layout).
- Centralized API client: friendly per-status error messages, request
  timeouts, and automatic logout on a 401 from anywhere in the app.

## 2. UI changes

- Every screen and shared component (`Screen`, `CodeBlock`, `NoteBlocks`,
  `NoteCard`, `NoteForm`, `RequestStates`, all `app/` routes) now reads
  colors from `useAppTheme()` instead of a static import — this is the
  "centralized design system" the brief asked for, not per-screen colors.
- Home redesigned with a real navbar, hero, 6 quick-access cards (Notes,
  Playground, AI, Projects, Resume, Contact), and a "Popular Notes" section
  with a "See all" link.
- Added a `table` block type to `NoteBlocks` (was missing before).
- Bottom tabs are now: Home, Notes, Playground, **AI**, Profile. Admin,
  Settings, Projects, Resume, and Contact are one tap away from Profile/Home
  rather than tabs, to avoid a cramped 8-tab bar.

## 3. Authentication changes

**Backend** (`server/src/controllers/authController.js`) — additive only,
website flow is byte-for-byte unchanged:
- `GET /api/auth/:provider?platform=mobile` now sets a second short-lived
  cookie (`oauth_target=mobile`) alongside the existing CSRF `oauth_state`
  cookie.
- `GET /api/auth/:provider/callback` checks that cookie: if present, it
  redirects to `MOBILE_APP_SCHEME://auth/callback#token=...&user=...`
  instead of the website's `CLIENT_URL/auth/callback`. Without the
  `platform=mobile` query param (i.e. every website request), behavior is
  identical to before.
- New env var: `MOBILE_APP_SCHEME` (defaults to `buildwithvishant`, matching
  `mobile/app.json`'s `"scheme"`). Added to `.env.example` and appended to
  your real `.env` (value only, no other lines touched).

**Mobile** (`services/oauth.js`, `app/login.jsx`) — opens
`${API_URL}/auth/:provider?platform=mobile` in `expo-web-browser`'s
`openAuthSessionAsync`, waits for the deep-link redirect, parses the
`token`/`user` out of the URL fragment, and calls the same `applySession()`
that the token store already uses for email/password login.

**⚠️ Real constraint, not a bug**: this only completes inside a **dev-client
or standalone/EAS build** — Expo Go cannot register the app's own
`buildwithvishant://` custom scheme, so tapping Google/GitHub inside plain
Expo Go will open the browser but never redirect back into the app. Email/
password login is unaffected and works in Expo Go as before. This is an
Expo platform limitation, not something fixable from app code — see
https://docs.expo.dev/guides/authentication/ if you want the details.

**Also unchanged, on purpose**: forgot-password/email verification —
I checked, and neither exists in the current backend (`authController.js`
has no reset-password or resend-verification routes). I didn't fabricate
UI for backend features that don't exist yet.

## 4. Theme changes

- `constants/theme.js` — `lightColors` / `darkColors`, copied field-for-
  field from `client/src/styles/global.css`'s `:root` / `[data-theme='light']`
  blocks, so the app matches the website's actual palette in both modes.
- `context/ThemeContext.jsx` (new) — `AppThemeProvider` / `useAppTheme()`.
  Mode (`light`/`dark`/`system`) persists via `expo-secure-store` (already a
  dependency; not a secret, but reusing it avoided adding AsyncStorage just
  for one string). `system` resolves via React Native's `useColorScheme`.
  `app.json`'s `userInterfaceStyle` is now `"automatic"` (was hardcoded
  `"dark"`), which is required for system-scheme detection to work at all.
- Every screen/component listed in section 2 reads from this context.

## 5. Logo / splash changes

- Copied your **actual** assets from `client/public/` — nothing generated:
  - `Interlocking 'BWV' Monogram Logo on Charcoal Background.png` →
    `mobile/assets/logo-splash.png` — used for the app icon, Android
    adaptive icon, and native splash screen (`app.json`).
  - `logo-tab.png` → `mobile/assets/logo-mark.png` — the transparent
    line-art mark, used by the new `components/Logo.jsx` in every header.
- `Logo.jsx` puts the mark on a small fixed-dark chip (`colors.brandChip`)
  in both themes — the mark itself is white/teal line art, so it needs a
  dark backing to stay legible in light mode too (there's no separate
  light-mode logo asset on the website — `img-dark.png`/`img-light.png`
  are the founder's photo on the Home hero, not a logo variant, so I didn't
  use those for branding).
- `app/_layout.jsx` uses `expo-splash-screen`'s `preventAutoHideAsync()` /
  `hideAsync()` to keep the native branded splash (not a blank/white screen)
  on-screen until both auth-session restore and theme-preference load are
  done, then hides it in one transition — no second custom loading screen
  needed for startup specifically.

## 6. Backend changes (full list)

Only these two things touched the backend — nothing else:
1. `server/src/controllers/authController.js` — mobile OAuth redirect
   support (section 3 above).
2. `server/.env.example` + `server/.env` — added `MOBILE_APP_SCHEME` key.

(The Cloudinary thumbnail-upload endpoint from earlier in this project is
unrelated to this pass and was already in place.)

## 7. Files touched this pass

**New:** `context/ThemeContext.jsx`, `components/Logo.jsx`, `services/ai.js`,
`services/oauth.js`, `services/projects.js`, `services/resume.js`,
`services/contact.js`, `utils/markdown.js`, `app/(tabs)/ai.jsx`,
`app/projects.jsx`, `app/resume.jsx`, `app/contact.jsx`, `app/settings.jsx`,
`assets/logo-splash.png`, `assets/logo-mark.png`.

**Rewritten:** `constants/theme.js`, `services/api.js`, `context/AuthContext.jsx`,
`app/_layout.jsx`, `app/(tabs)/_layout.jsx`, `app/(tabs)/index.jsx`,
`app/(tabs)/notes.jsx`, `app/(tabs)/playground.jsx`, `app/(tabs)/profile.jsx`,
`app/notes/[slug].jsx`, `app/login.jsx`, `app/signup.jsx`,
`app/admin/_layout.jsx`, `app/admin/index.jsx`, `components/Screen.jsx`,
`components/RequestStates.jsx`, `components/CodeBlock.jsx`,
`components/NoteCard.jsx`, `components/NoteBlocks.jsx`, `components/NoteForm.jsx`,
`app.json`, `package.json`.

**Backend:** `server/src/controllers/authController.js`, `server/.env.example`,
`server/.env`.

## 8. Feature-parity checklist (website → mobile)

| Website feature | Mobile status |
|---|---|
| Home | ✅ Redesigned, real navbar + profile |
| Email/password auth | ✅ |
| Google login | ✅ code complete — needs dev-client/EAS build to test (Expo Go limitation above) |
| GitHub login | ✅ same as above |
| Forgot/reset password | ⛔ Doesn't exist on the backend either — not fabricated |
| Email verification | ⛔ Backend has no resend/verify route exposed to reuse |
| Profile (view) | ✅ |
| Profile editing / avatar change | ⛔ No backend endpoint exists (website is read-only too) — flagged, not built |
| Notes (list/search/filter/detail) | ✅ |
| Note code rendering | ✅ real syntax highlighting, copy, horizontal scroll |
| Bookmarked/saved notes | ⛔ Not a backend feature on the website either |
| Projects | ✅ new screen |
| Resume | ✅ new screen |
| Contact | ✅ new screen |
| Playground | ✅ incl. real "Fit to screen" toggle |
| AI chat + save/history | ✅ new screen |
| Admin (notes/users/messages) | ✅ carried over, theme-aware |
| Settings / theme | ✅ new screen, Light/Dark/System |

## 9. Remaining limitations / things needing your input

- **Test on a real device before shipping** — untested in this sandbox, see
  the warning at the top.
- **OAuth needs a dev-client or EAS build to complete** (Expo Go can't own
  the custom scheme) — see section 3.
- `GOOGLE_CLIENT_ID/SECRET` and `GITHUB_CLIENT_ID/SECRET` must already be
  set in your real backend `.env` for social login to work at all — if
  they're blank, the backend returns "sign-in is not configured yet"
  instead of crashing, but it won't work until you add real OAuth app
  credentials.
- One thing worth a look while I was in there: `GET /api/contact/messages`
  only requires `protect` (any logged-in user), not `authorize('admin')`
  like the rest of the admin routes — I didn't change it since it's outside
  what was asked, but flagging it in case that's not intentional.
- No offline note caching yet (same limitation as before this pass).
- `react-syntax-highlighter`-grade precision isn't implemented — the
  dependency-free tokenizer in `utils/highlight.js` covers common
  languages well but isn't exhaustive.
