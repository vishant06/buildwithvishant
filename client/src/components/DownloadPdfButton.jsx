import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadNotePdf } from '../services/api.js';

// Download PDF button for a note. Frontend auth state only decides whether
// to show the login prompt immediately; the actual download always goes
// through the backend, which is the final authority (a 401 response is
// treated the same as "not logged in" even if local state said otherwise).
const DownloadPdfButton = ({ slug, className = 'btn secondary' }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleClick = async (event) => {
    event.preventDefault();
    if (state === 'loading') return; // prevent duplicate clicks

    if (!isAuthenticated) {
      setShowLogin(true);
      setError('');
      return;
    }

    setState('loading');
    setError('');
    setShowLogin(false);

    try {
      const { blob, filename } = await downloadNotePdf(slug);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED') {
        setShowLogin(true);
        setState('idle');
        return;
      }
      setError(err.message || 'Could not generate the PDF. Please try again.');
      setState('error');
    }
  };

  return (
    <div className="pdf-download">
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={state === 'loading'}
        aria-busy={state === 'loading'}
      >
        {state === 'loading' ? (
          <>
            <Loader2 size={16} className="spin" aria-hidden="true" /> Preparing PDF...
          </>
        ) : (
          <>
            <Download size={16} aria-hidden="true" /> Download PDF
          </>
        )}
      </button>

      {showLogin && (
        <p className="pdf-download-notice">
          Login to download notes as PDF.
          <Link className="btn primary" to="/login">
            Login
          </Link>
        </p>
      )}

      {state === 'error' && error && <p className="notice error pdf-download-error">{error}</p>}
    </div>
  );
};

export default DownloadPdfButton;
