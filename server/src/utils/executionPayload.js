import {
  WorkspaceError,
  basename,
  checkJavaProject,
  extname,
  validateWorkspace,
} from './workspaceCore.js';

const LANGUAGE_LABEL = { csharp: 'C#', cpp: 'C++', javascript: 'JavaScript', typescript: 'TypeScript', php: 'PHP', r: 'R', shell: 'Bash' };
const labelOf = (language) => LANGUAGE_LABEL[language] || language[0].toUpperCase() + language.slice(1);

const isSource = (config, path) => config.extensions.includes(extname(basename(path)));
const isHeader = (config, path) => config.headers.includes(extname(basename(path)));

// Picks the entry among source files: explicit choice, then the language's
// conventional name (main.py, Main.java ...), then a lone source file.
const resolveEntry = (config, language, sources, requested) => {
  if (requested) {
    if (!sources.some((file) => file.path === requested)) {
      throw new WorkspaceError(`Entry file "${requested}" is not a ${labelOf(language)} source file (${config.extensions.join(', ')}).`);
    }
    return requested;
  }
  if (sources.length === 1) return sources[0].path;
  const conventional = config.filename.toLowerCase();
  const byName = sources.filter((file) => basename(file.path).toLowerCase() === conventional);
  if (byName.length) return byName.sort((a, b) => a.path.length - b.path.length)[0].path;
  throw new WorkspaceError(`Choose which file to run: right-click a ${labelOf(language)} file and pick "Set as Entry File".`);
};

// Turns a workspace sent by a client into the request body for the sandboxed
// executor. Everything is re-validated here — the client is never trusted.
//
//   body: { files: [{ path, content }], entryFile?: string }
//   returns { payload: { files, entry, main_class? }, entry }
//
// Files keep their real relative paths. The entry file is listed first (the
// executor's convention for "main file"); nothing is concatenated.
export const buildProjectRequest = (config, language, body) => {
  const { nodes, entryFile } = validateWorkspace({
    files: (Array.isArray(body.files) ? body.files : []).map((file) => ({ ...file, type: file?.type || 'file' })),
    entryFile: typeof body.entryFile === 'string' ? body.entryFile : '',
  });
  const files = nodes.filter((node) => node.type === 'file');
  const sources = files.filter((file) => isSource(config, file.path));

  if (sources.length === 0) {
    throw new WorkspaceError(`This project has no ${labelOf(language)} source files (${config.extensions.join(', ')}). Add one, or switch the project language.`);
  }
  if (!config.multiFile && sources.length > 1) {
    throw new WorkspaceError(`Running several source files together is not supported for ${labelOf(language)} yet. Keep one ${config.extensions[0]} file, or use Java, Python, JavaScript, TypeScript, C, C++, C#, Ruby, PHP, Lua, Perl, R, Bash or Dart.`);
  }

  let entry = entryFile;
  let mainClass = '';

  if (language === 'java') {
    const check = checkJavaProject(files, entry);
    if (check.errors.length) {
      const error = new WorkspaceError(check.errors[0].message, check.errors);
      throw error;
    }
    entry = check.entryPath;
    mainClass = check.mainClass;
  } else {
    entry = resolveEntry(config, language, sources, entry);
  }

  // Which files travel to the executor.
  const chosen = files.filter((file) => {
    if (file.path === entry) return true;
    if (!config.multiFile) return false;
    if (config.kind === 'compiled') return isSource(config, file.path) || isHeader(config, file.path);
    return true; // interpreted: keep data files, modules, JSON ... on disk too
  });
  chosen.sort((a, b) => (a.path === entry ? -1 : b.path === entry ? 1 : a.path < b.path ? -1 : 1));

  const payload = {
    files: chosen.map((file) => ({ name: file.path, content: file.content })),
    entry,
  };
  if (mainClass) payload.main_class = mainClass;
  return { payload, entry };
};
