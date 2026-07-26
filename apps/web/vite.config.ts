import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const airOneRoot = resolve(repoRoot, '../AirOne');
const designRoot = resolve(airOneRoot, 'packages/design');

/**
 * 强制全应用共用一份 React。
 * @air/design 从 AirOne 加载时，若不做 alias，会再解析出第二份 React，
 * 导致 Radix Select 等组件出现 Invalid hook call。
 */
const require = createRequire(resolve(__dirname, 'package.json'));
const reactRoot = dirname(require.resolve('react/package.json'));
const reactDomRoot = dirname(require.resolve('react-dom/package.json'));

export default defineConfig({
  // 从仓库根执行 `vite --config apps/web/vite.config.ts` 时必须显式指定 root
  root: __dirname,
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@air/design/style.css',
        replacement: resolve(designRoot, 'dist/style.css'),
      },
      {
        find: '@air/design',
        replacement: resolve(designRoot, 'dist/index.mjs'),
      },
      // 精确匹配，避免字符串前缀误伤 react-dom
      { find: /^react$/, replacement: reactRoot },
      { find: /^react\/(.+)$/, replacement: `${reactRoot}/$1` },
      { find: /^react-dom$/, replacement: reactDomRoot },
      { find: /^react-dom\/(.+)$/, replacement: `${reactDomRoot}/$1` },
    ],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
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
