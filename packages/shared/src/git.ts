export interface GitFileStatusDto {
  path: string;
  /** porcelain XY 状态，如 M / A / ?? */
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitStatusDto {
  cwd: string;
  branch: string;
  upstream?: string;
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
  paths: string[];
}
