import { randomUUID } from 'node:crypto';
import type {
  AgentEventDto,
  ChatMessageDto,
  SessionDetailDto,
  SessionSummaryDto,
} from '@aircode/shared';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { formatToolResultInlineTag, formatToolUseInlineTag } from './tool-tags.js';

type EventListener = (sessionId: string, event: AgentEventDto) => void;

interface SessionRecord {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  /** Claude Code SDK session id（用于 resume） */
  claudeSessionId?: string;
  model?: string;
  messages: ChatMessageDto[];
  streaming: boolean;
  streamingContent: string;
  abortController?: AbortController;
}

function contentBlockToDelta(block: unknown): string {
  if (!block || typeof block !== 'object') return '';
  const b = block as Record<string, unknown>;
  if (b.type === 'text' && typeof b.text === 'string') return b.text;
  if (b.type === 'thinking' && typeof b.thinking === 'string') {
    return `\n<think>${b.thinking}</think>\n`;
  }
  if (b.type === 'tool_use') {
    const name = typeof b.name === 'string' ? b.name : 'tool';
    const input = b.input ?? {};
    return formatToolUseInlineTag(name, JSON.stringify(input));
  }
  return '';
}

function extractTextDeltaFromStreamEvent(event: unknown): string {
  if (!event || typeof event !== 'object') return '';
  const e = event as Record<string, unknown>;
  if (e.type === 'content_block_delta' && e.delta && typeof e.delta === 'object') {
    const d = e.delta as Record<string, unknown>;
    if (d.type === 'text_delta' && typeof d.text === 'string') return d.text;
    if (d.type === 'thinking_delta' && typeof d.thinking === 'string') {
      // 流式 thinking：简单追加（ChatView 在未闭合时当普通文本）
      return d.thinking;
    }
  }
  if (e.type === 'content_block_start' && e.content_block) {
    const block = e.content_block as Record<string, unknown>;
    if (block.type === 'tool_use') {
      const name = typeof block.name === 'string' ? block.name : 'tool';
      // 工具参数在后续 input_json_delta 中；先占位空对象，完整版在 assistant 消息里补齐
      return formatToolUseInlineTag(name, '{}');
    }
    if (block.type === 'thinking') return '\n<think>';
  }
  if (e.type === 'content_block_stop') {
    // thinking 闭合由完整 assistant 消息覆盖更稳妥；此处不强制
  }
  return '';
}

/**
 * Claude Agent SDK 会话宿主。
 * 无登录：依赖进程环境 ANTHROPIC_API_KEY。
 */
export class AgentHost {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly listeners = new Set<EventListener>();
  private readonly defaultCwd: string;

  constructor(options?: { defaultCwd?: string }) {
    this.defaultCwd = options?.defaultCwd?.trim() || process.cwd();
  }

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(sessionId: string, event: AgentEventDto): void {
    for (const listener of this.listeners) {
      try {
        listener(sessionId, event);
      } catch (err) {
        console.error('[AgentHost] listener error', err);
      }
    }
  }

  hasApiKey(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  getWorkspace(): { cwd: string; hasApiKey: boolean } {
    return { cwd: this.defaultCwd, hasApiKey: this.hasApiKey() };
  }

  listSessions(): SessionSummaryDto[] {
    return [...this.sessions.values()]
      .map((s) => this.toSummary(s))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSession(id: string): SessionDetailDto | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    return {
      ...this.toSummary(s),
      messages: [...s.messages],
      streamingContent: s.streamingContent,
    };
  }

  createSession(input?: { cwd?: string; title?: string }): SessionSummaryDto {
    const id = randomUUID();
    const now = Date.now();
    const cwd = input?.cwd?.trim() || this.defaultCwd;
    const record: SessionRecord = {
      id,
      title: input?.title?.trim() || '新会话',
      cwd,
      createdAt: now,
      updatedAt: now,
      messages: [],
      streaming: false,
      streamingContent: '',
    };
    this.sessions.set(id, record);
    return this.toSummary(record);
  }

  deleteSession(id: string): boolean {
    const s = this.sessions.get(id);
    if (!s) return false;
    s.abortController?.abort();
    this.sessions.delete(id);
    return true;
  }

  async abort(sessionId: string): Promise<boolean> {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.abortController?.abort();
    s.streaming = false;
    this.emit(sessionId, { type: 'aborted', sessionId });
    this.emit(sessionId, { type: 'status', sessionId, streaming: false });
    return true;
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error('会话不存在');
    if (s.streaming) throw new Error('当前会话正在生成，请先中止或等待完成');
    if (!this.hasApiKey()) {
      throw new Error('未配置 ANTHROPIC_API_KEY，请在环境变量或 .env 中设置');
    }

    const trimmed = text.trim();
    if (!trimmed) throw new Error('消息不能为空');

    const userMsg: ChatMessageDto = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
    };
    s.messages.push(userMsg);
    if (s.messages.filter((m) => m.role === 'user').length === 1) {
      s.title = trimmed.slice(0, 40) + (trimmed.length > 40 ? '…' : '');
    }
    s.updatedAt = Date.now();
    s.streaming = true;
    s.streamingContent = '';
    this.emit(sessionId, {
      type: 'user_message',
      sessionId,
      messageId: userMsg.id,
      content: trimmed,
    });
    this.emit(sessionId, { type: 'status', sessionId, streaming: true });

    const abortController = new AbortController();
    s.abortController = abortController;

    let accumulated = '';
    /** 已通过完整 assistant 消息写入的文本长度，用于避免与 stream_event 重复 */
    let committedFromAssistant = '';
    const seenToolUseIds = new Set<string>();

    try {
      const q = query({
        prompt: trimmed,
        options: {
          cwd: s.cwd,
          resume: s.claudeSessionId,
          abortController,
          includePartialMessages: true,
          permissionMode: 'acceptEdits',
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          settingSources: ['project'],
        },
      });

      for await (const message of q) {
        if (abortController.signal.aborted) break;

        if (message.type === 'system' && 'subtype' in message && message.subtype === 'init') {
          s.claudeSessionId = message.session_id;
          s.model = message.model;
          this.emit(sessionId, {
            type: 'session_init',
            sessionId,
            model: message.model,
            cwd: message.cwd,
          });
          continue;
        }

        if (message.type === 'stream_event') {
          const delta = extractTextDeltaFromStreamEvent(message.event);
          if (delta) {
            // 若已有完整 assistant 块，优先以完整块为准，跳过可能重复的 stream 文本
            if (!committedFromAssistant) {
              accumulated += delta;
              s.streamingContent = accumulated;
              this.emit(sessionId, {
                type: 'assistant_delta',
                sessionId,
                content: accumulated,
                delta,
              });
            }
          }
          continue;
        }

        if (message.type === 'assistant') {
          s.claudeSessionId = message.session_id;
          const parts: string[] = [];
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== 'object') continue;
              const b = block as Record<string, unknown>;
              if (b.type === 'tool_use' && typeof b.id === 'string') {
                if (seenToolUseIds.has(b.id)) continue;
                seenToolUseIds.add(b.id);
              }
              const piece = contentBlockToDelta(block);
              if (piece) parts.push(piece);
            }
          }
          const full = parts.join('');
          if (full) {
            // 完整 assistant 消息替换本轮此前 stream 累积，避免 tool 参数不完整
            if (!committedFromAssistant) {
              accumulated = full;
            } else {
              accumulated = committedFromAssistant + full;
            }
            committedFromAssistant = accumulated;
            s.streamingContent = accumulated;
            this.emit(sessionId, {
              type: 'assistant_delta',
              sessionId,
              content: accumulated,
              delta: full,
            });
          }
          continue;
        }

