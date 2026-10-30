import NoteDocument from '../models/NoteDocument.js';
import { documentConfig } from '../config/documents.js';
import { purgeDocument } from '../controllers/documentAdminController.js';
import { storageFor } from './documentStorage.js';

// Housekeeping that runs on a timer: permanently deletes documents whose retention period ended,
// and deletes stored files that no document refers to (left behind by a crash mid-upload).
export const purgeExpired = async (now = Date.now()) => {
  const cutoff = new Date(now - documentConfig().retentionDays * 24 * 60 * 60 * 1000);
  const expired = await NoteDocument.find({ status: 'removed', removedAt: { $lt: cutoff } }).limit(50);
  for (const doc of expired) await purgeDocument(doc);
  return expired.length;
};

export const sweepOrphans = async (now = Date.now()) => {
  const driver = storageFor('gridfs');
  const files = await driver.listOlderThan(new Date(now - 24 * 60 * 60 * 1000)).catch(() => []);
  let removed = 0;
  for (const { key } of files) {
    const id = /^documents\/([a-f0-9]{24})\//.exec(key)?.[1];
    if (!id) continue;
    const doc = await NoteDocument.findOne({ _id: id }).select('file.key thumbnail.key');
    if (!doc || (doc.file?.key !== key && doc.thumbnail?.key !== key)) {
      await driver.remove({ storage: 'gridfs', key }).catch(() => null);
      removed += 1;
    }
  }
  return removed;
};

export const startMaintenance = () => {
  const run = () => purgeExpired().then((n) => n && console.log(`Documents: purged ${n} expired`)).then(sweepOrphans).then((n) => n && console.log(`Documents: removed ${n} orphaned files`)).catch((error) => console.error('Document maintenance failed:', error.message));
  setTimeout(run, 30_000).unref();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
};
