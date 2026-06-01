import { useState, useEffect, useCallback, useRef } from "react"
import {
  GitBranch,
  Upload,
  Download,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  Copy,
} from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { useGitStore } from "@/stores/useGitStore"
import { SplitPane } from "@/components/layout/SplitPane"
import type { Tab, GitFileChange, GitCommit, GitCommitFile } from "@/lib/types"

interface GitTabProps {
  tab: Tab
}

// ── Branch Selector ──────────────────────────────────────────

function BranchSelector() {
  const branch = useGitStore((s) => s.branch)
  const branches = useGitStore((s) => s.branches)
  const switchBranch = useGitStore((s) => s.switchBranch)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleSwitch = (name: string) => {
    if (activeProject && name !== branch) {
      switchBranch(activeProject.path, name)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-xs"
      >
        <GitBranch size={14} className="text-text-secondary" />
        <span className="text-text-primary">{branch || "no branch"}</span>
        <ChevronDown size={12} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 border border-panel-border bg-panel-bg shadow-lg">
          {branches.map((b) => (
            <button
              key={b.name}
              onClick={() => handleSwitch(b.name)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-panel-hover ${
                b.is_current ? "text-accent" : "text-text-secondary"
              }`}
            >
              {b.is_current && <span className="text-accent">●</span>}
              <span className={b.is_current ? "font-medium" : ""}>{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status Color ──────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === "D") return "text-danger"
  if (status === "?" || status === "M") return "text-warning"
  return "text-success"
}

// ── File Row (for changes panel) ──────────────────────────────

function FileRow({
  file,
  onStage,
  onUnstage,
  onDiscard,
  onViewDiff,
}: {
  file: GitFileChange
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
  onViewDiff: () => void
}) {
  return (
    <div className="group flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-panel-hover">
      <span className={`w-4 shrink-0 text-center font-mono ${statusColor(file.status)}`}>
        {file.status}
      </span>
      <span
        className="min-w-0 flex-1 cursor-pointer truncate text-text-secondary"
        onClick={onViewDiff}
        title={file.path}
      >
        {file.path}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {onStage && (
          <button onClick={onStage} className="rounded p-0.5 text-text-muted hover:text-success" title="暂存">
            <Plus size={12} />
          </button>
        )}
        {onUnstage && (
          <button onClick={onUnstage} className="rounded p-0.5 text-text-muted hover:text-warning" title="取消暂存">
            <Minus size={12} />
          </button>
        )}
        {onDiscard && (
          <button onClick={onDiscard} className="rounded p-0.5 text-text-muted hover:text-danger" title="丢弃更改">
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Changes Panel ─────────────────────────────────────────────

function ChangesPanel({ projectPath }: { projectPath: string }) {
  const files = useGitStore((s) => s.files)
  const stageFile = useGitStore((s) => s.stageFile)
  const stageAll = useGitStore((s) => s.stageAll)
  const unstageFile = useGitStore((s) => s.unstageFile)
  const unstageAll = useGitStore((s) => s.unstageAll)
  const discardFile = useGitStore((s) => s.discardFile)
  const viewFileDiff = useGitStore((s) => s.viewFileDiff)

  const staged = files.filter((f) => f.staged)
  const unstaged = files.filter((f) => !f.staged && f.status !== "?")
  const untracked = files.filter((f) => f.status === "?")

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Staged */}
      {staged.length > 0 && (
        <div className="border-b border-panel-border pb-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
              已暂存 ({staged.length})
            </span>
            <button
              onClick={() => unstageAll(projectPath)}
              className="text-[0.625rem] text-text-muted hover:text-text-primary"
            >
              全部取消
            </button>
          </div>
          {staged.map((f) => (
            <FileRow
              key={`staged-${f.path}`}
              file={f}
              onUnstage={() => unstageFile(projectPath, f.path)}
              onViewDiff={() => viewFileDiff(projectPath, f.path, true)}
            />
          ))}
        </div>
      )}

      {/* Unstaged */}
      {unstaged.length > 0 && (
        <div className="border-b border-panel-border pb-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
              未暂存 ({unstaged.length})
            </span>
            <button
              onClick={() => stageAll(projectPath)}
              className="text-[0.625rem] text-text-muted hover:text-text-primary"
            >
              全部暂存
            </button>
          </div>
          {unstaged.map((f) => (
            <FileRow
              key={`unstaged-${f.path}`}
              file={f}
              onStage={() => stageFile(projectPath, f.path)}
              onDiscard={() => discardFile(projectPath, f.path)}
              onViewDiff={() => viewFileDiff(projectPath, f.path, false)}
            />
          ))}
        </div>
      )}

      {/* Untracked */}
      {untracked.length > 0 && (
        <div className="pb-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
              未跟踪 ({untracked.length})
            </span>
            <button
              onClick={() => stageAll(projectPath)}
              className="text-[0.625rem] text-text-muted hover:text-text-primary"
            >
              全部暂存
            </button>
          </div>
          {untracked.map((f) => (
            <FileRow
              key={`untracked-${f.path}`}
              file={f}
              onStage={() => stageFile(projectPath, f.path)}
              onViewDiff={() => viewFileDiff(projectPath, f.path, false)}
            />
          ))}
        </div>
      )}

      {files.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-text-muted">
          没有更改
        </div>
      )}
    </div>
  )
}

// ── History Panel (simplified list) ───────────────────────────

function HistoryPanel({ projectPath }: { projectPath: string }) {
  const commits = useGitStore((s) => s.commits)
  const commitHasMore = useGitStore((s) => s.commitHasMore)
  const selectedCommit = useGitStore((s) => s.selectedCommit)
  const selectCommit = useGitStore((s) => s.selectCommit)
  const loadMoreCommits = useGitStore((s) => s.loadMoreCommits)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && commitHasMore) {
          loadMoreCommits(projectPath)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [commitHasMore, loadMoreCommits, projectPath])

  function relativeTime(ts: number): string {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return "刚刚"
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`
    return new Date(ts * 1000).toLocaleDateString("zh-CN")
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {commits.map((c: GitCommit) => (
        <div
          key={c.hash}
          onClick={() => selectCommit(projectPath, c.hash)}
          className={`cursor-pointer rounded px-2 py-1.5 text-xs transition-colors ${
            selectedCommit === c.hash
              ? "bg-blue-500/10 border-l-2 border-blue-500"
              : "hover:bg-panel-hover border-l-2 border-transparent"
          }`}
        >
          <div className="truncate text-text-primary">{c.message}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-text-muted">
            <span className="font-mono text-[0.65rem]">{c.hash.substring(0, 7)}</span>
            <span>·</span>
            <span>{c.author}</span>
            <span>·</span>
            <span>{relativeTime(c.timestamp)}</span>
          </div>
        </div>
      ))}

      {commits.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-text-muted">无提交历史</div>
      )}

      <div ref={bottomRef} />
      {commitHasMore && commits.length > 0 && (
        <div className="px-3 py-2 text-center text-[0.65rem] text-text-muted">加载更多...</div>
      )}
    </div>
  )
}

// ── Commit Box ────────────────────────────────────────────────

function CommitBox({ projectPath }: { projectPath: string }) {
  const files = useGitStore((s) => s.files)
  const commit = useGitStore((s) => s.commit)
  const loadFileTree = useProjectStore((s) => s.loadFileTree)
  const [message, setMessage] = useState("")
  const [committing, setCommitting] = useState(false)

  const stagedCount = files.filter((f) => f.staged).length

  const handleCommit = useCallback(async () => {
    if (!message.trim() || stagedCount === 0) return
    setCommitting(true)
    const ok = await commit(projectPath, message.trim())
    setCommitting(false)
    if (ok) {
      setMessage("")
      loadFileTree(projectPath)
    }
  }, [message, stagedCount, commit, projectPath, loadFileTree])

  return (
    <div className="border-t border-panel-border p-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={stagedCount > 0 ? "输入提交信息..." : "暂存文件后才能提交"}
        className="w-full resize-none rounded border border-panel-border bg-panel-bg px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
        rows={2}
        disabled={stagedCount === 0}
      />
      <button
        onClick={handleCommit}
        disabled={!message.trim() || stagedCount === 0 || committing}
        className="mt-1.5 w-full rounded bg-text-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-text-secondary disabled:opacity-40"
      >
        {committing ? "提交中..." : `提交 (${stagedCount} 个文件)`}
      </button>
    </div>
  )
}

// ── Diff Panel (for changes tab, right side) ──────────────────

function DiffPanel() {
  const diffContent = useGitStore((s) => s.diffContent)
  const diffTitle = useGitStore((s) => s.diffTitle)

  if (!diffContent) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        点击左侧文件或提交查看变更
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-panel-border px-3 py-1.5 text-xs font-medium text-text-secondary">
        {diffTitle}
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-text-secondary">
          {diffContent}
        </pre>
      </div>
    </div>
  )
}

// ── Commit Detail Panel (for history tab, right side) ─────────

function CommitDetailPanel({ projectPath }: { projectPath: string }) {
  const commits = useGitStore((s) => s.commits)
  const selectedCommit = useGitStore((s) => s.selectedCommit)
  const commitFiles = useGitStore((s) => s.commitFiles)
  const selectedCommitFile = useGitStore((s) => s.selectedCommitFile)
  const commitFileDiff = useGitStore((s) => s.commitFileDiff)
  const selectCommitFile = useGitStore((s) => s.selectCommitFile)
  const copyHash = useGitStore((s) => s.copyHash)

  const commit = commits.find((c) => c.hash === selectedCommit)

  if (!commit) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        点击左侧提交查看详情
      </div>
    )
  }

  const files = commitFiles[commit.hash] || []

  function relativeTime(ts: number): string {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return "刚刚"
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`
    return new Date(ts * 1000).toLocaleDateString("zh-CN")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top: commit info */}
      <div className="shrink-0 border-b border-panel-border px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text-primary">{commit.message}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="font-mono">{commit.hash.substring(0, 7)}</span>
                <button
                  onClick={() => copyHash(commit.hash)}
                  className="text-text-muted hover:text-accent"
                  title="复制完整哈希"
                >
                  <Copy size={11} />
                </button>
              </span>
              <span>{commit.author}</span>
              <span>{relativeTime(commit.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: file list (left) + file diff (right) */}
      <SplitPane
        defaultLeftWidth={224}
        minLeftWidth={140}
        minRightWidth={200}
        left={
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-panel-border px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-text-muted">
              变更文件 ({files.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.map((f: GitCommitFile) => (
                <div
                  key={f.path}
                  onClick={() => selectCommitFile(projectPath, commit.hash, f.path)}
                  className={`flex cursor-pointer items-center gap-1.5 px-3 py-1 text-xs transition-colors ${
                    selectedCommitFile === f.path
                      ? "bg-blue-500/10 text-text-primary"
                      : "text-text-secondary hover:bg-panel-hover"
                  }`}
                >
                  <span className={`w-4 shrink-0 text-center font-mono ${statusColor(f.status)}`}>
                    {f.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{f.path}</span>
                  <span className="shrink-0 text-[0.6rem]">
                    <span className="text-success">+{f.additions}</span>
                    <span className="text-danger ml-1">-{f.deletions}</span>
                  </span>
                </div>
              ))}
              {files.length === 0 && (
                <div className="px-3 py-4 text-center text-[0.65rem] text-text-muted">加载中...</div>
              )}
            </div>
          </div>
        }
        right={
          <div className="h-full overflow-hidden">
            {!selectedCommitFile ? (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                选择文件查看变更内容
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="shrink-0 border-b border-panel-border px-3 py-1.5 text-xs font-medium text-text-secondary">
                  {selectedCommitFile}
                </div>
                <div className="flex-1 overflow-auto p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-text-secondary">
                    {commitFileDiff || "加载中..."}
                  </pre>
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

// ── Main GitTab Component ─────────────────────────────────────

export function GitTab({ tab: _tab }: GitTabProps) {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const activeTab = useGitStore((s) => s.activeTab)
  const setActiveTab = useGitStore((s) => s.setActiveTab)
  const refreshAll = useGitStore((s) => s.refreshAll)
  const pushAction = useGitStore((s) => s.push)
  const fetchAction = useGitStore((s) => s.fetch)

  // Auto-refresh on mount and when project changes
  useEffect(() => {
    if (activeProject?.path) {
      refreshAll(activeProject.path)
    }
  }, [activeProject?.path, refreshAll])

  // Auto-poll every 5 seconds
  useEffect(() => {
    if (!activeProject?.path) return
    const id = setInterval(() => {
      refreshAll(activeProject.path)
    }, 5000)
    return () => clearInterval(id)
  }, [activeProject?.path, refreshAll])

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        请先选择一个项目
      </div>
    )
  }

  return (
    <SplitPane
      defaultLeftWidth={320}
      minLeftWidth={240}
      minRightWidth={300}
      left={
        <div className="flex h-full flex-col">
          {/* Header: branch + push/fetch */}
          <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
            <BranchSelector />
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchAction(activeProject.path)}
                className="rounded p-1 text-text-muted hover:bg-panel-hover hover:text-text-primary"
                title="拉取远程更新"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => pushAction(activeProject.path)}
                className="rounded p-1 text-text-muted hover:bg-panel-hover hover:text-text-primary"
                title="推送到远程"
              >
                <Upload size={14} />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-panel-border">
            <button
              onClick={() => setActiveTab("changes")}
              className={`flex-1 py-1.5 text-center text-xs font-medium transition-colors ${
                activeTab === "changes"
                  ? "border-b-[3px] border-blue-500 text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              更改
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-1.5 text-center text-xs font-medium transition-colors ${
                activeTab === "history"
                  ? "border-b-[3px] border-blue-500 text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              历史
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "changes" ? (
            <ChangesPanel projectPath={activeProject.path} />
          ) : (
            <HistoryPanel projectPath={activeProject.path} />
          )}

          {/* Commit box */}
          <CommitBox projectPath={activeProject.path} />
        </div>
      }
      right={
        <div className="h-full overflow-hidden">
          {activeTab === "changes" ? (
            <DiffPanel />
          ) : (
            <CommitDetailPanel projectPath={activeProject.path} />
          )}
        </div>
      }
    />
  )
}
