import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    protect
} from '../middleware/authMiddleware.js';
import {
    create,
    mine,
    remove,
    update
} from '../controllers/playgroundController.js';
import {
    execute
} from '../controllers/executionController.js';
const router = express.Router();
router.post('/execute', rateLimit({
    windowMs: 60000,
    limit: 10,
    message: {
        message: 'Too many execution requests. Please try again shortly.'
    }
}), execute);
router.use(protect);
router.get('/my', mine);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
export default router;