import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PasswordField from '../../components/PasswordField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login">
      <motion.form className="form panel login-card" onSubmit={submit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="icon"><Lock size={24} /></div>
        <h1>Admin Login</h1>
        <p>Sign in to manage projects, resume, and contact messages.</p>
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <PasswordField
          label="Password"
          name="password"
          required
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          autoComplete="current-password"
        />
        <button className="btn primary" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
        {error && <p className="notice error">{error}</p>}
      </motion.form>
    </main>
  );
};

export default Login;
