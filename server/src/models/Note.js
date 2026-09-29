import mongoose from 'mongoose';

// One flexible block schema covers every block type rather than using
// discriminators — simpler to reason about and matches the project's
// existing lightweight schema style. Only the fields relevant to a given
// `type` are populated; the rest stay at their defaults.
const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['heading', 'text', 'code', 'output', 'bulletList', 'numberedList', 'callout', 'image', 'table', 'divider']
  },
  content: { type: String, default: '' },          // text / heading / code / output / callout
  level: { type: Number, min: 1, max: 4, default: 2 }, // heading
  language: { type: String, default: 'javascript' },   // code
  calloutType: { type: String, enum: ['note', 'important', 'tip', 'warning'], default: 'note' },
  items: [{ type: String }],                        // bulletList / numberedList
  url: { type: String, default: '' },                // image
  alt: { type: String, default: '' },                // image
  caption: { type: String, default: '' },            // image
  headers: [{ type: String }],                       // table
  rows: [{ cells: [{ type: String }] }]               // table
}, { _id: false });

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, maxlength: 500 },
  category: { type: String, required: true, trim: true },
  tags: [{ type: String, trim: true }],
  thumbnail: { type: String, default: '' },
  // Structured content — the primary way notes are authored/rendered now.
  blocks: { type: [blockSchema], default: [] },
  // Legacy plain-text fields. No longer written to by the block editor, but
  // kept (and still rendered) so notes created before this feature existed
  // keep working without a database migration.
  content: { type: String, default: '' },
  codeExamples: [{ language: String, code: String, title: String }],
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  published: { type: Boolean, default: false },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});
export default mongoose.model('Note', noteSchema);
