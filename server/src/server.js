import dns from "dns";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import connectDB from './config/db.js';
import User from './models/User.js';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import { startMaintenance } from './services/documentMaintenance.js';
import playgroundRoutes from './routes/playgroundRoutes.js';
import playgroundPublicRoutes from './routes/playgroundPublicRoutes.js';
import PlaygroundProject from './models/PlaygroundProject.js';
import { applyVisibilityMigration } from './migrations/playgroundVisibility.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import { allowedOrigins, isAllowedOrigin } from './config/allowedOrigins.js';


dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

const app = express();

app.set("trust proxy", 1);

connectDB();

// One-time, non-destructive backfill: existing Google/GitHub accounts already
// passed their provider's verified-email check before email verification
// existed here, so they should never be treated as "unverified". Safe to run
// on every boot — it only ever sets the flag to true, and only for accounts
// that already have a linked OAuth provider.
User.updateMany(
  { 'providers.0': { $exists: true }, isEmailVerified: { $ne: true } },
  { $set: { isEmailVerified: true } }
).catch((error) => console.error('OAuth email-verification backfill failed:', error));

// Privacy migration (idempotent, non-destructive): every saved Playground project
// without a valid `visibility` becomes 'private', and stray public links are
// removed. It never makes anything public and never touches files or owners.
// Waits for the database connection before running.
mongoose.connection.once('open', () => {
  startMaintenance();
  applyVisibilityMigration(PlaygroundProject)
    .then((result) => {
      if (result.madePrivate || result.linksRemoved) console.log('Playground privacy migration:', result);
    })
    .catch((error) => console.error('Playground privacy migration failed:', error));
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Explicit allowlist (main site, Playground, AI, localhost in development).
// Requests with no Origin header (mobile app, curl, server-to-server) are
// not browser cross-origin requests and are let through as before.
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
  credentials: true,
  // The PDF viewer reads PDFs in byte ranges and needs to see these response headers.
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition']
}));
// Saving a project can carry up to ~10 MB of source (see LIMITS in workspaceCore.js). Only signed-in
// requests to the project routes get the larger body limit; running code (/execute), the public view and
// every other route keep the 1 MB limit, and anonymous requests never get the larger one.
const largeJson = express.json({ limit: '12mb' });
app.use('/api/playground', (req, res, next) => {
  const signedIn = (req.headers.authorization || '').startsWith('Bearer ');
  if (signedIn && !req.path.startsWith('/execute') && !req.path.startsWith('/public')) return largeJson(req, res, next);
  return next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
// PDF bytes and thumbnails have their own, larger limit (see routes/documentRoutes.js): opening one
// document is many small range requests, which would otherwise exhaust this general limit.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, skip: (req) => /^\/api\/documents\/[a-z0-9-]+\/(file|thumbnail)$/.test(req.path) }));



app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Vishant Kumar Portfolio API' });
});

// Lightweight endpoint for uptime monitors (e.g. UptimeRobot) to ping,
// so the free Render instance doesn't spin down from inactivity.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'awake' });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/documents', documentRoutes);
// Public, read-only project view first (own router, no login, no write routes).
app.use('/api/playground/public', playgroundPublicRoutes);
app.use('/api/playground', playgroundRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes);


app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : err.message;
    return res.status(400).json({ message });
  }

  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  console.log(`CORS allowlist: ${[...allowedOrigins].join(', ')}`);
});
// console.log(process.env.MONGO_URI);
