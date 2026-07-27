import { randomUUID } from 'node:crypto';
import type {
  AgentEventDto,
  ChatMessageDto,
  SessionDetailDto,
  SessionSummaryDto,
} from '@aircode/shared';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  buildClaudeProcessEnv,
  isJsClaudeExecutable,
  resolveClaudeCodeExecutable,
  resolveSettingSources,
} from './claude-runtime.js';
import {
  isResumeNotFoundError,
  SdkContentMapper,
  SNAPSHOT_PREFIX,
  type SdkMessageLike,
} from './sdk-mapper.js';
import type { SettingsService } from './settings-service.js';

type EventListener = (sessionId: string, event: AgentEventDto) => void;

interface SessionRecord {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  claudeSessionId?: string;
  model?: string;
  messages: ChatMessageDto[];
  streaming: boolean;
  streamingContent: string;
  abortController?: AbortController;
}

const DEFAULT_TIMEOUT_MS = 1_800_000; // 30 分钟：长任务墙钟上限（超时前会落盘已生成内容）

/**
 * Claude Agent SDK 会话宿主。
 * 无登录：API Key / 项目目录均来自 SQLite；工作目录为所选项目。
 */
export class AgentHost {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly listeners = new Set<EventListener>();
  private readonly settings: SettingsService;

  constructor(options: { settings: SettingsService }) {
    this.settings = options.settings;
  }

  private projectCwd(): string | null {
    return this.settings.getProjectCwd();
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
    return this.settings.hasApiKey();
  }

