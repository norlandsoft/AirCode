/**
 * SDK 流式消息 → 内联文本增量（精简自 AirOne SdkMessageStreamMapper）
 * 产出可直接追加到 assistant content 的字符串片段。
 */
import { formatToolResultInlineTag, formatToolUseInlineTag } from './tool-tags.js';

type ContentBlock = {
  type?: string;
  id?: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
};

export interface SdkMessageLike {
  type?: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  cwd?: string;
  result?: string;
  is_error?: boolean;
  errors?: string[];
  error?: string;
  error_status?: number;
  attempt?: number;
  max_retries?: number;
  message?: { content?: ContentBlock[] };
  event?: {
    type?: string;
    delta?: { type?: string; text?: string; thinking?: string };
    content_block?: ContentBlock;
  };
  usage?: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
  num_turns?: number;
}

export type MappedPiece =
  | { kind: 'delta'; text: string }
  | { kind: 'session_init'; sessionId: string; model?: string; cwd?: string }
  | { kind: 'error'; message: string }
  | {
      kind: 'done';
      sessionId?: string;
      result?: string;
      failed: boolean;
      errorMessage?: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        turns?: number;
      };
    };

function toolResultDetail(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        c && typeof c === 'object' && 'text' in c
          ? String((c as { text: unknown }).text)
          : JSON.stringify(c),
      )
      .join('\n');
  }
  return JSON.stringify(content ?? '');
}

/**
 * 有状态 mapper：每个 prompt 调用新建实例。
 */
export class SdkContentMapper {
  private inThinking = false;
  private readonly seenToolUseIds = new Set<string>();

  mapMessage(message: SdkMessageLike): MappedPiece[] {
    const out: MappedPiece[] = [];

    if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
      out.push({
        kind: 'session_init',
        sessionId: message.session_id,
        model: message.model,
        cwd: message.cwd,
      });
    }

    if (message.type === 'system' && message.subtype === 'api_retry') {
      const attempt = message.attempt ?? 0;
      const maxRetries = message.max_retries ?? 10;
      const errCode = message.error?.trim() || 'api_error';
      const httpStatus = message.error_status;
      const authFailed =
        errCode === 'authentication_failed' ||
        errCode === 'invalid_api_key' ||
        httpStatus === 401;
      const retriesExhausted = attempt >= maxRetries;
      if (authFailed || retriesExhausted) {
        out.push({
          kind: 'error',
          message: authFailed
            ? 'API 认证失败（401），请检查 ANTHROPIC_API_KEY 或 ~/.claude/settings.json'
            : `API 请求失败：${errCode}${httpStatus ? `（HTTP ${httpStatus}）` : ''}`,
        });
      }
    }

    if (message.type === 'stream_event' && message.event) {
      const ev = message.event;
      if (ev.type === 'message_start' && this.inThinking) {
        out.push({ kind: 'delta', text: '</think>' });
        this.inThinking = false;
      }
      if (ev.type === 'content_block_start') {
        const blockType = ev.content_block?.type;
        if (blockType === 'thinking' || blockType === 'redacted_reasoning') {
          if (!this.inThinking) {
            out.push({ kind: 'delta', text: '\n<think>' });
            this.inThinking = true;
          }
        } else if (this.inThinking) {
          out.push({ kind: 'delta', text: '</think>\n' });
          this.inThinking = false;
        }
        if (blockType === 'tool_use') {
          const name = typeof ev.content_block?.name === 'string' ? ev.content_block.name : 'tool';
          // 参数在完整 assistant 消息中补齐；此处先占位
          out.push({ kind: 'delta', text: formatToolUseInlineTag(name, '{}') });
        }
      }
      if (ev.type === 'content_block_stop' && this.inThinking) {
        out.push({ kind: 'delta', text: '</think>\n' });
        this.inThinking = false;
      }
      if (ev.type === 'content_block_delta') {
        const delta = ev.delta;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          out.push({ kind: 'delta', text: delta.text });
        }
        if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
          out.push({ kind: 'delta', text: delta.thinking });
        }
      }
    }

    if (message.type === 'assistant') {
      if (message.error) {
        out.push({ kind: 'error', message: message.error });
      }
      const blocks = message.message?.content;
      if (Array.isArray(blocks)) {
        const parts: string[] = [];
        for (const block of blocks) {
          if (!block || typeof block !== 'object') continue;
          if (block.type === 'text' && typeof block.text === 'string') {
            parts.push(block.text);
          } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
            parts.push(`\n<think>${block.thinking}</think>\n`);
          } else if (block.type === 'tool_use') {
            const id = typeof block.id === 'string' ? block.id : '';
            if (id && this.seenToolUseIds.has(id)) continue;
            if (id) this.seenToolUseIds.add(id);
            const name = typeof block.name === 'string' ? block.name : 'tool';
            parts.push(formatToolUseInlineTag(name, JSON.stringify(block.input ?? {})));
          }
        }
        if (parts.length) {
          // 完整 assistant 块作为替换快照由调用方处理
          out.push({ kind: 'delta', text: `\0SNAPSHOT\0${parts.join('')}` });
        }
      }
      if (message.session_id) {
        out.push({
          kind: 'session_init',
          sessionId: message.session_id,
        });
      }
    }

    if (message.type === 'user') {
      const blocks = message.message?.content;
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block?.type === 'tool_result') {
            out.push({
              kind: 'delta',
              text: formatToolResultInlineTag(toolResultDetail(block.content)),
            });
          }
        }
      }
    }

    if (message.type === 'result') {
      if (this.inThinking) {
        out.push({ kind: 'delta', text: '</think>\n' });
        this.inThinking = false;
      }
      const failed =
        message.is_error === true ||
        (message.subtype != null && message.subtype !== 'success');
      out.push({
        kind: 'done',
        sessionId: message.session_id,
        result: typeof message.result === 'string' ? message.result : undefined,
        failed,
        errorMessage: failed
          ? message.errors?.join('; ') ||
            (typeof message.result === 'string' ? message.result : '') ||
            `Agent 执行失败 (${message.subtype ?? 'error'})`
          : undefined,
        usage: {
          inputTokens: message.usage?.input_tokens,
          outputTokens: message.usage?.output_tokens,
          costUsd: message.total_cost_usd,
          turns: message.num_turns,
        },
      });
    }

    return out;
  }
}

export const SNAPSHOT_PREFIX = '\0SNAPSHOT\0';

export function isResumeNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no conversation found/i.test(msg) || /conversation.*not found/i.test(msg);
}
