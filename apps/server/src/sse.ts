import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { AgentHost } from "@aircode/runtime";
import { SseEventName, type AgentEventDto } from "@aircode/shared";

/** Subscribe to AgentHost events for one session and push them as SSE. */
export function sessionEventStream(c: Context, host: AgentHost, sessionId: string) {
  return streamSSE(c, async (stream) => {
    const unsubscribe = host.onEvent((event: AgentEventDto) => {
      if (event.sessionId !== sessionId) {
        return;
      }
      void stream.writeSSE({
        event: SseEventName,
        data: JSON.stringify(event),
      });
    });

    try {
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ sessionId }),
      });

      while (!stream.aborted) {
        await stream.sleep(15_000);
        if (!stream.aborted) {
          await stream.writeSSE({ event: "ping", data: "{}" });
        }
      }
    } finally {
      unsubscribe();
    }
  });
}
