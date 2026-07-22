/** HTTP 路径常量 */
export const HttpPaths = {
  health: '/api/health',
  workspace: '/api/workspace',
  sessions: '/api/sessions',
  session: (id: string) => `/api/sessions/${id}` as const,
  sessionPrompt: (id: string) => `/api/sessions/${id}/prompt` as const,
  sessionAbort: (id: string) => `/api/sessions/${id}/abort` as const,
  sessionEvents: (id: string) => `/api/sessions/${id}/events` as const,
  sessionMessages: (id: string) => `/api/sessions/${id}/messages` as const,
  filesTree: '/api/files/tree',
  fileContent: '/api/files/content',
} as const;

/** SSE 事件名 */
export const SseEventName = {
  ready: 'ready',
  ping: 'ping',
  session: 'session',
} as const;
