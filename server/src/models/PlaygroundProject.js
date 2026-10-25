import mongoose from 'mongoose';
import { executionLanguages } from '../config/playgroundLanguages.js';

// Widened to match every language the execution API actually supports
// (previously only 7 of 21+ were allowed here, so saving a project in most
// languages — e.g. Rust, Go, PHP — failed Mongoose enum validation on both
// the website and this new mobile save feature; 'web' covers the combined
// HTML/CSS/JS mode). Purely additive: existing saved projects and the
// enum's default are unaffected.
//
// Workspaces (multi-file projects) add `files` + `entryFile`. Projects saved
// before that have `files` empty and keep working: the API presents their
// legacy fields (code / html / css / javascript) as a one-file workspace and
// never rewrites them until the owner saves. When a workspace is saved the
// legacy fields are mirrored from the entry file so older clients (the mobile
// app) can still open it.
const workspaceFileSchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: 64 },
  path: { type: String, required: true, maxlength: 240 },
  type: { type: String, enum: ['file', 'folder'], required: true },
  content: { type: String, default: '', maxlength: 100_000 }
}, { _id: false });

const playgroundProjectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  language: { type: String, default: 'web', enum: ['web', ...Object.keys(executionLanguages)] },
  code: { type: String, default: '', maxlength: 100_000 },
  html: { type: String, default: '', maxlength: 100_000 }, css: { type: String, default: '', maxlength: 100_000 }, javascript: { type: String, default: '', maxlength: 100_000 },
  files: { type: [workspaceFileSchema], default: undefined },
  entryFile: { type: String, default: '', maxlength: 240 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Privacy. Every project is PRIVATE unless its owner explicitly publishes it.
  // Only the exact string 'public' ever grants access, so a missing / null /
  // unknown value can never expose a project (the public lookup queries for
  // visibility === 'public' directly in the database). `publicSlug` is the
  // random, non-guessable token used in share links; it exists only while the
  // project is public and is removed (not just hidden) when it goes private.
  visibility: { type: String, enum: ['private', 'public'], default: 'private', required: true },
  publicSlug: { type: String, default: undefined, minlength: 8, maxlength: 32, index: { unique: true, sparse: true } },
  publishedAt: { type: Date, default: undefined },
  // People the owner has given access to. Roles:
  //   viewer  - open and read the project (and run it), never save
  //   editor  - viewer + edit files and save
  //   manager - "full access": editor + change privacy / the public link + manage
  //             people (viewer / editor). Never delete the project, never touch the
  //             owner or other managers; only the owner can grant 'manager'.
  collaborators: {
    type: [{
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, enum: ['viewer', 'editor', 'manager'], default: 'viewer', required: true },
      addedAt: { type: Date, default: Date.now },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    default: undefined,
    select: true
  }
}, { timestamps: true });
playgroundProjectSchema.index({ 'collaborators.user': 1 }); // "shared with me" and access checks
export default mongoose.model('PlaygroundProject', playgroundProjectSchema);
