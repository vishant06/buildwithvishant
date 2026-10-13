// Read-only audit of saved Playground projects. Safe to run on production.
//
//   node scripts/auditPlaygroundOwnership.js            report only
//   node scripts/auditPlaygroundOwnership.js --backup   also write playground-backup-<date>.json first
//
// It never modifies or deletes anything. The API only ever returns projects whose
// `owner` matches the signed-in account, so a project with no owner, or an owner
// that no longer exists, is already unreachable through the app (quarantined by
// construction). This script just tells you whether any such records exist.
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PlaygroundProject from '../src/models/PlaygroundProject.js';
import User from '../src/models/User.js';

dotenv.config();

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const projects = await PlaygroundProject.find({}).lean();

  if (process.argv.includes('--backup')) {
    const file = `playground-backup-${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(file, JSON.stringify(projects));
    console.log(`Backup written: ${file} (${projects.length} projects)`);
  }

  const ownerIds = [...new Set(projects.filter((p) => p.owner).map((p) => String(p.owner)))];
  const existing = new Set((await User.find({ _id: { $in: ownerIds } }).select('_id').lean()).map((u) => String(u._id)));
  const noOwner = projects.filter((p) => !p.owner);
  const orphaned = projects.filter((p) => p.owner && !existing.has(String(p.owner)));

  console.log(`Total projects:              ${projects.length}`);
  console.log(`Owned by an existing user:   ${projects.length - noOwner.length - orphaned.length}`);
  console.log(`No owner (unreachable):      ${noOwner.length}`);
  console.log(`Owner account missing:       ${orphaned.length}`);
  for (const p of [...noOwner, ...orphaned]) console.log(`  needs review: ${p._id} "${p.title}"`);
  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
