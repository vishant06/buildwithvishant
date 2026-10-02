import { executionLanguages } from '../config/playgroundLanguages.js';
import { analyzeJava, basename, extname, validateWorkspace } from './workspaceCore.js';

// Pure helpers that translate between a PlaygroundProject document and a
// workspace. No database access here, so they are easy to test.

const WEB_FILES = [
  { field: 'html', path: 'index.html' },
  { field: 'css', path: 'style.css' },
  { field: 'javascript', path: 'script.js' }
];

// Name given to the file of a project saved before workspaces existed.
const legacyFileName = (language, code) => {
  const fallback = executionLanguages[language]?.filename || 'main.txt';
  if (language !== 'java') return fallback;
  // Java demands the public class name match the file name; use it when there is exactly one.
  const publicTypes = analyzeJava(code || '').types.filter((type) => type.isPublic);
  return publicTypes.length === 1 ? `${publicTypes[0].name}.java` : fallback;
};

export const legacyToWorkspace = (doc) => {
  const language = doc.language || 'web';
  if (language === 'web') {
    return {
      files: WEB_FILES.map((entry, index) => ({ id: `legacy${index}`, path: entry.path, type: 'file', content: doc[entry.field] || '' })),
      entryFile: 'index.html'
    };
  }
  const path = legacyFileName(language, doc.code);
  return { files: [{ id: 'legacy0', path, type: 'file', content: doc.code || '' }], entryFile: path };
};

// The workspace to show for a stored project (never writes anything).
export const workspaceOf = (doc) => {
  const stored = Array.isArray(doc.files) ? doc.files : [];
  if (stored.length === 0) return { ...legacyToWorkspace(doc), migrated: true };
  return {
    files: stored.map((file) => ({ id: file.id, path: file.path, type: file.type, content: file.type === 'file' ? file.content || '' : undefined })),
    entryFile: doc.entryFile || '',
    migrated: false
  };
};

export const serializeProject = (doc) => {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const workspace = workspaceOf(plain);
  delete plain.files;
  return { ...plain, workspace };
};

// Legacy fields mirrored from a workspace so older clients still see the code.
export const legacyFieldsFrom = (language, nodes, entryFile) => {
  const files = nodes.filter((node) => node.type === 'file');
  const find = (path) => files.find((file) => file.path.toLowerCase() === path);
  if (language === 'web') {
    const pick = (path, ext) => (find(path) || files.find((file) => extname(basename(file.path)) === ext))?.content || '';
    return { code: '', html: pick('index.html', '.html'), css: pick('style.css', '.css'), javascript: pick('script.js', '.js') };
  }
  const entry = files.find((file) => file.path === entryFile) || files[0];
  return { code: entry?.content || '', html: '', css: '', javascript: '' };
};

// Validates the workspace part of a request body. Returns the fields to store.
export const workspaceFieldsFrom = (body, language) => {
  const { nodes, entryFile } = validateWorkspace({ files: body.files, entryFile: body.entryFile });
  return { files: nodes, entryFile, ...legacyFieldsFrom(language, nodes, entryFile) };
};

// A save from a client that only knows the legacy fields (the mobile app) onto
// a project that already has a workspace: mirror the edit into the workspace
// instead of letting the two drift apart.
export const mirrorLegacyEdit = (doc, body) => {
  const language = body.language || doc.language;
  if (language !== doc.language) return { files: [], entryFile: '' }; // language switched: back to a plain one-file project
  const files = doc.files.map((file) => ({ id: file.id, path: file.path, type: file.type, content: file.type === 'file' ? file.content : undefined }));
  const setContent = (path, content) => {
    const target = files.find((file) => file.type === 'file' && file.path === path);
    if (target && typeof content === 'string') target.content = content;
  };
  if (language === 'web') {
    for (const entry of WEB_FILES) if (body[entry.field] !== undefined) setContent(entry.path, body[entry.field]);
  } else if (body.code !== undefined) {
    setContent(doc.entryFile, body.code);
  }
  const { nodes, entryFile } = validateWorkspace({ files, entryFile: doc.entryFile });
  return { files: nodes, entryFile };
};
