export interface GitFileStatusDto {
  path: string;
  /** porcelain XY 状态，如 M / A / ?? */
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitStatusDto {
  /** 当前项目工作目录 */
  cwd: string;
  /** 是否位于 git 工作树内 */
  isRepo: boolean;
  /** 仓库根目录（git toplevel）；非仓库时等于 cwd */
  gitRoot: string;
  branch: string;
  upstream?: string;
  /** origin 远程 URL（若有） */
  remoteUrl?: string;
  clean: boolean;
  files: GitFileStatusDto[];
  ahead: number;
  behind: number;
}

export interface GitBranchDto {
  name: string;
  current: boolean;
  remote: boolean;
}

export interface GitLogEntryDto {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

export interface GitDiffDto {
  path?: string;
  staged: boolean;
  diff: string;
}

export interface GitCommitRequest {
  message: string;
}

export interface GitCheckoutRequest {
  branch: string;
  create?: boolean;
}

export interface GitStageRequest {
  paths?: string[];
  /** 为 true 时暂存 / 取消暂存全部 */
  all?: boolean;
}
