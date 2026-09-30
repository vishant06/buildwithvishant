import { fileURLToPath } from 'node:url';

// Shared Vite settings for the Playground and AI apps (and the main site).
// `shared/` lives outside each app's root, so:
//  - `@shared` points at it,
//  - dedupe makes shared files use the app's own copy of React / lucide,
//  - fs.allow lets the dev server read files above the app root.
const sharedDir = fileURLToPath(new URL('..', import.meta.url));

export const sharedResolve = {
  alias: { '@shared': sharedDir.replace(/\/$/, '') },
  dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'framer-motion'],
};

export const sharedServer = (port) => ({
  port,
  strictPort: true,
  fs: { allow: [sharedDir.replace(/\/shared\/?$/, '')] },
});
