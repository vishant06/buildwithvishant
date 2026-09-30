// Single source of truth for which browser origins may call this API and
// may receive a single-sign-on handoff code. An explicit allowlist — never
// a wildcard — because requests carry credentials (Authorization headers).
//
// Configure with env vars (comma-separated where noted):
//   CLIENT_URL           main website            e.g. https://buildwithvishant.in
//   PLAYGROUND_URL       dedicated Playground    e.g. https://code.buildwithvishant.in
//   AI_URL               dedicated AI app        e.g. https://ai.buildwithvishant.in
//   EXTRA_ALLOWED_ORIGINS  any additional origins (preview deploys, etc.)

const normalize = (value) => {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
};

const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const buildAllowlist = () => {
  const origins = new Set();
  const add = (value) => {
    const origin = normalize(value);
    if (origin) origins.add(origin);
  };

  const main = process.env.CLIENT_URL || 'http://localhost:5173';
  add(main);
  add(process.env.PLAYGROUND_URL);
  add(process.env.AI_URL);
  splitList(process.env.EXTRA_ALLOWED_ORIGINS).forEach(add);

  // buildwithvishant.in <-> www.buildwithvishant.in
  const mainOrigin = normalize(main);
  if (mainOrigin) {
    const url = new URL(mainOrigin);
    if (url.hostname.startsWith('www.')) add(`${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ''}`);
    else if (url.hostname.includes('.') && !/^\d+(\.\d+){3}$/.test(url.hostname) && url.hostname !== 'localhost') {
      add(`${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ''}`);
    }
  }

  // Local development: main site, Playground and AI dev servers.
  if (process.env.NODE_ENV !== 'production') {
    ['5173', '5174', '5175'].forEach((port) => {
      add(`http://localhost:${port}`);
      add(`http://127.0.0.1:${port}`);
    });
  }

  return origins;
};

export const allowedOrigins = buildAllowlist();

export const isAllowedOrigin = (origin) => {
  const normalized = origin ? normalize(origin) : null;
  return Boolean(normalized && allowedOrigins.has(normalized));
};

export const normalizeOrigin = normalize;
