import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  AgentHost,
  SettingsService,
  ShellJobRunner,
  browseDirectories,
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
  SaveModelSettingsRequest,
  SetProjectRequest,
  WriteFileRequest,
} from '@aircode/shared';
import { jobEventStream, sessionEventStream } from './sse.js';
import type { Context } from 'hono';

function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new Error(`缺少路径参数 ${name}`);
  return value;
}

const DEFAULT_CORS = [
  'http://localhost:10330',
  'http://127.0.0.1:10330',
  'http://localhost:10300',
  'http://127.0.0.1:10300',
];

export function createApp(options: { settings: SettingsService }) {
  const settings = options.settings;
  const host = new AgentHost({ settings });
  const jobs = new ShellJobRunner({
    getCwd: () => settings.requireProjectCwd(),
  });
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: DEFAULT_CORS,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  const requireCwd = (): string => settings.requireProjectCwd();

  app.get(HttpPaths.health, (c) => c.json({ ok: true }));

  app.get(HttpPaths.workspace, (c) => c.json(host.getWorkspace()));

  app.get(HttpPaths.project, (c) => c.json(settings.getProjectInfo()));

  app.put(HttpPaths.project, async (c) => {
    try {
      const body = (await c.req.json()) as SetProjectRequest;
      return c.json(settings.setProjectCwd(body.path ?? ''));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.projectBrowse, async (c) => {
    try {
      const path = c.req.query('path') || undefined;
      return c.json(await browseDirectories(path));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.settings, (c) => c.json(settings.getAppSettings()));

  app.put(HttpPaths.settingsModel, async (c) => {
    try {
      const body = (await c.req.json()) as SaveModelSettingsRequest;
      return c.json(settings.saveModelSettings(body));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.delete(HttpPaths.settingsModel, (c) => {
    return c.json(settings.clearModelSettings(true));
  });

  app.get(HttpPaths.sessions, (c) => c.json({ sessions: host.listSessions() }));

  app.post(HttpPaths.sessions, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as CreateSessionRequest;
      const session = host.createSession({
        cwd: body.cwd,
        title: body.title,
      });
      return c.json(session, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
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
      return c.json({ error: '未配置 API Key，请在设置中填写' }, 400);
    }
    if (!settings.getProjectCwd()) {
      return c.json({ error: '请先选择项目目录' }, 400);
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
    try {
      const cwd = requireCwd();
      const depthRaw = c.req.query('depth');
      const depth = depthRaw ? Math.min(8, Math.max(1, Number(depthRaw) || 3)) : 3;
      const tree = await readFileTree(cwd, '', 0, depth);
      return c.json({ cwd, tree });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.get(HttpPaths.fileContent, async (c) => {
    const rel = c.req.query('path');
    if (!rel) return c.json({ error: '缺少 path' }, 400);
    try {
      const file = await readWorkspaceFile(requireCwd(), rel);
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
      const file = await writeWorkspaceFile(requireCwd(), body.path, body.content);
      return c.json(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  const cwd = () => requireCwd();

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
    try {
      return c.json({ tasks: await jobs.listTasks() });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
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

  return { app, host, jobs, settings };
}
