import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DownloadPdfButton from '../components/DownloadPdfButton.jsx';
import NoteRenderer from '../components/notes/NoteRenderer.jsx';
import request from '../services/api.js';
import '../styles/notes-blocks.css';

export default function NoteDetail() {
  const { slug } = useParams();
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    request(`/notes/${slug}`)
      .then((data) => {
        if (!active) return;
        setNote(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'This note could not be found.');
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // Per-page SEO. Restores the site defaults set in index.html on unmount so
  // navigating to another page doesn't carry a stale title/description.
  useEffect(() => {
    if (!note) return undefined;
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute('content');
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalTag?.getAttribute('href');

    document.title = `${note.title} | BuildWithVishant Notes`;
    if (descriptionTag) descriptionTag.setAttribute('content', note.description);
    if (canonicalTag) canonicalTag.setAttribute('href', `${window.location.origin}/notes/${note.slug}`);

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== undefined) descriptionTag.setAttribute('content', previousDescription);
      if (canonicalTag && previousCanonical !== undefined) canonicalTag.setAttribute('href', previousCanonical);
    };
  }, [note]);

  if (status === 'loading') {
    return <p className="notice">Loading note...</p>;
  }

  if (status === 'error') {
    return (
      <div className="panel empty-state">
        <p className="notice error">{error}</p>
        <Link className="btn primary" to="/notes">
          Back to Notes
        </Link>
      </div>
    );
  }

  return (
    <article className="note-reader panel">
      <span className="eyebrow">
        {note.category} · {note.difficulty}
      </span>
      <h1>{note.title}</h1>
      <p className="lead">{note.description}</p>
      <div className="note-card-meta">
        {note.author?.name && <span>{note.author.name}</span>}
        {note.createdAt && <span>{new Date(note.createdAt).toLocaleDateString()}</span>}
      </div>
      {note.tags?.length > 0 && (
        <div className="chips">
          {note.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}

      <div className="note-reader-actions">
        <DownloadPdfButton slug={note.slug} />
      </div>

      <div className="note-reader-body">
        <NoteRenderer note={note} />
      </div>
    </article>
  );
}
