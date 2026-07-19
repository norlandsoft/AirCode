import {
  HttpPaths,
  SseEventName,
  type AgentEventDto,
  type AirCodeApi,
  type ApiResponse,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type PromptRequest,
  type SessionIdRequest,
  type SessionStateDto,
  type SteerRequest,
} from "@aircode/shared";

async function requestJson<T>(
  input: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as
      | T
      | { error?: string };

    if (!response.ok) {
      const error =
        payload && typeof payload === "object" && "error" in payload && payload.error
          ? String(payload.error)
          : `HTTP ${response.status}`;
      return { ok: false, error };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createHttpApi(baseUrl = ""): AirCodeApi {
  const root = baseUrl.replace(/\/$/, "");

  return {
    createSession: (req: CreateSessionRequest) =>
      requestJson<CreateSessionResponse>(`${root}${HttpPaths.sessions}`, {
        method: "POST",
        body: JSON.stringify(req),
      }),

    prompt: (req: PromptRequest) =>
      requestJson<void>(`${root}${HttpPaths.prompt(req.sessionId)}`, {
        method: "POST",
        body: JSON.stringify({ text: req.text }),
      }),

    steer: (req: SteerRequest) =>
      requestJson<void>(`${root}${HttpPaths.steer(req.sessionId)}`, {
        method: "POST",
        body: JSON.stringify({ text: req.text }),
      }),

    abort: (req: SessionIdRequest) =>
      requestJson<void>(`${root}${HttpPaths.abort(req.sessionId)}`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    dispose: (req: SessionIdRequest) =>
      requestJson<void>(`${root}${HttpPaths.session(req.sessionId)}`, {
        method: "DELETE",
      }),

    getState: (req: SessionIdRequest) =>
      requestJson<SessionStateDto>(`${root}${HttpPaths.session(req.sessionId)}`),

    subscribeEvents: (sessionId, listener) => {
      const source = new EventSource(`${root}${HttpPaths.events(sessionId)}`);

      const onSession = (event: MessageEvent<string>): void => {
        try {
          const payload = JSON.parse(event.data) as AgentEventDto;
          listener(payload);
        } catch {
          // Ignore malformed SSE payloads.
        }
      };

      source.addEventListener(SseEventName, onSession as EventListener);

      source.onerror = () => {
        // Browser will auto-reconnect; surface nothing unless closed by client.
      };

      return () => {
        source.removeEventListener(SseEventName, onSession as EventListener);
        source.close();
      };
    },
  };
}

export const aircodeApi = createHttpApi();
