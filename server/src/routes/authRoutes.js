import express from 'express';
import { login, me, oauthCallback, resendVerification, signup, startOAuth, verifyEmail } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadAvatar } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/signup', uploadAvatar.single('avatar'), signup);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, resendVerification);
router.get('/me', protect, me);
router.get('/:provider', startOAuth);
router.get('/:provider/callback', oauthCallback);

export default router;
