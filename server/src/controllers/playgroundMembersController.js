import PlaygroundProject from '../models/PlaygroundProject.js';
import User from '../models/User.js';
import { ROLE_RANK, accessTo } from './playgroundController.js';

// Who has access to a project, and at what level (see the model for the roles).
//
//   GET    /:id/members            owner / manager   list people
//   POST   /:id/members            owner / manager   { identifier: email or username, role }
//   PATCH  /:id/members/:userId    owner / manager   { role }
//   DELETE /:id/members/:userId    owner / manager   remove someone
//   DELETE /:id/members/me         any collaborator  leave a project
//
// Rules: only the owner can grant or change 'manager'; a manager can only manage
// viewers and editors; nobody can add the owner or themselves; at most 20 people.
// Changes leave `updatedAt` alone so open editors don't see a false conflict.
export const MAX_MEMBERS = 20;
const GRANTABLE = ['viewer', 'editor', 'manager'];
const NOT_FOUND = { message: 'Playground project not found' };

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ message: 'Invalid request.' });
    console.error('Playground members error:', error);
    res.status(500).json({ message: 'Something went wrong while updating access.' });
  }
};

const deny = (res, access) => (access.status === 403 ? res.status(403).json({ message: 'Your access level does not allow this.' }) : res.status(404).json(NOT_FOUND));
const save = (project) => project.save({ timestamps: false });
const sameId = (a, b) => String(a) === String(b);

// Can `actorRole` change someone currently at `targetRole` (or hand out `newRole`)?
const mayGrant = (actorRole, role) => GRANTABLE.includes(role) && (role !== 'manager' || actorRole === 'owner');
const mayTouch = (actorRole, targetRole) => actorRole === 'owner' || ROLE_RANK[targetRole] < ROLE_RANK.manager;

const describe = (users, entries) =>
  entries.map((entry) => {
    const user = users.find((candidate) => sameId(candidate._id, entry.user));
    return { userId: String(entry.user), username: user?.username || 'unknown', name: user?.name || '', avatar: user?.avatar?.url || '', role: entry.role, addedAt: entry.addedAt };
  });

export const listMembers = wrap(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'manager');
  if (!access.project) return deny(res, access);
  const entries = access.project.collaborators || [];
  const users = entries.length ? await User.find({ _id: { $in: entries.map((entry) => entry.user) } }).select('username name avatar') : [];
  res.json({ role: access.role, max: MAX_MEMBERS, members: describe(users, entries) });
});

export const addMember = wrap(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'manager');
  if (!access.project) return deny(res, access);
  const { project, role: actorRole } = access;

  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase().replace(/^@/, '') : '';
  const role = req.body?.role;
  if (!identifier || identifier.length > 120) return res.status(400).json({ message: 'Enter an email address or username.' });
  if (!GRANTABLE.includes(role)) return res.status(400).json({ message: 'Choose Viewer, Editor or Full access.' });
  if (!mayGrant(actorRole, role)) return res.status(403).json({ message: 'Only the project owner can give full access.' });

  // Only a plain string reaches the query (never an object), so it cannot carry operators.
  const user = await User.findOne(identifier.includes('@') ? { email: identifier } : { username: identifier }).select('username name avatar');
  if (!user) return res.status(404).json({ message: 'No account found with that email or username.' });
  if (sameId(user._id, project.owner) || sameId(user._id, req.user._id)) return res.status(400).json({ message: 'That person already has full ownership or is you.' });

  const entries = project.collaborators || [];
  if (entries.some((entry) => sameId(entry.user, user._id))) return res.status(409).json({ message: 'They already have access. Change their level from the list.' });
  if (entries.length >= MAX_MEMBERS) return res.status(400).json({ message: `A project can be shared with up to ${MAX_MEMBERS} people.` });

  project.collaborators = [...entries, { user: user._id, role, addedAt: new Date(), addedBy: req.user._id }];
  await save(project);
  res.status(201).json(describe([user], [project.collaborators[project.collaborators.length - 1]])[0]);
});

export const setMemberRole = wrap(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'manager');
  if (!access.project) return deny(res, access);
  const { project, role: actorRole } = access;
  const role = req.body?.role;
  if (!GRANTABLE.includes(role)) return res.status(400).json({ message: 'Choose Viewer, Editor or Full access.' });
  const entry = (project.collaborators || []).find((item) => sameId(item.user, req.params.userId));
  if (!entry) return res.status(404).json({ message: 'That person does not have access.' });
  if (!mayTouch(actorRole, entry.role) || !mayGrant(actorRole, role)) return res.status(403).json({ message: 'Only the project owner can change full access.' });
  project.collaborators = project.collaborators.map((item) => (sameId(item.user, entry.user) ? { ...plainEntry(item), role } : item));
  await save(project);
  res.json({ userId: String(entry.user), role });
});

export const removeMember = wrap(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'manager');
  if (!access.project) return deny(res, access);
  const { project, role: actorRole } = access;
  const entry = (project.collaborators || []).find((item) => sameId(item.user, req.params.userId));
  if (!entry) return res.status(404).json({ message: 'That person does not have access.' });
  if (!mayTouch(actorRole, entry.role)) return res.status(403).json({ message: 'Only the project owner can remove someone with full access.' });
  project.collaborators = project.collaborators.filter((item) => !sameId(item.user, entry.user));
  await save(project);
  res.json({ message: 'Access removed.' });
});

// A collaborator can always walk away from a project that was shared with them.
export const leaveProject = wrap(async (req, res) => {
  const access = await accessTo(req.params.id, req.user, 'viewer');
  if (!access.project) return deny(res, access);
  if (access.role === 'owner') return res.status(400).json({ message: 'The owner cannot leave. Delete the project instead.' });
  access.project.collaborators = access.project.collaborators.filter((item) => !sameId(item.user, req.user._id));
  await save(access.project);
  res.json({ message: 'You left the project.' });
});

const plainEntry = (item) => (typeof item.toObject === 'function' ? item.toObject() : { ...item });
