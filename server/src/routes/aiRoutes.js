import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/authMiddleware.js';
import {
  chat,
  deleteConversation,
  getConversation,
  listConversations,
  saveConversation,
  updateConversation,
} from '../controllers/aiController.js';

const router = express.Router();

router.post('/chat', protect, rateLimit({ windowMs: 60_000, limit: 15, message: { message: 'Too many AI requests. Please try again shortly.' } }), chat);

// Saved conversations — all scoped to the authenticated user.
router.get('/conversations', protect, listConversations);
router.get('/conversations/:id', protect, getConversation);
router.post('/conversations', protect, saveConversation);
router.put('/conversations/:id', protect, updateConversation);
router.delete('/conversations/:id', protect, deleteConversation);

export default router;
