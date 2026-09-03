import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Library build: bundles the package to dist/calcsuite.js (ESM), leaving react,
// react-dom, decimal.js, and the optional PDF/XLSX libs as external peers.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'calcsuite.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'decimal.js', 'jspdf', 'xlsx'],
    },
  },
});
