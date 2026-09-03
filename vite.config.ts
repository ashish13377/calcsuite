import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Demo app config (the library is built separately via vite.lib.config.ts).
// Relative base + its own output dir so it can be served from a GitHub Pages subpath.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
  build: { outDir: 'dist-demo' },
}));
