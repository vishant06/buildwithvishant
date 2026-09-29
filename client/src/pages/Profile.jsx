import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { absoluteAsset } from '../services/api.js';

export default function Profile() {
  const { user, resendVerification } = useAuth();
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const sendVerification = async () => {
    setSending(true); setStatus('');
    try {
      const data = await resendVerification();
      setStatus(data.message || 'Verification email sent.');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="profile-page">
      <div className="section-header">
        <span>Your account</span>
        <h1>Profile</h1>
        <p>Manage your learning workspace and saved browser playgrounds.</p>
      </div>

      <div className="panel profile-card-view">
        {user?.avatar?.url ? (
          <img
            src={absoluteAsset(user.avatar.url)}
            alt=""
            className="profile-avatar"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="profile-avatar">{user?.name?.slice(0, 1).toUpperCase()}</div>
        )}
        <div>
          <h2>{user?.name}</h2>
          <p>@{user?.username}</p>
          <p>{user?.email}</p>
          <span className="badge">{user?.role}</span>{' '}
          <span className={`badge ${user?.isEmailVerified ? 'verified' : 'pending'}`}>
            {user?.isEmailVerified ? 'Email verified' : 'Email not verified'}
          </span>
        </div>
      </div>

      {!user?.isEmailVerified && (
        <div className="panel" style={{ marginTop: 16 }}>
          <p>Verify your email address to keep your account secure.</p>
          <div className="actions">
            <button className="btn primary" onClick={sendVerification} disabled={sending}>
              {sending ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
          {status && <p className="notice">{status}</p>}
        </div>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn primary" to="/playground">My Playground</Link>
        <Link className="btn ghost" to="/notes">Explore Notes</Link>
      </div>
    </section>
  );
}
