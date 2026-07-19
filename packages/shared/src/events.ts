/**
 * Serializable agent events pushed from main/runtime to the UI.
 * Mirrors Pi AgentSession / agent-core events at a stable DTO boundary.
 */

export type AgentEventDto =
  | { type: "agent_start"; sessionId: string }
  | { type: "agent_end"; sessionId: string }
  | { type: "turn_start"; sessionId: string }
  | { type: "turn_end"; sessionId: string }
  | {
      type: "message_start";
      sessionId: string;
      role: string;
    }
  | {
      type: "message_update";
      sessionId: string;
      delta?: string;
      role?: string;
    }
  | {
      type: "message_end";
      sessionId: string;
      role: string;
      text?: string;
    }
  | {
      type: "tool_execution_start";
      sessionId: string;
      toolCallId: string;
      toolName: string;
      args?: unknown;
    }
  | {
      type: "tool_execution_update";
      sessionId: string;
      toolCallId: string;
      toolName: string;
      partialText?: string;
    }
  | {
      type: "tool_execution_end";
      sessionId: string;
      toolCallId: string;
      toolName: string;
      isError?: boolean;
      resultText?: string;
    }
  | {
      type: "error";
      sessionId: string;
      message: string;
    };
