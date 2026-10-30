import { BookOpen, Code2, FileText, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authHeaders, thumbnailUrl } from '../../services/documentsApi.js';

// Thumbnail of a note. Public notes use a plain image URL (cacheable, no login). Anything not public
// (the uploader's pending notes, admin previews) is fetched with the sign-in header, because the API
// only serves it to the people allowed to see it.
export function Thumb({ doc, className = '' }) {
  const needsAuth = Boolean(doc.status && doc.status !== 'approved') || (doc.visibility && doc.visibility !== 'public');
  const [src, setSrc] = useState(doc.hasThumbnail && !needsAuth ? thumbnailUrl(doc.slug) : '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doc.hasThumbnail || !needsAuth) return undefined;
    let url;
    let cancelled = false;
    fetch(thumbnailUrl(doc.slug), { headers: authHeaders() })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('no thumbnail'))))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.slug, doc.hasThumbnail, needsAuth]);

  return (
    <div className={`nd-thumb ${className}`}>
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <FileText size={36} aria-hidden="true" />}
      {doc.pages ? <span className="nd-pages-badge">{doc.pages} {doc.pages === 1 ? 'page' : 'pages'}</span> : null}
    </div>
  );
}

const when = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

export default function DocumentCard({ doc }) {
  return (
    <Link to={`/notes/doc/${doc.slug}`} className="nd-card" aria-label={`Read ${doc.title}`}>
      <Thumb doc={doc} />
      <div className="nd-card-body">
        <div className="chips">
          <span className="nd-chip accent">{doc.subject}</span>
          {doc.hasCode && <span className="nd-chip"><Code2 size={12} aria-hidden="true" /> Code</span>}
          {doc.visibility && doc.visibility !== 'public' && <span className="nd-chip"><Lock size={12} aria-hidden="true" /> {doc.visibility}</span>}
        </div>
        <h3>{doc.title}</h3>
        <p>{doc.description}</p>
        {doc.tags?.length > 0 && <div className="chips">{doc.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <div className="nd-meta">
          <span>{doc.uploader}</span>
          <span>{when(doc.approvedAt || doc.createdAt)}</span>
          {doc.views > 0 && <span><BookOpen size={12} aria-hidden="true" /> {doc.views}</span>}
        </div>
      </div>
    </Link>
  );
}

export const CardSkeletons = ({ count = 8 }) => (
  <div className="nd-grid" aria-hidden="true">{Array.from({ length: count }, (_, i) => <div key={i} className="nd-skeleton" />)}</div>
);
