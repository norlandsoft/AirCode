/** 本地设置（SQLite）相关 DTO */

export interface ModelConnectionDto {
  baseUrl: string;
  /** 是否已存储 Token（永不返回明文） */
  hasToken: boolean;
  model: string;
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
  connection: ModelConnectionDto;
  project: ProjectInfoDto;
  claudeHome: string;
  dbPath: string;
}

/** 自由填写，不绑定固定供应商 */
export interface SaveModelSettingsRequest {
  baseUrl: string;
  model: string;
  /** 省略或空字符串表示保留原 Token */
  token?: string;
}

export interface SetProjectRequest {
  path: string;
}

export interface ClearModelSettingsRequest {
  clearToken?: boolean;
}
