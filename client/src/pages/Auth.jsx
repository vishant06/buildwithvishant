import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

export default function Auth({ signup = false }) {
  const { login, signup: createAccount, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '', loginAs: 'user', avatar: null });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const previewUrlRef = useRef('');

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  if (isAuthenticated && !signedUp) return <Navigate to="/" replace />;

  const updateAvatar = (event) => {
    const file = event.target.files?.[0] || null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (file) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setAvatarPreview(url);
    } else {
      previewUrlRef.current = '';
      setAvatarPreview('');
    }
    setForm({ ...form, avatar: file });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (signup && form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (signup && !form.avatar) return setError('Please upload a profile photo');
    setLoading(true); setError('');
    try {
      if (signup) {
        await createAccount(form);
        setSignedUp(true);
      } else {
        await login(form.email, form.password, form.loginAs);
        navigate('/');
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const continueWith = (provider) => { window.location.assign(`${SERVER_URL}/api/auth/${provider}`); };

  if (signedUp) {
    return (
      <section className="auth-page">
        <div className="panel auth-card">
          <span className="eyebrow">Developer Learning Platform</span>
          <h1>Check your inbox</h1>
          <p>
            Your account has been created and you&rsquo;re signed in. We&rsquo;ve sent a verification
            link to <strong>{form.email}</strong> — verifying it helps keep your account secure.
          </p>
          <div className="actions">
            <button className="btn primary" onClick={() => navigate('/')}>Continue to the site</button>
            <button className="btn ghost" onClick={() => navigate('/profile')}>Go to profile</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="panel auth-card">
        <span className="eyebrow">Developer Learning Platform</span>
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signup ? 'Save playgrounds and keep learning momentum.' : 'Login as a user or an authorised administrator.'}</p>

        <div className="social-auth">
          <button type="button" className="btn social google" onClick={() => continueWith('google')}>Continue with Google</button>
          <button type="button" className="btn social github" onClick={() => continueWith('github')}>Continue with GitHub</button>
        </div>
        <div className="auth-divider"><span>or continue with email</span></div>

        <form className="form" onSubmit={submit}>
          {signup && (
            <>
              <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Username<input required minLength="3" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
              <label>
                Profile photo
                <div className="avatar-upload">
                  {avatarPreview && <img className="avatar-upload-preview" src={avatarPreview} alt="" />}
                  <input required type="file" accept="image/*" onChange={updateAvatar} />
                </div>
              </label>
            </>
          )}

          <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>

          <PasswordField
            label="Password"
            name="password"
            required
            minLength={signup ? '8' : undefined}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />

          {signup ? (
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          ) : (
            <label>
              Login as
              <select value={form.loginAs} onChange={(e) => setForm({ ...form, loginAs: e.target.value })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}

          <button className="btn primary" disabled={loading}>{loading ? 'Please wait...' : signup ? 'Create account' : 'Login'}</button>
          {error && <p className="notice error">{error}</p>}
        </form>
      </div>
    </section>
  );
}
