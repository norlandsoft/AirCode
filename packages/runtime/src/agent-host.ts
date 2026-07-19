import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import type { AgentEventDto, SessionStateDto } from "@aircode/shared";
import { mapSessionEvent } from "./map-event.js";

export interface CreateHostSessionOptions {
  cwd: string;
  modelId?: string;
}

export type AgentEventListener = (event: AgentEventDto) => void;

interface HostedSession {
  id: string;
  cwd: string;
  session: AgentSession;
  unsubscribe: () => void;
}

/**
 * Platform runtime facade over Pi's createAgentSession SDK.
 * Keeps HTTP server / CLI free of direct Pi imports.
 */
export class AgentHost {
  private readonly sessions = new Map<string, HostedSession>();
  private readonly listeners = new Set<AgentEventListener>();
  private modelRuntime: ModelRuntime | undefined;
  private modelRuntimePromise: Promise<ModelRuntime> | undefined;

  onEvent(listener: AgentEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async createSession(options: CreateHostSessionOptions): Promise<{ sessionId: string; cwd: string }> {
    const cwd = resolve(options.cwd);
    const modelRuntime = await this.getModelRuntime();

    const { session } = await createAgentSession({
      cwd,
      sessionManager: SessionManager.inMemory(),
      modelRuntime,
    });

    const sessionId = randomUUID();
    const unsubscribe = session.subscribe((event) => {
      const dto = mapSessionEvent(sessionId, event);
      if (dto) {
        this.emit(dto);
      }
    });

    this.sessions.set(sessionId, { id: sessionId, cwd, session, unsubscribe });
    return { sessionId, cwd };
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    try {
      await hosted.session.prompt(text);
    } catch (error) {
      this.emit({
        type: "error",
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async steer(sessionId: string, text: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    await hosted.session.steer(text);
  }

  async abort(sessionId: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    await hosted.session.abort();
  }

  getState(sessionId: string): SessionStateDto {
    const hosted = this.requireSession(sessionId);
    const { session } = hosted;
    const model = session.model;
    return {
      sessionId,
      cwd: hosted.cwd,
      isStreaming: session.isStreaming,
      modelId: model ? `${model.provider}/${model.id}` : undefined,
      thinkingLevel: session.thinkingLevel,
      errorMessage: session.agent.state.errorMessage,
    };
  }

  dispose(sessionId: string): void {
    const hosted = this.sessions.get(sessionId);
    if (!hosted) {
      return;
    }
    hosted.unsubscribe();
    hosted.session.dispose();
    this.sessions.delete(sessionId);
  }

  disposeAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.dispose(sessionId);
    }
  }

  private requireSession(sessionId: string): HostedSession {
    const hosted = this.sessions.get(sessionId);
    if (!hosted) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return hosted;
  }

  private emit(event: AgentEventDto): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener failures must not break the agent loop.
      }
    }
  }

  private async getModelRuntime(): Promise<ModelRuntime> {
    if (this.modelRuntime) {
      return this.modelRuntime;
    }
    if (!this.modelRuntimePromise) {
      this.modelRuntimePromise = ModelRuntime.create().then((runtime) => {
        this.modelRuntime = runtime;
        return runtime;
      });
    }
    return this.modelRuntimePromise;
  }
}
