import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function OAuthCallback() {
  const { completeOAuth } = useAuth();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    const rawUser = params.get('user');
    const providerError = params.get('error');
    if (providerError) { setError(providerError); return; }
    try {
      if (!token || !rawUser) throw new Error('Sign-in could not be completed. Please try again.');
      completeOAuth(token, JSON.parse(rawUser));
      window.history.replaceState({}, document.title, '/auth/callback');
      setDone(true);
    } catch (err) { setError(err.message); }
  }, [completeOAuth]);

  if (done) return <Navigate to="/" replace />;
  return <section className="auth-page"><div className="panel auth-card"><h1>{error ? 'Sign-in unsuccessful' : 'Completing sign-in…'}</h1><p>{error || 'Please wait while we securely sign you in.'}</p>{error && <a className="btn primary" href="/login">Back to login</a>}</div></section>;
}
