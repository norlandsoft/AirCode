import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SettingsService, resolveClaudeHome } from '@aircode/runtime';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

/** .env 仅保留服务端口与 Claude Home */
const port = Number(process.env.PORT || 10300);
const claudeHome = resolveClaudeHome();
const settings = new SettingsService({ claudeHome });

const { app, host } = createApp({ settings });

if (process.env.NODE_ENV === 'production') {
  const webDist = resolve(__dirname, '../../web/dist');
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', serveStatic({ root: webDist, path: 'index.html' }));
}

const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`[aircode] server http://0.0.0.0:${port}`);
  console.log(`[aircode] CLAUDE_HOME ${claudeHome}`);
  console.log(`[aircode] settings db ${settings.dbPath}`);
  console.log(
    `[aircode] project ${settings.getProjectCwd() ?? '（未选择，请在 Web 中打开项目）'}`,
  );
  console.log(`[aircode] API Key ${host.hasApiKey() ? '已配置' : '未配置（设置页）'}`);
});

async function shutdown() {
  await host.disposeAll();
  settings.close();
  server.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
