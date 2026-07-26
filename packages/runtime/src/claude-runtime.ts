/**
 * Claude Code 运行时解析（精简自 AirOne machine claudeRuntime）
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export type ClaudeSettingSource = 'user' | 'project' | 'local';

/** 解析 Claude Code 可执行文件路径 */
export function resolveClaudeCodeExecutable(): string | undefined {
  const explicit = process.env.CLAUDE_CODE_EXECUTABLE?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  try {
    const pkgDir = path.dirname(require.resolve('@anthropic-ai/claude-code/package.json'));
    for (const name of ['claude', 'claude.exe']) {
      const nativeBin = path.join(pkgDir, 'bin', name);
      if (fs.existsSync(nativeBin)) return nativeBin;
    }
  } catch {
    // 未安装 @anthropic-ai/claude-code
  }

  try {
    const sdkDir = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk/package.json'));
    const sdkCli = path.join(sdkDir, 'cli.js');
    if (fs.existsSync(sdkCli)) return sdkCli;
  } catch {
    // SDK 不可用
  }

  return undefined;
}

/** 是否需通过 node 启动 CC（SDK 内置 cli.js 等） */
export function isJsClaudeExecutable(executablePath: string): boolean {
  return ['.js', '.mjs', '.tsx', '.ts', '.jsx'].some((ext) => executablePath.endsWith(ext));
}

export function resolveSettingSources(): ClaudeSettingSource[] {
  return ['user', 'project', 'local'];
}

function ensureNodeOnPath(env: Record<string, string | undefined>): void {
  const nodeBin = path.dirname(process.execPath);
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const current = env[pathKey] ?? '';
  const segments = current.split(path.delimiter).filter(Boolean);
  if (!segments.includes(nodeBin)) {
    env[pathKey] = current ? `${nodeBin}${path.delimiter}${current}` : nodeBin;
  }
}

/** 构建 query 子进程 env（须继承 process.env，否则 PATH 丢失） */
export function buildClaudeProcessEnv(
  sessionEnv?: Record<string, string>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  if (sessionEnv) Object.assign(env, sessionEnv);
  env.PLAYWRIGHT_MCP_HEADLESS = '1';
  env.PLAYWRIGHT_MCP_ISOLATED = '1';
  if (!env.CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS?.trim()) {
    env.CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS = '0';
  }
  ensureNodeOnPath(env);
  return env;
}
