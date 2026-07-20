/** HTTP API path helpers for the AirCode agent service. */
export const HttpPaths = {
  health: "/api/health",
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  prompt: (id: string) => `/api/sessions/${encodeURIComponent(id)}/prompt`,
  steer: (id: string) => `/api/sessions/${encodeURIComponent(id)}/steer`,
  abort: (id: string) => `/api/sessions/${encodeURIComponent(id)}/abort`,
  events: (id: string) => `/api/sessions/${encodeURIComponent(id)}/events`,
  modelsSettings: "/api/settings/models",
  defaultModel: "/api/settings/models/default",
  modelEnabled: "/api/settings/models/enabled",
  providerApiKey: (providerId: string) =>
    `/api/settings/providers/${encodeURIComponent(providerId)}/api-key`,
} as const;

/** SSE event name for agent session payloads. */
export const SseEventName = "session" as const;
