import mongoose from 'mongoose';
import PlaygroundProject from '../models/PlaygroundProject.js';
import { mirrorLegacyEdit, serializeProject, workspaceFieldsFrom } from '../utils/projectWorkspace.js';
import { WorkspaceError } from '../utils/workspaceCore.js';
import { generateSlug } from '../utils/publicProject.js';

// Fields the classic (single-file / mobile) clients send.
const legacyFields = ['title', 'language', 'code', 'html', 'css', 'javascript'];
const legacyPayload = (body) => Object.fromEntries(legacyFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

// Express 4 does not catch rejected promises from async handlers; this keeps
// validation errors as 4xx responses instead of unhandled rejections.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof WorkspaceError) return res.status(422).json({ message: error.message });
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      const first = error.errors ? Object.values(error.errors)[0]?.message : error.message;
      return res.status(400).json({ message: first || 'Invalid playground project' });
    }
    console.error('Playground error:', error);
    return res.status(500).json({ message: 'Something went wrong while handling the playground project' });
  }
};

// Every lookup is constrained by the owner taken from the verified session
// (req.user is set by `protect` from the JWT, never from the request body,
// query or URL). A project that belongs to somebody else is indistinguishable
// from one that does not exist: both give the same 404, so ids cannot be probed.
// Admins get no exception here: saved code is private to the account that owns it.
const NOT_FOUND = { message: 'Playground project not found' };
const findOwnedProject = async (id, user) => (mongoose.isValidObjectId(id) ? PlaygroundProject.findOne({ _id: id, owner: user._id }) : null);

// Shared access. Roles rank owner > manager > editor > viewer. The role is always
// read from the database for THIS request (never from the client), so removing or
// demoting someone takes effect on their very next call.
//   - not the owner and not listed          -> 404 (indistinguishable from "no such project")
//   - listed, but the role is too low        -> 403 with a plain message
export const ROLE_RANK = { viewer: 1, editor: 2, manager: 3, owner: 4 };
export const accessTo = async (id, user, minRole = 'viewer') => {
  if (!mongoose.isValidObjectId(id)) return { status: 404 };
  const owned = await PlaygroundProject.findOne({ _id: id, owner: user._id });
  if (owned) return { project: owned, role: 'owner' };
  const shared = await PlaygroundProject.findOne({ _id: id, 'collaborators.user': user._id });
  const entry = shared?.collaborators?.find((item) => String(item.user) === String(user._id));
  if (!entry || !ROLE_RANK[entry.role]) return { status: 404 };
  if (ROLE_RANK[entry.role] < ROLE_RANK[minRole]) return { status: 403, role: entry.role };
  return { project: shared, role: entry.role };
};
const deny = (res, access) =>
  access.status === 403
    ? res.status(403).json({ message: 'Your access level does not allow this.' })
    : res.status(404).json(NOT_FOUND);

// What a client may see of a project. Collaborator ids never leave the server; people
// who are not the owner do not get the owner id, and only owner / manager see privacy fields.
const present = (project, role) => {
  const { collaborators, ...rest } = serializeProject(project);
  if (role !== 'owner') delete rest.owner;
  if (role !== 'owner' && role !== 'manager') {
    delete rest.visibility;
    delete rest.publicSlug;
    delete rest.publishedAt;
  }
  return { ...rest, myRole: role };
};

// Saved list: legacy fields only (as before). File contents are loaded on demand with GET /:id.
export const mine = handle(async (req, res) => {
  res.json(await PlaygroundProject.find({ owner: req.user._id }).select('-files -collaborators').sort({ updatedAt: -1 }));
});

// Projects other people shared with me (owner details are not included).
export const shared = handle(async (req, res) => {
  const rows = await PlaygroundProject.find({ 'collaborators.user': req.user._id }).select('title language updatedAt collaborators visibility publicSlug').sort({ updatedAt: -1 });
  res.json(
    rows
      .map((row) => {
        const role = row.collaborators?.find((item) => String(item.user) === String(req.user._id))?.role;
        if (!ROLE_RANK[role]) return null;
        const item = { _id: row._id, title: row.title, language: row.language, updatedAt: row.updatedAt, myRole: role };
        if (role === 'manager') Object.assign(item, { visibility: row.visibility === 'public' ? 'public' : 'private', publicSlug: row.visibility === 'public' ? row.publicSlug : undefined });
        return item;
      })
      .filter(Boolean)
  );
});

