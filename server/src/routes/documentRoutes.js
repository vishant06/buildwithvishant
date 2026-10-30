import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { attachUserIfPresent, authorize, protect } from '../middleware/authMiddleware.js';
import { documentConfig } from '../config/documents.js';
import {
  addBookmark, createDocument, deleteDocument, downloadFile, facets, getCodeExample, getDocument, homeDocuments, listCategories,
  listDocuments, myBookmarks, myDocuments, relatedDocuments, removeBookmark, replaceFile, reportDocument, resubmitDocument,
  streamFile, streamThumbnail, updateDocument, uploadConfig
} from '../controllers/documentController.js';
import { askAboutDocument } from '../controllers/documentAiController.js';
import * as admin from '../controllers/documentAdminController.js';

const router = express.Router();

const limit = (windowMs, max, message) => rateLimit({ windowMs, limit: max, message: { message } });
const perUser = (req) => String(req.user?._id || req.ip);

// File bytes are read through the API (access-checked every time). A PDF opens as many small range
// requests, so these routes have their own, higher limit and are skipped by the server-wide one.
const fileLimiter = limit(15 * 60 * 1000, 900, 'Too many file requests. Please slow down.');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: documentConfig().maxFileBytes, files: 2, fields: 30, fieldSize: 64 * 1024 }
}).fields([{ name: 'pdf', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]);

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 15, keyGenerator: perUser, validate: { keyGeneratorIpFallback: false }, message: { message: 'Too many uploads. Please try again later.' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, keyGenerator: perUser, validate: { keyGeneratorIpFallback: false }, message: { message: 'Too many requests. Please slow down.' } });
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, keyGenerator: perUser, validate: { keyGeneratorIpFallback: false }, message: { message: 'Too many reports. Please try again later.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, keyGenerator: perUser, validate: { keyGeneratorIpFallback: false }, message: { message: 'Too many AI requests. Please try again shortly.' } });

// ---- public discovery (approved + public documents only; enforced in the controller query)
router.get('/categories', listCategories);
router.get('/config', uploadConfig);
router.get('/home', homeDocuments);
router.get('/facets', facets);
router.get('/', listDocuments);

// ---- signed-in user
router.get('/mine', protect, myDocuments);
router.get('/bookmarks', protect, myBookmarks);
router.post('/', protect, uploadLimiter, upload, createDocument);
router.patch('/manage/:id', protect, writeLimiter, updateDocument);
router.post('/manage/:id/resubmit', protect, uploadLimiter, resubmitDocument);
router.post('/manage/:id/file', protect, uploadLimiter, upload, replaceFile);
router.delete('/manage/:id', protect, writeLimiter, deleteDocument);

// ---- administrators (every route behind protect + authorize('admin'); controllers re-check the role)
const adminRouter = express.Router();
adminRouter.use(protect, authorize('admin'));
adminRouter.get('/stats', admin.moderationStats);
adminRouter.get('/documents', admin.moderationQueue);
adminRouter.get('/documents/:id', admin.getForReview);
adminRouter.post('/documents/:id/approve', admin.approveDocument);
adminRouter.post('/documents/:id/reject', admin.rejectDocument);
adminRouter.post('/documents/:id/remove', admin.removeDocument);
adminRouter.post('/documents/:id/unpublish', admin.unpublishDocument);
adminRouter.post('/documents/:id/restore', admin.restoreDocument);
adminRouter.get('/reports', admin.listReports);
adminRouter.post('/reports/:id/resolve', admin.resolveReport);
adminRouter.get('/categories', admin.adminCategories);
adminRouter.post('/categories', admin.addCategory);
adminRouter.patch('/categories/:id', admin.renameCategory);
adminRouter.delete('/categories/:id', admin.deleteCategory);
adminRouter.get('/tags', admin.adminTags);
adminRouter.post('/tags/rename', admin.renameTag);
adminRouter.delete('/tags/:tag', admin.deleteTag);
router.use('/admin', adminRouter);

// ---- one document, by slug. `attachUserIfPresent` only identifies a signed-in visitor; the
// access decision is made by the controller for every one of these.
router.get('/:slug/file', fileLimiter, attachUserIfPresent, streamFile);
router.get('/:slug/thumbnail', fileLimiter, attachUserIfPresent, streamThumbnail);
router.get('/:slug/download', limit(60 * 1000, 20, 'Too many downloads. Please slow down.'), protect, downloadFile);
router.get('/:slug/related', attachUserIfPresent, relatedDocuments);
router.get('/:slug/code-example', attachUserIfPresent, getCodeExample);
router.post('/:slug/ai', protect, aiLimiter, askAboutDocument);
router.post('/:slug/bookmark', protect, writeLimiter, addBookmark);
router.delete('/:slug/bookmark', protect, writeLimiter, removeBookmark);
router.post('/:slug/report', protect, reportLimiter, reportDocument);
router.get('/:slug', attachUserIfPresent, getDocument);

export default router;
