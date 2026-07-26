import {
  HttpPaths,
  SseEventName,
  type AgentEventEnvelope,
  type CreateJobRequest,
  type FileContentDto,
  type FileTreeNodeDto,
  type GitBranchDto,
  type GitCommitFileDto,
  type GitDiffDto,
  type GitFileContentsDto,
  type GitLogEntryDto,
  type GitStatusDto,
  type JobEventEnvelope,
  type SessionDetailDto,
  type SessionSummaryDto,
  type AppSettingsDto,
  type BrowseResultDto,
  type ProjectInfoDto,
  type SaveModelSettingsRequest,
  type ShellJobDetailDto,
  type ShellJobSummaryDto,
  type ShellTaskDefDto,
  type WorkspaceDto,
} from '@aircode/shared';

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  } catch {
    throw new Error(
      res.ok
        ? `响应不是合法 JSON：${text.slice(0, 120)}`
        : text.trim() || res.statusText || `HTTP ${res.status}`,
    );
  }
  if (!res.ok) {
    throw new Error(data.error || text.trim() || res.statusText || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  async health(): Promise<{ ok: boolean }> {
    const res = await fetch(HttpPaths.health);
    return parseJson(res);
  },

  async workspace(): Promise<WorkspaceDto> {
    const res = await fetch(HttpPaths.workspace);
    return parseJson(res);
  },

  async listSessions(): Promise<SessionSummaryDto[]> {
    const res = await fetch(HttpPaths.sessions);
    const data = await parseJson<{ sessions: SessionSummaryDto[] }>(res);
    return data.sessions;
  },

  async createSession(body?: { cwd?: string; title?: string }): Promise<SessionSummaryDto> {
    const res = await fetch(HttpPaths.sessions, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return parseJson(res);
  },

  async getSession(id: string): Promise<SessionDetailDto> {
    const res = await fetch(HttpPaths.session(id));
    return parseJson(res);
  },

  async deleteSession(id: string): Promise<void> {
    const res = await fetch(HttpPaths.session(id), { method: 'DELETE' });
    await parseJson(res);
  },

  async prompt(id: string, text: string): Promise<void> {
    const res = await fetch(HttpPaths.sessionPrompt(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    await parseJson(res);
  },

  async abort(id: string): Promise<void> {
    const res = await fetch(HttpPaths.sessionAbort(id), { method: 'POST' });
    await parseJson(res);
  },

  subscribeSession(
    id: string,
    onEvent: (envelope: AgentEventEnvelope) => void,
  ): () => void {
    const es = new EventSource(HttpPaths.sessionEvents(id));
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as AgentEventEnvelope;
        onEvent(data);
      } catch (err) {
        console.error('[sse] parse error', err);
      }
    };
    es.addEventListener(SseEventName.session, handler as EventListener);
    es.onerror = () => {
      // EventSource 会自动重连
    };
    return () => es.close();
  },

  async fileTree(depth = 3): Promise<{ cwd: string; tree: FileTreeNodeDto[] }> {
    const res = await fetch(`${HttpPaths.filesTree}?depth=${depth}`);
    return parseJson(res);
  },

  async fileContent(path: string): Promise<FileContentDto> {
    const res = await fetch(`${HttpPaths.fileContent}?path=${encodeURIComponent(path)}`);
    return parseJson(res);
  },

  async writeFile(path: string, content: string): Promise<FileContentDto> {
    const res = await fetch(HttpPaths.fileContent, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    return parseJson(res);
  },

  async gitStatus(): Promise<GitStatusDto> {
    const res = await fetch(HttpPaths.gitStatus);
    return parseJson(res);
  },

  async gitBranches(): Promise<GitBranchDto[]> {
    const res = await fetch(HttpPaths.gitBranches);
    const data = await parseJson<{ branches: GitBranchDto[] }>(res);
    return data.branches;
  },

  async gitLog(limit = 30): Promise<GitLogEntryDto[]> {
    const res = await fetch(`${HttpPaths.gitLog}?limit=${limit}`);
    const data = await parseJson<{ commits: GitLogEntryDto[] }>(res);
    return data.commits;
  },

  async gitDiff(path?: string, staged = false): Promise<GitDiffDto> {
    const q = new URLSearchParams();
    if (path) q.set('path', path);
    if (staged) q.set('staged', '1');
    const res = await fetch(`${HttpPaths.gitDiff}?${q}`);
    return parseJson(res);
  },

  async gitContents(options: {
    path: string;
    staged?: boolean;
    commit?: string;
  }): Promise<GitFileContentsDto> {
    const q = new URLSearchParams();
    q.set('path', options.path);
    if (options.staged) q.set('staged', '1');
    if (options.commit) q.set('commit', options.commit);
    const res = await fetch(`${HttpPaths.gitContents}?${q}`);
    return parseJson(res);
  },

  async gitCommitFiles(commit: string): Promise<GitCommitFileDto[]> {
    const q = new URLSearchParams({ commit });
    const res = await fetch(`${HttpPaths.gitCommitFiles}?${q}`);
    const data = await parseJson<{ files: GitCommitFileDto[] }>(res);
    return data.files;
  },

  async gitStage(paths: string[]): Promise<GitStatusDto> {
    const res = await fetch(HttpPaths.gitStage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    return parseJson(res);
  },

  async gitStageAll(): Promise<GitStatusDto> {
    const res = await fetch(HttpPaths.gitStage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    return parseJson(res);
  },

  async gitUnstage(paths: string[]): Promise<GitStatusDto> {
    const res = await fetch(HttpPaths.gitUnstage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    return parseJson(res);
  },

  async gitUnstageAll(): Promise<GitStatusDto> {
    const res = await fetch(HttpPaths.gitUnstage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    return parseJson(res);
  },

  async gitCommit(message: string): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitCommit, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return parseJson(res);
  },

  async gitCheckout(
    branch: string,
    create = false,
  ): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitCheckout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, create }),
    });
    return parseJson(res);
  },

  async gitPull(): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitPull, { method: 'POST' });
    return parseJson(res);
  },

  async gitPush(): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitPush, { method: 'POST' });
    return parseJson(res);
  },

  async gitFetch(): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitFetch, { method: 'POST' });
    return parseJson(res);
  },

  async gitInit(): Promise<{ message: string; status: GitStatusDto }> {
    const res = await fetch(HttpPaths.gitInit, { method: 'POST' });
    return parseJson(res);
  },

  async listTasks(): Promise<ShellTaskDefDto[]> {
    const res = await fetch(HttpPaths.jobTasks);
    const data = await parseJson<{ tasks: ShellTaskDefDto[] }>(res);
    return data.tasks;
  },

  async listJobs(): Promise<ShellJobSummaryDto[]> {
    const res = await fetch(HttpPaths.jobs);
    const data = await parseJson<{ jobs: ShellJobSummaryDto[] }>(res);
    return data.jobs;
  },

  async createJob(body: CreateJobRequest): Promise<ShellJobSummaryDto> {
    const res = await fetch(HttpPaths.jobs, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },

  async getJob(id: string): Promise<ShellJobDetailDto> {
    const res = await fetch(HttpPaths.job(id));
    return parseJson(res);
  },

  async abortJob(id: string): Promise<void> {
    const res = await fetch(HttpPaths.jobAbort(id), { method: 'POST' });
    await parseJson(res);
  },

  subscribeJob(id: string, onEvent: (envelope: JobEventEnvelope) => void): () => void {
    const es = new EventSource(HttpPaths.jobEvents(id));
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as JobEventEnvelope;
        onEvent(data);
      } catch (err) {
        console.error('[job-sse] parse error', err);
      }
    };
    es.addEventListener(SseEventName.job, handler as EventListener);
    return () => es.close();
  },

  async getSettings(): Promise<AppSettingsDto> {
    const res = await fetch(HttpPaths.settings);
    return parseJson(res);
  },

  async saveModelSettings(body: SaveModelSettingsRequest): Promise<AppSettingsDto> {
    const res = await fetch(HttpPaths.settingsModel, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },

  async clearModelSettings(): Promise<AppSettingsDto> {
    const res = await fetch(HttpPaths.settingsModel, { method: 'DELETE' });
    return parseJson(res);
  },

  async getProject(): Promise<ProjectInfoDto> {
    const res = await fetch(HttpPaths.project);
    return parseJson(res);
  },

  async setProject(path: string): Promise<ProjectInfoDto> {
    const res = await fetch(HttpPaths.project, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return parseJson(res);
  },

  async browseProject(path?: string): Promise<BrowseResultDto> {
    const q = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await fetch(`${HttpPaths.projectBrowse}${q}`);
    return parseJson(res);
  },
};
