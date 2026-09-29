// Maps a note code block's `language` onto a key understood by the existing
// execution backend (POST /api/playground/execute, which is what the
// Playground page uses). The keys below mirror
// server/src/config/playgroundLanguages.js — if a language is added there,
// add it here and Notes code blocks pick it up automatically. A language that
// isn't listed simply gets no Run button (instead of a button that can only
// fail).

const EXECUTABLE_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'python',
  'c',
  'cpp',
  'java',
  'csharp',
  'go',
  'rust',
  'ruby',
  'php',
  'kotlin',
  'swift',
  'dart',
  'r',
  'scala',
  'shell',
  'sql',
  'lua',
  'perl',
  'haskell'
]);

// Shorthands / editor names that differ from the backend's keys. Notes only
// ever store the editor's own keys (see CODE_LANGUAGE_LABELS), but Markdown
// imports and legacy notes can carry other spellings.
const ALIASES = {
  js: 'javascript',
  mjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  py3: 'python',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell'
};

// Returns the backend language key for a note language, or null when the
// language can't be executed.
export const getExecutionLanguage = (language) => {
  const key = String(language || '').trim().toLowerCase();
  const resolved = ALIASES[key] || key;
  return EXECUTABLE_LANGUAGES.has(resolved) ? resolved : null;
};
