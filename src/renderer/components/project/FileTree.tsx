import { useEffect, useCallback, useState } from 'react'
import { FolderPlus, RefreshCw } from 'lucide-react'
import ignore from 'ignore'
import type { FileNode } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'
import { FileTreeNode } from './FileTreeNode'

interface FileTreeProps {
  projectPath: string
  projectName: string
  onFileSelect: (node: FileNode) => void
}

export function FileTree({ projectPath, projectName, onFileSelect }: FileTreeProps) {
  const {
    fileTree,
    expandedDirs,
    setFileTree,
    toggleDir,
    updateNodeChildren,
    ignoredPatterns
  } = useProjectStore()

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [newItemParent, setNewItemParent] = useState<{ path: string; type: 'file' | 'directory' } | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const rootNodes = fileTree[projectPath] ?? []

  // Load root nodes
  useEffect(() => {
    loadDirectory(projectPath)
  }, [projectPath])

  const loadDirectory = useCallback(async (dirPath: string) => {
    const entries = await window.api.files.list(dirPath)
    const nodes: FileNode[] = (entries as FileNode[])
      .filter((e) => {
        const gitignoreContent = ignoredPatterns[projectPath]
        if (gitignoreContent) {
          const ig = ignore().add(gitignoreContent)
          const relativePath = e.path.replace(projectPath + '/', '')
          return !ig.ignores(relativePath)
        }
        return true
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    if (dirPath === projectPath) {
      setFileTree(projectPath, nodes)
    }
    return nodes
  }, [projectPath, ignoredPatterns, setFileTree])

  const handleToggleDir = useCallback(async (dirPath: string) => {
    toggleDir(dirPath)
    const existingNodes = fileTree[projectPath]
    if (existingNodes) {
      const findNode = (nodes: FileNode[]): FileNode | undefined => {
        for (const n of nodes) {
          if (n.path === dirPath) return n
          if (n.children) {
            const found = findNode(n.children)
            if (found) return found
          }
        }
        return undefined
      }
      const node = findNode(existingNodes)
      if (node && !node.children) {
        updateNodeChildren(dirPath, [], projectPath)
        const children = await loadDirectory(dirPath)
        updateNodeChildren(dirPath, children, projectPath)
      }
    }
  }, [projectPath, fileTree, toggleDir, loadDirectory, updateNodeChildren])

  const handleCreateFile = useCallback(async (parentPath: string, type: 'file' | 'directory') => {
    setNewItemParent({ path: parentPath, type })
    setNewItemName(type === 'file' ? 'untitled' : 'new-folder')
  }, [])

  const submitNewItem = useCallback(async () => {
    if (!newItemParent || !newItemName.trim()) return
    const fullPath = `${newItemParent.path}/${newItemName.trim()}`
    await window.api.files.create({ path: fullPath, type: newItemParent.type })
    setNewItemParent(null)
    setNewItemName('')
    const children = await loadDirectory(newItemParent.path)
    updateNodeChildren(newItemParent.path, children, projectPath)
  }, [newItemParent, newItemName, projectPath, loadDirectory, updateNodeChildren])

  const handleRename = useCallback(async (node: FileNode, newName: string) => {
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = `${parentDir}/${newName}`
    await window.api.files.rename(node.path, newPath)
    const children = await loadDirectory(parentDir)
    updateNodeChildren(parentDir, children, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleDelete = useCallback(async (node: FileNode) => {
    if (!confirm(`确定删除 "${node.name}"？`)) return
    await window.api.files.delete(node.path)
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'))
    const children = await loadDirectory(parentDir)
    updateNodeChildren(parentDir, children, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleMove = useCallback(async (sourcePath: string, targetDir: string) => {
    const fileName = sourcePath.split('/').pop()!
    const newPath = `${targetDir}/${fileName}`
    await window.api.files.rename(sourcePath, newPath)
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
    const sourceChildren = await loadDirectory(sourceParent)
    updateNodeChildren(sourceParent, sourceChildren, projectPath)
    const targetChildren = await loadDirectory(targetDir)
    updateNodeChildren(targetDir, targetChildren, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleRefresh = useCallback(() => {
    loadDirectory(projectPath)
  }, [projectPath, loadDirectory])

  return (
    <div className="flex h-full flex-col bg-[var(--sidebar-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="truncate text-xs font-medium text-[var(--foreground)]">{projectName}</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            onClick={handleRefresh}
            title="刷新"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {rootNodes.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedDirs={expandedDirs}
            onToggleDir={handleToggleDir}
            onFileClick={(n) => {
              setSelectedPath(n.path)
              onFileSelect(n)
            }}
            onCreateFile={handleCreateFile}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        ))}
      </div>

      {/* New item input */}
      {newItemParent && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <input
            className="w-full rounded border border-[var(--primary)] bg-[var(--background)] px-2 py-1 text-xs outline-none"
            value={newItemName}
            autoFocus
            placeholder={newItemParent.type === 'file' ? '文件名' : '文件夹名'}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewItem()
              if (e.key === 'Escape') setNewItemParent(null)
            }}
            onBlur={() => {
              if (newItemName.trim()) submitNewItem()
              else setNewItemParent(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
