import multer from 'multer';

const storage = multer.memoryStorage();

const makeFileTypeError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const imageFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(makeFileTypeError('Only image files are allowed'));
};

const resumeFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') return cb(null, true);
  cb(makeFileTypeError('Only PDF resume files are allowed'));
};

export const uploadProjectImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 3 * 1024 * 1024 }
});

export const uploadNoteThumbnail = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 3 * 1024 * 1024 }
});

export const uploadResume = multer({
  storage,
  fileFilter: resumeFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});
