import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const NoteLink = ({ note }) => (
  <li>
    <Link to={`/notes/${note.slug}`} className="notes-related-link">
      <span className="notes-related-title">{note.title}</span>
      <span className="notes-related-meta">
        {note.category}
        {note.difficulty ? ` · ${note.difficulty}` : ''}
      </span>
    </Link>
  </li>
);

// Right column of the notes reader: previous/next navigation plus related and
// other notes. The note being read is never listed.
export default function RelatedNotesSidebar({ previous, next, related, other }) {
  const hasAnything = previous || next || related.length > 0 || other.length > 0;
  if (!hasAnything) return null;

  return (
    <aside className="notes-sidebar notes-aside" aria-label="More notes">
      {(previous || next) && (
        <nav className="notes-pager" aria-label="Previous and next note">
          {previous ? (
            <Link to={`/notes/${previous.slug}`} className="notes-pager-link">
              <span className="notes-pager-dir"><ArrowLeft size={13} aria-hidden="true" /> Previous</span>
              <span className="notes-pager-title">{previous.title}</span>
            </Link>
          ) : null}
          {next ? (
            <Link to={`/notes/${next.slug}`} className="notes-pager-link is-next">
              <span className="notes-pager-dir">Next <ArrowRight size={13} aria-hidden="true" /></span>
              <span className="notes-pager-title">{next.title}</span>
            </Link>
          ) : null}
        </nav>
      )}

      {related.length > 0 && (
        <section className="notes-aside-section">
          <h2>Related notes</h2>
          <ul>{related.map((note) => <NoteLink key={note.slug} note={note} />)}</ul>
        </section>
      )}

      {other.length > 0 && (
        <section className="notes-aside-section">
          <h2>Other notes</h2>
          <ul>{other.map((note) => <NoteLink key={note.slug} note={note} />)}</ul>
        </section>
      )}
    </aside>
  );
}
