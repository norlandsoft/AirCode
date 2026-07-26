import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message, Splitter } from '@air/design';
import type {
  GitBranchDto,
  GitCommitFileDto,
  GitFileContentsDto,
  GitFileStatusDto,
  GitLogEntryDto,
  GitStatusDto,
} from '@aircode/shared';
import { api } from '../lib/api';
import { GitDiffPane } from './GitDiffPane';

interface Props {
  projectCwd: string | null;
  onOpenFile?: (path: string) => void;
  onOpenChat?: () => void;
}

type SideTab = 'changes' | 'history';

function statusLetter(file: GitFileStatusDto): string {
  if (file.untracked) return 'U';
  const s = file.status.replace(/\s/g, '');
  return (s[0] || s[1] || 'M').toUpperCase();
}

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return phone;
}

export function GitPanel({ projectCwd, onOpenFile, onOpenChat }: Props) {
  const isPhone = useIsPhone();
  const [status, setStatus] = useState<GitStatusDto | null>(null);
  const [branches, setBranches] = useState<GitBranchDto[]>([]);
  const [commits, setCommits] = useState<GitLogEntryDto[]>([]);
  const [sideTab, setSideTab] = useState<SideTab>('changes');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitFiles, setCommitFiles] = useState<GitCommitFileDto[]>([]);
  const [contents, setContents] = useState<GitFileContentsDto | null>(null);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileShowDiff, setMobileShowDiff] = useState(false);

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
        setContents(null);
        return;
      }
      const [br, log] = await Promise.all([api.gitBranches(), api.gitLog(50)]);
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

  useEffect(() => {
    if (sideTab !== 'changes' || !status?.isRepo) return;
    setSelectedPath((prev) => {
      if (prev && status.files.some((f) => f.path === prev)) return prev;
      return status.files[0]?.path ?? null;
    });
  }, [sideTab, status]);

  const changeFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (status?.files ?? []).filter((f) =>
      q ? f.path.toLowerCase().includes(q) : true,
    );
  }, [status, filter]);

  const stagedCount = useMemo(
    () => (status?.files ?? []).filter((f) => f.staged).length,
    [status],
  );

  const loadChangeDiff = useCallback(async (file: GitFileStatusDto) => {
    setDiffLoading(true);
    try {
      const stagedOnly = file.staged && !file.unstaged && !file.untracked;
      const data = await api.gitContents({ path: file.path, staged: stagedOnly });
      setContents(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
      setContents(null);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const loadCommitDiff = useCallback(async (commit: string, path: string) => {
    setDiffLoading(true);
    try {
      const data = await api.gitContents({ path, commit });
      setContents(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
      setContents(null);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sideTab !== 'changes' || !selectedPath || !status?.isRepo) return;
    const file = status.files.find((f) => f.path === selectedPath);
    if (!file) {
      setContents(null);
      return;
    }
    void loadChangeDiff(file);
  }, [sideTab, selectedPath, status, loadChangeDiff]);

  useEffect(() => {
    if (sideTab !== 'history' || !selectedCommit || !selectedPath) return;
    void loadCommitDiff(selectedCommit, selectedPath);
  }, [sideTab, selectedCommit, selectedPath, loadCommitDiff]);

  async function selectCommit(hash: string) {
    setSelectedCommit(hash);
    setSelectedPath(null);
    setContents(null);
    setMobileShowDiff(false);
    try {
      const files = await api.gitCommitFiles(hash);
      setCommitFiles(files);
      if (files[0]) {
        setSelectedPath(files[0].path);
        if (isPhone) setMobileShowDiff(true);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
      setCommitFiles([]);
    }
  }

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

  async function toggleStage(file: GitFileStatusDto, checked: boolean) {
    await run(async () => {
      if (checked) await api.gitStage([file.path]);
      else await api.gitUnstage([file.path]);
    });
  }

  async function toggleStageAll(checked: boolean) {
    await run(async () => {
      if (checked) await api.gitStageAll();
      else await api.gitUnstageAll();
    });
  }

  async function onCommit() {
    const msg = [summary.trim(), description.trim()].filter(Boolean).join('\n\n');
    if (!summary.trim()) {
      message.error('请填写提交摘要');
      return;
    }
    await run(async () => {
      if (stagedCount === 0) await api.gitStageAll();
      await api.gitCommit(msg);
      setSummary('');
      setDescription('');
      setSelectedPath(null);
      setContents(null);
    }, '已提交');
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
        <p className="ac-muted-block">当前项目不是 Git 仓库：{projectCwd}</p>
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
              用对话配置远程
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const allStaged =
    changeFiles.length > 0 && changeFiles.every((f) => f.staged && !f.unstaged && !f.untracked);
  const someStaged = changeFiles.some((f) => f.staged);

  const sidebar = (
    <div className="ac-git-sidebar">
      <div className="ac-git-side-tabs">
        <button
          type="button"
          className={sideTab === 'changes' ? 'active' : ''}
          onClick={() => {
            setSideTab('changes');
            setSelectedCommit(null);
            setCommitFiles([]);
            setMobileShowDiff(false);
            if (changeFiles[0] && !selectedPath) setSelectedPath(changeFiles[0].path);
          }}
        >
          变更{changeFiles.length ? ` (${status?.files.length ?? 0})` : ''}
        </button>
        <button
          type="button"
          className={sideTab === 'history' ? 'active' : ''}
          onClick={() => {
            setSideTab('history');
            setContents(null);
            setSelectedPath(null);
            setMobileShowDiff(false);
          }}
        >
          历史
        </button>
      </div>

      {sideTab === 'changes' ? (
        <>
          <div className="ac-git-filter">
            <input
              className="ac-input"
              placeholder="筛选文件…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="ac-git-file-toolbar">
            <label className="ac-git-check">
              <input
                type="checkbox"
                checked={allStaged}
                ref={(el) => {
                  if (el) el.indeterminate = !allStaged && someStaged;
                }}
                disabled={busy || changeFiles.length === 0}
                onChange={(e) => void toggleStageAll(e.target.checked)}
              />
              <span>{changeFiles.length} 个变更文件</span>
            </label>
          </div>
          <ul className="ac-git-change-list">
            {changeFiles.length === 0 ? (
              <li className="ac-muted-block">工作区干净</li>
            ) : (
              changeFiles.map((f) => (
                <li
                  key={f.path}
                  className={selectedPath === f.path ? 'active' : ''}
                >
                  <label className="ac-git-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={f.staged}
                      disabled={busy}
                      onChange={(e) => void toggleStage(f, e.target.checked)}
                    />
                  </label>
                  <button
                    type="button"
                    className="ac-git-change-item"
                    onClick={() => {
                      setSelectedPath(f.path);
                      if (isPhone) setMobileShowDiff(true);
                    }}
                  >
                    <span className="ac-git-change-name" title={f.path}>
                      {f.path.includes('/') ? f.path.split('/').pop() : f.path}
                    </span>
                    <span className="ac-git-change-dir">
                      {f.path.includes('/')
                        ? f.path.slice(0, f.path.lastIndexOf('/'))
                        : ''}
                    </span>
                    <span className={`ac-git-badge ac-git-badge-${statusLetter(f).toLowerCase()}`}>
                      {statusLetter(f)}
                    </span>
                  </button>
                  {onOpenFile ? (
                    <button
                      type="button"
                      className="ac-icon-btn ac-git-open-btn"
                      title="在代码中打开"
                      onClick={() => onOpenFile(f.path)}
                    >
                      ↗
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          <div className="ac-git-commit-box">
            <input
              className="ac-input"
              placeholder="摘要（必填）"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <textarea
              className="ac-textarea"
              rows={3}
              placeholder="描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button
              type="primary"
              disabled={busy || !summary.trim() || (status?.files.length ?? 0) === 0}
              onClick={() => void onCommit()}
            >
              {stagedCount > 0
                ? `提交 ${stagedCount} 个文件到 ${status?.branch ?? '…'}`
                : `提交全部到 ${status?.branch ?? '…'}`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="ac-git-history-list">
            {commits.length === 0 ? (
              <li className="ac-muted-block">暂无提交</li>
            ) : (
              commits.map((c) => (
                <li key={c.hash}>
                  <button
                    type="button"
                    className={`ac-git-history-item ${selectedCommit === c.hash ? 'active' : ''}`}
                    onClick={() => void selectCommit(c.hash)}
                  >
                    <span className="ac-git-history-subject">{c.subject}</span>
                    <span className="ac-git-history-meta">
                      <code>{c.shortHash}</code>
                      <span>{c.author}</span>
                      <span>{c.date.slice(0, 10)}</span>
                    </span>
                  </button>
                  {selectedCommit === c.hash && commitFiles.length > 0 ? (
                    <ul className="ac-git-commit-files">
                      {commitFiles.map((f) => (
                        <li key={f.path}>
                          <button
                            type="button"
                            className={selectedPath === f.path ? 'active' : ''}
                            onClick={() => {
                              setSelectedPath(f.path);
                              if (isPhone) setMobileShowDiff(true);
                            }}
                          >
                            <span className="ac-git-xy">{f.status}</span>
                            <span className="ac-git-path">{f.path}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );

  const diffPane = (
    <div className="ac-git-main">
      {isPhone && mobileShowDiff ? (
        <div className="ac-git-diff-back">
          <Button size="sm" onClick={() => setMobileShowDiff(false)}>
            ← 返回列表
          </Button>
        </div>
      ) : null}
      {diffLoading ? (
        <p className="ac-muted-block">加载 Diff…</p>
      ) : contents ? (
        <GitDiffPane
          path={contents.path}
          language={contents.language}
          original={contents.original}
          modified={contents.modified}
          subtitle={
            contents.mode === 'commit'
              ? contents.commit?.slice(0, 7)
              : contents.mode === 'staged'
                ? '已暂存'
                : '工作区'
          }
        />
      ) : (
        <div className="ac-git-diff-empty">
          <p>选择左侧文件查看 Diff</p>
          <p className="ac-muted">使用 Monaco 展示变更</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="ac-panel ac-git-desktop">
      <div className="ac-git-toolbar">
        <div className="ac-git-toolbar-left">
          <select
            className="ac-select ac-git-branch-select"
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
          {status && (status.ahead > 0 || status.behind > 0) ? (
            <span className="ac-git-sync-badge">
              ↑{status.ahead} ↓{status.behind}
            </span>
          ) : null}
        </div>
        <div className="ac-git-toolbar-right">
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

      <div className="ac-git-body">
        {isPhone ? (
          mobileShowDiff ? (
            diffPane
          ) : (
            sidebar
          )
        ) : (
          <Splitter layout="horizontal" style={{ height: '100%', width: '100%' }}>
            <Splitter.Panel defaultSize={320} min={240} max={480}>
              {sidebar}
            </Splitter.Panel>
            <Splitter.Panel min={320}>{diffPane}</Splitter.Panel>
          </Splitter>
        )}
      </div>
    </div>
  );
}
