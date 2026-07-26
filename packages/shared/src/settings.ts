/** 本地设置（SQLite）相关 DTO */

export interface ProviderOptionDto {
  id: string;
  name: string;
  defaultBaseUrl?: string;
  defaultApiType?: string;
}

export interface ApiTypeOptionDto {
  id: string;
  label: string;
}

export interface ModelOptionDto {
  id: string;
  name: string;
  providerId: string;
}

export interface ModelConnectionDto {
  providerId: string;
  apiType: string;
  baseUrl: string;
  /** 是否已存储 Token（永不返回明文） */
  hasApiKey: boolean;
  defaultModel: string;
}

export interface ProjectInfoDto {
  /** 当前项目工作目录；未选择时为 null */
  cwd: string | null;
  recent: string[];
  claudeHome: string;
  dbPath: string;
}

export interface BrowseEntryDto {
  name: string;
  path: string;
  type: 'directory';
}

export interface BrowseResultDto {
  path: string;
  parent: string | null;
  entries: BrowseEntryDto[];
}

export interface AppSettingsDto {
  providers: ProviderOptionDto[];
  apiTypes: ApiTypeOptionDto[];
  models: ModelOptionDto[];
  connection: ModelConnectionDto;
  project: ProjectInfoDto;
  claudeHome: string;
  dbPath: string;
}

export interface SaveModelSettingsRequest {
  providerId: string;
  apiType: string;
  baseUrl: string;
  defaultModel: string;
  /** 省略或空字符串表示保留原 Token */
  apiKey?: string;
}

export interface SetProjectRequest {
  path: string;
}

export interface ClearModelSettingsRequest {
  clearApiKey?: boolean;
}
