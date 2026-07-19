import type {
  ApiResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  PromptRequest,
  SessionIdRequest,
  SessionStateDto,
  SteerRequest,
} from "./session.js";
import type { AgentEventDto } from "./events.js";

/** Frontend-facing agent API (implemented via HTTP REST + SSE). */
export interface AirCodeApi {
  createSession: (
    req: CreateSessionRequest,
  ) => Promise<ApiResponse<CreateSessionResponse>>;
  prompt: (req: PromptRequest) => Promise<ApiResponse<void>>;
  steer: (req: SteerRequest) => Promise<ApiResponse<void>>;
  abort: (req: SessionIdRequest) => Promise<ApiResponse<void>>;
  dispose: (req: SessionIdRequest) => Promise<ApiResponse<void>>;
  getState: (req: SessionIdRequest) => Promise<ApiResponse<SessionStateDto>>;
  /** Subscribe to SSE events for a session. */
  subscribeEvents: (
    sessionId: string,
    listener: (event: AgentEventDto) => void,
  ) => () => void;
}
