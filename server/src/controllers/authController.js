import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { uploadUserAvatar } from '../services/cloudinaryService.js';
import { sendVerificationEmail } from '../services/emailService.js';

const signToken = (id) =>
  jwt.sign({
    id
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  avatar: user.avatar && user.avatar.url ? user.avatar : null,
  isEmailVerified: Boolean(user.isEmailVerified)
});

const createVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const minutes = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 60);
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  return { rawToken, tokenHash, expires };
};
const cookieOptions = () => `HttpOnly; SameSite=Lax; Path=/; Max-Age=600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const readCookie = (req, name) => Object.fromEntries((req.headers.cookie || '').split(';').map((item) => item.trim().split('=')))[name];

const oauthConfig = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile'
  },
  github: {
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email'
  }
};

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const callbackUrl = (provider) => `${(process.env.SERVER_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/auth/${provider}/callback`;

// The mobile app can't receive a redirect to a website URL, so it starts
// the flow with `?platform=mobile`. That preference travels alongside the
// existing CSRF `oauth_state` cookie (same lifetime/flags) so the callback
// — which only ever gets `code`/`state` back from Google/GitHub — knows
// where to send the user afterwards. Nothing about the website flow
// changes when this cookie is absent.
const mobileScheme = () => (process.env.MOBILE_APP_SCHEME || 'buildwithvishant').replace(/:\/*$/, '');
const isMobileFlow = (req) => readCookie(req, 'oauth_target') === 'mobile';
const targetBase = (req) => (isMobileFlow(req) ? `${mobileScheme()}://auth/callback` : `${clientUrl()}/auth/callback`);
const redirectWithError = (req, res, message) => {
  console.log(
    "[OAuth ERROR] Redirect:",
    targetBase(req),
    "| Error:",
    message
  );

  res.redirect(
    `${targetBase(req)}#error=${encodeURIComponent(message)}`
  );
};
const redirectWithSession = (req, res, user) => {
  const params = new URLSearchParams({
    token: signToken(user._id),
    user: JSON.stringify(publicUser(user))
  });

  const redirectUrl = `${targetBase(req)}#${params.toString()}`;

  console.log(
    "[OAuth SUCCESS] Redirect:",
    redirectUrl.split("#")[0],
    "| User:",
    user.email
  );

  res.redirect(redirectUrl);
};

const generateUsername = async (base) => {
  const normalized = (base || 'developer').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'developer';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${normalized.slice(0, 14)}${crypto.randomBytes(3).toString('hex')}`;
    if (!(await User.exists({
        username: candidate
      }))) return candidate;
  }
  throw new Error('Unable to create a unique username');
};

const getProviderProfile = async (provider, accessToken) => {
  if (provider === 'google') {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const profile = await response.json();
    if (!response.ok || !profile.sub || !profile.email || !profile.email_verified) throw new Error('Google did not provide a verified email address');
    return {
      id: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      username: profile.email.split('@')[0],
      avatarUrl: profile.picture || null
    };
  }

  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'developer-learning-platform'
    }
  });
  const profile = await response.json();
  if (!response.ok || !profile.id) throw new Error('Unable to read your GitHub profile');
  const emailResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'developer-learning-platform'
    }
  });
  const emails = await emailResponse.json();
  const email = Array.isArray(emails) && emails.find((item) => item.primary && item.verified) || (Array.isArray(emails) && emails.find((item) => item.verified));
  if (!email?.email) throw new Error('GitHub must provide a verified email address to create an account');
  return {
    id: String(profile.id),
    email: email.email.toLowerCase(),
    name: profile.name || profile.login || email.email.split('@')[0],
    username: profile.login || email.email.split('@')[0],
    avatarUrl: profile.avatar_url || null
  };
};

export const login = async (req, res) => {
  const {
    email,
    password,
    loginAs = 'user'
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required'
    });
  }

  const user = await User.findOne({
    email
  });
  if (!user || !user.password || !(await user.matchPassword(password))) {
    return res.status(401).json({
      message: 'Invalid email or password'
    });
  }
  if (loginAs === 'admin' && user.role !== 'admin') return res.status(403).json({
    message: 'This account does not have administrator access'
  });

  res.json({
    token: signToken(user._id),
    user: publicUser(user)
  });
};

export const signup = async (req, res) => {
  const {
    name,
    username,
    email,
    password
  } = req.body;
  if (!name || !username || !email || !password) return res.status(400).json({
    message: 'Name, username, email and password are required'
  });
  if (password.length < 8) return res.status(400).json({
    message: 'Password must be at least 8 characters'
  });
  if (!req.file) return res.status(400).json({
    message: 'A profile photo is required'
  });
  const exists = await User.findOne({
    $or: [{
      email: email.toLowerCase()
    }, {
      username: username.toLowerCase()
    }]
  });
  if (exists) return res.status(409).json({
    message: 'An account with that email or username already exists'
  });

  let avatar;
  try {
    const uploaded = await uploadUserAvatar(req.file);
    avatar = {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      provider: 'upload'
    };
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to upload profile photo'
    });
  }

  const { rawToken, tokenHash, expires } = createVerificationToken();

  const user = await User.create({
    name,
    username,
    email,
    password,
    avatar,
    isEmailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: expires,
    emailVerificationLastSentAt: new Date()
  });

  sendVerificationEmail(user, rawToken).catch((error) => console.error('Failed to send verification email:', error));

  res.status(201).json({
    token: signToken(user._id),
    user: publicUser(user)
  });
};

export const verifyEmail = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({
    message: 'Verification token is required'
  });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() }
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) return res.status(400).json({
    message: 'This verification link is invalid or has expired. Please request a new one.'
  });

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({
    message: 'Your email has been verified. You can now use your account.'
  });
};

export const resendVerification = async (req, res) => {
  const user = await User.findById(req.user._id).select('+emailVerificationTokenHash +emailVerificationExpires +emailVerificationLastSentAt');
  if (!user) return res.status(404).json({
    message: 'User account not found'
  });
  if (user.isEmailVerified) return res.status(400).json({
    message: 'This email address is already verified.'
  });

  const rateLimitMinutes = Number(process.env.EMAIL_VERIFICATION_RATE_LIMIT_MINUTES || 2);
  if (user.emailVerificationLastSentAt && Date.now() - user.emailVerificationLastSentAt.getTime() < rateLimitMinutes * 60 * 1000) {
    return res.status(429).json({
      message: `Please wait a couple of minutes before requesting another verification email.`
    });
  }

  const { rawToken, tokenHash, expires } = createVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = expires;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  await sendVerificationEmail(user, rawToken).catch((error) => {
    console.error('Failed to send verification email:', error);
    throw Object.assign(new Error('Could not send the verification email right now. Please try again shortly.'), { status: 502 });
  });

  res.json({
    message: 'Verification email sent. Please check your inbox.'
  });
};

export const startOAuth = (req, res) => {
  const {
    provider
  } = req.params;
  const config = oauthConfig[provider];
  if (!config) return res.status(404).json({
    message: 'Unknown sign-in provider'
  });
  if (!config.clientId() || !config.clientSecret()) return res.status(503).json({
    message: `${provider === 'google' ? 'Google' : 'GitHub'} sign-in is not configured yet`
  });
  const state = crypto.randomBytes(32).toString('hex');
  const cookies = [`oauth_state=${state}; ${cookieOptions()}`];
  // Only ever set to the literal 'mobile' — never trusted for anything
  // beyond picking which of two fixed redirect targets to use.
  if (req.query.platform === 'mobile') cookies.push(`oauth_target=mobile; ${cookieOptions()}`);
  res.setHeader('Set-Cookie', cookies);
  const params = new URLSearchParams({
    client_id: config.clientId(),
    redirect_uri: callbackUrl(provider),
    response_type: 'code',
    scope: config.scope,
    state
  });
  res.redirect(`${config.authorizationUrl}?${params.toString()}`);
};

export const oauthCallback = async (req, res, next) => {
  const {
    provider
  } = req.params;
  const config = oauthConfig[provider];
  if (!config) return redirectWithError(req, res, 'Unknown sign-in provider');
  try {
    const expectedState = readCookie(req, 'oauth_state');
    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      'oauth_target=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
    ]);
    if (!req.query.code || !expectedState || !req.query.state || !crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(req.query.state))) return redirectWithError(req, res, 'Your sign-in session expired. Please try again.');
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: config.clientId(),
        client_secret: config.clientSecret(),
        redirect_uri: callbackUrl(provider),
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('The provider could not complete sign-in');
    const profile = await getProviderProfile(provider, tokenData.access_token);

    // The avatar is only refreshed from the provider when the user doesn't
    // already have one, or when the existing one also came from this same
    // provider — a deliberately uploaded photo is never overwritten.
    const applyProviderAvatar = (user) => {
      if (!profile.avatarUrl) return false;
      const hasOwnUpload = user.avatar?.provider === 'upload' && user.avatar?.url;
      if (hasOwnUpload || user.avatar?.url === profile.avatarUrl) return false;
      if (user.avatar?.provider && user.avatar.provider !== provider && user.avatar?.url) return false;
      user.avatar = { url: profile.avatarUrl, publicId: '', provider };
      return true;
    };

    let user = await User.findOne({
      providers: {
        $elemMatch: {
          provider,
          providerId: profile.id
        }
      }
    });
    if (!user) {
      user = await User.findOne({
        email: profile.email
      });
      if (user) {
        user.providers.push({
          provider,
          providerId: profile.id
        });
        // The provider has already verified this email address matches the
        // existing account, so we can trust it going forward.
        if (!user.isEmailVerified) user.isEmailVerified = true;
        applyProviderAvatar(user);
        await user.save();
      } else {
        user = await User.create({
          name: profile.name,
          username: await generateUsername(profile.username),
          email: profile.email,
          isEmailVerified: true,
          avatar: profile.avatarUrl ? { url: profile.avatarUrl, publicId: '', provider } : undefined,
          providers: [{
            provider,
            providerId: profile.id
          }]
        });
      }
    } else if (applyProviderAvatar(user)) {
      await user.save();
    }
    redirectWithSession(req, res, user);
  } catch (error) {
    if (error.message) return redirectWithError(req, res, error.message);
    next(error);
  }
};

export const me = async (req, res) => {
  res.json({
    user: publicUser(req.user)
  });
};