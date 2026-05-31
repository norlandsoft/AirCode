export type TabType = "terminal" | "editor" | "file_viewer" | "git"

export interface Tab {
  id: string
  type: TabType
  title: string
  icon: string
  projectId: string
  filePath?: string
  isDirty?: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  isGitRepo: boolean
}

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: number
}

export interface EditorFile {
  path: string
  name: string
  content: string
  language: string
  encoding: string
  size: number
  modified: number
  isDirty: boolean
}

export interface GitFileStatus {
  path: string
  status: string
}

export interface GitCommit {
  hash: string
  author: string
  email: string
  timestamp: number
  message: string
}

export interface TerminalSession {
  id: string
  pid: number
  cwd: string
}
