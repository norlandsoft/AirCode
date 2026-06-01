import { create } from "zustand"
import { api } from "@/lib/api"
import type { GitFileChange, GitCommit, GitCommitFile } from "@/lib/types"

interface GitState {
  // State
  branch: string
  branches: { name: string; is_current: boolean }[]
  files: GitFileChange[]
  commits: GitCommit[]
  commitHasMore: boolean
  commitOffset: number
  diffContent: string
  diffTitle: string
  activeTab: "changes" | "history"
  selectedCommit: string | null
  commitFiles: Record<string, GitCommitFile[]>
  selectedCommitFile: string | null
  commitFileDiff: string
  loading: boolean

  // Core
  refreshAll: (projectPath: string) => Promise<void>
  setActiveTab: (tab: "changes" | "history") => void

  // Changes operations
  stageFile: (projectPath: string, filePath: string) => Promise<void>
  stageAll: (projectPath: string) => Promise<void>
  unstageFile: (projectPath: string, filePath: string) => Promise<void>
  unstageAll: (projectPath: string) => Promise<void>
  discardFile: (projectPath: string, filePath: string) => Promise<void>
  viewFileDiff: (projectPath: string, filePath: string, staged: boolean) => Promise<void>

  // Commit
  commit: (projectPath: string, message: string) => Promise<boolean>

  // History operations
  loadMoreCommits: (projectPath: string) => Promise<void>
  selectCommit: (projectPath: string, hash: string) => Promise<void>
  selectCommitFile: (projectPath: string, hash: string, filePath: string) => Promise<void>
  copyHash: (hash: string) => void

  // Branch
  switchBranch: (projectPath: string, branch: string) => Promise<void>

  // Remote
  push: (projectPath: string) => Promise<void>
  fetch: (projectPath: string) => Promise<void>

  // Diff
  clearDiff: () => void
}

const PAGE_SIZE = 20

export const useGitStore = create<GitState>((set, get) => ({
  branch: "",
  branches: [],
  files: [],
  commits: [],
  commitHasMore: true,
  commitOffset: 0,
  diffContent: "",
  diffTitle: "",
  activeTab: "changes",
  selectedCommit: null,
  commitFiles: {},
  selectedCommitFile: null,
  commitFileDiff: "",
  loading: false,

  refreshAll: async (projectPath: string) => {
    const a = await api()
    set({ loading: true })
    try {
      const [statusResult, logResult, branchResult] = await Promise.all([
        a.git.status(projectPath),
        a.git.log(projectPath, PAGE_SIZE),
        a.git.branch_list(projectPath),
      ])

      // Parse files from status
      const files: GitFileChange[] = []
      if (statusResult.staged) {
        for (const f of statusResult.staged as { path: string; status: string }[]) {
          files.push({ path: f.path, status: f.status, staged: true })
        }
      }
      if (statusResult.unstaged) {
        for (const f of statusResult.unstaged as { path: string; status: string }[]) {
          files.push({ path: f.path, status: f.status, staged: false })
        }
      }
      if (statusResult.untracked) {
        for (const p of statusResult.untracked as string[]) {
          files.push({ path: p, status: "?", staged: false })
        }
      }

      set({
        branch: (statusResult.branch as string) || "",
        files,
        commits: (logResult.commits as GitCommit[]) || [],
        commitOffset: PAGE_SIZE,
        commitHasMore: ((logResult.commits as GitCommit[]) || []).length >= PAGE_SIZE,
        branches: (branchResult.branches as { name: string; is_current: boolean }[]) || [],
      })
    } finally {
      set({ loading: false })
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  stageFile: async (projectPath, filePath) => {
    const a = await api()
    await a.git.add(projectPath, filePath)
    await get().refreshAll(projectPath)
  },

  stageAll: async (projectPath) => {
    const a = await api()
    await a.git.add(projectPath)
    await get().refreshAll(projectPath)
  },

  unstageFile: async (projectPath, filePath) => {
    const a = await api()
    await a.git.reset(projectPath, filePath)
    await get().refreshAll(projectPath)
  },

  unstageAll: async (projectPath) => {
    const a = await api()
    await a.git.reset(projectPath)
    await get().refreshAll(projectPath)
  },

  discardFile: async (projectPath, filePath) => {
    const a = await api()
    await a.git.checkout_file(projectPath, filePath)
    await get().refreshAll(projectPath)
  },

  viewFileDiff: async (projectPath, filePath, staged) => {
    const a = await api()
    const result = await a.git.diff(projectPath, filePath, staged)
    set({
      diffContent: (result.diff as string) || "",
      diffTitle: filePath,
    })
  },

  commit: async (projectPath, message) => {
    const a = await api()
    const result = await a.git.commit(projectPath, message)
    if (result.success) {
      await get().refreshAll(projectPath)
      return true
    }
    return false
  },

  loadMoreCommits: async (projectPath) => {
    const { commitOffset } = get()
    const a = await api()
    const result = await a.git.log(projectPath, commitOffset + PAGE_SIZE)
    const newCommits = (result.commits as GitCommit[]) || []
    set({
      commits: newCommits,
      commitOffset: commitOffset + PAGE_SIZE,
      commitHasMore: newCommits.length >= commitOffset + PAGE_SIZE,
    })
  },

  selectCommit: async (projectPath, hash) => {
    const { commitFiles } = get()
    set({ selectedCommit: hash, selectedCommitFile: null, commitFileDiff: "" })

    // Load commit files if not cached
    if (!commitFiles[hash]) {
      const a = await api()
      const result = await a.git.show_stat(projectPath, hash)
      const currentFiles = get().commitFiles
      set({
        commitFiles: { ...currentFiles, [hash]: (result.files as GitCommitFile[]) || [] },
      })
    }
  },

  selectCommitFile: async (projectPath, hash, filePath) => {
    set({ selectedCommitFile: filePath, commitFileDiff: "" })
    const a = await api()
    const result = await a.git.show(projectPath, hash, filePath)
    set({ commitFileDiff: (result.diff as string) || "" })
  },

  copyHash: (hash) => {
    navigator.clipboard.writeText(hash)
  },

  switchBranch: async (projectPath, branch) => {
    const a = await api()
    const result = await a.git.checkout(projectPath, branch)
    if (!result.error) {
      await get().refreshAll(projectPath)
    }
  },

  push: async (projectPath) => {
    const a = await api()
    await a.git.push(projectPath)
    await get().refreshAll(projectPath)
  },

  fetch: async (projectPath) => {
    const a = await api()
    await a.git.fetch(projectPath)
    await get().refreshAll(projectPath)
  },

  clearDiff: () => set({ diffContent: "", diffTitle: "" }),
}))
