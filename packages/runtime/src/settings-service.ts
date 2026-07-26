import fs from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type {
  AppSettingsDto,
  ProjectInfoDto,
  SaveModelSettingsRequest,
} from '@aircode/shared';
import { SettingsDb, defaultDbPath, resolveClaudeHome } from './settings-db.js';

const KEY_MODEL = 'model.connection';
const KEY_API_KEY = 'model.apiKey';
const KEY_PROJECT_CWD = 'project.cwd';
const KEY_PROJECT_RECENT = 'project.recent';

const MAX_RECENT = 12;

export interface StoredModelConnection {
  baseUrl: string;
  model: string;
}

const DEFAULT_CONNECTION: StoredModelConnection = {
  baseUrl: '',
  model: '',
};

export function expandUserPath(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('路径不能为空');
  if (raw === '~') return homedir();
  if (raw.startsWith('~/')) return resolve(homedir(), raw.slice(2));
  return resolve(raw);
}

/**
 * 应用设置服务：模型 / 项目等持久化到 SQLite。
 * Token 等仅存库，不从 .env 读取。
 */
export class SettingsService {
  readonly claudeHome: string;
  private readonly db: SettingsDb;

  constructor(options?: { claudeHome?: string; dbPath?: string }) {
    this.claudeHome = options?.claudeHome ?? resolveClaudeHome();
    this.db = new SettingsDb(options?.dbPath ?? defaultDbPath(this.claudeHome));
  }

  get dbPath(): string {
    return this.db.path;
  }

  getConnection(): StoredModelConnection {
    const stored = this.db.getJson<Partial<StoredModelConnection> & {
      defaultModel?: string;
    }>(KEY_MODEL);
    const model =
      stored?.model?.trim() ||
      stored?.defaultModel?.trim() ||
      DEFAULT_CONNECTION.model;
    return {
      baseUrl:
        typeof stored?.baseUrl === 'string' ? stored.baseUrl : DEFAULT_CONNECTION.baseUrl,
      model,
    };
  }

  getApiKey(): string | undefined {
    return this.db.get(KEY_API_KEY)?.trim() || undefined;
  }

  hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  getDefaultModel(): string {
    return this.getConnection().model;
  }

  /** 当前项目工作目录；未选择时为 null */
  getProjectCwd(): string | null {
    const cwd = this.db.get(KEY_PROJECT_CWD)?.trim();
    if (!cwd) return null;
    try {
      if (fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) return cwd;
    } catch {
      // ignore
    }
    return null;
  }

  requireProjectCwd(): string {
    const cwd = this.getProjectCwd();
    if (!cwd) throw new Error('请先选择项目目录');
    return cwd;
  }

  getRecentProjects(): string[] {
    const list = this.db.getJson<string[]>(KEY_PROJECT_RECENT);
    if (!Array.isArray(list)) return [];
    return list.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim());
  }

  getProjectInfo(): ProjectInfoDto {
    return {
      cwd: this.getProjectCwd(),
      recent: this.getRecentProjects(),
      claudeHome: this.claudeHome,
      dbPath: this.db.path,
    };
  }

  setProjectCwd(inputPath: string): ProjectInfoDto {
    const cwd = expandUserPath(inputPath);
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`目录不存在：${cwd}`);
    }
    this.db.set(KEY_PROJECT_CWD, cwd);
    const recent = [cwd, ...this.getRecentProjects().filter((p) => p !== cwd)].slice(
      0,
      MAX_RECENT,
    );
    this.db.setJson(KEY_PROJECT_RECENT, recent);
    return this.getProjectInfo();
  }

  getAppSettings(): AppSettingsDto {
    const connection = this.getConnection();
    return {
      connection: {
        baseUrl: connection.baseUrl,
        model: connection.model,
        hasToken: this.hasApiKey(),
      },
      project: this.getProjectInfo(),
      claudeHome: this.claudeHome,
      dbPath: this.db.path,
    };
  }

  saveModelSettings(req: SaveModelSettingsRequest): AppSettingsDto {
    const baseUrl = (req.baseUrl ?? '').trim();
    const model = req.model?.trim() || '';
    if (!model) {
      throw new Error('请填写模型 ID');
    }

    const connection: StoredModelConnection = { baseUrl, model };
    this.db.setJson(KEY_MODEL, connection);

    const incoming = req.token?.trim();
    if (incoming) {
      this.db.set(KEY_API_KEY, incoming);
    }

    return this.getAppSettings();
  }

  clearModelSettings(clearToken = true): AppSettingsDto {
    this.db.setJson(KEY_MODEL, DEFAULT_CONNECTION);
    if (clearToken) {
      this.db.delete(KEY_API_KEY);
    }
    return this.getAppSettings();
  }

  /** 供 AgentHost 注入 SDK 子进程环境 */
  buildAuthEnv(): Record<string, string> {
    const connection = this.getConnection();
    const token = this.getApiKey();
    const env: Record<string, string> = {};

    if (token) {
      // 官方与多数兼容网关均可用；自定义 baseUrl 时 AUTH_TOKEN 更常见
      env.ANTHROPIC_API_KEY = token;
      env.ANTHROPIC_AUTH_TOKEN = token;
    }

    if (connection.baseUrl.trim()) {
      env.ANTHROPIC_BASE_URL = connection.baseUrl.trim().replace(/\/$/, '');
    }

    // Claude Code 配置目录放在应用 Home 下，与项目 cwd 分离
    env.CLAUDE_CONFIG_DIR = resolve(this.claudeHome, 'claude');

    return env;
  }

  close(): void {
    this.db.close();
  }
}
