import Note from '../models/Note.js';
import { deleteCloudinaryAsset, uploadNoteThumbnail } from '../services/cloudinaryService.js';
import { noteFilename, renderNotePdf } from '../services/notePdfService.js';

const list = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const BLOCK_TYPES = ['heading', 'text', 'code', 'output', 'bulletList', 'numberedList', 'callout', 'image', 'table', 'divider'];

// Defense in depth: the client already only ever sends well-formed blocks,
// but this never trusts that. Anything with an unknown/missing type is
// dropped, and every value is coerced to the right shape/type so a bad
// request can't produce a Mongoose ValidationError further down.
const sanitizeBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((block) => block && BLOCK_TYPES.includes(block.type))
    .map((block) => {
      const clean = { type: block.type };
      if (['heading', 'text', 'code', 'output', 'callout'].includes(block.type)) {
        clean.content = String(block.content || '').slice(0, 20000);
      }
      if (block.type === 'heading') {
        const level = Number(block.level);
        clean.level = [1, 2, 3, 4].includes(level) ? level : 2;
      }
      if (block.type === 'code') {
        clean.language = String(block.language || 'javascript').slice(0, 30);
      }
      if (block.type === 'callout') {
        clean.calloutType = ['note', 'important', 'tip', 'warning'].includes(block.calloutType) ? block.calloutType : 'note';
      }
      if (['bulletList', 'numberedList'].includes(block.type)) {
        clean.items = Array.isArray(block.items) ? block.items.map((item) => String(item || '').slice(0, 2000)) : [];
      }
      if (block.type === 'image') {
        clean.url = String(block.url || '').slice(0, 2000);
        clean.alt = String(block.alt || '').slice(0, 300);
        clean.caption = String(block.caption || '').slice(0, 300);
      }
      if (block.type === 'table') {
        clean.headers = Array.isArray(block.headers) ? block.headers.map((h) => String(h || '').slice(0, 200)) : [];
        clean.rows = Array.isArray(block.rows)
          ? block.rows.map((row) => ({ cells: Array.isArray(row?.cells) ? row.cells.map((c) => String(c || '').slice(0, 500)) : [] }))
          : [];
      }
      return clean;
    })
    // Drop genuinely empty blocks (dividers have no content and are always kept).
    .filter((block) => {
      if (block.type === 'divider') return true;
      if (block.type === 'image') return Boolean(block.url);
      if (block.type === 'table') return block.headers.some(Boolean);
      if (['bulletList', 'numberedList'].includes(block.type)) return block.items.some((item) => item.trim());
      return Boolean(block.content && block.content.trim());
    });
};

const hasRenderableContent = (data) =>
  (Array.isArray(data.blocks) && data.blocks.length > 0) || Boolean(data.content && data.content.trim());

export const getNotes = async (req, res) => { const query = { published: true }; if (req.query.category) query.category = req.query.category; if (req.query.difficulty) query.difficulty = req.query.difficulty; if (req.query.tag) query.tags = req.query.tag; if (req.query.search) query.$or = [{ title: new RegExp(req.query.search, 'i') }, { description: new RegExp(req.query.search, 'i') }]; res.json(await Note.find(query).select('-content -blocks').sort({ createdAt: -1 }).populate('author', 'name')); };

export const getNote = async (req, res) => { const note = await Note.findOne({ slug: req.params.slug, published: true }).populate('author', 'name'); if (!note) return res.status(404).json({ message: 'Note not found' }); res.json(note); };

// GET /api/notes/:slug/pdf — requires auth (see `protect` in noteRoutes.js).
// Only ever looks up a note by its own stored slug/published flag, the same
// query used by the public getNote handler above, so this can't be used to
// reach unpublished notes or any file path supplied by the caller.
export const downloadNotePdf = async (req, res) => {
  try {
    const note = await Note.findOne({ slug: req.params.slug, published: true }).populate('author', 'name');
    if (!note) return res.status(404).json({ message: 'Note not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${noteFilename(note)}"`);

    const doc = renderNotePdf(note, res);
    doc.on('error', (error) => {
      console.error('PDF stream error:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF. Please try again.' });
      else res.end();
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF. Please try again.' });
    else res.end();
  }
};

export const getAdminNotes = async (_req, res) => res.json(await Note.find().select('-content -blocks').sort({ updatedAt: -1 }).populate('author', 'name'));

export const getAdminNote = async (req, res) => { const note = await Note.findById(req.params.id).populate('author', 'name'); if (!note) return res.status(404).json({ message: 'Note not found' }); res.json(note); };

// POST /api/notes/admin/thumbnail — the "Upload image" button in the admin
// note editor. Uploads straight to Cloudinary and hands back a URL, which
// the client then stores in the note's `thumbnail` field on save — same
// two-step shape as the resume upload flow already used elsewhere.
export const uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please choose an image file to upload' });
    const result = await uploadNoteThumbnail(req.file);
    res.status(201).json({ url: result.secure_url });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Unable to upload thumbnail' });
  }
};

export const saveNote = async (req, res) => {
  try {
    const blocks = sanitizeBlocks(req.body.blocks);
    const data = { ...req.body, blocks, tags: list(req.body.tags), slug: slugify(req.body.slug || req.body.title), author: req.user._id };
    if (data.published && !hasRenderableContent(data)) {
      return res.status(400).json({ message: 'Add at least one content block before publishing.' });
    }
    const duplicate = await Note.findOne({ slug: data.slug });
    if (duplicate) return res.status(409).json({ message: 'A note with this slug already exists' });
    res.status(201).json(await Note.create(data));
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : (error.status || 500)).json({ message: error.message || 'Failed to save note' });
  }
};

export const updateNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const previousThumbnail = note.thumbnail;
    const patch = {
      ...req.body,
      ...(req.body.blocks !== undefined ? { blocks: sanitizeBlocks(req.body.blocks) } : {}),
      ...(req.body.tags !== undefined ? { tags: list(req.body.tags) } : {}),
      ...(req.body.slug || req.body.title ? { slug: slugify(req.body.slug || req.body.title) } : {})
    };
    const merged = { blocks: note.blocks, content: note.content, ...patch };
    if (merged.published && !hasRenderableContent(merged)) {
      return res.status(400).json({ message: 'Add at least one content block before publishing.' });
    }
    Object.assign(note, patch);
    const saved = await note.save();
    // Old thumbnail was swapped out for a newly uploaded one — clean up the
    // now-unused Cloudinary asset (no-op if it wasn't a Cloudinary URL).
    if (previousThumbnail && previousThumbnail !== saved.thumbnail) {
      await deleteCloudinaryAsset(previousThumbnail).catch(() => null);
    }
    res.json(saved);
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : (error.status || 500)).json({ message: error.message || 'Failed to update note' });
  }
};

export const deleteNote = async (req, res) => {
  const note = await Note.findByIdAndDelete(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });
  if (note.thumbnail) await deleteCloudinaryAsset(note.thumbnail).catch(() => null);
  res.json({ message: 'Note deleted' });
};
