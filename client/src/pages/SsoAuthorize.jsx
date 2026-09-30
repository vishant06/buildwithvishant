import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  completeAuthorize,
  isAllowedTarget,
  rememberPostLoginRedirect,
  safeReturnPath,
} from '@shared/auth/sso.js';
import { originOf } from '@shared/config/urls.js';
import { useAuth } from '../context/AuthContext.jsx';

// Single sign-on hand-off page. Playground / AI send the browser here to get
// a one-time code for the user who is already signed in on the main site.
//   /sso/authorize?target=<app origin>&return=<path in that app>[&silent=1]
// `target` must be one of the allow-listed app origins and `return` a
// relative path, so this can never redirect somewhere arbitrary.
export default function SsoAuthorize() {
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const target = originOf(params.get('target') || '');
    const returnPath = safeReturnPath(params.get('return'));
    const silent = params.get('silent') === '1';

    if (!target || !isAllowedTarget(target)) {
      setError('This sign-in link is not valid.');
      return;
    }
    if (!isAuthenticated && !silent) {
      // Not signed in yet: log in first, then come straight back here.
      rememberPostLoginRedirect(`${target}${returnPath}`);
      navigate('/login', { replace: true });
      return;
    }
    completeAuthorize({ target, returnPath, silent }).catch(() => setError('Could not complete sign-in. Please try again.'));
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="auth-page">
      <div className="panel auth-card">
        <h1>{error ? 'Sign-in unsuccessful' : 'Signing you in…'}</h1>
        <p>{error || 'Taking you back to where you were.'}</p>
        {error && <a className="btn primary" href="/">Back to the site</a>}
      </div>
    </section>
  );
}
