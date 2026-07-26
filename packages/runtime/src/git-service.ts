import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  GitBranchDto,
  GitCommitFileDto,
  GitDiffDto,
  GitFileContentsDto,
  GitFileStatusDto,
  GitLogEntryDto,
  GitStatusDto,
} from '@aircode/shared';

const execFileAsync = promisify(execFile);

async function git(
  cwd: string,
  args: string[],
  options?: { allowFail?: boolean },
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return { stdout: stdout.toString(), stderr: stderr.toString(), code: 0 };
  } catch (err) {
    const e = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      code?: number;
      message?: string;
    };
    const stdout = e.stdout?.toString() ?? '';
    const stderr = e.stderr?.toString() ?? e.message ?? String(err);
    if (options?.allowFail) {
      return { stdout, stderr, code: typeof e.code === 'number' ? e.code : 1 };
    }
    throw new Error(stderr.trim() || 'git 命令失败');
  }
}

function parsePorcelain(line: string): GitFileStatusDto | null {
  if (line.length < 3) return null;
  const xy = line.slice(0, 2);
  let filePath = line.slice(3);
  if (filePath.includes(' -> ')) {
    filePath = filePath.split(' -> ').pop() ?? filePath;
  }
  const x = xy[0] ?? ' ';
  const y = xy[1] ?? ' ';
  const untracked = xy === '??';
  const staged = !untracked && x !== ' ' && x !== '?';
  const unstaged = untracked || (y !== ' ' && y !== '?');
  return {
    path: filePath,
    status: xy.trim() || xy,
    staged,
    unstaged,
    untracked,
  };
}

async function requireRepoRoot(cwd: string): Promise<string> {
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    throw new Error('当前项目不是 Git 仓库');
  }
  const root = await git(cwd, ['rev-parse', '--show-toplevel']);
  return root.stdout.trim() || cwd;
}

/** 识别项目目录对应的 git 仓库并返回状态；非仓库时 isRepo=false（不抛错） */
export async function gitStatus(cwd: string): Promise<GitStatusDto> {
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return {
      cwd,
      isRepo: false,
      gitRoot: cwd,
      branch: '',
      clean: true,
      files: [],
      ahead: 0,
      behind: 0,
    };
  }

  const rootRes = await git(cwd, ['rev-parse', '--show-toplevel']);
  const gitRoot = rootRes.stdout.trim() || cwd;

  const branchRes = await git(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  const branch = branchRes.stdout.trim() || 'HEAD';

  const upstreamRes = await git(gitRoot, ['rev-parse', '--abbrev-ref', '@{upstream}'], {
    allowFail: true,
  });
  const upstream = upstreamRes.code === 0 ? upstreamRes.stdout.trim() : undefined;

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await git(gitRoot, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`], {
      allowFail: true,
    });
    if (counts.code === 0) {
      const [b, a] = counts.stdout.trim().split(/\s+/).map((n) => Number(n) || 0);
      behind = b ?? 0;
      ahead = a ?? 0;
    }
  }

  const remoteRes = await git(gitRoot, ['remote', 'get-url', 'origin'], { allowFail: true });
  const remoteUrl = remoteRes.code === 0 ? remoteRes.stdout.trim() || undefined : undefined;

  const statusRes = await git(gitRoot, ['status', '--porcelain']);
  const files = statusRes.stdout
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map(parsePorcelain)
    .filter((f): f is GitFileStatusDto => Boolean(f));

  return {
    cwd,
    isRepo: true,
    gitRoot,
    branch,
    upstream,
    remoteUrl,
    clean: files.length === 0,
    files,
    ahead,
    behind,
  };
}

export async function gitBranches(cwd: string): Promise<GitBranchDto[]> {
  const gitRoot = await requireRepoRoot(cwd);
  const local = await git(gitRoot, ['branch', '--format=%(refname:short)|%(HEAD)']);
  const remote = await git(gitRoot, ['branch', '-r', '--format=%(refname:short)'], {
    allowFail: true,
  });
  const branches: GitBranchDto[] = [];
  const seen = new Set<string>();

  for (const line of local.stdout.split('\n').filter(Boolean)) {
    const [name, head] = line.split('|');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    branches.push({ name, current: head === '*', remote: false });
  }

  if (remote.code === 0) {
    for (const name of remote.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) {
      if (name.includes('->') || !name.includes('/') || seen.has(name)) continue;
      seen.add(name);
      branches.push({ name, current: false, remote: true });
    }
  }

  return branches;
}

export async function gitLog(cwd: string, limit = 30): Promise<GitLogEntryDto[]> {
  const gitRoot = await requireRepoRoot(cwd);
  const res = await git(gitRoot, [
    'log',
    `-n${limit}`,
    '--pretty=format:%H|%h|%s|%an|%ad',
    '--date=iso',
  ], { allowFail: true });
  if (res.code !== 0) return [];
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, subject, author, date] = line.split('|');
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        subject: subject ?? '',
        author: author ?? '',
        date: date ?? '',
      };
    });
}

export async function gitDiff(
  cwd: string,
  options?: { path?: string; staged?: boolean },
): Promise<GitDiffDto> {
  const gitRoot = await requireRepoRoot(cwd);
  const args = ['diff'];
  if (options?.staged) args.push('--cached');
  if (options?.path) args.push('--', options.path);
  const res = await git(gitRoot, args, { allowFail: true });
  return {
    path: options?.path,
    staged: Boolean(options?.staged),
    diff: res.stdout || res.stderr,
  };
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  toml: 'toml',
};

function guessLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return LANG_BY_EXT[ext] || 'plaintext';
}

const MAX_DIFF_BYTES = 1.5 * 1024 * 1024;

async function gitBlob(gitRoot: string, rev: string): Promise<string | null> {
  const res = await git(gitRoot, ['show', rev], { allowFail: true });
  if (res.code !== 0) return null;
  if (Buffer.byteLength(res.stdout, 'utf8') > MAX_DIFF_BYTES) {
    return `// 文件过大，请在「代码」或对话中查看\n`;
  }
  return res.stdout;
}

