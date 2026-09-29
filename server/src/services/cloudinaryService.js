import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

const PROJECTS_FOLDER = 'portfolio/projects';
const RESUMES_FOLDER = 'portfolio/resumes';
const USERS_FOLDER = 'portfolio/users';
const NOTES_FOLDER = 'portfolio/notes';

const assertCloudinaryConfigured = () => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    const error = new Error(`Missing Cloudinary environment variables: ${missing.join(', ')}`);
    error.status = 500;
    throw error;
  }
};

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    assertCloudinaryConfigured();

    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

export const uploadProjectImage = async (file) => {
  if (!file?.buffer) {
    const error = new Error('Project image file is required');
    error.status = 400;
    throw error;
  }

  return uploadBuffer(file.buffer, {
    folder: PROJECTS_FOLDER,
    resource_type: 'image'
  });
};

export const uploadUserAvatar = async (file) => {
  if (!file?.buffer) {
    const error = new Error('Profile photo is required');
    error.status = 400;
    throw error;
  }

  return uploadBuffer(file.buffer, {
    folder: USERS_FOLDER,
    resource_type: 'image'
  });
};

export const uploadNoteThumbnail = async (file) => {
  if (!file?.buffer) {
    const error = new Error('Thumbnail image file is required');
    error.status = 400;
    throw error;
  }

  return uploadBuffer(file.buffer, {
    folder: NOTES_FOLDER,
    resource_type: 'image'
  });
};

export const uploadResumePdf = async (file) => {
  if (!file?.buffer) {
    const error = new Error('Resume file is required');
    error.status = 400;
    throw error;
  }

  return uploadBuffer(file.buffer, {
    folder: RESUMES_FOLDER,
    resource_type: 'raw',
    use_filename: true,
    unique_filename: true
  });
};

const getPublicIdFromCloudinaryUrl = (assetUrl) => {
  if (!assetUrl || !assetUrl.startsWith('http')) return null;

  try {
    const { hostname, pathname } = new URL(assetUrl);
    if (!hostname.includes('cloudinary.com')) return null;

    const uploadIndex = pathname.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    const afterUpload = pathname.slice(uploadIndex + '/upload/'.length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const decodedPath = decodeURIComponent(withoutVersion);
    const extensionIndex = decodedPath.lastIndexOf('.');

    return extensionIndex === -1 ? decodedPath : decodedPath.slice(0, extensionIndex);
  } catch {
    return null;
  }
};

export const deleteCloudinaryAsset = async (assetUrl, resourceType = 'image') => {
  const publicId = getPublicIdFromCloudinaryUrl(assetUrl);
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
