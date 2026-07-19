import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  TauriCommands,
  TauriEvents,
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

async function call<T>(command: string, args: Record<string, unknown>): Promise<ApiResponse<T>> {
  try {
    const data = await invoke<T>(command, args);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const aircodeApi: AirCodeApi = {
  createSession: (req: CreateSessionRequest) =>
    call<CreateSessionResponse>(TauriCommands.sessionCreate, { req }),
  prompt: (req: PromptRequest) => call<void>(TauriCommands.sessionPrompt, { req }),
  steer: (req: SteerRequest) => call<void>(TauriCommands.sessionSteer, { req }),
  abort: (req: SessionIdRequest) => call<void>(TauriCommands.sessionAbort, { req }),
  dispose: (req: SessionIdRequest) => call<void>(TauriCommands.sessionDispose, { req }),
  getState: (req: SessionIdRequest) =>
    call<SessionStateDto>(TauriCommands.sessionGetState, { req }),
  onSessionEvent: (listener: (event: AgentEventDto) => void): (() => void) => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    void listen<AgentEventDto>(TauriEvents.sessionEvent, (event) => {
      listener(event.payload);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  },
};
