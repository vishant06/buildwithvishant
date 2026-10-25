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
    setVisibility,
    shared,
    update
} from '../controllers/playgroundController.js';
import {
    addMember,
    leaveProject,
    listMembers,
    removeMember,
    setMemberRole
} from '../controllers/playgroundMembersController.js';
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
router.get('/shared', shared);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/visibility', rateLimit({
    windowMs: 60000,
    limit: 30,
    message: {
        message: 'Too many privacy changes. Please try again shortly.'
    }
}), setVisibility);
const peopleLimit = rateLimit({
    windowMs: 60000,
    limit: 30,
    message: {
        message: 'Too many sharing changes. Please try again shortly.'
    }
});
router.get('/:id/members', listMembers);
router.post('/:id/members', peopleLimit, addMember);
router.patch('/:id/members/:userId', peopleLimit, setMemberRole);
router.delete('/:id/members/me', leaveProject);
router.delete('/:id/members/:userId', peopleLimit, removeMember);
router.delete('/:id', remove);
export default router;