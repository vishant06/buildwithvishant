// Deliberately dependency-free: a small regex tokenizer is enough for
// readable note code blocks, and it avoids pulling in a heavy
// react-native syntax highlighter that would need its own native/WebView
// setup. Swap this out for `react-native-syntax-highlighter` later if you
// want full Prism-grade highlighting.
const KEYWORDS = [
  "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break",
  "continue", "const", "let", "var", "class", "extends", "new", "this", "super", "import",
  "export", "default", "from", "async", "await", "try", "catch", "finally", "throw", "typeof",
  "instanceof", "public", "private", "protected", "static", "void", "int", "long", "float",
  "double", "boolean", "char", "String", "def", "print", "println", "System", "package",
  "interface", "implements", "struct", "enum", "namespace", "using", "include", "true", "false",
  "null", "None", "nil", "undefined", "self", "in", "of", "as", "with", "lambda",
];
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`);

// Order matters: strings/comments are matched first so keywords inside
// them are never re-tokenized.
const TOKEN_TYPES = [
  { type: "comment", re: /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/ },
  { type: "string", re: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/ },
  { type: "number", re: /\b\d+(\.\d+)?\b/ },
  { type: "keyword", re: KEYWORD_RE },
];

const COMBINED_RE = new RegExp(TOKEN_TYPES.map((t) => t.re.source).join("|"), "g");

export const tokenizeLine = (line) => {
  if (!line) return [{ text: "", type: "plain" }];
  const tokens = [];
  let lastIndex = 0;
  let match;

  COMBINED_RE.lastIndex = 0;
  while ((match = COMBINED_RE.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: "plain" });
    }
    const text = match[0];
    const type =
      TOKEN_TYPES.find((t) => new RegExp(`^(?:${t.re.source})$`).test(text))?.type || "plain";
    tokens.push({ text, type });
    lastIndex = match.index + text.length;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex), type: "plain" });
  return tokens;
};
