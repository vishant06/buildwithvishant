// Code formatter for the Playground ("Format Document", Alt+Shift+F).
//
// Monaco already formats JavaScript, TypeScript, JSON, CSS and HTML itself.
// Everything else (Java, C, C++, C#, Go, Rust, Kotlin, Swift, Dart, Scala, PHP,
// Python, Ruby, Shell, SQL, Lua, Perl, R, Haskell) has no formatter in the browser,
// so registerFormatters() adds one for those languages:
//
//  - brace languages: re-indents every line from its bracket depth (strings,
//    comments, text blocks and preprocessor lines are respected, `case` labels
//    inside `switch` are indented), trims trailing spaces, keeps at most one
//    blank line in a row, and ends the file with a single newline;
//  - indentation-based languages (Python, Ruby, Shell, SQL ...): only safe
//    clean-up. Indentation is never touched because it can carry meaning.
//
// The formatter only ever changes whitespace, so it can never change what the
// program does.

const BRACE_LANGUAGES = {
  java: { multi: ['"""'] },
  c: { preproc: true },
  cpp: { preproc: true },
  csharp: { preproc: true, multi: ['"""'] },
  go: { backtick: true, tabs: true },
  rust: {},
  kotlin: { multi: ['"""'] },
  swift: { multi: ['"""'] },
  dart: { multi: ['"""', "'''"], singleQuote: true },
  scala: { multi: ['"""'] },
  php: { hash: true, singleQuote: true },
};

const PLAIN_LANGUAGES = {
  python: { docstrings: true },
  ruby: {},
  shell: {},
  sql: {},
  lua: {},
  perl: {},
  r: {},
  haskell: {},
  plaintext: {},
};

const CHAR_LITERAL = /^'(?:\\u[0-9a-fA-F]{4}|\\.|[^\\'])'/;
const WORD = /^[A-Za-z_$][\w$]*/;

const skipQuoted = (line, start, quote) => {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === "\\") i += 2;
    else if (line[i] === quote) return i + 1;
    else i += 1;
  }
  return line.length;
};

// Walks one line, keeping the bracket stack and the multi-line state up to date.
const scan = (line, from, state, config) => {
  let i = from;
  while (i < line.length) {
    if (state.multi) {
      const end = line.indexOf(state.multi, i);
      if (end === -1) return;
      i = end + state.multi.length;
      state.multi = null;
      continue;
    }
    if (state.comment) {
      const end = line.indexOf("*/", i);
      if (end === -1) return;
      i = end + 2;
      state.comment = false;
      continue;
    }

    const ch = line[i];
    const two = line.slice(i, i + 2);
    if (two === "//") return;
    if (config.hash && ch === "#" && line[i + 1] !== "[") return;
    if (two === "/*") {
      state.comment = true;
      i += 2;
      continue;
    }
    const multi = config.multi?.find((token) => line.startsWith(token, i));
    if (multi) {
      state.multi = multi;
      i += multi.length;
      continue;
    }
    if (ch === '"') {
      i = skipQuoted(line, i, '"');
      continue;
    }
    if (ch === "'") {
      if (config.singleQuote) i = skipQuoted(line, i, "'");
      else {
        const match = CHAR_LITERAL.exec(line.slice(i, i + 12));
        i += match ? match[0].length : 1;
      }
      continue;
    }
    if (ch === "`" && config.backtick) {
      state.multi = "`";
      i += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const word = WORD.exec(line.slice(i))[0];
      if (word === "switch") state.pendingSwitch = true;
      i += word.length;
      continue;
    }
    if (ch === "{") {
      state.stack.push({ switchBlock: state.pendingSwitch, inCase: false, onCaseLine: state.caseLine });
      state.pendingSwitch = false;
    } else if (ch === "(" || ch === "[") {
      state.stack.push({});
    } else if (ch === "}" || ch === ")" || ch === "]") {
      state.stack.pop();
    } else if (ch === ";") {
      state.pendingSwitch = false;
    }
    i += 1;
  }
};

const CASE_LABEL = /^(?:case\b|default\s*(?::|->))/;

