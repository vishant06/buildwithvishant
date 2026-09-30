import { COOKIE_DOMAIN } from '../config/urls.js';

// Same storage keys the site has always used, so existing logins survive.
export const TOKEN_KEY = 'portfolio_token';
export const USER_KEY = 'portfolio_user';
// Which login this browser profile's stored token belongs to (see marker).
export const SID_KEY = 'portfolio_sid';

// The session marker is a NON-SECRET random id kept in a parent-domain
// cookie (.buildwithvishant.in). It is not a credential — the JWT stays in
// each app's own localStorage and is never put in a cookie or URL. It only
// lets the three apps agree that "a login exists" (so a fresh app can ask
// for a handoff) and that "the user logged out" (so every app drops its
// token). If cookies can't be shared, everything degrades gracefully to
// link-based handoff from the main site.
const MARKER_COOKIE = 'bwv_sid';
const MARKER_MAX_AGE = 7 * 24 * 60 * 60; // matches the API's default JWT lifetime

const cookieAttributes = (maxAge) =>
  `Path=/; Max-Age=${maxAge}; SameSite=Lax${COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''}${
    window.location.protocol === 'https:' ? '; Secure' : ''
  }`;

export const readCookie = (name) => {
  const match = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
};

export const writeCookie = (name, value, maxAge) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAge)}`;
};

export const readMarker = () => readCookie(MARKER_COOKIE);
export const writeMarker = (sid) => writeCookie(MARKER_COOKIE, sid, MARKER_MAX_AGE);
export const clearMarker = () => writeCookie(MARKER_COOKIE, '', 0);

export const newSid = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getSid = () => localStorage.getItem(SID_KEY);
export const getUser = () => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const saveUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));

// Sentinel stored instead of a real id when the shared cookie can't be used
// (unsupported domain, cookies blocked). Cross-app logout sync is then off,
// but the session itself keeps working.
export const LOCAL_SID = 'local';

// Store a session. A brand-new login (main site) omits `sid` and gets a
// fresh one; an app receiving a handoff passes the marker it observed (or
// LOCAL_SID when there is none, in which case no cookie is written).
export const saveSession = (token, user, sid = newSid()) => {
  localStorage.setItem(TOKEN_KEY, token);
  saveUser(user);
  let stored = sid;
  if (sid !== LOCAL_SID) {
    writeMarker(sid);
    if (readMarker() !== sid) stored = LOCAL_SID;
  }
  localStorage.setItem(SID_KEY, stored);
  return stored;
};

// Make sure this browser has a session marker for an existing token (a
// login made before the marker existed, or one whose cookie expired).
// Adopts the current marker if there is one; otherwise, when `create` is
// set (main site only), mints one. Returns the sid now in effect, or ''.
export const ensureSid = ({ create = false } = {}) => {
  const marker = readMarker();
  if (marker) {
    localStorage.setItem(SID_KEY, marker);
    return marker;
  }
  if (!create) return '';
  const sid = newSid();
  writeMarker(sid);
  const stored = readMarker() === sid ? sid : LOCAL_SID;
  localStorage.setItem(SID_KEY, stored);
  return stored;
};

export const clearLocalSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SID_KEY);
};

// Logging out anywhere: drop this app's copy AND the shared marker so every
// other app / tab notices and signs out on its next check.
export const clearSession = () => {
  clearLocalSession();
  clearMarker();
};
