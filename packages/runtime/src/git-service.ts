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
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; code?: number; message?: string };
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
  // rename: "R  old -> new"
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

export async function gitStatus(cwd: string): Promise<GitStatusDto> {
  const branchRes = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  if (branchRes.code !== 0) {
    throw new Error('当前工作区不是 git 仓库');
  }
  const branch = branchRes.stdout.trim() || 'HEAD';

  const upstreamRes = await git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}'], {
    allowFail: true,
  });
  const upstream = upstreamRes.code === 0 ? upstreamRes.stdout.trim() : undefined;

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await git(cwd, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`], {
      allowFail: true,
    });
    if (counts.code === 0) {
      const [b, a] = counts.stdout.trim().split(/\s+/).map((n) => Number(n) || 0);
      behind = b ?? 0;
      ahead = a ?? 0;
    }
  }

  const statusRes = await git(cwd, ['status', '--porcelain']);
  const files = statusRes.stdout
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map(parsePorcelain)
    .filter((f): f is GitFileStatusDto => Boolean(f));

  return {
    cwd,
    branch,
    upstream,
    clean: files.length === 0,
    files,
    ahead,
    behind,
  };
}

export async function gitBranches(cwd: string): Promise<GitBranchDto[]> {
  const local = await git(cwd, ['branch', '--format=%(refname:short)|%(HEAD)']);
  const remote = await git(cwd, ['branch', '-r', '--format=%(refname:short)'], { allowFail: true });
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
      // 跳过 "origin/HEAD -> origin/master" 与仅 remote 名（无 /）
      if (name.includes('->') || !name.includes('/') || seen.has(name)) continue;
      seen.add(name);
      branches.push({ name, current: false, remote: true });
    }
  }

  return branches;
}

export async function gitLog(cwd: string, limit = 30): Promise<GitLogEntryDto[]> {
  const res = await git(cwd, [
    'log',
    `-n${limit}`,
    '--pretty=format:%H|%h|%s|%an|%ad',
    '--date=iso',
  ]);
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
  const args = ['diff'];
  if (options?.staged) args.push('--cached');
  if (options?.path) args.push('--', options.path);
  const res = await git(cwd, args, { allowFail: true });
  return {
    path: options?.path,
    staged: Boolean(options?.staged),
    diff: res.stdout || res.stderr,
  };
}

export async function gitStage(cwd: string, paths: string[]): Promise<void> {
  if (!paths.length) throw new Error('请指定要暂存的文件');
  await git(cwd, ['add', '--', ...paths]);
}

export async function gitUnstage(cwd: string, paths: string[]): Promise<void> {
  if (!paths.length) throw new Error('请指定要取消暂存的文件');
  await git(cwd, ['restore', '--staged', '--', ...paths]);
}

export async function gitCommit(cwd: string, message: string): Promise<string> {
  const msg = message.trim();
  if (!msg) throw new Error('提交信息不能为空');
  const res = await git(cwd, ['commit', '-m', msg]);
  return res.stdout.trim() || '提交成功';
}

export async function gitCheckout(
  cwd: string,
  branch: string,
  create = false,
): Promise<string> {
  const name = branch.trim();
  if (!name) throw new Error('分支名不能为空');
  const args = create ? ['checkout', '-b', name] : ['checkout', name];
  const res = await git(cwd, args);
  return res.stdout.trim() || res.stderr.trim() || `已切换到 ${name}`;
}

export async function gitPull(cwd: string): Promise<string> {
  const res = await git(cwd, ['pull', '--ff-only']);
  return res.stdout.trim() || res.stderr.trim() || 'pull 完成';
}

export async function gitPush(cwd: string): Promise<string> {
  const res = await git(cwd, ['push']);
  return res.stdout.trim() || res.stderr.trim() || 'push 完成';
}

export async function gitFetch(cwd: string): Promise<string> {
  const res = await git(cwd, ['fetch', '--all', '--prune']);
  return res.stdout.trim() || res.stderr.trim() || 'fetch 完成';
}
