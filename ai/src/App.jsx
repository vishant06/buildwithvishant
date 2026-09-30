import AppNavbar from '@shared/components/AppNavbar.jsx';
import Assistant from './pages/Assistant.jsx';

export default function App() {
  return (
    <div className="bwv-app">
      <AppNavbar app="ai" />
      <main className="bwv-app-body">
        <Assistant />
      </main>
    </div>
  );
}
