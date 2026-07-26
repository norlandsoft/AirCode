import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  GitBranchDto,
  GitDiffDto,
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
