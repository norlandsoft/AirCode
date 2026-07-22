import {
  HttpPaths,
  SseEventName,
  type AgentEventEnvelope,
  type FileContentDto,
  type FileTreeNodeDto,
  type SessionDetailDto,
  type SessionSummaryDto,
  type WorkspaceDto,
} from '@aircode/shared';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
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

  async fileTree(): Promise<{ cwd: string; tree: FileTreeNodeDto[] }> {
    const res = await fetch(HttpPaths.filesTree);
    return parseJson(res);
  },

  async fileContent(path: string): Promise<FileContentDto> {
    const res = await fetch(`${HttpPaths.fileContent}?path=${encodeURIComponent(path)}`);
    return parseJson(res);
  },
};
