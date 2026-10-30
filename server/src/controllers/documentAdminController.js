import NoteDocument from '../models/NoteDocument.js';
import User from '../models/User.js';
import { DocumentBookmark, DocumentCategory, DocumentReport, DocumentText } from '../models/DocumentExtras.js';
import { DEFAULT_CATEGORIES, STATUSES } from '../config/documents.js';
import { storageFor } from '../services/documentStorage.js';
import { TransitionError, accessFor, logAudit, presentDocument, transition } from '../utils/documentAccess.js';

// Moderation. Mounted behind `protect, authorize('admin')`; the role is also re-checked here so a
// wiring mistake in a route file can never expose these actions.
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const requireAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'You are not authorized for this action' });
    return false;
  }
  return true;
};
const handle = (fn) => async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    await fn(req, res);
  } catch (error) {
    if (error instanceof TransitionError) return res.status(error.status).json({ message: error.message });
    console.error('Document admin error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};
const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const findDoc = (id) => (OBJECT_ID.test(String(id)) ? NoteDocument.findById(id) : null);
const adminView = (doc, user) => presentDocument(doc, accessFor(doc, user, 'meta'));

export const moderationStats = handle(async (_req, res) => {
  const counts = await Promise.all([...STATUSES.map((status) => NoteDocument.countDocuments({ status })), DocumentReport.countDocuments({ status: 'open' })]);
  res.json({ ...Object.fromEntries(STATUSES.map((status, i) => [status, counts[i]])), openReports: counts[STATUSES.length] });
});

export const moderationQueue = handle(async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const rows = await NoteDocument.find({ status }).sort({ createdAt: status === 'pending' ? 1 : -1 }).skip((page - 1) * 25).limit(25);
  const owners = await User.find({ _id: { $in: rows.map((row) => row.owner) } }).select('name username email');
  const byId = new Map(owners.map((owner) => [String(owner._id), owner]));
  res.json(rows.map((doc) => {
    const owner = byId.get(String(doc.owner));
    return { ...adminView(doc, req.user), uploaderUsername: owner?.username || '', uploaderEmail: owner?.email || '' };
  }));
});

export const getForReview = handle(async (req, res) => {
  const doc = await findDoc(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  res.json(adminView(doc, req.user));
});

const act = (to, { needsReason = false, actorLabel = 'admin' } = {}) =>
  handle(async (req, res) => {
    const doc = await findDoc(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (needsReason && reason.length < 3) return res.status(400).json({ message: 'Please give a short reason so the uploader understands.' });
    transition(doc, to, { actor: actorLabel, user: req.user, reason });
    await doc.save();
    res.json(adminView(doc, req.user));
  });

export const approveDocument = act('approved');
export const rejectDocument = act('rejected', { needsReason: true });
export const removeDocument = act('removed', { needsReason: true });
export const unpublishDocument = act('pending'); // take it back to review without deleting anything
// Restoring puts a removed document back where it was before removal (approved or pending).
export const restoreDocument = handle(async (req, res) => {
  const doc = await findDoc(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  const target = doc.previousStatus === 'approved' ? 'approved' : 'pending';
  transition(doc, target, { actor: 'admin', user: req.user, reason: 'restored' });
  await doc.save();
  res.json(adminView(doc, req.user));
});

// ---- reports ------------------------------------------------------------------------------
export const listReports = handle(async (req, res) => {
  const status = ['open', 'dismissed', 'actioned'].includes(req.query.status) ? req.query.status : 'open';
  const reports = await DocumentReport.find({ status }).sort({ createdAt: 1 }).limit(100);
  const docs = await NoteDocument.find({ _id: { $in: reports.map((r) => r.document) } });
  const docById = new Map(docs.map((d) => [String(d._id), d]));
  res.json(reports.map((report) => {
    const doc = docById.get(String(report.document));
    return { id: String(report._id), reason: report.reason, details: report.details, status: report.status, createdAt: report.createdAt, document: doc ? { id: String(doc._id), slug: doc.slug, title: doc.title, status: doc.status } : null };
  }));
});

export const resolveReport = handle(async (req, res) => {
  const report = OBJECT_ID.test(String(req.params.id)) ? await DocumentReport.findById(req.params.id) : null;
  if (!report) return res.status(404).json({ message: 'Report not found' });
  const decision = req.body?.action;
  if (!['dismiss', 'remove'].includes(decision)) return res.status(400).json({ message: 'Choose dismiss or remove.' });
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';

  if (decision === 'remove') {
    const doc = await NoteDocument.findById(report.document);
    if (doc && doc.status !== 'removed') {
      transition(doc, 'removed', { actor: 'admin', user: req.user, reason: note || `removed after a ${report.reason} report` });
      await doc.save();
    }
  }
  const open = await DocumentReport.find({ document: report.document, status: 'open' });
  for (const item of decision === 'remove' ? open : [report]) {
    item.status = decision === 'remove' ? 'actioned' : 'dismissed';
    item.resolvedBy = req.user._id;
    item.resolvedAt = new Date();
    item.resolutionNote = note;
    await item.save();
  }
  await NoteDocument.updateOne({ _id: report.document }, { openReports: await DocumentReport.countDocuments({ document: report.document, status: 'open' }) });
  res.json({ message: decision === 'remove' ? 'Document removed and reports closed.' : 'Report dismissed.' });
});

// ---- categories and tags -------------------------------------------------------------------
export const adminCategories = handle(async (_req, res) => {
  if (!(await DocumentCategory.countDocuments({}))) await DocumentCategory.insertMany(DEFAULT_CATEGORIES.map((name) => ({ name, slug: slugify(name) })));
  const rows = await DocumentCategory.find({}).sort({ name: 1 });
  const counts = await NoteDocument.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const used = new Map(counts.map((row) => [row._id, row.count]));
  res.json(rows.map((row) => ({ id: String(row._id), name: row.name, documents: used.get(row.name) || 0 })));
});

export const addCategory = handle(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Category names are 2-80 characters.' });
  if (await DocumentCategory.findOne({ slug: slugify(name) })) return res.status(409).json({ message: 'That category already exists.' });
  const row = await DocumentCategory.create({ name, slug: slugify(name) });
  res.status(201).json({ id: String(row._id), name: row.name, documents: 0 });
});

export const renameCategory = handle(async (req, res) => {
  const row = OBJECT_ID.test(String(req.params.id)) ? await DocumentCategory.findById(req.params.id) : null;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!row) return res.status(404).json({ message: 'Category not found' });
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Category names are 2-80 characters.' });
  const previous = row.name;
  row.name = name;
  row.slug = slugify(name);
  await row.save();
  await NoteDocument.updateMany({ category: previous }, { category: name });
  res.json({ id: String(row._id), name });
});

export const deleteCategory = handle(async (req, res) => {
  const row = OBJECT_ID.test(String(req.params.id)) ? await DocumentCategory.findById(req.params.id) : null;
  if (!row) return res.status(404).json({ message: 'Category not found' });
  if (await NoteDocument.countDocuments({ category: row.name })) return res.status(409).json({ message: 'Documents still use this category. Rename it or move them first.' });
  await row.deleteOne();
  res.json({ message: 'Category deleted.' });
});

export const adminTags = handle(async (_req, res) => {
  const rows = await NoteDocument.aggregate([{ $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 200 }]);
  res.json(rows.map((row) => ({ name: row._id, count: row.count })));
});

const cleanTag = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
export const renameTag = handle(async (req, res) => {
  const from = cleanTag(req.body?.from);
  const to = cleanTag(req.body?.to);
  if (!from || to.length < 2 || to.length > 30 || !/^[a-z0-9+#.\- ]+$/.test(to)) return res.status(400).json({ message: 'Enter the tag and its new name (2-30 characters).' });
  // $addToSet then $pull merges the tag into an existing one instead of duplicating it.
  await NoteDocument.updateMany({ tags: from }, { $addToSet: { tags: to } });
  await NoteDocument.updateMany({ tags: from }, { $pull: { tags: from } });
  res.json({ message: 'Tag renamed.' });
});
export const deleteTag = handle(async (req, res) => {
  const tag = cleanTag(req.params.tag);
  if (!tag) return res.status(400).json({ message: 'Tag required.' });
  await NoteDocument.updateMany({ tags: tag }, { $pull: { tags: tag } });
  res.json({ message: 'Tag removed from all notes.' });
});

// ---- retention: permanent deletion of removed documents once the retention period has passed -----
export const purgeDocument = async (doc) => {
  await Promise.all([doc.file, doc.thumbnail].filter((ref) => ref?.key).map((ref) => storageFor(ref.storage).remove(ref).catch(() => null)));
  await Promise.all([DocumentText.deleteOne({ document: doc._id }), DocumentBookmark.deleteMany({ document: doc._id }), DocumentReport.deleteMany({ document: doc._id })]);
  await NoteDocument.deleteOne({ _id: doc._id });
};
