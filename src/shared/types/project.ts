export interface Project {
  id: string
  name: string
  path: string
  type: 'maven' | 'node' | 'unknown'
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  expanded?: boolean
  loading?: boolean
}

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  content: string
  originalContent: string
  isDirty: boolean
}

export interface SearchResult {
  filePath: string
  fileName: string
  line: number
  column: number
  text: string
  matchStart: number
  matchEnd: number
}
