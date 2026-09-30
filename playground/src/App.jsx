import { useRef } from 'react';
import AppNavbar from '@shared/components/AppNavbar.jsx';
import Playground from './pages/Playground.jsx';

export default function App() {
  const playgroundRef = useRef(null);

  return (
    <div className="bwv-app">
      <AppNavbar app="playground" onMyPlayground={() => playgroundRef.current?.openSaved()} />
      <main className="bwv-app-body">
        <Playground ref={playgroundRef} />
      </main>
    </div>
  );
}
