import fs from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type {
  ApiTypeOptionDto,
  AppSettingsDto,
  ModelOptionDto,
  ProjectInfoDto,
  ProviderOptionDto,
  SaveModelSettingsRequest,
} from '@aircode/shared';
import { SettingsDb, defaultDbPath, resolveClaudeHome } from './settings-db.js';

const KEY_MODEL = 'model.connection';
const KEY_API_KEY = 'model.apiKey';
const KEY_PROJECT_CWD = 'project.cwd';
const KEY_PROJECT_RECENT = 'project.recent';

const MAX_RECENT = 12;

export interface StoredModelConnection {
  providerId: string;
  apiType: string;
  baseUrl: string;
  defaultModel: string;
}

const PROVIDERS: ProviderOptionDto[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultApiType: 'anthropic-messages',
  },
  {
    id: 'custom',
    name: '自定义 / 兼容网关',
    defaultBaseUrl: '',
    defaultApiType: 'anthropic-messages',
  },
];

const API_TYPES: ApiTypeOptionDto[] = [
  { id: 'anthropic-messages', label: 'Anthropic Messages' },
  { id: 'openai-completions', label: 'OpenAI Completions（兼容网关）' },
];

const MODELS: ModelOptionDto[] = [
  { id: 'sonnet', name: 'Claude Sonnet（推荐）', providerId: 'anthropic' },
  { id: 'opus', name: 'Claude Opus', providerId: 'anthropic' },
  { id: 'haiku', name: 'Claude Haiku', providerId: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', name: 'claude-sonnet-4-20250514', providerId: 'anthropic' },
  { id: 'claude-opus-4-20250514', name: 'claude-opus-4-20250514', providerId: 'anthropic' },
  { id: 'claude-haiku-4-20250514', name: 'claude-haiku-4-20250514', providerId: 'anthropic' },
];

const DEFAULT_CONNECTION: StoredModelConnection = {
  providerId: 'anthropic',
  apiType: 'anthropic-messages',
  baseUrl: 'https://api.anthropic.com',
  defaultModel: 'sonnet',
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
 * API Key 等仅存库，不从 .env 读取。
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
    const stored = this.db.getJson<Partial<StoredModelConnection>>(KEY_MODEL);
    return {
      providerId: stored?.providerId?.trim() || DEFAULT_CONNECTION.providerId,
      apiType: stored?.apiType?.trim() || DEFAULT_CONNECTION.apiType,
      baseUrl:
        typeof stored?.baseUrl === 'string' ? stored.baseUrl : DEFAULT_CONNECTION.baseUrl,
      defaultModel: stored?.defaultModel?.trim() || DEFAULT_CONNECTION.defaultModel,
    };
  }

  getApiKey(): string | undefined {
    return this.db.get(KEY_API_KEY)?.trim() || undefined;
  }

  hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  getDefaultModel(): string {
    return this.getConnection().defaultModel;
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
      providers: PROVIDERS,
      apiTypes: API_TYPES,
      models: MODELS,
      connection: {
        ...connection,
        hasApiKey: this.hasApiKey(),
      },
      project: this.getProjectInfo(),
      claudeHome: this.claudeHome,
      dbPath: this.db.path,
    };
  }

  saveModelSettings(req: SaveModelSettingsRequest): AppSettingsDto {
    const providerId = req.providerId?.trim() || 'anthropic';
    const apiType = req.apiType?.trim() || 'anthropic-messages';
    const baseUrl = (req.baseUrl ?? '').trim();
    const defaultModel = req.defaultModel?.trim() || 'sonnet';

    if (!PROVIDERS.some((p) => p.id === providerId)) {
      throw new Error(`未知供应商：${providerId}`);
    }
    if (!API_TYPES.some((t) => t.id === apiType)) {
      throw new Error(`未知接口类型：${apiType}`);
    }

    const connection: StoredModelConnection = {
      providerId,
      apiType,
      baseUrl,
      defaultModel,
    };
    this.db.setJson(KEY_MODEL, connection);

    const incoming = req.apiKey?.trim();
    if (incoming) {
      this.db.set(KEY_API_KEY, incoming);
    }

    return this.getAppSettings();
  }

  clearModelSettings(clearApiKey = true): AppSettingsDto {
    this.db.setJson(KEY_MODEL, DEFAULT_CONNECTION);
    if (clearApiKey) {
      this.db.delete(KEY_API_KEY);
    }
    return this.getAppSettings();
  }

  /** 供 AgentHost 注入 SDK 子进程环境 */
  buildAuthEnv(): Record<string, string> {
    const connection = this.getConnection();
    const apiKey = this.getApiKey();
    const env: Record<string, string> = {};

    if (apiKey) {
      env.ANTHROPIC_API_KEY = apiKey;
      if (connection.apiType === 'openai-completions' || connection.providerId === 'custom') {
        env.ANTHROPIC_AUTH_TOKEN = apiKey;
      }
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
