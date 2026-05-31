export type TabType = "terminal" | "code" | "git"

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

// ---- Settings / Storage types ----

export interface TerminalSettings {
  shell: string
  fontSize: number
}

export interface EditorSettings {
  tabSize: number
  wordWrap: boolean
  fontSize: number
}

export interface WindowSettings {
  width: number
  height: number
}

export interface AppSettings {
  version: number
  theme: string
  fontSize: number
  terminal: TerminalSettings
  editor: EditorSettings
  recentProjects: string[]
  window: WindowSettings
}

export interface ProjectConfig {
  path: string
  name: string
  gitUserName: string | null
  gitUserEmail: string | null
  ignorePatterns: string[]
  editorOverrides: Partial<EditorSettings>
}

export interface WorkspaceTab {
  id: string
  type: TabType
  filePath?: string
  title: string
}

export interface WorkspaceData {
  projectPath: string
  activeTabId: string
  tabs: WorkspaceTab[]
  drafts: Record<string, string>
}

export interface Secrets {
  gitTokens: Record<string, string>
  sshKeyPath: string | null
  customTokens: Record<string, string>
}
