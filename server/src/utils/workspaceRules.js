// Workspace rules — pure functions with NO imports, shared by the Playground UI
// (local-folder sync, share warnings) and the API server (public view filter).
// The single source of truth is this file; the server keeps a byte-identical
// copy at server/src/utils/workspaceRules.js
// (run `npm run sync:workspace` in server/ after editing; `npm run check:workspace` verifies).
//
// Paths are "/"-separated and relative to the project root, exactly like
// shared/workspace/core.js.

// ------------------------------------------------------------ sensitive files
// Files that very often hold secrets. They are never synchronised from a local
// folder unless the user explicitly allows it, and they are never shown in a
// public project, whatever the owner chooses.

const SAFE_ENV_SUFFIXES = new Set(['example', 'sample', 'template', 'dist', 'defaults', 'schema']);

const SENSITIVE_DIRS = new Set(['.ssh', '.aws', '.gnupg', '.kube', '.docker', '.azure', '.gcloud']);

const SENSITIVE_NAMES = new Set([
  '.npmrc', '.pypirc', '.netrc', '.git-credentials', '.htpasswd', '.dockercfg', '.pgpass', '.vault_pass',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
  'credentials', 'credentials.json', 'credentials.yml', 'credentials.yaml', 'credentials.toml',
  'secrets.json', 'secrets.yml', 'secrets.yaml', 'secrets.toml', 'secret.json', 'secret.yml', 'secret.yaml',
  'wp-config.php', 'terraform.tfvars', 'terraform.tfstate',
]);

const SENSITIVE_PATTERNS = [
  /\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk)$/i,
  /\.(tfvars|tfstate)$/i,
  /^client_secret.*\.json$/i,
  /^service[-_]?account.*\.json$/i,
  /^.*\.env$/i, // production.env, local.env
];

// Returns a short reason when the path should be treated as sensitive, else ''.
export const sensitiveReason = (path) => {
  if (typeof path !== 'string' || !path) return '';
  const parts = path.split('/');
  const name = parts[parts.length - 1].toLowerCase();
  if (parts.slice(0, -1).some((part) => SENSITIVE_DIRS.has(part.toLowerCase()))) return 'credentials folder';
  if (name === '.env' || name.startsWith('.env.')) {
    const suffix = name.slice(5);
    return name !== '.env' && SAFE_ENV_SUFFIXES.has(suffix) ? '' : 'environment file';
  }
  if (SENSITIVE_NAMES.has(name)) return 'credentials file';
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(name))) return /\.env$/.test(name) ? 'environment file' : 'key or credentials file';
  return '';
};

export const isSensitivePath = (path) => Boolean(sensitiveReason(path));

const PRIVATE_KEY_BLOCK = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/;

// Content that is a private key, whatever the file is called.
export const hasPrivateKeyBlock = (content) => typeof content === 'string' && PRIVATE_KEY_BLOCK.test(content);

// Looser, advisory scan used only to WARN the owner before a project is made
// public (never to block anything). Returns a list of short reasons.
const SECRET_SHAPES = [
  [/AKIA[0-9A-Z]{16}/, 'looks like an AWS access key'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'looks like a GitHub token'],
  [/sk-[A-Za-z0-9_-]{24,}/, 'looks like an API secret key'],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'looks like a Slack token'],
  [/AIza[0-9A-Za-z_-]{35}/, 'looks like a Google API key'],
  [/mongodb(?:\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/i, 'contains a database connection string with a password'],
];

export const scanSecrets = (content) => {
  if (typeof content !== 'string' || !content) return [];
  const found = [];
  if (hasPrivateKeyBlock(content)) found.push('contains a private key');
  for (const [pattern, reason] of SECRET_SHAPES) if (pattern.test(content)) found.push(reason);
  return found;
};

// A file the public view must not show (name or content).
export const isHiddenFromPublic = (path, content) => isSensitivePath(path) || hasPrivateKeyBlock(content);

// -------------------------------------------------------------- binary files

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif', '.tiff', '.psd',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.jar', '.war',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj', '.class', '.pyc', '.pyo', '.a', '.lib',
  '.sqlite', '.sqlite3', '.db', '.iso', '.dmg',
]);

export const isBinaryPath = (path) => {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot > 0 && BINARY_EXTENSIONS.has(name.slice(dot));
};

// ------------------------------------------------------------ default ignores
// gitignore syntax. Evaluated BEFORE the project's own .gitignore /
// .playgroundignore, so a project can re-include something with "!pattern".

