import { randomBytes } from 'node:crypto';
import NoteDocument from '../models/NoteDocument.js';
import Note from '../models/Note.js';
import { DocumentBookmark, DocumentCategory, DocumentReport, DocumentText } from '../models/DocumentExtras.js';
import { DEFAULT_CATEGORIES, REPORT_REASONS, VISIBILITIES, documentConfig } from '../config/documents.js';
import { executionLanguages } from '../config/playgroundLanguages.js';
import { PdfRejected, detectImageType, inspectPdf } from '../services/pdfInspector.js';
import { activeStorageName, storageFor } from '../services/documentStorage.js';
import { PUBLIC_LISTING_FILTER, accessFor, isAdmin, isOwner, isPubliclyListed, logAudit, presentCard, presentDocument, transition } from '../utils/documentAccess.js';
import { rankRelated } from '../utils/documentRelated.js';

// Community PDF notes: public discovery, upload, owner management, reading, reporting.
// Authorization is decided per request in utils/documentAccess.js; nothing here trusts a
// client-supplied owner, status, visibility-on-pending, storage key or role.

const NOT_FOUND = { message: 'This note is not available.' };
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const newId = () => randomBytes(12).toString('hex');
const str = (value) => (typeof value === 'string' ? value.trim() : '');
const slugify = (value) => String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'note';
const makeSlug = (title) => `${slugify(title)}-${randomBytes(3).toString('hex')}`;
const escapeHeader = (name) => String(name).replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'notes';

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof PdfRejected || error?.name === 'TransitionError') return res.status(error.status).json({ message: error.message });
    if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ message: 'Some details are invalid. Please check the form.' });
    if (error?.code === 11000) return res.status(409).json({ message: 'That already exists.' });
    console.error('Documents error:', error);
    res.status(error.status && error.status < 500 ? error.status : 500).json({ message: error.status && error.status < 500 ? error.message : 'Something went wrong. Please try again.' });
  }
};

// ---- categories ----------------------------------------------------------------------
export const categoryNames = async () => {
  const rows = await DocumentCategory.find({}).sort({ name: 1 });
  return rows.length ? rows.map((row) => row.name) : DEFAULT_CATEGORIES;
};

export const listCategories = handle(async (_req, res) => res.json(await categoryNames()));

// Limits the upload form shows and checks up front (the server enforces them again).
export const uploadConfig = handle(async (_req, res) => {
  const cfg = documentConfig();
  res.json({
    maxFileMb: Math.round(cfg.maxFileBytes / 1024 / 1024),
    maxPages: cfg.maxPages,
    maxCodeChars: cfg.maxCodeChars,
    requireVerifiedEmail: cfg.requireVerifiedEmail,
    codeLanguages: [...CODE_LANGUAGES],
    categories: await categoryNames()
  });
});

// ---- metadata validation -----------------------------------------------------------------
const CODE_LANGUAGES = new Set([...Object.keys(executionLanguages), 'web']);

