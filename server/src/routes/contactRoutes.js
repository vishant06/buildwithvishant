import express from 'express';
import { createMessage, getMessages } from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createMessage);
router.get('/messages', protect, getMessages);

export default router;
