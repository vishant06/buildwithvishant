// Central place for every URL the three BuildWithVishant apps need.
// Values come from Vite env vars; each has a sensible fallback so a fresh
// checkout works in development and a missing variable in production still
// points at the real domains.
const env = import.meta.env;
const clean = (value) => String(value || '').trim().replace(/\/+$/, '');
const dev = Boolean(env.DEV);

export const API_URL = clean(env.VITE_API_URL) || 'http://localhost:5000/api';
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

export const MAIN_SITE_URL = clean(env.VITE_MAIN_SITE_URL) || (dev ? 'http://localhost:5173' : 'https://buildwithvishant.in');
export const PLAYGROUND_URL = clean(env.VITE_PLAYGROUND_URL) || (dev ? 'http://localhost:5174' : 'https://code.buildwithvishant.in');
export const AI_URL = clean(env.VITE_AI_URL) || (dev ? 'http://localhost:5175' : 'https://ai.buildwithvishant.in');

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

// Origins that may take part in single sign-on. The backend enforces its
// own allowlist too (server/src/config/allowedOrigins.js); this list only
// stops a tampered link from sending the user's code to a stranger.
export const SSO_ALLOWED_ORIGINS = new Set(
  [MAIN_SITE_URL, PLAYGROUND_URL, AI_URL, ...String(env.VITE_SSO_EXTRA_ORIGINS || '').split(',')]
    .map((item) => originOf(item.trim()))
    .filter(Boolean),
);

// Parent-domain cookie shared by every subdomain (session marker + theme).
// Derived from the main site's host; override with VITE_COOKIE_DOMAIN.
// Left empty for localhost/IPs, where host-only cookies are already shared
// across ports.
const deriveCookieDomain = () => {
  const explicit = clean(env.VITE_COOKIE_DOMAIN);
  if (explicit) return explicit;
  try {
    const { hostname } = new URL(MAIN_SITE_URL);
    if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || !hostname.includes('.')) return '';
    return `.${hostname.replace(/^www\./, '')}`;
  } catch {
    return '';
  }
};
export const COOKIE_DOMAIN = deriveCookieDomain();

export const mainUrl = (path = '/') => `${MAIN_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
export { originOf };
