import express from 'express';
import rateLimit from 'express-rate-limit';
import { search } from '../controllers/searchController.js';

const router = express.Router();

// The palette is debounced client-side; this is a backstop against abuse.
router.get('/', rateLimit({ windowMs: 60_000, limit: 90, message: { message: 'Too many searches. Please slow down.' } }), search);

export default router;
