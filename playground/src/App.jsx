import { useRef } from 'react';
import { useAuth } from '@shared/auth/AuthContext.jsx';
import AppNavbar from '@shared/components/AppNavbar.jsx';
import Playground from './pages/Playground.jsx';
import { namespaceFor } from './workspace/storage.js';

export default function App() {
  const playgroundRef = useRef(null);
  const { token } = useAuth();
  // Whose workspace is on screen. It comes from the session token itself, and
  // it is the React `key` of the Playground: when the account changes (sign-out,
  // sign-in, switching accounts, another tab changing the session) the whole
  // workspace -- files, tabs, history, selections -- is unmounted and rebuilt
  // from the new account's own data, never carried over.
  const namespace = namespaceFor(token);

  return (
    <div className="bwv-app">
      <AppNavbar app="playground" onMyPlayground={() => playgroundRef.current?.openSaved()} />
      <main className="bwv-app-body">
        <Playground key={namespace} namespace={namespace} ref={playgroundRef} />
      </main>
    </div>
  );
}
