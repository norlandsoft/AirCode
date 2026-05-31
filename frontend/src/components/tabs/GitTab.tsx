import { useState, useEffect, useCallback } from "react"
import { GitCommit as GitCommitIcon, GitBranch, RefreshCw } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { api } from "@/lib/api"
import type { GitCommit, GitFileStatus, Tab } from "@/lib/types"

interface GitTabProps {
  tab: Tab
}

export function GitTab({ tab: _tab }: GitTabProps) {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const loadFileTree = useProjectStore((s) => s.loadFileTree)

  const [branch, setBranch] = useState<string>("")
  const [staged, setStaged] = useState<GitFileStatus[]>([])
  const [unstaged, setUnstaged] = useState<GitFileStatus[]>([])
  const [untracked, setUntracked] = useState<string[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMessage, setCommitMessage] = useState("")
  const [diff, setDiff] = useState("")
  const [loading, setLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!activeProject) return
    const a = await api()
    setLoading(true)
    try {
      const [statusResult, logResult] = await Promise.all([
        a.git.status(activeProject.path),
        a.git.log(activeProject.path, 20),
      ])
      if (statusResult.branch) setBranch(statusResult.branch as string)
      if (statusResult.staged) setStaged(statusResult.staged as GitFileStatus[])
      if (statusResult.unstaged) setUnstaged(statusResult.unstaged as GitFileStatus[])
      if (statusResult.untracked) setUntracked(statusResult.untracked as string[])
      if (logResult.commits) setCommits(logResult.commits as GitCommit[])
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const handleCommit = useCallback(async () => {
    if (!activeProject || !commitMessage.trim()) return
    const a = await api()
    const result = await a.git.commit(activeProject.path, commitMessage.trim())
    if (result.success) {
      setCommitMessage("")
      refreshStatus()
      loadFileTree(activeProject.path)
    }
  }, [activeProject, commitMessage, refreshStatus, loadFileTree])

  const handleViewDiff = useCallback(async (filePath?: string) => {
    if (!activeProject) return
    const a = await api()
    const result = await a.git.diff(activeProject.path, filePath, !filePath)
    if (result.diff) setDiff(result.diff as string)
  }, [activeProject])

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        请先选择一个项目
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-80 flex flex-col border-r border-panel-border">
        <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs">
            <GitBranch size={14} className="text-text-secondary" />
            <span className="text-text-primary">{branch || "no branch"}</span>
          </div>
          <button
            onClick={refreshStatus}
            className="rounded p-1 text-text-muted hover:bg-panel-hover"
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {(unstaged.length > 0 || untracked.length > 0) && (
            <div className="mb-3">
              <div className="mb-1 text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
                更改 ({unstaged.length + untracked.length})
              </div>
              {[...unstaged.map((f) => ({ path: f.path, status: f.status })),
                ...untracked.map((f) => ({ path: f, status: "?" })),
              ].map((item) => (
                <div
                  key={item.path}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-panel-hover cursor-pointer"
                  onClick={() => handleViewDiff(item.path)}
                >
                  <span className={`w-4 text-center font-mono ${
                    item.status === "?" ? "text-warning" :
                    item.status === "M" ? "text-warning" :
                    item.status === "D" ? "text-danger" : "text-success"
                  }`}>
                    {item.status}
                  </span>
                  <span className="truncate text-text-secondary">{item.path}</span>
                </div>
              ))}
            </div>
          )}

          {staged.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
                暂存 ({staged.length})
              </div>
              {staged.map((f) => (
                <div key={f.path} className="flex items-center gap-2 rounded px-2 py-1 text-xs">
                  <span className="w-4 text-center font-mono text-success">{f.status}</span>
                  <span className="truncate text-text-secondary">{f.path}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1 text-[0.625rem] font-medium uppercase tracking-wider text-text-muted">
              最近提交
            </div>
            {commits.map((c) => (
              <div key={c.hash} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-panel-hover">
                <GitCommitIcon size={14} className="mt-0.5 shrink-0 text-text-muted" />
                <div className="min-w-0">
                  <div className="truncate text-text-primary">{c.message}</div>
                  <div className="text-text-muted">
                    {c.author} · {new Date(c.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-panel-border p-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="提交信息..."
            className="w-full resize-none rounded border border-panel-border bg-panel-bg px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
            rows={2}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            className="mt-1.5 w-full rounded bg-text-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-text-secondary disabled:opacity-40"
          >
            提交全部更改
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {diff ? (
          <pre className="whitespace-pre-wrap font-mono text-xs text-text-secondary">{diff}</pre>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            点击左侧文件查看差异
          </div>
        )}
      </div>
    </div>
  )
}
