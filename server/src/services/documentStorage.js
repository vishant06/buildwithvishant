import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import axios from 'axios';
import { documentConfig } from '../config/documents.js';

// Where document bytes live. Callers only ever see an opaque `{ storage, key }` reference and
// these four operations, so the driver can change without touching any controller:
//
//   put(buffer, { key, mime })  -> { storage, key }
//   open(ref, { start, end })   -> Readable   (byte range, inclusive; whole file if omitted)
//   remove(ref)                 -> void
//   listOlderThan(date)         -> [{ key }]  (only used to find orphans)
//
// Neither driver ever produces a public URL: every read goes through the API's access check.
//
//  * gridfs (default): MongoDB GridFS in the existing database. Files have no URL at all and
//    nothing to configure. Counts against the database's storage quota.
//  * cloudinary: uploads as `type: "authenticated"` raw assets (not publicly deliverable) and
//    streams them to the client through the API using a short-lived signed URL. Requires
//    Cloudinary to allow delivery of PDF files for your account (Settings > Security >
//    "PDF and ZIP files delivery"), and respects Cloudinary's per-file size cap for your plan.
const BUCKET = 'note_documents';
let bucket;
const gridfs = () => {
  if (!bucket) bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
  return bucket;
};

const gridfsDriver = {
  name: 'gridfs',
  async put(buffer, { key, mime }) {
    await new Promise((resolve, reject) => {
      const upload = gridfs().openUploadStream(key, { metadata: { mime } });
      upload.on('error', reject).on('finish', resolve);
      upload.end(buffer);
    });
    return { storage: 'gridfs', key };
  },
  async open(ref, range = {}) {
    const files = await gridfs().find({ filename: ref.key }).limit(1).toArray();
    if (!files.length) {
      const error = new Error('Stored file not found');
      error.status = 404;
      throw error;
    }
    const options = {};
    if (Number.isInteger(range.start)) options.start = range.start;
    if (Number.isInteger(range.end)) options.end = range.end + 1; // GridFS end is exclusive
    return gridfs().openDownloadStreamByName(ref.key, options);
  },
  async remove(ref) {
    const files = await gridfs().find({ filename: ref.key }).toArray();
    await Promise.all(files.map((file) => gridfs().delete(file._id).catch(() => null)));
  },
  async listOlderThan(date) {
    return (await gridfs().find({ uploadDate: { $lt: date } }).toArray()).map((file) => ({ key: file.filename }));
  }
};

const cloudinaryDriver = {
  name: 'cloudinary',
  async put(buffer, { key, mime }) {
    const { default: cloudinary } = await import('../config/cloudinary.js');
    const { default: streamifier } = await import('streamifier');
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ public_id: key, resource_type: 'raw', type: 'authenticated', overwrite: false, context: `mime=${mime}` }, (error, result) => (error ? reject(error) : resolve(result)));
      streamifier.createReadStream(buffer).pipe(stream);
    });
    return { storage: 'cloudinary', key };
  },
  async open(ref, range = {}) {
    const { default: cloudinary } = await import('../config/cloudinary.js');
    const url = cloudinary.url(ref.key, { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true });
    const headers = Number.isInteger(range.start) ? { Range: `bytes=${range.start}-${Number.isInteger(range.end) ? range.end : ''}` } : {};
    const response = await axios.get(url, { responseType: 'stream', headers, timeout: 20_000, maxRedirects: 2, validateStatus: (s) => s < 400 });
    return response.data;
  },
  async remove(ref) {
    const { default: cloudinary } = await import('../config/cloudinary.js');
    await cloudinary.uploader.destroy(ref.key, { resource_type: 'raw', type: 'authenticated', invalidate: true });
  },
  async listOlderThan() {
    return []; // orphan sweeping is only done for GridFS
  }
};

const drivers = { gridfs: gridfsDriver, cloudinary: cloudinaryDriver };
// `ref.storage` decides, so documents stored by an earlier driver keep working after a switch.
export const storageFor = (storage = documentConfig().storageDriver) => drivers[storage] || gridfsDriver;
export const activeStorageName = () => (drivers[documentConfig().storageDriver] ? documentConfig().storageDriver : 'gridfs');

export const toBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of Readable.from(stream)) chunks.push(chunk);
  return Buffer.concat(chunks);
};
