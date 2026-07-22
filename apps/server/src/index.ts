import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

const port = Number(process.env.PORT || 8787);
const workspace = process.env.AIRCODE_WORKSPACE?.trim() || process.cwd();

const { app, host } = createApp({ workspace });

if (process.env.NODE_ENV === 'production') {
  const webDist = resolve(__dirname, '../../web/dist');
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', serveStatic({ root: webDist, path: 'index.html' }));
}

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[aircode] server http://127.0.0.1:${port}`);
  console.log(`[aircode] workspace ${workspace}`);
  console.log(
    `[aircode] ANTHROPIC_API_KEY ${host.hasApiKey() ? '已配置' : '未配置（请写入 .env）'}`,
  );
});

async function shutdown() {
  await host.disposeAll();
  server.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
