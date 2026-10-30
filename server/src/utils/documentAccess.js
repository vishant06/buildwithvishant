// The single source of truth for "who may do what with a document". Every endpoint that
// returns document metadata, bytes, a thumbnail, text for the AI, or a code example goes
// through `accessFor`; nothing else decides. Moderation changes go through `transition`.
//
//   status     public           owner                      admin
//   pending    nothing          view, preview, edit        everything
//   approved   (see visibility) everything                 everything
//   rejected   nothing          view, edit, resubmit       everything
//   removed    nothing          sees status + reason only  everything
//
// For approved documents the owner's `visibility` applies:
//   public   - anyone, listed and searchable
//   unlisted - anyone WITH THE LINK, never listed, searched or recommended
//   private  - owner and admins only

export const isAdmin = (user) => user?.role === 'admin';
export const isOwner = (doc, user) => Boolean(user?._id) && String(doc.owner?._id || doc.owner) === String(user._id);

// -> { allowed, role: 'owner' | 'admin' | 'viewer' | null, statusOnly? }
export const accessFor = (doc, user, purpose = 'meta') => {
  if (!doc) return { allowed: false, role: null };
  const admin = isAdmin(user);
  const owner = isOwner(doc, user);
  const role = admin ? 'admin' : owner ? 'owner' : 'viewer';

  if (admin) return { allowed: true, role };

  switch (doc.status) {
    case 'approved':
      if (owner) return { allowed: true, role };
      if (doc.visibility === 'public' || doc.visibility === 'unlisted') return { allowed: true, role };
      return { allowed: false, role: null };
    case 'pending':
    case 'rejected':
      return owner ? { allowed: true, role } : { allowed: false, role: null };
    case 'removed':
      // The owner may learn that an admin removed it (and why); the file is gone for them too.
      if (owner && doc.removedBy === 'admin' && purpose === 'meta') return { allowed: true, role, statusOnly: true };
      return { allowed: false, role: null };
    default:
      return { allowed: false, role: null };
  }
};

// Only these documents may appear in listings, search results and recommendations.
export const PUBLIC_LISTING_FILTER = Object.freeze({ status: 'approved', visibility: 'public' });

// --- explicit moderation state machine ---------------------------------------------------
// transition table: from -> to -> who may do it
const TRANSITIONS = {
  pending: { approved: ['admin'], rejected: ['admin'], removed: ['owner', 'admin'] },
  approved: { pending: ['owner', 'admin'], removed: ['owner', 'admin'] },
  rejected: { pending: ['owner', 'admin'], approved: ['admin'], removed: ['owner', 'admin'] },
  removed: { pending: ['admin'], approved: ['admin'] }
};

export const canTransition = (from, to, actor) => Boolean(TRANSITIONS[from]?.[to]?.includes(actor));

export class TransitionError extends Error {
  constructor(from, to, actor) {
    super(`A ${actor} cannot move a document from "${from}" to "${to}".`);
    this.status = 409;
    this.name = 'TransitionError';
  }
}

const AUDIT_LIMIT = 50;

// Applies a status change to a document in memory (the caller saves it) and records it in the
// audit trail. Throws TransitionError if the actor may not make that change.
export const transition = (doc, to, { actor, user, reason = '' }) => {
  const from = doc.status;
  if (!canTransition(from, to, actor)) throw new TransitionError(from, to, actor);
  const clean = String(reason || '').trim().slice(0, 500);

  doc.status = to;
  if (to === 'approved') {
    doc.approvedAt = new Date();
    doc.reviewedBy = user._id;
    doc.rejectionReason = '';
    doc.removalReason = '';
    doc.removedBy = '';
    doc.removedAt = undefined;
  } else if (to === 'rejected') {
    doc.rejectionReason = clean;
    doc.reviewedBy = user._id;
    doc.approvedAt = undefined;
  } else if (to === 'removed') {
    doc.previousStatus = from === 'removed' ? doc.previousStatus : from;
    doc.removedBy = actor;
    doc.removedAt = new Date();
    doc.removalReason = clean;
  } else if (to === 'pending') {
    doc.rejectionReason = '';
    doc.removalReason = '';
    doc.removedBy = '';
    doc.removedAt = undefined;
    doc.approvedAt = undefined;
  }
  doc.audit = [...(doc.audit || []), { action: `${from}->${to}`, by: user._id, byRole: actor, from, to, reason: clean, at: new Date() }].slice(-AUDIT_LIMIT);
  return doc;
};

export const logAudit = (doc, action, { user, actor, reason = '' }) => {
  doc.audit = [...(doc.audit || []), { action, by: user._id, byRole: actor, reason: String(reason).slice(0, 500), at: new Date() }].slice(-AUDIT_LIMIT);
};

// --- what each audience may see ---------------------------------------------------------
const plain = (doc) => (typeof doc.toObject === 'function' ? doc.toObject() : { ...doc });

// Never includes: storage keys, hashes, owner id, owner email, audit trail, moderation internals.
export const presentCard = (doc) => {
  const d = plain(doc);
  return {
    slug: d.slug,
    title: d.title,
    description: d.description,
    subject: d.subject,
    category: d.category,
    topic: d.topic || '',
    tags: d.tags || [],
    university: d.university || '',
    course: d.course || '',
    semester: d.semester || '',
    subjectCode: d.subjectCode || '',
    language: d.language || '',
    pages: d.file?.pages || 0,
    sizeBytes: d.file?.size || 0,
    hasCode: Boolean(d.codeExample?.code || d.codeExample?.language),
    hasThumbnail: Boolean(d.thumbnail?.key),
    hasText: Boolean(d.file?.hasText),
    uploader: d.ownerName || 'Community member',
    createdAt: d.createdAt,
    approvedAt: d.approvedAt,
    views: d.views || 0,
    downloads: d.downloads || 0,
    bookmarks: d.bookmarks || 0
  };
};

export const presentDocument = (doc, access) => {
  const d = plain(doc);
  if (access?.statusOnly) {
    return { slug: d.slug, title: d.title, status: 'removed', removalReason: d.removalReason || '', myRole: access.role, statusOnly: true };
  }
  const out = { ...presentCard(doc), downloadable: d.downloadable !== false, visibility: d.visibility, myRole: access?.role || 'viewer' };
  if (access?.role === 'owner' || access?.role === 'admin') {
    Object.assign(out, {
      id: String(d._id),
      status: d.status,
      rejectionReason: d.rejectionReason || '',
      removalReason: d.removalReason || '',
      removedBy: d.removedBy || ''
    });
  }
  if (access?.role === 'admin') {
    Object.assign(out, { ownerId: String(d.owner?._id || d.owner), openReports: d.openReports || 0, audit: (d.audit || []).slice(-20) });
  }
  return out;
};

// Related / listing safety net: drop anything that is not publicly listable, whatever the query returned.
export const isPubliclyListed = (doc) => doc.status === 'approved' && doc.visibility === 'public';
