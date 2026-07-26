import { useCallback, useEffect, useState } from 'react';
import { Button, message } from '@air/design';
import type { GitBranchDto, GitFileStatusDto, GitStatusDto } from '@aircode/shared';
import { api } from '../lib/api';

interface Props {
  onOpenFile?: (path: string) => void;
}

export function GitPanel({ onOpenFile }: Props) {
  const [status, setStatus] = useState<GitStatusDto | null>(null);
  const [branches, setBranches] = useState<GitBranchDto[]>([]);
  const [diff, setDiff] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [st, br] = await Promise.all([api.gitStatus(), api.gitBranches()]);
      setStatus(st);
      setBranches(br.filter((b) => !b.remote));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    try {
      await action();
      if (okMsg) message.success(okMsg);
      await refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function showDiff(file: GitFileStatusDto) {
    try {
      const d = await api.gitDiff(file.path, file.staged && !file.unstaged);
      setDiff(d.diff || '（无差异）');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    return (
      <div className="ac-panel">
        <div className="ac-panel-head">
          <span>Git</span>
          <Button size="sm" onClick={() => void refresh()}>
            重试
          </Button>
        </div>
        <p className="ac-panel-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="ac-panel ac-git-panel">
      <div className="ac-panel-head">
        <span>
          Git · {status?.branch ?? '…'}
          {status && (status.ahead > 0 || status.behind > 0)
            ? ` ↑${status.ahead} ↓${status.behind}`
            : ''}
        </span>
        <div className="ac-panel-actions">
          <Button size="sm" disabled={busy} onClick={() => void refresh()}>
            刷新
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run(() => api.gitFetch(), 'Fetch 完成')}>
            Fetch
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run(() => api.gitPull(), 'Pull 完成')}>
            Pull
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run(() => api.gitPush(), 'Push 完成')}>
            Push
          </Button>
        </div>
      </div>

      <div className="ac-git-branch-row">
        <select
          className="ac-select"
          value={status?.branch ?? ''}
          disabled={busy}
          onChange={(e) => {
            const branch = e.target.value;
            if (branch && branch !== status?.branch) {
              void run(() => api.gitCheckout(branch), `已切换到 ${branch}`);
            }
          }}
        >
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          className="ac-input"
          placeholder="新分支名"
          value={newBranch}
          onChange={(e) => setNewBranch(e.target.value)}
        />
        <Button
          size="sm"
          disabled={busy || !newBranch.trim()}
          onClick={() =>
            void run(async () => {
              await api.gitCheckout(newBranch.trim(), true);
              setNewBranch('');
            }, '已创建分支')
          }
        >
          创建
        </Button>
      </div>

      <div className="ac-git-files">
        <div className="ac-panel-subhead">变更 ({status?.files.length ?? 0})</div>
        {(status?.files ?? []).length === 0 ? (
          <p className="ac-muted-block">工作区干净</p>
        ) : (
          <ul className="ac-git-file-list">
            {(status?.files ?? []).map((f) => (
              <li key={f.path}>
                <button type="button" className="ac-git-file" onClick={() => void showDiff(f)}>
                  <span className="ac-git-xy">{f.status}</span>
                  <span className="ac-git-path">{f.path}</span>
                </button>
                <div className="ac-git-file-actions">
                  {f.unstaged || f.untracked ? (
                    <button
                      type="button"
                      className="ac-link-btn"
                      disabled={busy}
                      onClick={() => void run(() => api.gitStage([f.path]))}
                    >
                      暂存
                    </button>
                  ) : null}
                  {f.staged ? (
                    <button
                      type="button"
                      className="ac-link-btn"
                      disabled={busy}
                      onClick={() => void run(() => api.gitUnstage([f.path]))}
                    >
                      取消
                    </button>
                  ) : null}
                  {onOpenFile ? (
                    <button
                      type="button"
                      className="ac-link-btn"
                      onClick={() => onOpenFile(f.path)}
                    >
                      打开
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ac-git-commit">
        <textarea
          className="ac-textarea"
          rows={2}
          placeholder="提交说明"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
        />
        <Button
          size="sm"
          type="primary"
          disabled={busy || !commitMsg.trim() || !status?.files.some((f) => f.staged)}
          onClick={() =>
            void run(async () => {
              await api.gitCommit(commitMsg.trim());
              setCommitMsg('');
            }, '已提交')
          }
        >
          提交暂存
        </Button>
      </div>

      {diff ? (
        <pre className="ac-diff">{diff}</pre>
      ) : null}
    </div>
  );
}