function readWorktreeFile(gitRoot: string, relPath: string): string {
  const abs = path.resolve(gitRoot, relPath);
  const rootAbs = path.resolve(gitRoot);
  if (!abs.startsWith(rootAbs + path.sep) && abs !== rootAbs) {
    throw new Error('非法路径');
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return '';
  const buf = fs.readFileSync(abs);
  if (buf.length > MAX_DIFF_BYTES) {
    return `// 文件过大，请在「代码」或对话中查看\n`;
  }
  return buf.toString('utf8');
}

/**
 * 返回 Monaco DiffEditor 所需的 original / modified 文本。
 * - unstaged: 索引(或 HEAD) vs 工作区
 * - staged: HEAD vs 索引
 * - commit: commit^ vs commit
 */
export async function gitFileContents(
  cwd: string,
  options: { path: string; staged?: boolean; commit?: string },
): Promise<GitFileContentsDto> {
  const gitRoot = await requireRepoRoot(cwd);
  const filePath = options.path.trim();
  if (!filePath) throw new Error('请指定文件路径');
  const language = guessLanguage(filePath);

  if (options.commit?.trim()) {
    const commit = options.commit.trim();
    const original = (await gitBlob(gitRoot, `${commit}^:${filePath}`)) ?? '';
    const modified = (await gitBlob(gitRoot, `${commit}:${filePath}`)) ?? '';
    return {
      path: filePath,
      language,
      original,
      modified,
      mode: 'commit',
      commit,
    };
  }

  if (options.staged) {
    const original = (await gitBlob(gitRoot, `HEAD:${filePath}`)) ?? '';
    const modified = (await gitBlob(gitRoot, `:${filePath}`)) ?? '';
    return { path: filePath, language, original, modified, mode: 'staged' };
  }

  const fromIndex = await gitBlob(gitRoot, `:${filePath}`);
  const fromHead = fromIndex === null ? await gitBlob(gitRoot, `HEAD:${filePath}`) : null;
  const original = fromIndex ?? fromHead ?? '';
  const modified = readWorktreeFile(gitRoot, filePath);
  return { path: filePath, language, original, modified, mode: 'unstaged' };
}

export async function gitCommitFiles(
  cwd: string,
  commit: string,
): Promise<GitCommitFileDto[]> {
  const gitRoot = await requireRepoRoot(cwd);
  const hash = commit.trim();
  if (!hash) throw new Error('请指定提交');
  const res = await git(gitRoot, ['show', '--name-status', '--format=', '--find-renames', hash], {
    allowFail: true,
  });
  if (res.code !== 0) return [];
  const files: GitCommitFileDto[] = [];
  for (const line of res.stdout.split('\n').map((l) => l.trimEnd()).filter(Boolean)) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const status = line.slice(0, tab).trim();
    let filePath = line.slice(tab + 1);
    if (filePath.includes('\t')) {
      // rename: R100\told\tnew
      const parts = filePath.split('\t');
      filePath = parts[parts.length - 1] ?? filePath;
    }
    files.push({ path: filePath, status: status[0] ?? status });
  }
  return files;
}

