import request from '../api/request.js';
import { MAIN_SITE_URL, SSO_ALLOWED_ORIGINS, originOf } from '../config/urls.js';
import { LOCAL_SID, ensureSid, getSid, getToken, readMarker, saveSession } from './session.js';

const TRIED_KEY = 'bwv_sso_tried';
const REDIRECT_KEY = 'bwv_post_login_redirect';
export const CALLBACK_PATH = '/sso/callback';
export const AUTHORIZE_PATH = '/sso/authorize';

// A path is only ever accepted as a same-app relative path. "//evil.com",
// "/\evil.com", "javascript:" etc. are all rejected — this is what stops the
// return parameter being used as an open redirect.
export const isSafeReturnPath = (value) =>
  typeof value === 'string' &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !/[\\\u0000-\u001f]/.test(value);

export const safeReturnPath = (value) => (isSafeReturnPath(value) ? value : '/');

export const isAllowedTarget = (origin) => SSO_ALLOWED_ORIGINS.has(origin || '');
export const isMainSiteOrigin = () => window.location.origin === originOf(MAIN_SITE_URL);

// Link that asks the main site to sign the user in to `targetBase`, then
// come back to `returnPath`. Used by the app links in navbars.
export const authorizeUrl = (targetBase, returnPath = '/', silent = false) => {
  const params = new URLSearchParams({ target: originOf(targetBase) || '', return: safeReturnPath(returnPath) });
  if (silent) params.set('silent', '1');
  return `${MAIN_SITE_URL}${AUTHORIZE_PATH}?${params.toString()}`;
};

// Where a navbar link to Playground/AI should point. Normally the app's own
// URL: it finds the shared session marker and signs itself in. On the main
// site, when the marker cookie can't be shared, a signed-in user is sent
// through the handoff instead so they still arrive signed in.
export const appHref = (appUrl, path = '/') => {
  if (isMainSiteOrigin() && getToken() && getSid() === LOCAL_SID) return authorizeUrl(appUrl, path);
  return `${appUrl}${path}`;
};

// Login page support: remember where to send the user after they sign in
// (an OAuth round trip loses the query string, so it is kept in
// sessionStorage). Only allow-listed app origins are stored.
export const rememberPostLoginRedirect = (value) => {
  try {
    const url = new URL(value);
    if (isAllowedTarget(url.origin)) sessionStorage.setItem(REDIRECT_KEY, url.href);
  } catch {
    // ignore malformed values
  }
};

export const peekPostLoginRedirect = () => sessionStorage.getItem(REDIRECT_KEY);

export const takePostLoginRedirect = () => {
  const value = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return value;
};

// Main site: called once the user is known to be signed in. Fetches a
// one-time code bound to `target` and sends the browser there. Only the
// short-lived code travels in the URL — never the JWT.
export const completeAuthorize = async ({ target, returnPath, silent }) => {
  const targetOrigin = originOf(target);
  if (!targetOrigin || !isAllowedTarget(targetOrigin)) throw new Error('This sign-in target is not allowed.');
  const ret = safeReturnPath(returnPath);
  const callback = new URL(CALLBACK_PATH, targetOrigin);
  callback.searchParams.set('return', ret);

  if (!getToken()) {
    if (!silent) throw new Error('not-signed-in');
    callback.searchParams.set('status', 'anonymous');
    window.location.replace(callback.href);
    return;
  }

  // Make sure the shared marker exists so the receiving app can pair with it.
  if (!readMarker()) ensureSid({ create: true });

  try {
    const { code } = await request('/auth/sso/code', { method: 'POST', body: JSON.stringify({ target: targetOrigin }) });
    callback.searchParams.set('code', code);
  } catch {
    callback.searchParams.set('status', 'anonymous');
  }
  window.location.replace(callback.href);
};

// Playground / AI: runs before React renders. Returns true when the page is
// navigating away (so the caller should not render the app).
//   /sso/callback?code=...  -> exchange the code for a session, then go on
//   no local token + shared marker present -> ask the main site once
export const bootstrapSession = async () => {
  const { pathname, searchParams } = new URL(window.location.href);

  if (pathname === CALLBACK_PATH) {
    const code = searchParams.get('code');
    const ret = safeReturnPath(searchParams.get('return'));
    // Remove the code from the address bar/history immediately.
    window.history.replaceState({}, document.title, CALLBACK_PATH);
    document.getElementById('root').textContent = 'Signing you in…';
    const marker = readMarker();
    if (marker) sessionStorage.setItem(TRIED_KEY, marker);
    if (code) {
      try {
        const data = await request('/auth/sso/exchange', { method: 'POST', body: JSON.stringify({ code }) });
        saveSession(data.token, data.user, marker || LOCAL_SID);
      } catch {
        // Fall through: the app opens signed out and can offer Login.
      }
    }
    window.location.replace(ret);
    return true;
  }

  const marker = readMarker();
  if (!getToken() && marker && sessionStorage.getItem(TRIED_KEY) !== marker) {
    sessionStorage.setItem(TRIED_KEY, marker);
    window.location.replace(authorizeUrl(window.location.origin, `${window.location.pathname}${window.location.search}`, true));
    return true;
  }
  return false;
};

// Login page: if a login was started from another app, hand the fresh session
// over to it now. Returns true when a redirect was started.
export const finishPostLogin = () => {
  const pending = takePostLoginRedirect();
  if (!pending) return false;
  try {
    const url = new URL(pending);
    completeAuthorize({ target: url.origin, returnPath: `${url.pathname}${url.search}`, silent: false }).catch(() => {
      window.location.replace(`${url.origin}/`);
    });
    return true;
  } catch {
    return false;
  }
};