        if (message.type === 'user') {
          // 工具结果会以 user 消息形式回传
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== 'object') continue;
              const b = block as Record<string, unknown>;
              if (b.type === 'tool_result') {
                const detail =
                  typeof b.content === 'string'
                    ? b.content
                    : Array.isArray(b.content)
                      ? b.content
                          .map((c) =>
                            c && typeof c === 'object' && 'text' in c
                              ? String((c as { text: unknown }).text)
                              : JSON.stringify(c),
                          )
                          .join('\n')
                      : JSON.stringify(b.content ?? '');
                const tag = formatToolResultInlineTag(detail);
                accumulated += tag;
                committedFromAssistant = accumulated;
                s.streamingContent = accumulated;
                this.emit(sessionId, {
                  type: 'assistant_delta',
                  sessionId,
                  content: accumulated,
                  delta: tag,
                });
              }
            }
          }
          continue;
        }

        if (message.type === 'result') {
          s.claudeSessionId = message.session_id;
          const assistantId = randomUUID();
          const finalContent = accumulated || (message.subtype === 'success' ? message.result : '');
          const assistantMsg: ChatMessageDto = {
            id: assistantId,
            role: 'assistant',
            content: finalContent,
          };
          s.messages.push(assistantMsg);
          s.streamingContent = '';
          s.streaming = false;
          s.updatedAt = Date.now();

          if (message.subtype !== 'success' && 'errors' in message) {
            const errText = message.errors?.join('; ') || 'Agent 执行失败';
            this.emit(sessionId, { type: 'error', sessionId, message: errText });
          }

          this.emit(sessionId, {
            type: 'assistant_done',
            sessionId,
            messageId: assistantId,
            content: finalContent,
            usage: {
              inputTokens: message.usage?.input_tokens,
              outputTokens: message.usage?.output_tokens,
              costUsd: message.total_cost_usd,
              turns: message.num_turns,
            },
          });
          this.emit(sessionId, { type: 'status', sessionId, streaming: false });
        }
      }

      // 若循环因 abort 结束且尚未落库
      if (s.streaming) {
        if (accumulated) {
          const assistantId = randomUUID();
          s.messages.push({ id: assistantId, role: 'assistant', content: accumulated });
          this.emit(sessionId, {
            type: 'assistant_done',
            sessionId,
            messageId: assistantId,
            content: accumulated,
          });
        }
        s.streaming = false;
        s.streamingContent = '';
        this.emit(sessionId, { type: 'status', sessionId, streaming: false });
      }
    } catch (err) {
      s.streaming = false;
      s.streamingContent = accumulated;
      const msg = err instanceof Error ? err.message : String(err);
      if (accumulated) {
        s.messages.push({
          id: randomUUID(),
          role: 'assistant',
          content: accumulated,
        });
      }
      this.emit(sessionId, { type: 'error', sessionId, message: msg });
      this.emit(sessionId, { type: 'status', sessionId, streaming: false });
      throw err;
    } finally {
      s.abortController = undefined;
    }
  }

  async disposeAll(): Promise<void> {
    for (const s of this.sessions.values()) {
      s.abortController?.abort();
    }
    this.sessions.clear();
    this.listeners.clear();
  }

  private toSummary(s: SessionRecord): SessionSummaryDto {
    return {
      id: s.id,
      title: s.title,
      cwd: s.cwd,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      streaming: s.streaming,
      model: s.model,
    };
  }
}
