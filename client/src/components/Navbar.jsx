import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { absoluteAsset } from "../services/api.js";
import styles from "./Navbar.module.css";

const links = [
  ["Home", "/"],
  ["Notes", "/notes"],
  ["Projects", "/projects"],
  ["Playground", "/playground"],
  ["AI", "/ai"],
  ["About", "/about"],
  // ["Education", "/education"],
  ["Contact", "/contact"],
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  useEffect(() => {
    const close = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const closeMenu = () => setMenuOpen(false);
  const signOut = () => {
    logout();
    setProfileOpen(false);
    closeMenu();
    navigate("/");
  };
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <NavLink
          to="/"
          className={styles.logo}
          onClick={closeMenu}
          aria-label="VK home"
        >
          <img src="https://res.cloudinary.com/dnx9p4ztk/image/upload/v1788552079/Interlocking_BWV_Monogram_Logo_on_Charcoal_Background_tukrum.png" alt="VK" />
        </NavLink>
        <div className={`${styles.centerLinks} ${menuOpen ? styles.open : ""}`}>
          {links.map(([label, path]) => (
            <NavLink
              key={label}
              to={path}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? styles.active : "")}
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className={styles.utilities}>
          <button
            className={styles.themeButton}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {!user ? (
            <div className={styles.authLinks}>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/signup" className={styles.signup}>
                Signup
              </NavLink>
            </div>
          ) : (
            <div className={styles.profileWrap} ref={profileRef}>
              <button
                className={styles.profileButton}
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
                aria-label="Open account menu"
              >
                <span>
                  {user.avatar?.url ? (
                    <img className={styles.avatarImg} src={absoluteAsset(user.avatar.url)} alt="" />
                  ) : (
                    user.name?.slice(0, 1).toUpperCase()
                  )}
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className={styles.profileMenu}>
                  <div className={styles.identity}>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <NavLink to="/profile" onClick={() => setProfileOpen(false)}>
                    <UserRound size={16} /> Profile
                  </NavLink>
                  <NavLink
                    to="/playground"
                    onClick={() => setProfileOpen(false)}
                  >
                    My Playground
                  </NavLink>
                  {user.role === "admin" && (
                    <NavLink to="/admin" onClick={() => setProfileOpen(false)}>
                      Admin Dashboard
                    </NavLink>
                  )}
                  <button onClick={signOut}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            className={styles.menuButton}
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>
    </header>
  );
}
