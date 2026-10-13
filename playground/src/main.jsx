import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from '@shared/auth/AuthContext.jsx';
import { bootstrapSession } from '@shared/auth/sso.js';
import { SearchProvider } from '@shared/search/SearchProvider.jsx';
import { ThemeProvider } from '@shared/theme/ThemeContext.jsx';
import '@shared/styles/base.css';
import App from './App.jsx';
import { quarantineLegacyStorage } from './workspace/storage.js';

// Pick up a session handed over by the main site (or ask it for one) before
// anything renders, so the app never flashes a signed-out state.
bootstrapSession().then((redirecting) => {
  if (redirecting) return;
  // Earlier versions kept every account's draft under shared keys; park those so
  // they are never shown to whoever signs in next (nothing is deleted).
  quarantineLegacyStorage();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <SearchProvider app="playground">
            <App />
          </SearchProvider>
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
