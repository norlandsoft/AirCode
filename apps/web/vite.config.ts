import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const airOneRoot = resolve(repoRoot, '../AirOne');
const designRoot = resolve(airOneRoot, 'packages/design');

export default defineConfig({
  // 从仓库根执行 `vite --config apps/web/vite.config.ts` 时必须显式指定 root
  root: __dirname,
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
    host: '0.0.0.0',
    port: 10330,
    strictPort: true,
    fs: {
      allow: [repoRoot, airOneRoot],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:10300',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/, /AirOne/],
    },
  },
});
