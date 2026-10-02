import { LANGUAGE_EXTENSIONS, basename, extname } from "@shared/workspace/core.js";

// Language catalogue for the Playground: the selectable languages, their demo
// programs, and how file names map to editor syntax highlighting.

export const initial = {
  html: "<main>\n  <h1>Hello, builder!</h1>\n  <p>Make something delightful.</p>\n</main>",
  css: "body { font-family: system-ui; padding: 2rem; color: #0f172a; }\nh1 { color: #0284c7; }",
  javascript: 'console.log("Ready to build");',
};


export const languages = [
  { id: "web", label: "HTML / CSS / JS" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "dart", label: "Dart" },
  { id: "r", label: "R" },
  { id: "scala", label: "Scala" },
  { id: "shell", label: "Bash / Shell" },
  { id: "sql", label: "SQL" },
  { id: "lua", label: "Lua" },
  { id: "perl", label: "Perl" },
  { id: "haskell", label: "Haskell" },
];
export const editorLanguage = {
  html: "html",
  css: "css",
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  c: "c",
  cpp: "cpp",
  java: "java",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  kotlin: "kotlin",
  swift: "swift",
  dart: "dart",
  r: "r",
  scala: "scala",
  shell: "shell",
  sql: "sql",
  lua: "lua",
  perl: "perl",
  haskell: "haskell",
};
export const demos = {
  javascript:
    "const numbers = [1, 2, 3, 4, 5];\nconsole.log(numbers);\nconsole.log(numbers.reduce((sum, value) => sum + value, 0));",
  typescript:
    'interface User { name: string; age: number; }\nconst user: User = { name: "Vishant", age: 20 };\nconsole.log(user.name + " is " + user.age);',
  python:
    'name = "Vishant"\nfor i in range(5):\n    print(f"Hello {name} - {i}")',
  c: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello from C!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java!");\n  }\n}',
  csharp:
    'using System;\n\nclass MainClass {\n  static void Main() {\n    Console.WriteLine("Hello from C#!");\n  }\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello from Go!")\n}',
  rust: 'fn main() {\n  println!("Hello from Rust!");\n}',
  ruby: 'puts "Hello from Ruby!"',
  php: '<?php\necho "Hello from PHP!\\n";',
  kotlin: 'fun main() {\n  println("Hello from Kotlin!")\n}',
  swift: 'print("Hello from Swift!")',
  dart: 'void main() {\n  print("Hello from Dart!");\n}',
  r: 'print("Hello from R!")',
  scala: 'object Main extends App {\n  println("Hello from Scala!")\n}',
  shell: '#!/usr/bin/env bash\necho "Hello from Bash!"',
  sql: 'CREATE TABLE students (name TEXT, score INTEGER);\nINSERT INTO students VALUES ("Vishant", 100);\nSELECT * FROM students;',
  lua: 'print("Hello from Lua!")',
  perl: 'print "Hello from Perl!\\n";',
  haskell: 'main :: IO ()\nmain = putStrLn "Hello from Haskell!"',
};

// Default file name for a new single-file project (matches the executor's
// conventional names: Main.java, main.py ...).
const CAPITAL_MAIN = new Set(["java", "kotlin", "csharp", "scala", "haskell"]);
export const defaultFileName = (language) => {
  if (language === "web") return "index.html";
  const ext = LANGUAGE_EXTENSIONS[language]?.[0] || ".txt";
  return `${CAPITAL_MAIN.has(language) ? "Main" : "main"}${ext}`;
};

// Extension -> Monaco language id.
const EXTENSION_LANGUAGE = {
  ".java": "java", ".py": "python", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript", ".jsx": "javascript", ".c": "c", ".cpp": "cpp", ".cc": "cpp",
  ".cxx": "cpp", ".c++": "cpp", ".hpp": "cpp", ".hh": "cpp", ".hxx": "cpp", ".cs": "csharp", ".go": "go",
  ".rs": "rust", ".rb": "ruby", ".php": "php", ".kt": "kotlin", ".kts": "kotlin", ".swift": "swift",
  ".dart": "dart", ".r": "r", ".scala": "scala", ".sh": "shell", ".bash": "shell", ".sql": "sql",
  ".lua": "lua", ".pl": "perl", ".hs": "haskell", ".html": "html", ".htm": "html", ".css": "css",
  ".json": "json", ".md": "markdown", ".xml": "xml", ".yml": "yaml", ".yaml": "yaml", ".txt": "plaintext",
};

// .h is ambiguous: C headers in a C project, C++ headers otherwise.
export const monacoLanguageFor = (path, projectLanguage) => {
  const ext = extname(basename(path));
  if (ext === ".h") return projectLanguage === "c" ? "c" : "cpp";
  return EXTENSION_LANGUAGE[ext] || "plaintext";
};

// Extensions the file-name hint recognises for the project's language.
export const extensionsFor = (language) => (language === "web" ? [".html", ".css", ".js"] : LANGUAGE_EXTENSIONS[language] || []);

// Files without an extension that are normal and need no hint.
export const EXTENSIONLESS_OK = /^(makefile|dockerfile|license|readme|procfile|gemfile|rakefile)$/i;

// Which project language best describes an imported set of file paths.
export const detectProjectLanguage = (paths, fallback) => {
  const counts = new Map();
  for (const path of paths) {
    const ext = extname(basename(path));
    for (const [id, list] of Object.entries(LANGUAGE_EXTENSIONS)) {
      if (list.includes(ext)) counts.set(id, (counts.get(id) || 0) + 1);
    }
    if ([".html", ".htm"].includes(ext)) counts.set("web", (counts.get("web") || 0) + 1);
  }
  if (counts.size === 0) return fallback;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};
