import { useEffect } from 'react';
import { appHref } from '@shared/auth/sso.js';
import { AI_URL, PLAYGROUND_URL } from '@shared/config/urls.js';

const APPS = {
  playground: { url: PLAYGROUND_URL, label: 'Playground' },
  ai: { url: AI_URL, label: 'AI assistant' },
};

// /playground, /assistant and /ai now live in their own apps. The old routes
// stay as entry points and forward there (already signed in, via the shared session).
export default function AppRedirect({ app }) {
  const target = APPS[app];

  useEffect(() => {
    window.location.replace(appHref(target.url));
  }, [target.url]);

  return <p className="notice">Opening the {target.label}…</p>;
}
