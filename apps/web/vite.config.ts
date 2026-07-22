import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const airOneRoot = resolve(repoRoot, '../AirOne');
const designRoot = resolve(airOneRoot, 'packages/design');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@air/design/style.css',
        replacement: resolve(designRoot, 'dist/style.css'),
      },
      {
        find: '@air/design',
        replacement: resolve(designRoot, 'dist/index.mjs'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@air/design'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [repoRoot, airOneRoot],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/node_modules/, /AirOne/],
    },
  },
});
