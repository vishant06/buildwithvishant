import express from 'express';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { uploadNoteThumbnail } from '../middleware/uploadMiddleware.js';
import { deleteNote, downloadNotePdf, getAdminNote, getAdminNotes, getNote, getNotes, saveNote, updateNote, uploadThumbnail } from '../controllers/noteController.js';

const router = express.Router();

router.get('/', getNotes);
router.get('/admin/all', protect, authorize('admin'), getAdminNotes);
router.post('/admin/thumbnail', protect, authorize('admin'), uploadNoteThumbnail.single('thumbnail'), uploadThumbnail);
router.get('/admin/:id', protect, authorize('admin'), getAdminNote);
// Auth required — `protect` rejects with 401 before the note is even looked
// up, so an unauthenticated request never reaches PDF generation.
router.get('/:slug/pdf', protect, downloadNotePdf);
router.get('/:slug', getNote);
router.post('/', protect, authorize('admin'), saveNote);
router.put('/:id', protect, authorize('admin'), updateNote);
router.delete('/:id', protect, authorize('admin'), deleteNote);

export default router;