export async function gitStage(cwd: string, paths: string[]): Promise<void> {
  const gitRoot = await requireRepoRoot(cwd);
  if (!paths.length) throw new Error('请指定要暂存的文件');
  await git(gitRoot, ['add', '--', ...paths]);
}

export async function gitStageAll(cwd: string): Promise<void> {
  const gitRoot = await requireRepoRoot(cwd);
  await git(gitRoot, ['add', '-A']);
}

export async function gitUnstage(cwd: string, paths: string[]): Promise<void> {
  const gitRoot = await requireRepoRoot(cwd);
  if (!paths.length) throw new Error('请指定要取消暂存的文件');
  await git(gitRoot, ['restore', '--staged', '--', ...paths]);
}

export async function gitUnstageAll(cwd: string): Promise<void> {
  const gitRoot = await requireRepoRoot(cwd);
  await git(gitRoot, ['reset', 'HEAD'], { allowFail: true });
}

export async function gitCommit(cwd: string, message: string): Promise<string> {
  const gitRoot = await requireRepoRoot(cwd);
  const msg = message.trim();
  if (!msg) throw new Error('提交信息不能为空');
  const res = await git(gitRoot, ['commit', '-m', msg]);
  return res.stdout.trim() || '提交成功';
}

export async function gitCheckout(
  cwd: string,
  branch: string,
  create = false,
): Promise<string> {
  const gitRoot = await requireRepoRoot(cwd);
  const name = branch.trim();
  if (!name) throw new Error('分支名不能为空');
  const args = create ? ['checkout', '-b', name] : ['checkout', name];
  const res = await git(gitRoot, args);
  return res.stdout.trim() || res.stderr.trim() || `已切换到 ${name}`;
}

export async function gitPull(cwd: string): Promise<string> {
  const gitRoot = await requireRepoRoot(cwd);
  const res = await git(gitRoot, ['pull', '--ff-only']);
  return res.stdout.trim() || res.stderr.trim() || 'pull 完成';
}

export async function gitPush(cwd: string): Promise<string> {
  const gitRoot = await requireRepoRoot(cwd);
  const upstream = await git(gitRoot, ['rev-parse', '--abbrev-ref', '@{upstream}'], {
    allowFail: true,
  });
  if (upstream.code !== 0) {
    const remotes = await git(gitRoot, ['remote'], { allowFail: true });
    const list = remotes.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!list.includes('origin')) {
      throw new Error('没有 origin 远程。可在「对话」中让 Claude Code 添加 remote 后再 Push');
    }
    const res = await git(gitRoot, ['push', '-u', 'origin', 'HEAD']);
    return res.stdout.trim() || res.stderr.trim() || '已推送并设置上游分支';
  }
  const res = await git(gitRoot, ['push']);
  return res.stdout.trim() || res.stderr.trim() || 'push 完成';
}

export async function gitFetch(cwd: string): Promise<string> {
  const gitRoot = await requireRepoRoot(cwd);
  const res = await git(gitRoot, ['fetch', '--all', '--prune']);
  return res.stdout.trim() || res.stderr.trim() || 'fetch 完成';
}

export async function gitInit(cwd: string): Promise<string> {
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  if (inside.code === 0 && inside.stdout.trim() === 'true') {
    throw new Error('已经是 Git 仓库');
  }
  await git(cwd, ['init']);
  return '已在当前项目初始化 Git 仓库';
}