const formatBraces = (text, config, unit) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const state = { stack: [], comment: false, multi: null, pendingSwitch: false, caseLine: false };
  const out = [];
  let blank = 0;
  let macro = false; // inside a multi-line #define (lines end with a backslash)

  for (const raw of lines) {
    // Text blocks / raw strings: their content is data, so it stays exactly as typed.
    if (state.multi) {
      out.push(raw);
      scan(raw, 0, state, config);
      blank = 0;
      continue;
    }
    if (macro) {
      out.push(raw.replace(/\s+$/, ""));
      macro = /\\\s*$/.test(raw);
      blank = 0;
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      blank += 1;
      if (blank === 1 && out.length) out.push("");
      continue;
    }
    blank = 0;

    const inComment = state.comment;

    // C/C++/C# preprocessor lines sit at column 0 and never affect bracket depth.
    if (!inComment && config.preproc && trimmed.startsWith("#")) {
      out.push(trimmed);
      macro = /\\$/.test(trimmed);
      continue;
    }

    let start = 0;
    let closed = null;
    if (!inComment) {
      while (start < trimmed.length && ")]}".includes(trimmed[start])) {
        closed = state.stack.pop();
        start += 1;
      }
    }

    let level = state.stack.length;
    const top = state.stack[state.stack.length - 1];
    state.caseLine = false;
    if (!inComment && top?.switchBlock) {
      if (CASE_LABEL.test(trimmed.slice(start))) {
        top.inCase = true;
        state.caseLine = true;
      } else if (top.inCase && !closed?.onCaseLine) {
        level += 1;
      }
    }

    let prefix = unit.repeat(Math.max(0, level));
    if (inComment && trimmed.startsWith("*")) prefix += " ";
    out.push(prefix + trimmed);
    scan(trimmed, inComment ? 0 : start, state, config);
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.length ? `${out.join("\n")}\n` : "";
};

const formatPlain = (text, config) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let blank = 0;
  let open = null; // inside a Python triple-quoted string

  const track = (line) => {
    if (!config.docstrings) return;
    let i = 0;
    for (;;) {
      if (open) {
        const end = line.indexOf(open, i);
        if (end === -1) return;
        i = end + 3;
        open = null;
      } else {
        const a = line.indexOf('"""', i);
        const b = line.indexOf("'''", i);
        const found = [a, b].filter((index) => index !== -1).sort((x, y) => x - y)[0];
        if (found === undefined) return;
        open = line.startsWith('"""', found) ? '"""' : "'''";
        i = found + 3;
      }
    }
  };

  for (const raw of lines) {
    const wasOpen = open !== null;
    track(raw);
    // A line that leaves a triple-quoted string open ends inside the string, so keep it as typed.
    const line = open !== null ? raw : raw.replace(/\s+$/, "");
    if (!wasOpen && open === null && !line) {
      blank += 1;
      if (blank <= 2 && out.length) out.push("");
      continue;
    }
    blank = 0;
    out.push(line);
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.length ? `${out.join("\n")}\n` : "";
};

export const canFormat = (language) => language in BRACE_LANGUAGES || language in PLAIN_LANGUAGES;

export const formatText = (language, text, { tabSize = 4, insertSpaces = true } = {}) => {
  if (!String(text).trim()) return text;
  if (language in BRACE_LANGUAGES) {
    const config = BRACE_LANGUAGES[language];
    const unit = config.tabs || !insertSpaces ? "\t" : " ".repeat(Math.min(Math.max(tabSize, 1), 8));
    return formatBraces(text, config, unit);
  }
  if (language in PLAIN_LANGUAGES) return formatPlain(text, PLAIN_LANGUAGES[language]);
  return text;
};

// Registers the formatter with Monaco once (the monaco object is shared by every editor).
export const registerFormatters = (monaco) => {
  if (!monaco || monaco.__vkFormattersRegistered) return;
  monaco.__vkFormattersRegistered = true;
  for (const language of [...Object.keys(BRACE_LANGUAGES), ...Object.keys(PLAIN_LANGUAGES)]) {
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      displayName: "Playground formatter",
      provideDocumentFormattingEdits(model, options) {
        const before = model.getValue();
        const after = formatText(language, before, { tabSize: options.tabSize, insertSpaces: options.insertSpaces });
        return after === before ? [] : [{ range: model.getFullModelRange(), text: after }];
      },
    });
  }
};
