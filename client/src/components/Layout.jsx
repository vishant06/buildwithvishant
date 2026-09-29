<<<<<<< HEAD
import { Outlet, useLocation } from 'react-router-dom';
=======
import { Outlet } from 'react-router-dom';
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';
import styles from './Layout.module.css';

<<<<<<< HEAD
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
=======
const Layout = () => (
  <div className={styles.shell}>
    <div className={styles.background} aria-hidden="true" />
    <Navbar />
    <main className={styles.main}>
      <Outlet />
    </main>
    <Footer />
  </div>
);
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764

export default Layout;
