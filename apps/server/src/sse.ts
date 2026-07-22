import type { Context } from 'hono';
import type { AgentEventDto } from '@aircode/shared';
import { SseEventName } from '@aircode/shared';
import { streamSSE } from 'hono/streaming';

/** 按 sessionId 过滤的 SSE 订阅 */
export function sessionEventStream(
  c: Context,
  sessionId: string,
  subscribe: (listener: (sid: string, event: AgentEventDto) => void) => () => void,
) {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: SseEventName.ready, data: JSON.stringify({ sessionId }) });

    const unsub = subscribe((sid, event) => {
      if (sid !== sessionId) return;
      void stream.writeSSE({
        event: SseEventName.session,
        data: JSON.stringify({ sessionId: sid, event, at: Date.now() }),
      });
    });

    const ping = setInterval(() => {
      void stream.writeSSE({ event: SseEventName.ping, data: '{}' });
    }, 15000);

    stream.onAbort(() => {
      clearInterval(ping);
      unsub();
    });

    // 保持连接
    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
}
