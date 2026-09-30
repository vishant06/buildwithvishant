import { Navigate, Route, Routes } from 'react-router-dom';
import AppRedirect from './components/AppRedirect.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Education from './pages/Education.jsx';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Skills from './pages/Skills.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Login from './pages/admin/Login.jsx';
import Resume from './pages/Resume.jsx';
import Notes from './pages/Notes.jsx';
import NoteDetail from './pages/NoteDetail.jsx';
import Auth from './pages/Auth.jsx';
import OAuthCallback from './pages/OAuthCallback.jsx';
import Profile from './pages/Profile.jsx';
import SsoAuthorize from './pages/SsoAuthorize.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<Navigate to="/#about" replace />} />
      <Route path="/skills" element={<Skills />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/education" element={<Education />} />
      <Route path="/contact" element={<Navigate to="/#contact" replace />} />
      <Route path="/resume" element={<Resume />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/notes/:slug" element={<NoteDetail />} />
      {/* Playground and AI are separate apps now; these routes forward to them. */}
      <Route path="/playground" element={<AppRedirect app="playground" />} />
      <Route path="/assistant" element={<AppRedirect app="ai" />} />
      <Route path="/ai" element={<AppRedirect app="ai" />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/login" element={<Auth />} />
      <Route path="/signup" element={<Auth signup />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
    </Route>
    <Route path="/sso/authorize" element={<SsoAuthorize />} />
    <Route path="/admin/login" element={<Login />} />
    <Route
      path="/admin"
      element={
        <ProtectedRoute adminOnly>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
