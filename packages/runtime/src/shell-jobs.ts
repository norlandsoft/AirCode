import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CreateJobRequest,
  JobEventDto,
  ShellJobDetailDto,
  ShellJobStatus,
  ShellJobSummaryDto,
  ShellTaskDefDto,
} from '@aircode/shared';

type JobListener = (jobId: string, event: JobEventDto) => void;

interface JobRecord {
  id: string;
  taskId?: string;
  name: string;
  command: string;
  status: ShellJobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number | null;
  log: string;
  child?: ChildProcess;
}

const DEFAULT_TASKS: ShellTaskDefDto[] = [
  { id: 'typecheck', name: 'Typecheck', command: 'npm run typecheck', description: '类型检查' },
  { id: 'build', name: 'Build', command: 'npm run build', description: '编译构建' },
  { id: 'test', name: 'Test', command: 'npm test', description: '运行测试' },
  { id: 'deploy', name: 'Deploy', command: 'npm run deploy', description: '部署（需项目自定义脚本）' },
];

/**
 * Shell 任务运行器（简单 CI/CD）：并发 1，日志事件推送。
 */
export class ShellJobRunner {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly listeners = new Set<JobListener>();
  private readonly cwd: string;
  private activeJobId: string | null = null;
  private readonly queue: string[] = [];

  constructor(options: { cwd: string }) {
    this.cwd = options.cwd;
  }

  onEvent(listener: JobListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(jobId: string, event: JobEventDto): void {
    for (const listener of this.listeners) {
      try {
        listener(jobId, event);
      } catch (err) {
        console.error('[ShellJobRunner] listener error', err);
      }
    }
  }

  async listTasks(): Promise<ShellTaskDefDto[]> {
    const customPath = path.join(this.cwd, '.aircode', 'tasks.json');
    try {
      const raw = await fs.readFile(customPath, 'utf8');
      const parsed = JSON.parse(raw) as { tasks?: ShellTaskDefDto[] };
      if (Array.isArray(parsed.tasks) && parsed.tasks.length) {
        return parsed.tasks.filter((t) => t.id && t.command);
      }
    } catch {
      // 使用默认
    }
    return DEFAULT_TASKS;
  }

  listJobs(): ShellJobSummaryDto[] {
    return [...this.jobs.values()]
      .map((j) => this.toSummary(j))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getJob(id: string): ShellJobDetailDto | null {
    const j = this.jobs.get(id);
    if (!j) return null;
    return { ...this.toSummary(j), log: j.log };
  }

  async createJob(req: CreateJobRequest): Promise<ShellJobSummaryDto> {
    let command = req.command?.trim() ?? '';
    let name = req.name?.trim() || '';
    let taskId = req.taskId?.trim();

    if (taskId) {
      const tasks = await this.listTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`未知任务：${taskId}`);
      command = task.command;
      name = name || task.name;
    }

    if (!command) throw new Error('请指定 taskId 或 command');
    if (!name) name = command.slice(0, 40);

    const id = randomUUID();
    const record: JobRecord = {
      id,
      taskId,
      name,
      command,
      status: 'queued',
      createdAt: Date.now(),
      log: '',
    };
    this.jobs.set(id, record);
    this.queue.push(id);
    void this.pump();
    return this.toSummary(record);
  }

  async abort(jobId: string): Promise<boolean> {
    const j = this.jobs.get(jobId);
    if (!j) return false;
    if (j.status === 'queued') {
      const idx = this.queue.indexOf(jobId);
      if (idx >= 0) this.queue.splice(idx, 1);
      j.status = 'aborted';
      j.finishedAt = Date.now();
      this.emit(jobId, { type: 'job_finished', jobId, status: 'aborted', exitCode: null });
      return true;
    }
    if (j.status === 'running' && j.child) {
      j.child.kill('SIGTERM');
      setTimeout(() => {
        if (j.status === 'running' && j.child && !j.child.killed) {
          j.child.kill('SIGKILL');
        }
      }, 3000);
      return true;
    }
    return false;
  }

  private async pump(): Promise<void> {
    if (this.activeJobId) return;
    const nextId = this.queue.shift();
    if (!nextId) return;
    const job = this.jobs.get(nextId);
    if (!job || job.status !== 'queued') {
      void this.pump();
      return;
    }
    this.activeJobId = nextId;
    await this.runJob(job);
    this.activeJobId = null;
    void this.pump();
  }

  private runJob(job: JobRecord): Promise<void> {
    return new Promise((resolve) => {
      job.status = 'running';
      job.startedAt = Date.now();
      this.emit(job.id, { type: 'job_started', jobId: job.id });

      const child = spawn(job.command, {
        cwd: this.cwd,
        shell: true,
        env: { ...process.env },
      });
      job.child = child;

      const append = (chunk: Buffer | string) => {
        const text = chunk.toString();
        job.log += text;
        this.emit(job.id, { type: 'job_log', jobId: job.id, chunk: text });
      };

      child.stdout?.on('data', append);
      child.stderr?.on('data', append);

      child.on('error', (err) => {
        const msg = err.message;
        job.log += `\n[error] ${msg}\n`;
        this.emit(job.id, { type: 'job_error', jobId: job.id, message: msg });
        job.status = 'failed';
        job.finishedAt = Date.now();
        job.exitCode = 1;
        job.child = undefined;
        this.emit(job.id, {
          type: 'job_finished',
          jobId: job.id,
          status: 'failed',
          exitCode: 1,
        });
        resolve();
      });

      child.on('close', (code, signal) => {
        job.child = undefined;
        job.finishedAt = Date.now();
        job.exitCode = code;
        if (signal === 'SIGTERM' || signal === 'SIGKILL' || job.status === 'aborted') {
          job.status = 'aborted';
        } else if (code === 0) {
          job.status = 'succeeded';
        } else {
          job.status = 'failed';
        }
        this.emit(job.id, {
          type: 'job_finished',
          jobId: job.id,
          status: job.status,
          exitCode: code,
        });
        resolve();
      });
    });
  }

  private toSummary(j: JobRecord): ShellJobSummaryDto {
    return {
      id: j.id,
      taskId: j.taskId,
      name: j.name,
      command: j.command,
      status: j.status,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      exitCode: j.exitCode,
    };
  }
}
