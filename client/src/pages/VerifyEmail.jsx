import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import request from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyEmail() {
  const { token } = useParams();
  const { isAuthenticated, refreshUser } = useAuth();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const data = await request(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
        if (isAuthenticated) refreshUser().catch(() => {});
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'This verification link is invalid or has expired.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="auth-page">
      <div className="panel auth-card">
        <span className="eyebrow">Developer Learning Platform</span>
        <h1>{status === 'success' ? 'Email verified' : status === 'error' ? 'Verification failed' : 'Verifying…'}</h1>
        <p>{message}</p>
        <div className="actions">
          <Link className="btn primary" to={isAuthenticated ? '/profile' : '/login'}>
            {isAuthenticated ? 'Go to profile' : 'Back to login'}
          </Link>
        </div>
      </div>
    </section>
  );
}
