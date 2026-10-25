// Privacy migration for saved Playground projects.
//
//   node scripts/migratePlaygroundVisibility.js            report only (dry run)
//   node scripts/migratePlaygroundVisibility.js --apply    apply it
//   node scripts/migratePlaygroundVisibility.js --apply --backup   also write playground-visibility-backup-<date>.json first
//
// What "apply" does is deliberately small: projects with no / invalid
// `visibility` become 'private', and stray public links are removed. It never
// makes a project public and never touches files, folders or owners. The server
// also runs the same (idempotent) migration at start-up, so running this by hand
// is optional.
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PlaygroundProject from '../src/models/PlaygroundProject.js';
import { applyVisibilityMigration, planVisibilityMigration } from '../src/migrations/playgroundVisibility.js';

dotenv.config();

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await PlaygroundProject.countDocuments({});
  const plan = await planVisibilityMigration(PlaygroundProject);
  console.log(`Projects:                                   ${total}`);
  console.log(`Missing / invalid visibility (-> private):  ${plan.missing}`);
  console.log(`Not public but carrying a public link:      ${plan.strayLinks}`);
  console.log(`Marked public without a link (-> private):  ${plan.publicNoSlug}`);

  if (!process.argv.includes('--apply')) {
    console.log('\nDry run: nothing was changed. Re-run with --apply to migrate.');
  } else {
    if (process.argv.includes('--backup')) {
      const file = `playground-visibility-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const rows = await PlaygroundProject.find({}).select('visibility publicSlug publishedAt').lean();
      fs.writeFileSync(file, JSON.stringify(rows));
      console.log(`Backup written: ${file}`);
    }
    console.log('\nApplied:', await applyVisibilityMigration(PlaygroundProject));
  }
  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
