import request from './api.js';

// Client side of the code-execution service that already powers the
// Playground (POST /api/playground/execute). Notes code blocks reuse it
// as-is — there is no second execution engine.

// Maps the language keys used by note blocks (and common shorthands found in
// legacy notes / AI answers) onto the keys the execution service understands.
const EXECUTION_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  py3: 'python',
  'c++': 'cpp',
  cplusplus: 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  pl: 'perl',
  hs: 'haskell',
};

export const toExecutionLanguage = (language) => {
  const key = String(language || '').trim().toLowerCase();
  return EXECUTION_ALIASES[key] || key;
};

// The supported-language list is owned by the server (config/playgroundLanguages.js).
// Fetched once per page load and shared by every code block on the page.
let languagesPromise = null;

export const fetchExecutionLanguages = () => {
  if (!languagesPromise) {
    languagesPromise = request('/playground/languages')
      .then((data) => new Set(Array.isArray(data?.languages) ? data.languages : []))
      .catch(() => {
        // Let a later block retry (e.g. the API was still waking up on Render).
        languagesPromise = null;
        return null;
      });
  }
  return languagesPromise;
};

const CLIENT_TIMEOUT_MS = 20_000;

// Runs `code` and resolves to a normalized result:
// { success, stdout, stderr, compileOutput, message, status, time }
// Rejects with an Error whose `.message` is safe to show to the user.
export const executeCode = async ({ language, code, stdin = '' }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const result = await request('/playground/execute', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ language: toExecutionLanguage(language), code, stdin }),
    });
    return {
      success: Boolean(result.success),
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compileOutput: result.compileOutput || '',
      message: result.message || '',
      status: result.status || '',
      time: result.time ?? null,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The execution service took too long to respond. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Network error — please check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
