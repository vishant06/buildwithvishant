import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { sharedResolve, sharedServer } from '../shared/vite/config.js';

export default defineConfig({
  plugins: [react()],
  resolve: sharedResolve,
  server: sharedServer(5174),
});
