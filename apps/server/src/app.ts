import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  AgentHost,
  ShellJobRunner,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitDiff,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitStage,
  gitStatus,
  gitUnstage,
  readFileTree,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '@aircode/runtime';
import { HttpPaths } from '@aircode/shared';
import type {
  CreateJobRequest,
  CreateSessionRequest,
  GitCheckoutRequest,
  GitCommitRequest,
  GitStageRequest,
  PromptRequest,
  WriteFileRequest,
} from '@aircode/shared';
import { jobEventStream, sessionEventStream } from './sse.js';
import type { Context } from 'hono';

function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new Error(`缺少路径参数 ${name}`);
  return value;
}

function resolveCorsOrigins(): string[] {
  const raw = process.env.AIRCODE_CORS_ORIGIN?.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
  ];
}

export function createApp(options: { workspace: string }) {
  const host = new AgentHost({ defaultCwd: options.workspace });
  const jobs = new ShellJobRunner({ cwd: options.workspace });
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: resolveCorsOrigins(),
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
    const depthRaw = c.req.query('depth');
    const depth = depthRaw ? Math.min(8, Math.max(1, Number(depthRaw) || 3)) : 3;
    const tree = await readFileTree(cwd, '', 0, depth);
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

  app.put(HttpPaths.fileContent, async (c) => {
    const body = (await c.req.json()) as WriteFileRequest;
    if (!body.path?.trim()) return c.json({ error: '缺少 path' }, 400);
    if (typeof body.content !== 'string') return c.json({ error: '缺少 content' }, 400);
    try {
      const file = await writeWorkspaceFile(
        host.getWorkspace().cwd,
        body.path,
        body.content,
      );
      return c.json(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  const cwd = () => host.getWorkspace().cwd;

  app.get(HttpPaths.gitStatus, async (c) => {
    try {
      return c.json(await gitStatus(cwd()));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.gitBranches, async (c) => {
    try {
      return c.json({ branches: await gitBranches(cwd()) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.gitLog, async (c) => {
    try {
      const limit = Number(c.req.query('limit') || 30);
      return c.json({ commits: await gitLog(cwd(), limit) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.gitDiff, async (c) => {
    try {
      const path = c.req.query('path') || undefined;
      const staged = c.req.query('staged') === '1' || c.req.query('staged') === 'true';
      return c.json(await gitDiff(cwd(), { path, staged }));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitStage, async (c) => {
    try {
      const body = (await c.req.json()) as GitStageRequest;
      await gitStage(cwd(), body.paths ?? []);
      return c.json(await gitStatus(cwd()));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitUnstage, async (c) => {
    try {
      const body = (await c.req.json()) as GitStageRequest;
      await gitUnstage(cwd(), body.paths ?? []);
      return c.json(await gitStatus(cwd()));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitCommit, async (c) => {
    try {
      const body = (await c.req.json()) as GitCommitRequest;
      const message = await gitCommit(cwd(), body.message ?? '');
      const status = await gitStatus(cwd());
      return c.json({ message, status });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitCheckout, async (c) => {
    try {
      const body = (await c.req.json()) as GitCheckoutRequest;
      const message = await gitCheckout(cwd(), body.branch ?? '', Boolean(body.create));
      return c.json({ message, status: await gitStatus(cwd()) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitPull, async (c) => {
    try {
      const message = await gitPull(cwd());
      return c.json({ message, status: await gitStatus(cwd()) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitPush, async (c) => {
    try {
      const message = await gitPush(cwd());
      return c.json({ message, status: await gitStatus(cwd()) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post(HttpPaths.gitFetch, async (c) => {
    try {
      const message = await gitFetch(cwd());
      return c.json({ message, status: await gitStatus(cwd()) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.jobTasks, async (c) => {
    return c.json({ tasks: await jobs.listTasks() });
  });

  app.get(HttpPaths.jobs, (c) => c.json({ jobs: jobs.listJobs() }));

  app.post(HttpPaths.jobs, async (c) => {
    try {
      const body = (await c.req.json()) as CreateJobRequest;
      const job = await jobs.createJob(body);
      return c.json(job, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.job(':id'), (c) => {
    const detail = jobs.getJob(requireParam(c, 'id'));
    if (!detail) return c.json({ error: '任务不存在' }, 404);
    return c.json(detail);
  });

  app.post(HttpPaths.jobAbort(':id'), async (c) => {
    const ok = await jobs.abort(requireParam(c, 'id'));
    if (!ok) return c.json({ error: '任务不存在或无法中止' }, 404);
    return c.json({ ok: true });
  });

  app.get(HttpPaths.jobEvents(':id'), (c) => {
    const id = requireParam(c, 'id');
    if (!jobs.getJob(id)) return c.json({ error: '任务不存在' }, 404);
    return jobEventStream(c, id, (listener) => jobs.onEvent(listener));
  });

  return { app, host, jobs };
}
