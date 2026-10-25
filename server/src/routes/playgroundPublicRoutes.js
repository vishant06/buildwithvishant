import express from 'express';
import rateLimit from 'express-rate-limit';
import { attachUserIfPresent } from '../middleware/authMiddleware.js';
import { getPublic } from '../controllers/playgroundPublicController.js';

// Mounted at /api/playground/public BEFORE the private playground router (see
// server.js). It exposes exactly one read-only GET and nothing else: there is
// no write, execute or listing route here.
const router = express.Router();

router.use((_req, res, next) => {
    // Never cached by a browser, proxy or CDN: revoking access must be immediate.
    res.set({
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        Vary: 'Authorization, Origin',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer'
    });
    next();
});

router.get('/:slug', rateLimit({
    windowMs: 60000,
    limit: 60,
    message: {
        message: 'Too many requests. Please try again shortly.'
    }
}), attachUserIfPresent, getPublic);

export default router;
