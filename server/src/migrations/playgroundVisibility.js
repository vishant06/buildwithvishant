// Idempotent, non-destructive migration for the privacy feature.
//
//  1. Any project whose `visibility` is missing, null or not exactly
//     'private' / 'public' becomes 'private'.
//  2. A project that is not public must not carry a public link: its
//     `publicSlug` / `publishedAt` are removed.
//  3. A project marked public without a slug (corrupt) is made private.
//
// It never touches files, folders, owners or any other field, and it never
// makes anything public. Safe to run on every server start and from the CLI.
export const planVisibilityMigration = async (Model) => {
  const [missing, strayLinks, publicNoSlug] = await Promise.all([
    Model.countDocuments({ visibility: { $nin: ['private', 'public'] } }),
    Model.countDocuments({ visibility: { $ne: 'public' }, $or: [{ publicSlug: { $exists: true } }, { publishedAt: { $exists: true } }] }),
    Model.countDocuments({ visibility: 'public', $or: [{ publicSlug: { $exists: false } }, { publicSlug: null }, { publicSlug: '' }] })
  ]);
  return { missing, strayLinks, publicNoSlug };
};

export const applyVisibilityMigration = async (Model) => {
  // Order matters: step 1 first so step 2 sees the corrected value.
  const fixedMissing = await Model.updateMany({ visibility: { $nin: ['private', 'public'] } }, { $set: { visibility: 'private' } });
  const fixedPublic = await Model.updateMany(
    { visibility: 'public', $or: [{ publicSlug: { $exists: false } }, { publicSlug: null }, { publicSlug: '' }] },
    { $set: { visibility: 'private' } }
  );
  const fixedLinks = await Model.updateMany(
    { visibility: { $ne: 'public' }, $or: [{ publicSlug: { $exists: true } }, { publishedAt: { $exists: true } }] },
    { $unset: { publicSlug: '', publishedAt: '' } }
  );
  return {
    madePrivate: (fixedMissing.modifiedCount || 0) + (fixedPublic.modifiedCount || 0),
    linksRemoved: fixedLinks.modifiedCount || 0
  };
};
