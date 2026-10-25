import { randomBytes } from 'node:crypto';
import { workspaceOf } from './projectWorkspace.js';
import { isHiddenFromPublic } from './workspaceRules.js';

// Everything the public (read-only, no login) view is allowed to see.
// This is an allow-list: a field that is not copied here is never sent, so a
// column added to the model later cannot leak by accident.

// 12 URL-safe characters = 72 bits of randomness. Not derived from the database id.
export const generateSlug = () => randomBytes(9).toString('base64url');
export const isValidSlug = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value);

export const serializePublicProject = (doc, { viewerId } = {}) => {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const { files, entryFile } = workspaceOf(plain);

  const visible = [];
  let hidden = 0;
  for (const node of files) {
    if (node.type === 'file' && isHiddenFromPublic(node.path, node.content)) hidden += 1;
    else if (node.type === 'folder' && isHiddenFromPublic(`${node.path}/x`, '')) hidden += 1; // e.g. a ".ssh" folder
    else visible.push(node);
  }
  const nodes = visible;

  const entryVisible = nodes.some((node) => node.type === 'file' && node.path === entryFile);
  const isOwner = Boolean(viewerId) && String(viewerId) === String(plain.owner);
  const isCollaborator = Boolean(viewerId) && (plain.collaborators || []).some((item) => String(item.user) === String(viewerId));

  const out = {
    slug: plain.publicSlug,
    title: plain.title,
    language: plain.language || 'web',
    updatedAt: plain.updatedAt,
    readOnly: true,
    hiddenFileCount: hidden,
    workspace: {
      files: nodes.map((node) => (node.type === 'file' ? { path: node.path, type: 'file', content: node.content || '' } : { path: node.path, type: 'folder' })),
      entryFile: entryVisible ? entryFile : ''
    },
    isOwner
  };
  // `isOwner` / `projectId` only tell a signed-in person that this is a project they can open themselves.
  // The internal id is only ever given to the owner (so "Open in editor" works).
  if (isOwner || isCollaborator) out.projectId = String(plain._id);
  return out;
};
