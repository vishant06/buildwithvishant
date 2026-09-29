import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const NoteLinkList = ({ notes }) => (
  <ul className="note-rail-list">
    {notes.map((note) => (
      <li key={note._id || note.slug}>
        <Link to={`/notes/${note.slug}`}>
          <span className="note-rail-title">{note.title}</span>
          <span className="note-rail-meta">
            {[note.category, note.difficulty].filter(Boolean).join(' · ')}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

// Right column: previous/next, related notes and other notes. The current
// note is already excluded by getRailNotes().
export default function NoteRail({ prev, next, related, others, loading }) {
  if (loading) {
    return (
      <div className="note-rail" aria-hidden="true">
        <div className="note-topics-skeleton">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} style={{ width: `${92 - (index % 3) * 16}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="note-rail">
      {(prev || next) && (
        <nav className="note-rail-section" aria-label="Previous and next note">
          <h2>Continue reading</h2>
          <div className="note-rail-pager">
            {prev && (
              <Link to={`/notes/${prev.slug}`} rel="prev">
                <span className="note-rail-pager-label">
                  <ArrowLeft size={13} aria-hidden="true" /> Previous
                </span>
                <span className="note-rail-title">{prev.title}</span>
              </Link>
            )}
            {next && (
              <Link to={`/notes/${next.slug}`} rel="next">
                <span className="note-rail-pager-label">
                  Next <ArrowRight size={13} aria-hidden="true" />
                </span>
                <span className="note-rail-title">{next.title}</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {related.length > 0 && (
        <section className="note-rail-section" aria-labelledby="note-rail-related">
          <h2 id="note-rail-related">Related notes</h2>
          <NoteLinkList notes={related} />
        </section>
      )}

      {others.length > 0 && (
        <section className="note-rail-section" aria-labelledby="note-rail-others">
          <h2 id="note-rail-others">{related.length > 0 ? 'Other notes' : 'More notes'}</h2>
          <NoteLinkList notes={others} />
        </section>
      )}

      <Link className="note-rail-all" to="/notes">
        Browse all notes
      </Link>
    </div>
  );
}