const parseTags = (value) => {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(raw.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
};

// Returns { data, errors }. With `partial` only the fields present are validated (edits).
export const validateMeta = async (body, { partial = false } = {}) => {
  const errors = {};
  const data = {};
  const has = (key) => body[key] !== undefined;
  const text = (key, { min = 0, max, required = false, label = key }) => {
    if (!has(key) && partial) return;
    const value = str(body[key]);
    if (required && !value) errors[key] = `${label} is required.`;
    else if (value && value.length < min) errors[key] = `${label} must be at least ${min} characters.`;
    else if (value.length > max) errors[key] = `${label} must be at most ${max} characters.`;
    else data[key] = value;
  };
  text('title', { min: 3, max: 140, required: true, label: 'Title' });
  text('description', { min: 10, max: 1000, required: true, label: 'Description' });
  text('subject', { min: 2, max: 80, required: true, label: 'Subject' });
  text('topic', { max: 80 });
  text('university', { max: 100 });
  text('course', { max: 100 });
  text('semester', { max: 30 });
  text('subjectCode', { max: 30 });

  if (has('category') || !partial) {
    const names = await categoryNames();
    const match = names.find((name) => name.toLowerCase() === str(body.category).toLowerCase());
    if (!match) errors.category = 'Choose one of the listed categories.';
    else data.category = match;
  }
  if (has('tags') || !partial) {
    const tags = parseTags(body.tags);
    if (tags.length > 8) errors.tags = 'Use at most 8 tags.';
    else if (tags.some((tag) => tag.length < 2 || tag.length > 30 || !/^[a-z0-9+#.\- ]+$/.test(tag))) errors.tags = 'Tags must be 2-30 characters: letters, numbers, spaces, + # . -';
    else data.tags = tags;
  }
  if (has('language')) {
    const language = str(body.language).toLowerCase();
    if (language && !CODE_LANGUAGES.has(language)) errors.language = 'Unsupported programming language.';
    else data.language = language;
  }
  if (has('visibility')) {
    if (!VISIBILITIES.includes(body.visibility)) errors.visibility = 'Visibility must be public, unlisted or private.';
    else data.visibility = body.visibility;
  }
  if (has('downloadable')) data.downloadable = !(body.downloadable === false || body.downloadable === 'false');

  if (has('code') || has('codeLanguage') || has('codeTitle')) {
    const code = typeof body.code === 'string' ? body.code.replace(/\r\n/g, '\n') : '';
    if (!code.trim()) data.codeExample = null; // clearing it
    else if (code.length > documentConfig().maxCodeChars) errors.code = `The code example is limited to ${documentConfig().maxCodeChars} characters.`;
    else if (!CODE_LANGUAGES.has(str(body.codeLanguage).toLowerCase())) errors.codeLanguage = 'Choose the language of the code example.';
    else data.codeExample = { title: str(body.codeTitle).slice(0, 100), language: str(body.codeLanguage).toLowerCase(), code };
  }
  return { data, errors: Object.keys(errors).length ? errors : null };
};

// ---- discovery (public) ------------------------------------------------------------------
const CARD_FIELDS = 'slug title description subject category topic tags university course semester subjectCode language file.pages file.size file.hasText thumbnail.key codeExample.language ownerName createdAt approvedAt views downloads bookmarks';
const exact = (value) => (typeof value === 'string' && value.trim() && value.length <= 80 ? value.trim() : '');

export const listDocuments = handle(async (req, res) => {
  const q = exact(req.query.q) || (typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '');
  const filter = { ...PUBLIC_LISTING_FILTER };
  for (const key of ['subject', 'category', 'language', 'course', 'university', 'semester']) {
    const value = exact(req.query[key]);
    if (value) filter[key] = value;
  }
  const tag = exact(req.query.tag);
  if (tag) filter.tags = tag.toLowerCase();
  if (q) filter.$text = { $search: q };

  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const sort = req.query.sort === 'popular' ? { views: -1, bookmarks: -1, createdAt: -1 } : q && req.query.sort !== 'recent' ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 };

  const query = NoteDocument.find(filter).select(CARD_FIELDS);
  if (q) query.select({ score: { $meta: 'textScore' } });
  const [items, total] = await Promise.all([
    query.sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    NoteDocument.countDocuments(filter)
  ]);
  res.json({ items: items.filter(isPubliclyListedLoose).map(presentCard), page, pages: Math.max(1, Math.ceil(total / limit)), total });
});
// `.select()` can drop status/visibility from the result, so listings rely on the query filter above;
// this keeps the safety net meaningful for rows that do carry them.
const isPubliclyListedLoose = (doc) => doc.status === undefined || isPubliclyListed(doc);

export const homeDocuments = handle(async (_req, res) => {
  const [recent, popular, subjects] = await Promise.all([
    NoteDocument.find(PUBLIC_LISTING_FILTER).select(CARD_FIELDS).sort({ createdAt: -1 }).limit(8).lean(),
    NoteDocument.find({ ...PUBLIC_LISTING_FILTER, views: { $gt: 0 } }).select(CARD_FIELDS).sort({ views: -1, bookmarks: -1 }).limit(8).lean(),
    NoteDocument.aggregate([{ $match: PUBLIC_LISTING_FILTER }, { $group: { _id: '$subject', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 16 }])
  ]);
  res.json({ recent: recent.map(presentCard), popular: popular.map(presentCard), subjects: subjects.map((row) => ({ name: row._id, count: row.count })) });
});

export const facets = handle(async (_req, res) => {
  const group = (field) => [
    ...(field === 'tags' ? [{ $unwind: '$tags' }] : []),
    { $match: { [field]: { $nin: ['', null] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 30 }
  ];
  const [row] = await NoteDocument.aggregate([
    { $match: PUBLIC_LISTING_FILTER },
    { $facet: { subjects: group('subject'), categories: group('category'), tags: group('tags'), languages: group('language') } }
  ]);
  const shape = (list = []) => list.map((item) => ({ name: item._id, count: item.count }));
  res.json({ subjects: shape(row?.subjects), categories: shape(row?.categories), tags: shape(row?.tags), languages: shape(row?.languages) });
});

// ---- reading one document ----------------------------------------------------------------
const findBySlug = (slug) => (typeof slug === 'string' && /^[a-z0-9-]{3,80}$/.test(slug) ? NoteDocument.findOne({ slug }) : null);

// Loads a document and applies the access policy. Sends the 404 itself; returns null when denied.
const authorized = async (req, res, purpose = 'meta') => {
  const doc = await findBySlug(req.params.slug);
  const access = accessFor(doc, req.user, purpose);
  if (!doc || !access.allowed) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  return { doc, access };
};

export const getDocument = handle(async (req, res) => {
  const found = await authorized(req, res, 'meta');
  if (!found) return;
  const { doc, access } = found;
  if (!access.statusOnly && doc.status === 'approved' && access.role === 'viewer') NoteDocument.updateOne({ _id: doc._id }, { $inc: { views: 1 } }).catch(() => null);
  const out = presentDocument(doc, access);
  if (req.user && !access.statusOnly) out.bookmarked = Boolean(await DocumentBookmark.findOne({ user: req.user._id, document: doc._id }));
  out.canDownload = Boolean(req.user) && !access.statusOnly && (doc.downloadable !== false || access.role !== 'viewer');
  res.set('Cache-Control', 'private, no-store');
  res.json(out);
});

// Byte-range streaming so a large PDF opens without downloading it all first.
const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    start = Math.max(0, size - Number.parseInt(match[2], 10));
    end = size - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] === '' ? size - 1 : Math.min(Number.parseInt(match[2], 10), size - 1);
  }
  return Number.isFinite(start) && start <= end && start < size ? { start, end } : 'invalid';
};
export const _parseRange = parseRange;

const sendStored = async (req, res, { doc, ref, size, mime, filename, disposition, publicCacheable }) => {
  const range = parseRange(req.headers.range, size);
  res.set({
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    // The PDF is shown by pdf.js (not the browser's own viewer); this stops anything inside the
    // file from running if it is ever opened directly.
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    // Never kept by shared caches: removing or rejecting a document must take effect immediately.
    'Cache-Control': publicCacheable ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    'Content-Disposition': `${disposition}; filename="${escapeHeader(filename)}.${mime === 'application/pdf' ? 'pdf' : 'img'}"`
  });
  if (range === 'invalid') {
    res.set('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  const stream = await storageFor(ref.storage).open(ref, range || {});
  if (range) {
    res.status(206).set({ 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(range.end - range.start + 1) });
  } else res.set('Content-Length', String(size));
  stream.on('error', (error) => {
    console.error('Document stream error:', error.message);
    if (!res.headersSent) res.status(502).json({ message: 'Could not read this file.' });
    else res.destroy();
  });
  stream.pipe(res);
};

export const streamFile = handle(async (req, res) => {
  const found = await authorized(req, res, 'file');
  if (!found || found.access.statusOnly) return found && res.status(404).json(NOT_FOUND);
  const { doc } = found;
  await sendStored(req, res, { doc, ref: doc.file, size: doc.file.size, mime: 'application/pdf', filename: doc.slug, disposition: 'inline', publicCacheable: false });
});

export const downloadFile = handle(async (req, res) => {
  const found = await authorized(req, res, 'download');
  if (!found || found.access.statusOnly) return found && res.status(404).json(NOT_FOUND);
  const { doc, access } = found;
  if (doc.downloadable === false && access.role === 'viewer') return res.status(403).json({ message: 'The uploader has turned off downloads for this note.' });
  if (doc.status === 'approved' && access.role === 'viewer') NoteDocument.updateOne({ _id: doc._id }, { $inc: { downloads: 1 } }).catch(() => null);
  await sendStored(req, res, { doc, ref: doc.file, size: doc.file.size, mime: 'application/pdf', filename: doc.slug, disposition: 'attachment', publicCacheable: false });
});

export const streamThumbnail = handle(async (req, res) => {
  const found = await authorized(req, res, 'thumbnail');
  if (!found || found.access.statusOnly) return found && res.status(404).json(NOT_FOUND);
  const { doc } = found;
  if (!doc.thumbnail?.key) return res.status(404).json(NOT_FOUND);
  await sendStored(req, res, { doc, ref: doc.thumbnail, size: doc.thumbnail.size, mime: doc.thumbnail.mime || 'image/jpeg', filename: doc.slug, disposition: 'inline', publicCacheable: isPubliclyListed(doc) });
});

// "Try in Playground": a reference-based hand-off. Playground fetches the example from here by
// slug, so no code travels in a URL, and it passes through the same access check as the PDF.
export const getCodeExample = handle(async (req, res) => {
  const found = await authorized(req, res, 'code');
  if (!found || found.access.statusOnly) return found && res.status(404).json(NOT_FOUND);
  const { doc } = found;
  if (!doc.codeExample?.code) return res.status(404).json({ message: 'This note has no code example.' });
  res.set('Cache-Control', 'private, no-store');
  res.json({ slug: doc.slug, documentTitle: doc.title, title: doc.codeExample.title || '', language: doc.codeExample.language, code: doc.codeExample.code });
});

export const relatedDocuments = handle(async (req, res) => {
  const found = await authorized(req, res, 'meta');
  if (!found || found.access.statusOnly) return found && res.status(404).json(NOT_FOUND);
  const { doc } = found;
  const limit = Math.min(12, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
  const or = [{ subject: doc.subject }, { category: doc.category }];
  if (doc.tags?.length) or.push({ tags: { $in: doc.tags } });
  if (doc.subjectCode) or.push({ subjectCode: doc.subjectCode });
  if (doc.course) or.push({ course: doc.course });
  if (doc.language) or.push({ language: doc.language });

  const candidates = await NoteDocument.find({ ...PUBLIC_LISTING_FILTER, _id: { $ne: doc._id }, $or: or }).select(`${CARD_FIELDS} _id`).sort({ createdAt: -1 }).limit(80).lean();
  let related = rankRelated(doc, candidates, limit);
  if (related.length < limit) {
    const have = new Set([String(doc._id), ...related.map((item) => String(item._id))]);
    const filler = await NoteDocument.find({ ...PUBLIC_LISTING_FILTER, _id: { $ne: doc._id } }).select(`${CARD_FIELDS} _id`).sort({ views: -1, createdAt: -1 }).limit(limit + 4).lean();
    related = [...related, ...filler.filter((item) => !have.has(String(item._id)))].slice(0, limit);
  }
  // Admin-written guides on the same topic (the existing block-based notes), published ones only.
  const guideOr = [{ category: doc.category }, { category: doc.subject }];
  if (doc.tags?.length) guideOr.push({ tags: { $in: doc.tags } });
  const guides = await Note.find({ published: true, $or: guideOr }).select('title slug description category').sort({ createdAt: -1 }).limit(4).lean();
  res.set('Cache-Control', 'private, no-store');
  res.json({ items: related.filter(isPubliclyListedLoose).map(presentCard), guides: guides.map((g) => ({ slug: g.slug, title: g.title, description: g.description, category: g.category })) });
});

// ---- uploading ----------------------------------------------------------------------------
const startOfWindow = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

const checkQuotas = async (user) => {
  const cfg = documentConfig();
  if (isAdmin(user)) return null;
  const [pending, recent, usage] = await Promise.all([
    NoteDocument.countDocuments({ owner: user._id, status: 'pending' }),
    NoteDocument.countDocuments({ owner: user._id, createdAt: { $gte: startOfWindow() } }),
    NoteDocument.aggregate([{ $match: { owner: user._id, status: { $ne: 'removed' } } }, { $group: { _id: null, bytes: { $sum: '$file.size' } } }])
  ]);
  if (pending >= cfg.maxPendingPerUser) return { status: 429, message: `You already have ${pending} notes waiting for review. Please wait for them to be reviewed first.` };
  if (recent >= cfg.maxUploadsPerDay) return { status: 429, message: 'You have reached today\'s upload limit. Please try again tomorrow.' };
  if ((usage[0]?.bytes || 0) >= cfg.maxStoragePerUserBytes) return { status: 413, message: 'You have used all of your upload storage. Delete an old note to upload a new one.' };
  return null;
};

const fileOf = (req, field) => req.files?.[field]?.[0];

const checkUploadedPdf = (file) => {
  const cfg = documentConfig();
  if (!file?.buffer) return 'Choose a PDF file to upload.';
  if (!/\.pdf$/i.test(file.originalname || '')) return 'Only .pdf files are accepted.';
  if (file.mimetype !== 'application/pdf') return 'Only PDF files are accepted.';
  if (file.size > cfg.maxFileBytes) return `That file is larger than ${Math.round(cfg.maxFileBytes / 1024 / 1024)} MB.`;
  return null;
};

const storeThumbnail = async (req, id) => {
  const file = fileOf(req, 'thumbnail');
  if (!file?.buffer || file.size > documentConfig().maxThumbnailBytes) return undefined;
  const mime = detectImageType(file.buffer);
  if (!mime) return undefined; // a thumbnail is optional: an unusable one is simply ignored
  const key = `documents/${id}/thumb-${randomBytes(3).toString('hex')}`;
  const ref = await storageFor(activeStorageName()).put(file.buffer, { key, mime });
  return { ...ref, mime, size: file.size };
};

const discard = (ref) => (ref?.key ? storageFor(ref.storage).remove(ref).catch(() => null) : null);

const duplicateOf = async (sha256, user) => {
  const mine = await NoteDocument.findOne({ 'file.sha256': sha256, owner: user._id, status: { $ne: 'removed' } });
  if (mine) return { slug: mine.slug, own: true };
  const live = await NoteDocument.findOne({ 'file.sha256': sha256, status: 'approved', visibility: 'public' });
  return live ? { slug: live.slug, own: false } : null;
};

export const createDocument = handle(async (req, res) => {
  const cfg = documentConfig();
  const user = req.user;
  if (cfg.requireVerifiedEmail && !user.isEmailVerified && !isAdmin(user)) {
    return res.status(403).json({ message: 'Please verify your email address before uploading notes.' });
  }
  const { data, errors } = await validateMeta(req.body || {});
  if (errors) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
  if (req.body.rightsConfirmed !== 'true' && req.body.rightsConfirmed !== true) {
    return res.status(400).json({ message: 'Please confirm you have the right to share this document.', errors: { rightsConfirmed: 'Required.' } });
  }
  const pdf = fileOf(req, 'pdf');
  const fileProblem = checkUploadedPdf(pdf);
  if (fileProblem) return res.status(400).json({ message: fileProblem, errors: { pdf: fileProblem } });
  const quota = await checkQuotas(user);
  if (quota) return res.status(quota.status).json({ message: quota.message });

  const inspected = await inspectPdf(pdf.buffer, { maxPages: cfg.maxPages, maxTextChars: cfg.maxTextChars });
  const duplicate = await duplicateOf(inspected.sha256, user);
  if (duplicate) {
    return res.status(409).json({ message: duplicate.own ? 'You have already uploaded this PDF.' : 'This PDF has already been shared on the platform.', slug: duplicate.own ? duplicate.slug : undefined });
  }

  const _id = newId();
  const driver = activeStorageName();
  const fileRef = await storageFor(driver).put(pdf.buffer, { key: `documents/${_id}/file-${randomBytes(3).toString('hex')}.pdf`, mime: 'application/pdf' });
  let thumbnail;
  try {
    thumbnail = await storeThumbnail(req, _id);
    const trusted = isAdmin(user); // administrators publish their own uploads directly; everyone else is reviewed
    const doc = new NoteDocument({
      ...data,
      _id,
      slug: makeSlug(data.title),
      owner: user._id,
      ownerName: String(user.name || user.username || 'Community member').slice(0, 100),
      rightsConfirmedAt: new Date(),
      // never taken from the request: status and every moderation field
      status: trusted ? 'approved' : 'pending',
      approvedAt: trusted ? new Date() : undefined,
      reviewedBy: trusted ? user._id : undefined,
      file: { ...fileRef, size: pdf.size, pages: inspected.pages, sha256: inspected.sha256, hasText: inspected.hasText, originalName: String(pdf.originalname || '').slice(0, 200) },
      thumbnail,
      audit: [{ action: trusted ? 'submitted+auto-approved' : 'submitted', by: user._id, byRole: trusted ? 'admin' : 'owner', to: trusted ? 'approved' : 'pending', at: new Date() }]
    });
    await doc.save();
    await DocumentText.create({ document: _id, pages: inspected.pageText, totalChars: inspected.totalChars }).catch((error) => console.error('Document text save failed:', error.message));
    res.status(201).json(presentDocument(doc, accessFor(doc, user, 'meta')));
  } catch (error) {
    await Promise.all([discard(fileRef), discard(thumbnail)]); // nothing is left orphaned if the database write fails
    throw error;
  }
});

// ---- the owner's own documents ----------------------------------------------------------
const findOwned = async (req) => (OBJECT_ID.test(String(req.params.id)) ? NoteDocument.findOne({ _id: req.params.id, owner: req.user._id }) : null);

export const myDocuments = handle(async (req, res) => {
  const rows = await NoteDocument.find({ owner: req.user._id, $nor: [{ status: 'removed', removedBy: 'owner' }] }).select('-audit').sort({ createdAt: -1 }).limit(200);
  res.set('Cache-Control', 'private, no-store');
  res.json(rows.map((doc) => presentDocument(doc, accessFor(doc, req.user, 'meta'))));
});

export const updateDocument = handle(async (req, res) => {
  const doc = await findOwned(req);
  if (!doc || (doc.status === 'removed')) return res.status(404).json(NOT_FOUND);
  const { data, errors } = await validateMeta(req.body || {}, { partial: true });
  if (errors) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
  const { codeExample, ...rest } = data;
  // Only the fields validateMeta returns can be set: status, owner, file, counters and
  // moderation fields are not reachable from a request body.
  Object.assign(doc, rest);
  if (codeExample !== undefined) doc.codeExample = codeExample || undefined;
  logAudit(doc, 'edited', { user: req.user, actor: 'owner' });
  await doc.save();
  res.json(presentDocument(doc, accessFor(doc, req.user, 'meta')));
});

export const resubmitDocument = handle(async (req, res) => {
  const doc = await findOwned(req);
  if (!doc) return res.status(404).json(NOT_FOUND);
  transition(doc, 'pending', { actor: 'owner', user: req.user, reason: 'resubmitted after changes' });
  await doc.save();
  res.json(presentDocument(doc, accessFor(doc, req.user, 'meta')));
});

export const replaceFile = handle(async (req, res) => {
  const cfg = documentConfig();
  const doc = await findOwned(req);
  if (!doc || doc.status === 'removed') return res.status(404).json(NOT_FOUND);
  const pdf = fileOf(req, 'pdf');
  const problem = checkUploadedPdf(pdf);
  if (problem) return res.status(400).json({ message: problem });
  const inspected = await inspectPdf(pdf.buffer, { maxPages: cfg.maxPages, maxTextChars: cfg.maxTextChars });
  if (inspected.sha256 === doc.file.sha256) return res.status(409).json({ message: 'That is the same file you already uploaded.' });

  const oldFile = { storage: doc.file.storage, key: doc.file.key };
  const oldThumb = doc.thumbnail?.key ? { storage: doc.thumbnail.storage, key: doc.thumbnail.key } : null;
  const ref = await storageFor(activeStorageName()).put(pdf.buffer, { key: `documents/${doc._id}/file-${randomBytes(3).toString('hex')}.pdf`, mime: 'application/pdf' });
  let thumbnail;
  try {
    thumbnail = await storeThumbnail(req, String(doc._id));
    doc.file = { ...ref, size: pdf.size, pages: inspected.pages, sha256: inspected.sha256, hasText: inspected.hasText, originalName: String(pdf.originalname || '').slice(0, 200) };
    doc.thumbnail = thumbnail || undefined;
    if (doc.status !== 'pending') transition(doc, 'pending', { actor: 'owner', user: req.user, reason: 'file replaced' }); // new content is reviewed again
    else logAudit(doc, 'file-replaced', { user: req.user, actor: 'owner' });
    await doc.save();
  } catch (error) {
    await Promise.all([discard(ref), discard(thumbnail)]);
    throw error;
  }
  await DocumentText.findOneAndUpdate({ document: doc._id }, { pages: inspected.pageText, totalChars: inspected.totalChars }, { upsert: true }).catch(() => null);
  await Promise.all([discard(oldFile), thumbnail ? discard(oldThumb) : null]); // the replaced bytes are deleted only after the new ones are safely stored
  res.json(presentDocument(doc, accessFor(doc, req.user, 'meta')));
});

// Soft delete: the file is kept for the retention period (admins can restore), then purged.
export const deleteDocument = handle(async (req, res) => {
  const doc = await findOwned(req);
  if (!doc || (doc.status === 'removed' && doc.removedBy === 'owner')) return res.status(404).json(NOT_FOUND);
  if (doc.status === 'removed') return res.status(409).json({ message: 'An administrator removed this note. Contact support to appeal.' });
  transition(doc, 'removed', { actor: 'owner', user: req.user, reason: 'deleted by owner' });
  await doc.save();
  res.json({ message: 'Note deleted.' });
});

// ---- bookmarks and reports ----------------------------------------------------------------
export const addBookmark = handle(async (req, res) => {
  const found = await authorized(req, res, 'meta');
  if (!found) return;
  if (found.doc.status !== 'approved' || found.access.statusOnly) return res.status(409).json({ message: 'Only published notes can be saved.' });
  const existing = await DocumentBookmark.findOne({ user: req.user._id, document: found.doc._id });
  if (!existing) {
    await DocumentBookmark.create({ user: req.user._id, document: found.doc._id });
    await NoteDocument.updateOne({ _id: found.doc._id }, { $inc: { bookmarks: 1 } });
  }
  res.status(existing ? 200 : 201).json({ bookmarked: true });
});

export const removeBookmark = handle(async (req, res) => {
  const doc = await findBySlug(req.params.slug);
  if (!doc) return res.json({ bookmarked: false });
  const removed = await DocumentBookmark.findOneAndDelete({ user: req.user._id, document: doc._id });
  if (removed) await NoteDocument.updateOne({ _id: doc._id }, { $inc: { bookmarks: -1 } });
  res.json({ bookmarked: false });
});

export const myBookmarks = handle(async (req, res) => {
  const marks = await DocumentBookmark.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  if (!marks.length) return res.json([]);
  const docs = await NoteDocument.find({ _id: { $in: marks.map((mark) => mark.document) } });
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const visible = marks.map((mark) => byId.get(String(mark.document))).filter((doc) => doc && doc.status === 'approved' && accessFor(doc, req.user, 'meta').allowed);
  res.set('Cache-Control', 'private, no-store');
  res.json(visible.map(presentCard));
});

export const reportDocument = handle(async (req, res) => {
  const found = await authorized(req, res, 'meta');
  if (!found) return;
  const { doc, access } = found;
  if (access.role !== 'viewer' || doc.status !== 'approved') return res.status(409).json({ message: 'You cannot report this note.' });
  const reason = req.body?.reason;
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ message: 'Choose a reason for the report.' });
  const details = str(req.body?.details).slice(0, 1000);
  if (await DocumentReport.findOne({ document: doc._id, reporter: req.user._id, status: 'open' })) return res.status(409).json({ message: 'You have already reported this note. We will review it.' });
  await DocumentReport.create({ document: doc._id, reporter: req.user._id, reason, details });
  await NoteDocument.updateOne({ _id: doc._id }, { $inc: { openReports: 1 } });
  res.status(201).json({ message: 'Thank you. An administrator will review this report.' });
});
