import PlaygroundProject from '../models/PlaygroundProject.js';
import { isValidSlug, serializePublicProject } from '../utils/publicProject.js';

// Read-only public view of a project that its owner has published.
//
//   GET /api/playground/public/:slug      (no login needed)
//
// Authorization is decided here, in the database query, on EVERY request:
// the project must carry this exact slug AND have visibility === 'public'.
// There is no cache and no per-visitor permission to go stale, so the moment an
// owner switches a project back to private the next request gets a 404.
// "No such link", "deleted" and "private now" all return the same 404, so the
// response never reveals whether a private project exists.
const UNAVAILABLE = { message: 'This project is private or no longer available.' };

export const getPublic = async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!isValidSlug(slug)) return res.status(404).json(UNAVAILABLE);
    const project = await PlaygroundProject.findOne({ publicSlug: slug, visibility: 'public' });
    if (!project) return res.status(404).json(UNAVAILABLE);
    return res.json(serializePublicProject(project, { viewerId: req.user?._id }));
  } catch (error) {
    console.error('Public playground error:', error);
    return res.status(500).json({ message: 'Something went wrong while loading this project.' });
  }
};
