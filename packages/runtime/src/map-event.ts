import type { AgentEventDto } from "@aircode/shared";

/** Narrow unknown Pi session events into stable DTOs for UI / IPC. */
export function mapSessionEvent(sessionId: string, event: unknown): AgentEventDto | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const e = event as Record<string, unknown>;
  const type = e.type;
  if (typeof type !== "string") {
    return null;
  }

  switch (type) {
    case "agent_start":
      return { type: "agent_start", sessionId };
    case "agent_end":
      return { type: "agent_end", sessionId };
    case "turn_start":
      return { type: "turn_start", sessionId };
    case "turn_end":
      return { type: "turn_end", sessionId };
    case "message_start": {
      const role = extractRole(e.message) ?? "unknown";
      return { type: "message_start", sessionId, role };
    }
    case "message_update": {
      const delta = extractTextDelta(e.assistantMessageEvent);
      return {
        type: "message_update",
        sessionId,
        delta,
        role: "assistant",
      };
    }
    case "message_end": {
      const role = extractRole(e.message) ?? "unknown";
      const text = extractMessageText(e.message);
      return { type: "message_end", sessionId, role, text };
    }
    case "tool_execution_start":
      return {
        type: "tool_execution_start",
        sessionId,
        toolCallId: String(e.toolCallId ?? ""),
        toolName: String(e.toolName ?? "unknown"),
        args: e.args,
      };
    case "tool_execution_update":
      return {
        type: "tool_execution_update",
        sessionId,
        toolCallId: String(e.toolCallId ?? ""),
        toolName: String(e.toolName ?? "unknown"),
        partialText: extractToolPartialText(e),
      };
    case "tool_execution_end":
      return {
        type: "tool_execution_end",
        sessionId,
        toolCallId: String(e.toolCallId ?? ""),
        toolName: String(e.toolName ?? "unknown"),
        isError: Boolean(e.isError),
        resultText: extractToolResultText(e),
      };
    default:
      return null;
  }
}

function extractRole(message: unknown): string | undefined {
  if (message && typeof message === "object" && "role" in message) {
    const role = (message as { role: unknown }).role;
    return typeof role === "string" ? role : undefined;
  }
  return undefined;
}

function extractTextDelta(assistantMessageEvent: unknown): string | undefined {
  if (!assistantMessageEvent || typeof assistantMessageEvent !== "object") {
    return undefined;
  }
  const ev = assistantMessageEvent as { type?: unknown; delta?: unknown };
  if (ev.type === "text_delta" && typeof ev.delta === "string") {
    return ev.delta;
  }
  return undefined;
}

function extractMessageText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  const parts: string[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        parts.push(text);
      }
    }
  }
  return parts.length > 0 ? parts.join("") : undefined;
}

function extractToolPartialText(event: Record<string, unknown>): string | undefined {
  const partial = event.partialResult ?? event.result;
  return extractContentText(partial);
}

function extractToolResultText(event: Record<string, unknown>): string | undefined {
  return extractContentText(event.result);
}

function extractContentText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const content = (value as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  const parts: string[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        parts.push(text);
      }
    }
  }
  return parts.length > 0 ? parts.join("") : undefined;
}
