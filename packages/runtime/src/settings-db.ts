/**
 * 本地 SQLite 设置存储（Node 内置 node:sqlite）
 * 应用 Home 仅由环境变量 CLAUDE_HOME 决定，其余配置进库。
 */
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** 解析应用 Home（Claude Home）：仅认 CLAUDE_HOME，默认 ~/.aircode */
export function resolveClaudeHome(): string {
  const raw = process.env.CLAUDE_HOME?.trim();
  if (!raw) return join(homedir(), '.aircode');
  if (raw === '~') return homedir();
  if (raw.startsWith('~/')) return join(homedir(), raw.slice(2));
  return resolve(raw);
}

export function defaultDbPath(home = resolveClaudeHome()): string {
  return join(home, 'settings.db');
}

/** @deprecated 使用 resolveClaudeHome */
export function defaultDataDir(): string {
  return resolveClaudeHome();
}

export class SettingsDb {
  readonly path: string;
  private readonly db: DatabaseSync;

  constructor(dbPath = defaultDbPath()) {
    this.path = dbPath;
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  get(key: string): string | undefined {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value?: string } | undefined;
    return typeof row?.value === 'string' ? row.value : undefined;
  }

  getJson<T>(key: string): T | undefined {
    const raw = this.get(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now);
  }

  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  close(): void {
    this.db.close();
  }
}
