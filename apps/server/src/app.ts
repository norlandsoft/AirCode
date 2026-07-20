import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { AgentHost } from "@aircode/runtime";
import { HttpPaths } from "@aircode/shared";
import { sessionEventStream } from "./sse.js";

export interface CreateAppOptions {
  host?: AgentHost;
  /** Absolute or relative path to built web assets (production). */
  webDist?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createApp(options: CreateAppOptions = {}): { app: Hono; host: AgentHost } {
  const host = options.host ?? new AgentHost();
  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get(HttpPaths.health, (c) => c.json({ ok: true }));

  app.get(HttpPaths.modelsSettings, async (c) => {
    try {
      return c.json(await host.getModelsSettings());
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500);
    }
  });

  app.put(HttpPaths.modelConnection, async (c) => {
    try {
      const body = (await c.req.json()) as {
        providerId?: string;
        apiType?: string;
        baseUrl?: string;
        token?: string;
      };
      if (!body.providerId?.trim() || !body.apiType?.trim()) {
        return c.json({ error: "providerId and apiType are required" }, 400);
      }
      const settings = await host.saveModelConnection({
        providerId: body.providerId,
        apiType: body.apiType,
        baseUrl: body.baseUrl ?? "",
        token: body.token,
      });
      return c.json(settings);
    } catch (error) {
      const message = errorMessage(error);
      const status =
        message.startsWith("Unknown") || message.includes("required") ? 400 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.delete(HttpPaths.modelConnection, async (c) => {
    try {
      return c.json(await host.clearModelConnection());
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500);
    }
  });

  app.put(HttpPaths.defaultModel, async (c) => {
    try {
      const body = (await c.req.json()) as { modelRef?: string | null };
      const settings = await host.setDefaultModel(body.modelRef ?? null);
      return c.json(settings);
    } catch (error) {
      const message = errorMessage(error);
      const status = message.startsWith("Unknown") ? 400 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.post(HttpPaths.sessions, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as {
        cwd?: string;
        modelId?: string;
      };
      const cwd = body.cwd?.trim() ? body.cwd : process.cwd();
      const result = await host.createSession({ cwd, modelId: body.modelId });
      return c.json(result, 201);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500);
    }
  });

  app.get("/api/sessions/:id", (c) => {
    try {
      const state = host.getState(c.req.param("id"));
      return c.json(state);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
  });

  app.post("/api/sessions/:id/prompt", async (c) => {
    try {
      const id = c.req.param("id");
      const body = (await c.req.json()) as { text?: string };
      const text = body.text?.trim() ?? "";
      if (!text) {
        return c.json({ error: "text is required" }, 400);
      }
      await host.prompt(id, text);
      return c.json({ ok: true });
    } catch (error) {
      const message = errorMessage(error);
      const status = message.includes("not found") ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.post("/api/sessions/:id/steer", async (c) => {
    try {
      const id = c.req.param("id");
      const body = (await c.req.json()) as { text?: string };
      const text = body.text?.trim() ?? "";
      if (!text) {
        return c.json({ error: "text is required" }, 400);
      }
      await host.steer(id, text);
      return c.json({ ok: true });
    } catch (error) {
      const message = errorMessage(error);
      const status = message.includes("not found") ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.post("/api/sessions/:id/abort", async (c) => {
    try {
      await host.abort(c.req.param("id"));
      return c.json({ ok: true });
    } catch (error) {
      const message = errorMessage(error);
      const status = message.includes("not found") ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.delete("/api/sessions/:id", (c) => {
    try {
      host.dispose(c.req.param("id"));
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500);
    }
  });

  app.get("/api/sessions/:id/events", (c) => {
    const id = c.req.param("id");
    try {
      // Ensure session exists before opening SSE.
      host.getState(id);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    return sessionEventStream(c, host, id);
  });

  const webDist =
    options.webDist ??
    join(fileURLToPath(new URL(".", import.meta.url)), "../../web/dist");

  if (process.env.NODE_ENV === "production" && existsSync(webDist)) {
    const root = relative(process.cwd(), webDist) || webDist;
    app.use("/*", serveStatic({ root }));
  }

  return { app, host };
}
