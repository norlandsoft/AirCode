import type { ChatMessageDto } from './events.js';

export interface CreateSessionRequest {
  cwd?: string;
  title?: string;
}

export interface SessionSummaryDto {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  streaming: boolean;
  model?: string;
}

export interface SessionDetailDto extends SessionSummaryDto {
  messages: ChatMessageDto[];
  /** 当前流式累积内容（若正在生成） */
  streamingContent: string;
}

export interface PromptRequest {
  text: string;
}

export interface WorkspaceDto {
  /** 当前项目目录；未选择时为 null */
  cwd: string | null;
  hasApiKey: boolean;
  hasProject: boolean;
  defaultModel?: string;
  claudeHome?: string;
  settingsDbPath?: string;
}

export interface FileTreeNodeDto {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNodeDto[];
}

export interface FileContentDto {
  path: string;
  content: string;
  language?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
}
