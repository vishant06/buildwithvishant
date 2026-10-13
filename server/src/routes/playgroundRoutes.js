import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    protect
} from '../middleware/authMiddleware.js';
import {
    create,
    getOne,
    mine,
    remove,
    update
} from '../controllers/playgroundController.js';
import {
    execute
} from '../controllers/executionController.js';
const router = express.Router();
// Saved code and run output are per-account: never let a browser, proxy or CDN
// store them, and never serve one visitor's response to another.
router.use((_req, res, next) => {
    res.set({
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        Vary: 'Authorization, Origin'
    });
    next();
});
router.post('/execute', rateLimit({
    windowMs: 60000,
    limit: 10,
    message: {
        message: 'Too many execution requests. Please try again shortly.'
    }
}), execute);
router.use(protect);
router.get('/my', mine);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
export default router;