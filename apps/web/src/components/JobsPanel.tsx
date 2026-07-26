import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, message } from '@air/design';
import type { ShellJobSummaryDto, ShellTaskDefDto } from '@aircode/shared';
import { api } from '../lib/api';

export function JobsPanel() {
  const [tasks, setTasks] = useState<ShellTaskDefDto[]>([]);
  const [jobs, setJobs] = useState<ShellJobSummaryDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const [customCmd, setCustomCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    const [t, j] = await Promise.all([api.listTasks(), api.listJobs()]);
    setTasks(t);
    setJobs(j);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => {
      message.error(err instanceof Error ? err.message : String(err));
    });
    return () => {
      unsubRef.current?.();
    };
  }, [refresh]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  function watchJob(id: string) {
    unsubRef.current?.();
    setActiveId(id);
    setLog('');
    void api.getJob(id).then((detail) => {
      setLog(detail.log);
    });
    unsubRef.current = api.subscribeJob(id, (envelope) => {
      const { event } = envelope;
      if (event.type === 'job_log') {
        setLog((prev) => prev + event.chunk);
      } else if (event.type === 'job_finished' || event.type === 'job_error') {
        void refresh();
      }
    });
  }

  async function startTask(taskId: string) {
    setBusy(true);
    try {
      const job = await api.createJob({ taskId });
      await refresh();
      watchJob(job.id);
      message.success(`已启动：${job.name}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startCustom() {
    const command = customCmd.trim();
    if (!command) return;
    setBusy(true);
    try {
      const job = await api.createJob({ command, name: command.slice(0, 40) });
      setCustomCmd('');
      await refresh();
      watchJob(job.id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function abortActive() {
    if (!activeId) return;
    try {
      await api.abortJob(activeId);
      message.info('已请求中止');
      await refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  const active = jobs.find((j) => j.id === activeId);

  return (
    <div className="ac-panel ac-jobs-panel">
      <div className="ac-panel-head">
        <span>CI / CD · Shell 任务</span>
        <Button size="sm" onClick={() => void refresh()}>
          刷新
        </Button>
      </div>

      <div className="ac-jobs-tasks">
        {tasks.map((t) => (
          <Button
            key={t.id}
            size="sm"
            type="primary"
            disabled={busy}
            onClick={() => void startTask(t.id)}
            title={t.command}
          >
            {t.name}
          </Button>
        ))}
      </div>

      <div className="ac-jobs-custom">
        <input
          className="ac-input"
          placeholder="自定义命令，如 npm run build"
          value={customCmd}
          onChange={(e) => setCustomCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void startCustom();
          }}
        />
        <Button size="sm" disabled={busy || !customCmd.trim()} onClick={() => void startCustom()}>
          运行
        </Button>
      </div>

      <div className="ac-jobs-list">
        <div className="ac-panel-subhead">历史</div>
        {jobs.length === 0 ? (
          <p className="ac-muted-block">暂无任务</p>
        ) : (
          <ul>
            {jobs.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  className={`ac-job-item ${j.id === activeId ? 'active' : ''}`}
                  onClick={() => watchJob(j.id)}
                >
                  <span className={`ac-job-status ${j.status}`}>{j.status}</span>
                  <span className="ac-job-name">{j.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ac-jobs-log-head">
        <span>日志 {active ? `· ${active.name}` : ''}</span>
        {active?.status === 'running' || active?.status === 'queued' ? (
          <Button size="sm" onClick={() => void abortActive()}>
            停止
          </Button>
        ) : null}
      </div>
      <pre className="ac-jobs-log" ref={logRef}>
        {log || '选择任务查看日志…'}
      </pre>
    </div>
  );
}
