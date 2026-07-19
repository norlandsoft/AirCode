export interface CreateSessionRequest {
  cwd: string;
  /** Optional model id override; otherwise Pi ModelRuntime default is used. */
  modelId?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  cwd: string;
}

export interface PromptRequest {
  sessionId: string;
  text: string;
}

export interface SteerRequest {
  sessionId: string;
  text: string;
}

export interface SessionIdRequest {
  sessionId: string;
}

export interface SessionStateDto {
  sessionId: string;
  cwd: string;
  isStreaming: boolean;
  modelId?: string;
  thinkingLevel?: string;
  errorMessage?: string;
}

export interface ApiResult<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiResult<T> | ApiError;
