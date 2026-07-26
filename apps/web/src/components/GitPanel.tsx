import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message } from '@air/design';
import type {
  GitBranchDto,
  GitFileStatusDto,
  GitLogEntryDto,
  GitStatusDto,
} from '@aircode/shared';
import { api } from '../lib/api';

interface Props {
  /** 当前选中的项目目录；变化时自动重新识别仓库 */
  projectCwd: string | null;
  onOpenFile?: (path: string) => void;
  onOpenChat?: () => void;
}

function FileRow({
  file,
  busy,
  onDiff,
  onStage,
  onUnstage,
  onOpen,
}: {
  file: GitFileStatusDto;
  busy: boolean;
  onDiff: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onOpen?: () => void;
}) {
  return (
    <li>
      <button type="button" className="ac-git-file" onClick={onDiff}>
        <span className="ac-git-xy">{file.status}</span>
        <span className="ac-git-path">{file.path}</span>
      </button>
      <div className="ac-git-file-actions">
        {onStage ? (
          <button type="button" className="ac-link-btn" disabled={busy} onClick={onStage}>
            暂存
          </button>
        ) : null}
        {onUnstage ? (
          <button type="button" className="ac-link-btn" disabled={busy} onClick={onUnstage}>
            取消
          </button>
        ) : null}
        {onOpen ? (
          <button type="button" className="ac-link-btn" onClick={onOpen}>
            打开
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function GitPanel({ projectCwd, onOpenFile, onOpenChat }: Props) {
  const [status, setStatus] = useState<GitStatusDto | null>(null);
  const [branches, setBranches] = useState<GitBranchDto[]>([]);
  const [commits, setCommits] = useState<GitLogEntryDto[]>([]);
  const [diff, setDiff] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectCwd) {
      setStatus(null);
      setBranches([]);
      setCommits([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      setError(null);
      const st = await api.gitStatus();
      setStatus(st);
      if (!st.isRepo) {
        setBranches([]);
        setCommits([]);
        setDiff('');
        return;
      }
      const [br, log] = await Promise.all([api.gitBranches(), api.gitLog(8)]);
      setBranches(br.filter((b) => !b.remote));
      setCommits(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [projectCwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const staged = useMemo(
    () => (status?.files ?? []).filter((f) => f.staged),
    [status],
  );
  const unstaged = useMemo(
    () => (status?.files ?? []).filter((f) => f.unstaged || f.untracked),
    [status],
  );

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

  if (!projectCwd) {
    return (
      <div className="ac-panel">
        <div className="ac-panel-head">
          <span>Git</span>
        </div>
        <p className="ac-muted-block">请先选择项目，Git 将自动识别该目录下的仓库与状态。</p>
      </div>
    );
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

  if (loading && !status) {
    return (
      <div className="ac-panel">
        <div className="ac-panel-head">
          <span>Git</span>
        </div>
        <p className="ac-muted-block">正在识别仓库…</p>
      </div>
    );
  }

  if (status && !status.isRepo) {
    return (
      <div className="ac-panel ac-git-panel">
        <div className="ac-panel-head">
          <span>Git</span>
          <Button size="sm" disabled={busy} onClick={() => void refresh()}>
            刷新
          </Button>
        </div>
        <div className="ac-git-meta">
          <div>
            <span className="ac-git-meta-label">项目</span>
            <span className="ac-git-meta-value">{projectCwd}</span>
          </div>
        </div>
        <p className="ac-muted-block">当前项目不是 Git 仓库。</p>
        <div className="ac-settings-actions" style={{ padding: '0 12px 12px' }}>
          <Button
            type="primary"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => api.gitInit(), '已初始化仓库')}
          >
            git init
          </Button>
          {onOpenChat ? (
            <Button size="sm" onClick={onOpenChat}>
              用对话配置远程等
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ac-panel ac-git-panel">
      <div className="ac-panel-head">
        <span>
          {status?.branch ?? '…'}
          {status && (status.ahead > 0 || status.behind > 0)
            ? `  ↑${status.ahead} ↓${status.behind}`
            : ''}
          {status?.clean ? ' · 干净' : ''}
        </span>
        <div className="ac-panel-actions">
          <Button size="sm" disabled={busy} onClick={() => void refresh()}>
            刷新
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => api.gitFetch(), 'Fetch 完成')}
          >
            Fetch
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => api.gitPull(), 'Pull 完成')}
          >
            Pull
          </Button>
          <Button
            size="sm"
            type="primary"
            disabled={busy}
            onClick={() => void run(() => api.gitPush(), 'Push 完成')}
          >
            Push
          </Button>
        </div>
      </div>

      <div className="ac-git-meta">
        <div>
          <span className="ac-git-meta-label">项目</span>
          <span className="ac-git-meta-value" title={status?.cwd}>
            {status?.cwd}
          </span>
        </div>
        {status?.gitRoot && status.gitRoot !== status.cwd ? (
          <div>
            <span className="ac-git-meta-label">仓库根</span>
            <span className="ac-git-meta-value" title={status.gitRoot}>
              {status.gitRoot}
            </span>
          </div>
        ) : null}
        <div>
          <span className="ac-git-meta-label">远程</span>
          <span className="ac-git-meta-value" title={status?.remoteUrl}>
            {status?.remoteUrl || status?.upstream || '（未配置 origin）'}
          </span>
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
        <div className="ac-panel-subhead ac-git-section-head">
          <span>已暂存 ({staged.length})</span>
          {staged.length > 0 ? (
            <button
              type="button"
              className="ac-link-btn"
              disabled={busy}
              onClick={() => void run(() => api.gitUnstageAll())}
            >
              全部取消
            </button>
          ) : null}
        </div>
        {staged.length === 0 ? (
          <p className="ac-muted-block">无暂存变更</p>
        ) : (
          <ul className="ac-git-file-list">
            {staged.map((f) => (
              <FileRow
                key={`s-${f.path}`}
                file={f}
                busy={busy}
                onDiff={() => void showDiff(f)}
                onUnstage={() => void run(() => api.gitUnstage([f.path]))}
                onOpen={onOpenFile ? () => onOpenFile(f.path) : undefined}
              />
            ))}
          </ul>
        )}

        <div className="ac-panel-subhead ac-git-section-head">
          <span>未暂存 ({unstaged.length})</span>
          {unstaged.length > 0 ? (
            <button
              type="button"
              className="ac-link-btn"
              disabled={busy}
              onClick={() => void run(() => api.gitStageAll())}
            >
              全部暂存
            </button>
          ) : null}
        </div>
        {unstaged.length === 0 ? (
          <p className="ac-muted-block">工作区干净</p>
        ) : (
          <ul className="ac-git-file-list">
            {unstaged.map((f) => (
              <FileRow
                key={`u-${f.path}`}
                file={f}
                busy={busy}
                onDiff={() => void showDiff(f)}
                onStage={() => void run(() => api.gitStage([f.path]))}
                onOpen={onOpenFile ? () => onOpenFile(f.path) : undefined}
              />
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
        <div className="ac-git-commit-actions">
          <Button
            size="sm"
            type="primary"
            disabled={busy || !commitMsg.trim() || staged.length === 0}
            onClick={() =>
              void run(async () => {
                await api.gitCommit(commitMsg.trim());
                setCommitMsg('');
              }, '已提交')
            }
          >
            Commit
          </Button>
          <Button
            size="sm"
            disabled={busy || !commitMsg.trim() || (staged.length === 0 && unstaged.length === 0)}
            onClick={() =>
              void run(async () => {
                if (unstaged.length) await api.gitStageAll();
                await api.gitCommit(commitMsg.trim());
                setCommitMsg('');
              }, '已全部暂存并提交')
            }
          >
            全部提交
          </Button>
        </div>
      </div>

      {commits.length > 0 ? (
        <div className="ac-git-log">
          <div className="ac-panel-subhead">最近提交</div>
          <ul>
            {commits.map((c) => (
              <li key={c.hash}>
                <code>{c.shortHash}</code>
                <span>{c.subject}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diff ? <pre className="ac-diff">{diff}</pre> : null}

      <p className="ac-git-tip">
        变基、冲突解决、子模块等复杂操作可在「对话」中交给 Claude Code。
        {onOpenChat ? (
          <>
            {' '}
            <button type="button" className="ac-link-btn" onClick={onOpenChat}>
              去对话
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
