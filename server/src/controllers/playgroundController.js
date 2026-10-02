import mongoose from 'mongoose';
import PlaygroundProject from '../models/PlaygroundProject.js';
import { mirrorLegacyEdit, serializeProject, workspaceFieldsFrom } from '../utils/projectWorkspace.js';
import { WorkspaceError } from '../utils/workspaceCore.js';

// Fields the classic (single-file / mobile) clients send.
const legacyFields = ['title', 'language', 'code', 'html', 'css', 'javascript'];
const legacyPayload = (body) => Object.fromEntries(legacyFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const isOwnerOrAdmin = (project, user) => String(project.owner) === String(user._id) || user.role === 'admin';

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

const findProject = async (id) => (mongoose.isValidObjectId(id) ? PlaygroundProject.findById(id) : null);

// Saved list: legacy fields only (as before). File contents are loaded on demand with GET /:id.
export const mine = handle(async (req, res) => {
  res.json(await PlaygroundProject.find({ owner: req.user._id }).select('-files').sort({ updatedAt: -1 }));
});

export const getOne = handle(async (req, res) => {
  const project = await findProject(req.params.id);
  if (!project) return res.status(404).json({ message: 'Playground project not found' });
  if (!isOwnerOrAdmin(project, req.user)) return res.status(403).json({ message: 'You can only open your own projects' });
  res.json(serializeProject(project));
});

export const create = handle(async (req, res) => {
  const fields = legacyPayload(req.body);
  if (req.body.files !== undefined) {
    const language = fields.language || 'web';
    Object.assign(fields, workspaceFieldsFrom(req.body, language));
  }
  const project = await PlaygroundProject.create({ ...fields, owner: req.user._id });
  res.status(201).json(serializeProject(project));
});

export const update = handle(async (req, res) => {
  const project = await findProject(req.params.id);
  if (!project) return res.status(404).json({ message: 'Playground project not found' });
  if (!isOwnerOrAdmin(project, req.user)) return res.status(403).json({ message: 'You can only edit your own projects' });

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
  res.json(serializeProject(await project.save()));
});

export const remove = handle(async (req, res) => {
  const project = await findProject(req.params.id);
  if (!project) return res.status(404).json({ message: 'Playground project not found' });
  if (!isOwnerOrAdmin(project, req.user)) return res.status(403).json({ message: 'You can only delete your own projects' });
  await project.deleteOne();
  res.json({ message: 'Playground project deleted' });
});
