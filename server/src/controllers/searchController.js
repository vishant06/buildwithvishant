import Note from '../models/Note.js';
import Project from '../models/Project.js';

const MAX_QUERY_LENGTH = 80;
const RESULT_LIMIT = 6;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lower is better: exact title, title prefix, title contains, everything else.
const rank = (title, needle) => {
  const value = String(title || '').toLowerCase();
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  if (value.includes(needle)) return 2;
  return 3;
};

const sortByRelevance = (items, needle) =>
  items
    .map((item) => ({ item, score: rank(item.title, needle) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, RESULT_LIMIT)
    .map(({ item }) => item);

// GET /api/search?q=...  ->  { notes: [], projects: [] }
// Public, read-only: notes are limited to published ones and only list-safe
// fields are returned (never note bodies). The query is escaped, so user
// input is always treated as literal text and never as a regular expression.
export const search = async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return res.json({ notes: [], projects: [] });

  const needle = query.toLowerCase();
  const pattern = new RegExp(escapeRegex(query), 'i');

  try {
    const [notes, projects] = await Promise.all([
      Note.find({
        published: true,
        $or: [
          { title: pattern },
          { slug: pattern },
          { description: pattern },
          { category: pattern },
          { tags: pattern },
          // Topics: headings inside the note body.
          { blocks: { $elemMatch: { type: 'heading', content: pattern } } }
        ]
      })
        .select('title slug description category tags difficulty')
        .limit(30)
        .lean(),
      Project.find({
        $or: [{ title: pattern }, { description: pattern }, { technologies: pattern }]
      })
        .select('title description technologies featured')
        .limit(30)
        .lean()
    ]);

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      notes: sortByRelevance(notes, needle).map((note) => ({
        id: String(note._id),
        title: note.title,
        slug: note.slug,
        description: note.description,
        category: note.category,
        tags: note.tags || [],
        difficulty: note.difficulty
      })),
      projects: sortByRelevance(projects, needle).map((project) => ({
        id: String(project._id),
        title: project.title,
        description: project.description,
        technologies: project.technologies || [],
        featured: Boolean(project.featured)
      }))
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ message: 'Search is unavailable right now' });
  }
};
