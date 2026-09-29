import mongoose from 'mongoose';
import { executionLanguages } from '../config/playgroundLanguages.js';

// Widened to match every language the execution API actually supports
// (previously only 7 of 21+ were allowed here, so saving a project in most
// languages — e.g. Rust, Go, PHP — failed Mongoose enum validation on both
// the website and this new mobile save feature; 'web' covers the combined
// HTML/CSS/JS mode). Purely additive: existing saved projects and the
// enum's default are unaffected.
const playgroundProjectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  language: { type: String, default: 'web', enum: ['web', ...Object.keys(executionLanguages)] },
  code: { type: String, default: '', maxlength: 100_000 },
  html: { type: String, default: '', maxlength: 100_000 }, css: { type: String, default: '', maxlength: 100_000 }, javascript: { type: String, default: '', maxlength: 100_000 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
export default mongoose.model('PlaygroundProject', playgroundProjectSchema);
