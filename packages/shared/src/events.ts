/** 前端 ChatView 兼容的消息 */
export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** Agent 运行事件（经 SSE 推送） */
export type AgentEventDto =
  | {
      type: 'session_init';
      sessionId: string;
      model?: string;
      cwd?: string;
    }
  | {
      type: 'user_message';
      sessionId: string;
      messageId: string;
      content: string;
    }
  | {
      type: 'assistant_delta';
      sessionId: string;
      /** 本轮累积全文（含 <tool_use>/<tool_result> 内联标签） */
      content: string;
      /** 增量片段 */
      delta: string;
    }
  | {
      type: 'assistant_done';
      sessionId: string;
      messageId: string;
      content: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        turns?: number;
      };
    }
  | {
      type: 'error';
      sessionId: string;
      message: string;
    }
  | {
      type: 'aborted';
      sessionId: string;
    }
  | {
      type: 'status';
      sessionId: string;
      streaming: boolean;
    };

export interface AgentEventEnvelope {
  sessionId: string;
  event: AgentEventDto;
  at: number;
}
