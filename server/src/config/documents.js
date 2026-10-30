// Community PDF notes: every tunable limit in one place, read from the environment
// at call time (so tests and deployments can change them without code edits).
const int = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export const documentConfig = () => ({
  storageDriver: (process.env.DOCUMENT_STORAGE || 'gridfs').toLowerCase(), // 'gridfs' | 'cloudinary'
  maxFileBytes: int(process.env.DOC_MAX_FILE_MB, 15, { max: 100 }) * 1024 * 1024,
  maxPages: int(process.env.DOC_MAX_PAGES, 400, { max: 5000 }),
  maxTextChars: int(process.env.DOC_MAX_TEXT_CHARS, 600_000),
  maxThumbnailBytes: 400 * 1024,
  maxPendingPerUser: int(process.env.DOC_MAX_PENDING_PER_USER, 5),
  maxUploadsPerDay: int(process.env.DOC_MAX_UPLOADS_PER_DAY, 10),
  maxStoragePerUserBytes: int(process.env.DOC_USER_STORAGE_MB, 150) * 1024 * 1024,
  retentionDays: int(process.env.DOC_RETENTION_DAYS, 30),
  aiDailyQuota: int(process.env.DOC_AI_DAILY_QUOTA, 30),
  maxCodeChars: 20_000,
  requireVerifiedEmail: process.env.DOC_REQUIRE_VERIFIED_EMAIL !== 'false'
});

// Seeded into the category list the first time an administrator opens it (they can then
// add, rename or remove categories). Uploaders choose from the stored list.
export const DEFAULT_CATEGORIES = [
  'Data Structures & Algorithms', 'Programming Languages', 'Web Development', 'Databases', 'Operating Systems',
  'Computer Networks', 'Software Engineering', 'Mathematics', 'Machine Learning & AI', 'Interview Preparation', 'Other'
];

export const REPORT_REASONS = ['copyright', 'inappropriate', 'spam', 'wrong_information', 'other'];
export const VISIBILITIES = ['public', 'unlisted', 'private'];
export const STATUSES = ['pending', 'approved', 'rejected', 'removed'];
