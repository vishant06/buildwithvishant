import { HEADER_EXTENSIONS, LANGUAGE_EXTENSIONS } from '../utils/workspaceCore.js';

// Execution configuration, one entry per language.
//
//   runtime / filename  what the executor is told to run, and the file name used
//                       for the classic single-file request ({ language, code })
//   extensions          source-file extensions for the language (workspaceCore)
//   headers             header extensions that must be present but are not compiled
//   kind                'compiled'    -> only sources (+ headers) are sent; the executor
//                                        compiles every file it receives
//                       'interpreted' -> every project file is sent (data files, JSON,
//                                        README ... can be read by the program)
//   multiFile           true  -> several source files of this language may be run together
//                       false -> only one source file; extra source files are rejected with a
//                                clear message (flip to true once the executor supports it)
//   mainClass           resolve a fully-qualified main class and send it as `main_class`
const lang = (runtime, filename, id, options = {}) => ({
  runtime,
  filename,
  extensions: LANGUAGE_EXTENSIONS[id],
  headers: HEADER_EXTENSIONS[id] || [],
  kind: 'interpreted',
  multiFile: false,
  ...options,
});

export const executionLanguages = {
  javascript: lang('javascript', 'main.js', 'javascript', { multiFile: true }),
  typescript: lang('typescript', 'main.ts', 'typescript', { multiFile: true }),
  python: lang('python', 'main.py', 'python', { multiFile: true }),
  c: lang('c', 'main.c', 'c', { kind: 'compiled', multiFile: true }),
  cpp: lang('c++', 'main.cpp', 'cpp', { kind: 'compiled', multiFile: true }),
  java: lang('java', 'Main.java', 'java', { kind: 'compiled', multiFile: true, mainClass: true }),
  csharp: lang('csharp', 'Main.cs', 'csharp', { kind: 'compiled', multiFile: true }),
  go: lang('go', 'main.go', 'go', { kind: 'compiled' }),
  rust: lang('rust', 'main.rs', 'rust', { kind: 'compiled' }),
  ruby: lang('ruby', 'main.rb', 'ruby', { multiFile: true }),
  php: lang('php', 'main.php', 'php', { multiFile: true }),
  kotlin: lang('kotlin', 'Main.kt', 'kotlin', { kind: 'compiled' }),
  swift: lang('swift', 'main.swift', 'swift', { kind: 'compiled' }),
  dart: lang('dart', 'main.dart', 'dart', { multiFile: true }),
  r: lang('r', 'main.r', 'r', { multiFile: true }),
  scala: lang('scala', 'Main.scala', 'scala', { kind: 'compiled' }),
  shell: lang('bash', 'main.sh', 'shell', { multiFile: true }),
  sql: lang('sqlite3', 'main.sql', 'sql'),
  lua: lang('lua', 'main.lua', 'lua', { multiFile: true }),
  perl: lang('perl', 'main.pl', 'perl', { multiFile: true }),
  haskell: lang('haskell', 'Main.hs', 'haskell', { kind: 'compiled' }),
};
