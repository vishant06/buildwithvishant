import dns from "dns";
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
import playgroundRoutes from './routes/playgroundRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';


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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }));



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
app.use('/api/playground', playgroundRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);


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
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
// console.log(process.env.MONGO_URI);
