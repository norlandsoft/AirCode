import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const { app, host } = createApp();

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.info(`[aircode-server] listening on http://127.0.0.1:${info.port}`);
});

function shutdown(): void {
  host.disposeAll();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
