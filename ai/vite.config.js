import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { sharedResolve, sharedServer } from '../shared/vite/config.js';

// AI answers reuse the note code blocks from the main site's source tree
// (`@client`); their npm imports must resolve from THIS app's node_modules.
const clientSrc = fileURLToPath(new URL('../client/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { ...sharedResolve.alias, '@client': clientSrc },
    dedupe: [...sharedResolve.dedupe, 'react-syntax-highlighter'],
  },
  server: sharedServer(5175),
});
