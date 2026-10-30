import mongoose from 'mongoose';

// Small companion collections for community PDF notes.

// Extracted text, one entry per page. Only read by the AI assistant, after the access check.
const textSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteDocument', required: true, unique: true },
  pages: { type: [{ _id: false, n: Number, text: String }], default: [] },
  totalChars: { type: Number, default: 0 }
}, { timestamps: true });
export const DocumentText = mongoose.model('DocumentText', textSchema);

const reportSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteDocument', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: ['copyright', 'inappropriate', 'spam', 'wrong_information', 'other'], required: true },
  details: { type: String, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open', index: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  resolutionNote: { type: String, maxlength: 500, default: '' }
}, { timestamps: true });
// One open report per person per document.
reportSchema.index({ document: 1, reporter: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });
export const DocumentReport = mongoose.model('DocumentReport', reportSchema);

const bookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteDocument', required: true }
}, { timestamps: true });
bookmarkSchema.index({ user: 1, document: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });
export const DocumentBookmark = mongoose.model('DocumentBookmark', bookmarkSchema);

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true }
}, { timestamps: true });
export const DocumentCategory = mongoose.model('DocumentCategory', categorySchema);

// Daily AI usage per person (the quota is enforced against this).
const usageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
  at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 } // old counters clean themselves up
});
usageSchema.index({ user: 1, day: 1 }, { unique: true });
export const DocumentAiUsage = mongoose.model('DocumentAiUsage', usageSchema);
