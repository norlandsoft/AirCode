export type ShellJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'aborted';

export interface ShellTaskDefDto {
  id: string;
  name: string;
  command: string;
  description?: string;
}

export interface ShellJobSummaryDto {
  id: string;
  taskId?: string;
  name: string;
  command: string;
  status: ShellJobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number | null;
}

export interface ShellJobDetailDto extends ShellJobSummaryDto {
  log: string;
}

export interface CreateJobRequest {
  /** 预置任务 id，与 command 二选一 */
  taskId?: string;
  /** 自定义 shell 命令 */
  command?: string;
  name?: string;
}

export type JobEventDto =
  | { type: 'job_started'; jobId: string }
  | { type: 'job_log'; jobId: string; chunk: string }
  | {
      type: 'job_finished';
      jobId: string;
      status: ShellJobStatus;
      exitCode?: number | null;
    }
  | { type: 'job_error'; jobId: string; message: string };

export interface JobEventEnvelope {
  jobId: string;
  event: JobEventDto;
  at: number;
}
