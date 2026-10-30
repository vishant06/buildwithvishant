import mongoose from 'mongoose';

// A community-contributed PDF note. Separate from the block-based `Note` model on purpose:
// existing admin-authored notes keep working exactly as before, untouched.
//
// `status` is the moderation state and only server code changes it (see
// utils/documentAccess.js for the allowed transitions); `visibility` is the owner's choice
// and only matters once a document is approved.
const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byRole: { type: String, enum: ['owner', 'admin', 'system'], default: 'system' },
  from: String,
  to: String,
  reason: { type: String, maxlength: 500 },
  at: { type: Date, default: Date.now }
}, { _id: false });

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  subject: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  topic: { type: String, trim: true, maxlength: 80, default: '' },
  tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }], default: [] },
  university: { type: String, trim: true, maxlength: 100, default: '' },
  course: { type: String, trim: true, maxlength: 100, default: '' },
  semester: { type: String, trim: true, maxlength: 30, default: '' },
  subjectCode: { type: String, trim: true, maxlength: 30, default: '' },
  language: { type: String, trim: true, lowercase: true, maxlength: 30, default: '' }, // programming language, optional
  // Optional starter code for "Try in Playground". Plain text, never executed by this service.
  codeExample: {
    type: new mongoose.Schema({
      title: { type: String, maxlength: 100, default: '' },
      language: { type: String, required: true, maxlength: 30 },
      code: { type: String, required: true, maxlength: 20000 }
    }, { _id: false }),
    default: undefined
  },

  // Where the bytes live. `key` is an internal storage reference and is never sent to a client.
  file: {
    storage: { type: String, enum: ['gridfs', 'cloudinary'], required: true },
    key: { type: String, required: true },
    size: { type: Number, required: true },
    pages: { type: Number, required: true },
    sha256: { type: String, required: true },
    hasText: { type: Boolean, default: false },
    originalName: { type: String, maxlength: 200, default: '' }
  },
  thumbnail: {
    type: new mongoose.Schema({ storage: String, key: String, mime: String, size: Number }, { _id: false }),
    default: undefined
  },

  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerName: { type: String, trim: true, maxlength: 100, default: '' }, // display name shown publicly
  rightsConfirmedAt: { type: Date, required: true },

  status: { type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending', required: true },
  visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public', required: true },
  downloadable: { type: Boolean, default: true },
  rejectionReason: { type: String, maxlength: 500, default: '' },
  removalReason: { type: String, maxlength: 500, default: '' },
  removedBy: { type: String, enum: ['owner', 'admin', ''], default: '' },
  removedAt: { type: Date },
  previousStatus: { type: String, enum: ['pending', 'approved', 'rejected', ''], default: '' },
  approvedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  openReports: { type: Number, default: 0 },
  audit: { type: [auditSchema], default: [] },

  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  bookmarks: { type: Number, default: 0 }
}, { timestamps: true });

schema.index({ status: 1, visibility: 1, createdAt: -1 });
schema.index({ status: 1, visibility: 1, views: -1 });
schema.index({ owner: 1, createdAt: -1 });
schema.index({ 'file.sha256': 1 });
schema.index({ status: 1, category: 1 });
schema.index({ status: 1, tags: 1 });
schema.index({ status: 1, removedAt: 1 });

schema.index(
  {
    title: 'text',
    description: 'text',
    subject: 'text',
    topic: 'text',
    tags: 'text',
    ownerName: 'text',
    course: 'text',
    subjectCode: 'text',
    university: 'text'
  },
  {
    weights: {
      title: 10,
      subject: 6,
      topic: 6,
      tags: 6,
      description: 3,
      ownerName: 2,
      course: 2,
      subjectCode: 2,
      university: 2
    },
    name: 'document_search',
    language_override: 'textSearchLanguage'
  }
);


export default mongoose.model('NoteDocument', schema);