export const DEFAULT_IGNORE_LINES = Object.freeze([
  // dependencies, VCS, build output, caches
  'node_modules/', '.git', '.svn', '.hg',
  'dist/', 'build/', 'out/', '.next/', '.nuxt/', '.svelte-kit/', '.output/', '.parcel-cache/', '.turbo/', '.vercel/', '.expo/',
  '.cache/', 'coverage/', 'target/', '__pycache__/', '.pytest_cache/', '.mypy_cache/', '.gradle/', '.venv/', 'venv/',
  '.idea/',
  // operating-system metadata and editor leftovers
  '.DS_Store', 'Thumbs.db', 'ehthumbs.db', 'desktop.ini', '._*', '*.swp', '*.swo', '*~',
  // logs, lock files and compiled files (no value in a code playground)
  '*.log', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '*.class', '*.pyc',
]);

// --------------------------------------------------------- gitignore matcher

const escapeRegex = (char) => char.replace(/[.+^${}()|\\]/g, '\\$&');

const globToRegex = (glob) => {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const prevSlash = i === 0 || glob[i - 1] === '/';
        let j = i + 2;
        while (glob[j] === '*') j += 1;
        if (prevSlash && glob[j] === '/') {
          out += '(?:.*/)?'; // "**/" matches zero or more directories
          i = j;
        } else if (prevSlash && j >= glob.length) {
          out += '.*'; // trailing "/**"
          i = j - 1;
        } else {
          out += '[^/]*';
          i = j - 1;
        }
      } else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else if (c === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) out += '\\[';
      else {
        let body = glob.slice(i + 1, end);
        if (body[0] === '!') body = `^${body.slice(1)}`;
        out += `[${body.replace(/\\/g, '\\\\')}]`;
        i = end;
      }
    } else if (c === '\\' && i + 1 < glob.length) {
      out += escapeRegex(glob[i + 1]);
      i += 1;
    } else out += escapeRegex(c);
  }
  return out;
};

const compileLine = (rawLine) => {
  let line = rawLine.replace(/\r$/, '');
  if (!line.trim() || line.startsWith('#')) return null;
  line = line.replace(/(?<!\\)[ \t]+$/, '');
  let negate = false;
  if (line.startsWith('!')) {
    negate = true;
    line = line.slice(1);
  } else if (line.startsWith('\\!') || line.startsWith('\\#')) line = line.slice(1);
  if (!line) return null;
  let dirOnly = false;
  if (line.endsWith('/')) {
    dirOnly = true;
    line = line.replace(/\/+$/, '');
  }
  if (!line) return null;
  const anchored = line.includes('/');
  line = line.replace(/^\//, '');
  let regex;
  try {
    regex = new RegExp(anchored ? `^${globToRegex(line)}$` : `(?:^|/)${globToRegex(line)}$`);
  } catch {
    return null; // a malformed pattern never breaks syncing; it is just ignored
  }
  return { negate, dirOnly, regex };
};

// createIgnore(text) -> { ignores(path, isDir) }.
// Follows gitignore rules: the last matching pattern wins, a pattern that
// matches a directory ignores everything inside it, patterns with a slash are
// anchored to the root, a trailing slash matches directories only.
export const createIgnore = (text = '') => {
  const rules = String(text).split('\n').map(compileLine).filter(Boolean);
  const matchPrefix = (prefix, isDir) => {
    let ignored = false;
    for (const rule of rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.regex.test(prefix)) ignored = !rule.negate;
    }
    return ignored;
  };
  return {
    ruleCount: rules.length,
    ignores(path, isDir = false) {
      const parts = path.split('/');
      for (let i = 0; i < parts.length; i += 1) {
        const last = i === parts.length - 1;
        if (matchPrefix(parts.slice(0, i + 1).join('/'), last ? isDir : true)) return true;
      }
      return false;
    },
  };
};

export const buildIgnore = ({ gitignore = '', playgroundignore = '' } = {}) =>
  createIgnore([...DEFAULT_IGNORE_LINES, gitignore, playgroundignore].join('\n'));

// What should happen to a path when synchronising? One answer per path:
//   { sync: true }                               -> synchronise it
//   { sync: false, kind, reason }                -> leave it alone and say why
export const classifySyncPath = (path, { ignore, isDir = false, includeSensitive = false } = {}) => {
  if (ignore && ignore.ignores(path, isDir)) return { sync: false, kind: 'ignored', reason: 'matches an ignore rule' };
  if (!includeSensitive) {
    // a sensitive FOLDER (".ssh") is skipped as a whole, never opened
    const reason = sensitiveReason(isDir ? `${path}/_` : path);
    if (reason) return { sync: false, kind: 'sensitive', reason };
  }
  if (!isDir && isBinaryPath(path)) return { sync: false, kind: 'binary', reason: 'binary file' };
  return { sync: true };
};
