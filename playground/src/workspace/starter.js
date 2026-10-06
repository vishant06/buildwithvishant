import { LANGUAGE_EXTENSIONS, analyzeJava, basename, dirname, extname } from "@shared/workspace/core.js";
import { demos } from "./languages.js";

// Starter ("example") code for a brand-new file, chosen from its name and folder.
// Pure function, no side effects: state.js calls it when the user creates a file.
//
//   starterFor({ path: "src/com/app/Utils.java", language: "java", nodes, hasMain })
//
// - Java gets the right `package` (from a sibling file in the same folder, else from
//   the folder path) and a class name that matches the file name.
// - Languages that have a demo in languages.js reuse that demo.
// - Unknown or plain-text extensions return "" so those files stay empty as before.

const JAVA_KEYWORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const",
  "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float",
  "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native",
  "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp",
  "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
  "volatile", "while", "true", "false", "null",
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const toIdentifier = (value) => {
  let id = String(value || "").replace(/[^A-Za-z0-9_$]/g, "_") || "_";
  if (/^[0-9]/.test(id)) id = `_${id}`;
  if (JAVA_KEYWORDS.has(id)) id = `${id}_`;
  return id;
};

// Folder that holds the source roots we should not turn into package names.
const SOURCE_ROOT = /^(?:src\/(?:main|test)\/java|src\/(?:main|test)|src|java)(?:\/|$)/;

const javaPackageFor = (path, nodes) => {
  const dir = dirname(path);
  if (!dir) return "";

  // 1) Follow a Java file that already lives in the same folder.
  const sibling = nodes.find(
    (node) => node.type === "file" && node.path !== path && /\.java$/i.test(node.path) && dirname(node.path) === dir,
  );
  if (sibling) return analyzeJava(sibling.content || "").packageName;

  // 2) Otherwise derive it from the folder path.
  return dir
    .replace(SOURCE_ROOT, "")
    .split("/")
    .filter(Boolean)
    .map((part) => toIdentifier(part.toLowerCase()))
    .join(".");
};

const javaStarter = (path, nodes, hasMain) => {
  const stem = basename(path).replace(/\.java$/i, "");
  if (/^(package-info|module-info)$/i.test(stem)) return "";

  // Only declare `public` when the class name can match the file name exactly,
  // otherwise javac would reject the file.
  const exact = IDENTIFIER.test(stem) && !JAVA_KEYWORDS.has(stem);
  const className = exact ? stem : toIdentifier(stem);
  const modifier = exact ? "public " : "";
  const pkg = javaPackageFor(path, nodes);
  const head = pkg ? `package ${pkg};\n\n` : "";

  // The first runnable class gets main(); later files are reusable helpers.
  if (!hasMain || stem === "Main") {
    return `${head}${modifier}class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${className}!");\n    }\n}\n`;
  }
  return `${head}${modifier}class ${className} {\n    public static String greet(String name) {\n        return "Hello, " + name + "!";\n    }\n}\n`;
};

const headerStarter = (name, ext) => {
  let macro = `${name.slice(0, name.length - ext.length).replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}${ext.replace(".", "_").toUpperCase()}`;
  if (/^[0-9]/.test(macro)) macro = `_${macro}`;
  return `#ifndef ${macro}\n#define ${macro}\n\nint add(int a, int b);\n\n#endif /* ${macro} */\n`;
};

const htmlStarter = (stem) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${(stem || "Document").replace(/[<>&"]/g, "")}</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n`;

const JS_MODULE = `function greet(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("World"));\n\nif (typeof module !== "undefined") {\n  module.exports = { greet };\n}\n`;
const TS_MODULE = `function greet(name: string): string {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("World"));\n`;
const PY_MODULE = `def greet(name):\n    return f"Hello, {name}!"\n\n\nif __name__ == "__main__":\n    print(greet("World"))\n`;

// extension -> language id, built from the same table the executor uses.
// Java, JS, TS and Python are handled above; .kts is a script (no main), so it stays empty.
const DEMO_LANGUAGE_BY_EXTENSION = (() => {
  const map = {};
  for (const [id, list] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (["java", "javascript", "typescript", "python"].includes(id)) continue;
    for (const ext of list) if (ext !== ".kts") map[ext] = id;
  }
  return map;
})();

export const starterFor = ({ path, language = "", nodes = [], hasMain = false }) => {
  const name = basename(path);
  const ext = extname(name);
  const stem = ext ? name.slice(0, name.length - ext.length) : name;

  switch (ext) {
    case ".java":
      return javaStarter(path, nodes, hasMain);
    case ".h":
    case ".hpp":
    case ".hh":
    case ".hxx":
      return headerStarter(name, ext);
    case ".html":
    case ".htm":
      return htmlStarter(stem);
    case ".css":
      return "body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}\n";
    case ".json":
      return '{\n  "message": "Hello, World!"\n}\n';
    case ".md":
      return `# ${stem}\n\nWrite something here.\n`;
    case ".js":
    case ".mjs":
    case ".cjs":
      return language === "web" ? 'console.log("Hello from script!");\n' : JS_MODULE;
    case ".ts":
      return TS_MODULE;
    case ".py":
      return PY_MODULE;
    default: {
      const id = DEMO_LANGUAGE_BY_EXTENSION[ext];
      return id && demos[id] ? `${demos[id]}\n` : "";
    }
  }
};
