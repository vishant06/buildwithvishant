import { Outlet, useLocation } from 'react-router-dom';
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';
import styles from './Layout.module.css';

// /notes/:slug is the documentation-style reader (3 columns), which needs
// more room than the default 1120px page container.
const isNoteReader = (pathname) => /^\/notes\/[^/]+\/?$/.test(pathname);

const Layout = () => {
  const { pathname } = useLocation();
  return (
    <div className={styles.shell}>
      <div className={styles.background} aria-hidden="true" />
      <Navbar />
      <main className={`${styles.main}${isNoteReader(pathname) ? ` ${styles.wide}` : ''}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
