import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AgentHost, readFileTree, readWorkspaceFile } from '@aircode/runtime';
import { HttpPaths } from '@aircode/shared';
import type { CreateSessionRequest, PromptRequest } from '@aircode/shared';
import { sessionEventStream } from './sse.js';
import type { Context } from 'hono';

function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new Error(`缺少路径参数 ${name}`);
  return value;
}

export function createApp(options: { workspace: string }) {
  const host = new AgentHost({ defaultCwd: options.workspace });
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.get(HttpPaths.health, (c) => c.json({ ok: true }));

  app.get(HttpPaths.workspace, (c) => c.json(host.getWorkspace()));

  app.get(HttpPaths.sessions, (c) => c.json({ sessions: host.listSessions() }));

  app.post(HttpPaths.sessions, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as CreateSessionRequest;
    const session = host.createSession({
      cwd: body.cwd,
      title: body.title,
    });
    return c.json(session, 201);
  });

  app.get(HttpPaths.session(':id'), (c) => {
    const detail = host.getSession(requireParam(c, 'id'));
    if (!detail) return c.json({ error: '会话不存在' }, 404);
    return c.json(detail);
  });

  app.delete(HttpPaths.session(':id'), (c) => {
    const ok = host.deleteSession(requireParam(c, 'id'));
    if (!ok) return c.json({ error: '会话不存在' }, 404);
    return c.json({ ok: true });
  });

  app.post(HttpPaths.sessionPrompt(':id'), async (c) => {
    const id = requireParam(c, 'id');
    const body = (await c.req.json()) as PromptRequest;
    const detail = host.getSession(id);
    if (!detail) return c.json({ error: '会话不存在' }, 404);
    if (detail.streaming) return c.json({ error: '当前会话正在生成' }, 409);
    if (!host.hasApiKey()) {
      return c.json({ error: '未配置 ANTHROPIC_API_KEY' }, 400);
    }
    const text = body.text?.trim() ?? '';
    if (!text) return c.json({ error: '消息不能为空' }, 400);

    void host.prompt(id, text).catch((err) => {
      console.error('[prompt]', err);
    });
    return c.json({ ok: true });
  });

  app.post(HttpPaths.sessionAbort(':id'), async (c) => {
    const ok = await host.abort(requireParam(c, 'id'));
    if (!ok) return c.json({ error: '会话不存在' }, 404);
    return c.json({ ok: true });
  });

  app.get(HttpPaths.sessionEvents(':id'), (c) => {
    const id = requireParam(c, 'id');
    if (!host.getSession(id)) return c.json({ error: '会话不存在' }, 404);
    return sessionEventStream(c, id, (listener) => host.onEvent(listener));
  });

  app.get(HttpPaths.filesTree, async (c) => {
    const cwd = host.getWorkspace().cwd;
    const tree = await readFileTree(cwd);
    return c.json({ cwd, tree });
  });

  app.get(HttpPaths.fileContent, async (c) => {
    const rel = c.req.query('path');
    if (!rel) return c.json({ error: '缺少 path' }, 400);
    try {
      const file = await readWorkspaceFile(host.getWorkspace().cwd, rel);
      return c.json(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  return { app, host };
}
