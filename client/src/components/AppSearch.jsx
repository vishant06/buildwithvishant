import { useNavigate } from 'react-router-dom';
import { SearchProvider } from '@shared/search/SearchProvider.jsx';

// Global Ctrl+K search for the main site. Results that live on the main site
// navigate with the router (no full reload).
export default function AppSearch({ children }) {
  const navigate = useNavigate();
  return (
    <SearchProvider app="main" onNavigateMain={(path) => navigate(path)}>
      {children}
    </SearchProvider>
  );
}