  getWorkspace(): {
    cwd: string | null;
    hasApiKey: boolean;
    hasProject: boolean;
    defaultModel?: string;
    claudeHome?: string;
    settingsDbPath?: string;
  } {
    const cwd = this.projectCwd();
    return {
      cwd,
      hasApiKey: this.hasApiKey(),
      hasProject: Boolean(cwd),
      defaultModel: this.settings.getDefaultModel(),
      claudeHome: this.settings.claudeHome,
      settingsDbPath: this.settings.dbPath,
    };
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
    const cwd = input?.cwd?.trim() || this.settings.requireProjectCwd();
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
    if (!s?.abortController) return false;
    // 只发 abort 信号；由 runQuery 统一落盘并推送 aborted / assistant_done
    s.abortController.abort();
    return true;
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error('会话不存在');
    if (s.streaming) throw new Error('当前会话正在生成，请先中止或等待完成');
    if (!this.hasApiKey()) {
      throw new Error('未配置 API Key，请在设置中填写');
    }
    if (!this.projectCwd()) {
      throw new Error('请先选择项目目录');
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

    let abortController = new AbortController();
    s.abortController = abortController;

    /** 致命错误：先落盘已生成内容，再推 error，避免前端流式气泡被 loading=false 卸掉后丢失 */
    const fail = (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      const aborted =
        abortController.signal.aborted ||
        /abort/i.test(raw) ||
        (err instanceof Error && err.name === 'AbortError');
      const msg = aborted
        ? raw && !/abort/i.test(raw)
          ? raw
          : '任务已中止'
        : raw;

      this.commitStreamingAssistant(s, s.streamingContent);
      s.streaming = false;
      s.streamingContent = '';
      s.updatedAt = Date.now();

      if (aborted) {
        this.emit(sessionId, { type: 'aborted', sessionId });
      } else {
        this.emit(sessionId, { type: 'error', sessionId, message: msg });
      }
      this.emit(sessionId, { type: 'status', sessionId, streaming: false });
    };

    try {
      await this.runQuery(s, trimmed, abortController, false);
    } catch (err) {
      if (isResumeNotFoundError(err) && s.claudeSessionId) {
        console.warn('[AgentHost] resume 失效，清空 session 后重试');
        s.claudeSessionId = undefined;
        abortController = new AbortController();
        s.abortController = abortController;
        try {
          await this.runQuery(s, trimmed, abortController, true);
        } catch (retryErr) {
          fail(retryErr);
          throw retryErr;
        }
      } else {
        fail(err);
        throw err;
      }
    } finally {
      s.abortController = undefined;
    }
  }

  /** 将 streamingContent 写入 messages 并推送 assistant_done（有内容时） */
  private commitStreamingAssistant(s: SessionRecord, content: string): string | null {
    const finalContent = content.trimEnd();
    if (!finalContent) return null;
    const assistantId = randomUUID();
    s.messages.push({
      id: assistantId,
      role: 'assistant',
      content: finalContent,
    });
    this.emit(s.id, {
      type: 'assistant_done',
      sessionId: s.id,
      messageId: assistantId,
      content: finalContent,
    });
    return assistantId;
  }

  private async runQuery(
    s: SessionRecord,
    prompt: string,
    abortController: AbortController,
    isRetry: boolean,
  ): Promise<void> {
    const sessionId = s.id;
    const mapper = new SdkContentMapper();
    let accumulated = '';
    let committedFromAssistant = '';
    let timedOut = false;

    const claudeExecutable = resolveClaudeCodeExecutable();
    const authEnv = this.settings.buildAuthEnv();
    const queryEnv = buildClaudeProcessEnv(authEnv);
    const defaultModel = this.settings.getDefaultModel();
    const queryOptions: Record<string, unknown> = {
      cwd: s.cwd,
      resume: s.claudeSessionId,
      abortController,
      includePartialMessages: true,
      permissionMode: 'acceptEdits',
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      settingSources: resolveSettingSources(),
      env: queryEnv,
      allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Skill'],
      canUseTool: async (_toolName: string, input: Record<string, unknown>) => ({
        behavior: 'allow' as const,
        updatedInput: input,
      }),
      stderr: (line: string) => {
        console.error(`[agent-sdk] ${line}`);
      },
    };
    if (defaultModel) {
      queryOptions.model = defaultModel;
      s.model = defaultModel;
    }

    if (claudeExecutable) {
      queryOptions.pathToClaudeCodeExecutable = claudeExecutable;
      if (isJsClaudeExecutable(claudeExecutable)) {
        queryOptions.executable = process.execPath;
      }
    }

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, DEFAULT_TIMEOUT_MS);

    try {
      if (isRetry) {
        accumulated = '';
        committedFromAssistant = '';
        s.streamingContent = '';
      }

      const q = query({
        prompt,
        options: queryOptions as Parameters<typeof query>[0]['options'],
      });

      for await (const message of q) {
        if (abortController.signal.aborted) break;

        const pieces = mapper.mapMessage(message as SdkMessageLike);
        for (const piece of pieces) {
          if (piece.kind === 'session_init') {
            s.claudeSessionId = piece.sessionId;
            if (piece.model) s.model = piece.model;
            this.emit(sessionId, {
              type: 'session_init',
              sessionId,
              model: piece.model ?? s.model,
              cwd: piece.cwd ?? s.cwd,
            });
            continue;
          }

          if (piece.kind === 'error') {
            this.emit(sessionId, { type: 'error', sessionId, message: piece.message });
            continue;
          }

          if (piece.kind === 'delta') {
            if (piece.text.startsWith(SNAPSHOT_PREFIX)) {
              const full = piece.text.slice(SNAPSHOT_PREFIX.length);
              if (!committedFromAssistant) {
                accumulated = full;
              } else {
                // 保留已提交的 tool_result，用完整 assistant 块替换正文/工具调用段
                accumulated = full;
              }
              committedFromAssistant = accumulated;
            } else if (!committedFromAssistant || piece.text.includes('<tool_result>')) {
              accumulated += piece.text;
              if (piece.text.includes('<tool_result>')) {
                committedFromAssistant = accumulated;
              }
            } else {
              // 已有完整 assistant 快照时，跳过可能重复的 stream 文本
              continue;
            }
            s.streamingContent = accumulated;
            this.emit(sessionId, {
              type: 'assistant_delta',
              sessionId,
              content: accumulated,
              delta: piece.text.startsWith(SNAPSHOT_PREFIX)
                ? piece.text.slice(SNAPSHOT_PREFIX.length)
                : piece.text,
            });
            continue;
          }

          if (piece.kind === 'done') {
            if (piece.sessionId) s.claudeSessionId = piece.sessionId;
            const finalContent = accumulated || piece.result || '';
            const assistantId = randomUUID();
            const assistantMsg: ChatMessageDto = {
              id: assistantId,
              role: 'assistant',
              content: finalContent,
            };
            s.messages.push(assistantMsg);
            s.streamingContent = '';
            s.streaming = false;
            s.updatedAt = Date.now();

            // 先落盘再报错，保证前端能把正文写入 chatList
            this.emit(sessionId, {
              type: 'assistant_done',
              sessionId,
              messageId: assistantId,
              content: finalContent,
              usage: piece.usage,
            });

            if (piece.failed && piece.errorMessage) {
              this.emit(sessionId, {
                type: 'error',
                sessionId,
                message: piece.errorMessage,
              });
            }

            this.emit(sessionId, { type: 'status', sessionId, streaming: false });
          }
        }
      }

      const wasAborted = abortController.signal.aborted;

      if (timedOut) {
        if (s.streaming) {
          this.commitStreamingAssistant(s, accumulated || s.streamingContent);
          s.streaming = false;
          s.streamingContent = '';
          s.updatedAt = Date.now();
        }
        const minutes = Math.round(DEFAULT_TIMEOUT_MS / 60_000);
        this.emit(sessionId, {
          type: 'error',
          sessionId,
          message: `Agent 运行超时（${minutes} 分钟），已中止。已生成内容已保留，可继续提问。`,
        });
        this.emit(sessionId, { type: 'status', sessionId, streaming: false });
        return;
      }

      if (wasAborted && s.streaming) {
        this.commitStreamingAssistant(s, accumulated || s.streamingContent);
        s.streaming = false;
        s.streamingContent = '';
        s.updatedAt = Date.now();
        this.emit(sessionId, { type: 'aborted', sessionId });
        this.emit(sessionId, { type: 'status', sessionId, streaming: false });
        return;
      }

      if (s.streaming) {
        this.commitStreamingAssistant(s, accumulated || s.streamingContent);
        s.streaming = false;
        s.streamingContent = '';
        s.updatedAt = Date.now();
        this.emit(sessionId, { type: 'status', sessionId, streaming: false });
      }
    } finally {
      clearTimeout(timeoutTimer);
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