export const getOne = handle(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'viewer');
  if (!access.project) return deny(res, access);
  res.json(present(access.project, access.role));
});

export const create = handle(async (req, res) => {
  const fields = legacyPayload(req.body);
  if (req.body.files !== undefined) {
    const language = fields.language || 'web';
    Object.assign(fields, workspaceFieldsFrom(req.body, language));
  }
  const project = await PlaygroundProject.create({ ...fields, owner: req.user._id });
  res.status(201).json(present(project, 'owner'));
});

export const update = handle(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'editor');
  if (!access.project) return deny(res, access);
  const { project, role } = access;

  // Optimistic concurrency: a client that knows which version it started from
  // (workspace clients do) must not silently overwrite a newer save from
  // another tab or device. `force: true` is the explicit "overwrite" choice.
  if (req.body.baseUpdatedAt && !req.body.force) {
    const base = new Date(req.body.baseUpdatedAt).getTime();
    if (Number.isFinite(base) && project.updatedAt && project.updatedAt.getTime() > base) {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'This project was changed somewhere else since you opened it.',
        updatedAt: project.updatedAt
      });
    }
  }

  const fields = legacyPayload(req.body);
  if (req.body.files !== undefined) {
    Object.assign(fields, workspaceFieldsFrom(req.body, fields.language || project.language));
  } else if (project.files?.length) {
    Object.assign(fields, mirrorLegacyEdit(project, req.body));
  }
  Object.assign(project, fields);
  // Ownership and the people list are never changed by this route: `fields` only ever
  // holds the project content above, whoever (owner or editor) is saving.
  res.json(present(await project.save(), role));
});

export const remove = handle(async (req, res) => {
  const project = await findOwnedProject(req.params.id, req.user);
  if (!project) return res.status(404).json(NOT_FOUND);
  await PlaygroundProject.deleteOne({ _id: project._id, owner: req.user._id });
  res.json({ message: 'Playground project deleted' });
});

// Privacy. Owner only (404 for anyone else, like every other lookup here).
//   PATCH /api/playground/:id/visibility   { visibility: 'private' | 'public', regenerate?: true }
//
//  - Going public creates a fresh random link. Going private DELETES the link
//    (it is not merely hidden), so an old URL stays dead even if the project is
//    published again later. `regenerate` swaps the link of an already-public project.
//  - The change is applied to the database immediately and the public view reads
//    the database on every request, so access is revoked at once.
//  - `updatedAt` is left alone on purpose: changing privacy is not an edit of the
//    code, and bumping it would make the owner's open editor report a false
//    "changed in another tab" conflict on its next auto-save.
const isDuplicateKey = (error) => error?.code === 11000;
const toShareState = (project) => ({
  _id: project._id,
  visibility: project.visibility === 'public' ? 'public' : 'private',
  publicSlug: project.visibility === 'public' ? project.publicSlug || null : null,
  publishedAt: project.visibility === 'public' ? project.publishedAt || null : null,
  updatedAt: project.updatedAt
});

export const setVisibility = handle(async (req, res) => {
  const target = req.body?.visibility;
  if (target !== 'public' && target !== 'private') return res.status(400).json({ message: 'visibility must be "public" or "private".' });

  const access = await accessTo(req.params.id, req.user, 'manager');
  if (!access.project) return deny(res, access);
  const { project } = access;

  if (target === 'private') {
    project.visibility = 'private';
    project.publicSlug = undefined;
    project.publishedAt = undefined;
    await project.save({ timestamps: false });
    return res.json(toShareState(project));
  }

  const needsLink = project.visibility !== 'public' || !project.publicSlug || req.body.regenerate === true;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    project.visibility = 'public';
    if (needsLink) {
      project.publicSlug = generateSlug();
      project.publishedAt = new Date();
    }
    try {
      await project.save({ timestamps: false });
      return res.json(toShareState(project));
    } catch (error) {
      if (!isDuplicateKey(error) || !needsLink) throw error; // astronomically unlikely slug clash: pick another
    }
  }
  return res.status(500).json({ message: 'Could not create a share link. Please try again.' });
});
