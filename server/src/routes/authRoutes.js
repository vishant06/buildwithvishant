import express from 'express';
import rateLimit from 'express-rate-limit';
import { exchangeSsoCode, issueSsoCode, login, me, oauthCallback, resendVerification, signup, startOAuth, verifyEmail } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadAvatar } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/signup', uploadAvatar.single('avatar'), signup);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, resendVerification);
router.get('/me', protect, me);
// Cross-app single sign-on — registered before the '/:provider' OAuth routes.
const ssoLimiter = rateLimit({ windowMs: 60_000, limit: 30, message: { message: 'Too many sign-in attempts. Please try again shortly.' } });
router.post('/sso/code', ssoLimiter, protect, issueSsoCode);
router.post('/sso/exchange', ssoLimiter, exchangeSsoCode);
router.get('/:provider', startOAuth);
router.get('/:provider/callback', oauthCallback);

export default router;
