import express from 'express';
import { getLatestResume, uploadLatestResume } from '../controllers/resumeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadResume } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/latest', getLatestResume);
router.post('/upload', protect, uploadResume.single('resume'), uploadLatestResume);

export default router;
