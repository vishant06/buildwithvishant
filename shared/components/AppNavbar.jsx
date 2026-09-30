import { BookOpen, Bot, ChevronDown, Code, FolderGit2, Globe, LogOut, Menu, Moon, Shield, Sun, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { absoluteAsset } from '../api/request.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { appHref } from '../auth/sso.js';
import { AI_URL, MAIN_SITE_URL, PLAYGROUND_URL, mainUrl } from '../config/urls.js';
import { SearchButton } from '../search/SearchProvider.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import './app-navbar.css';

const LOGO =
  'https://res.cloudinary.com/dnx9p4ztk/image/upload/v1788552079/Interlocking_BWV_Monogram_Logo_on_Charcoal_Background_tukrum.png';

const APP_LABEL = { playground: 'Playground', ai: 'AI' };

const buildLinks = () => [
  { key: 'main', label: 'Main Site', href: mainUrl('/'), icon: Globe },
  { key: 'notes', label: 'Notes', href: mainUrl('/notes'), icon: BookOpen },
  { key: 'projects', label: 'Projects', href: mainUrl('/projects'), icon: FolderGit2 },
  { key: 'playground', label: 'Playground', href: appHref(PLAYGROUND_URL), icon: Code },
  { key: 'ai', label: 'AI', href: appHref(AI_URL), icon: Bot },
];

// Where "Login" goes: the main site's login page, told to bring the user
// straight back to this app afterwards (validated against an allowlist there).
const loginHref = (path) => `${MAIN_SITE_URL}${path}?redirect=${encodeURIComponent(window.location.href)}`;

export default function AppNavbar({ app, onMyPlayground }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const links = buildLinks();

  useEffect(() => {
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const linkProps = (link) =>
    link.key === app
      ? {
          // The link to the app you are already in never navigates away
          // (no reload, no redirect loop).
          'aria-current': 'page',
          onClick: (event) => {
            event.preventDefault();
            setMenuOpen(false);
          },
        }
      : { onClick: () => setMenuOpen(false) };

  const openMyPlayground = (event) => {
    setAccountOpen(false);
    if (app === 'playground' && onMyPlayground) {
      event.preventDefault();
      onMyPlayground();
    }
  };

  return (
    <header className="bwv-nav">
      <a className="bwv-brand" href="/" aria-label={`BuildWithVishant ${APP_LABEL[app]}`}>
        <img src={LOGO} alt="" width="28" height="28" />
        <span className="bwv-brand-text">
          <strong>BuildWithVishant</strong>
          <em>{APP_LABEL[app]}</em>
        </span>
      </a>

      <nav className={`bwv-nav-links${menuOpen ? ' open' : ''}`} aria-label="BuildWithVishant apps">
        {links.map((link) => (
          <a key={link.key} href={link.href} className={link.key === app ? 'active' : ''} {...linkProps(link)}>
            <link.icon size={15} aria-hidden="true" />
            {link.label}
          </a>
        ))}
      </nav>

      <div className="bwv-nav-right">
        <SearchButton />
        <button type="button" className="bwv-icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!user ? (
          <div className="bwv-auth-links">
            <a href={loginHref('/login')}>Login</a>
            <a href={loginHref('/signup')} className="bwv-signup">Signup</a>
          </div>
        ) : (
          <div className="bwv-account" ref={accountRef}>
            <button
              type="button"
              className="bwv-account-btn"
              onClick={() => setAccountOpen((value) => !value)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
            >
              <span className="bwv-avatar">
                {user.avatar?.url ? <img src={absoluteAsset(user.avatar.url)} alt="" /> : user.name?.slice(0, 1).toUpperCase()}
              </span>
              <span className="bwv-account-name">{user.name}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {accountOpen && (
              <div className="bwv-menu" role="menu">
                <div className="bwv-menu-id">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <a role="menuitem" href={mainUrl('/profile')}><UserRound size={15} /> Profile</a>
                <a role="menuitem" href={appHref(PLAYGROUND_URL)} onClick={openMyPlayground}><Code size={15} /> My Playground</a>
                <a role="menuitem" href={mainUrl('/')}><Globe size={15} /> Main Website</a>
                {user.role === 'admin' && <a role="menuitem" href={mainUrl('/admin')}><Shield size={15} /> Admin Dashboard</a>}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        )}

        <button type="button" className="bwv-icon-btn bwv-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={menuOpen}>
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}
