/** HTTP API path helpers for the AirCode agent service. */
export const HttpPaths = {
  health: "/api/health",
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  prompt: (id: string) => `/api/sessions/${encodeURIComponent(id)}/prompt`,
  steer: (id: string) => `/api/sessions/${encodeURIComponent(id)}/steer`,
  abort: (id: string) => `/api/sessions/${encodeURIComponent(id)}/abort`,
  events: (id: string) => `/api/sessions/${encodeURIComponent(id)}/events`,
} as const;

/** SSE event name for agent session payloads. */
export const SseEventName = "session" as const;
