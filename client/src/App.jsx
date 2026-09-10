import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import Education from './pages/Education.jsx';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Skills from './pages/Skills.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Login from './pages/admin/Login.jsx';
import Resume from "./pages/Resume";
import Notes from './pages/Notes.jsx'; import NoteDetail from './pages/NoteDetail.jsx'; import Playground from './pages/Playground.jsx'; import Assistant from './pages/Assistant.jsx'; import Auth from './pages/Auth.jsx'; import OAuthCallback from './pages/OAuthCallback.jsx'; import Profile from './pages/Profile.jsx'; import VerifyEmail from './pages/VerifyEmail.jsx';

const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/skills" element={<Skills />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/education" element={<Education />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/resume" element={<Resume />} />
      <Route path="/notes" element={<Notes />} /><Route path="/notes/:slug" element={<NoteDetail />} />
      <Route path="/playground" element={<Playground />} /><Route path="/assistant" element={<Assistant />} /><Route path="/ai" element={<Assistant />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/login" element={<Auth />} /><Route path="/signup" element={<Auth signup />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
    </Route>
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
