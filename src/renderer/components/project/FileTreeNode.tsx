import { useState, useCallback, type DragEvent } from 'react'
import { ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { FileNode } from '../../../shared/types'
import { FileTreeContextMenu, type ContextMenuAction } from './FileTreeContextMenu'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  selectedPath: string | null
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  onFileClick: (node: FileNode) => void
  onCreateFile: (parentPath: string, type: 'file' | 'directory') => void
  onRename: (node: FileNode, newName: string) => void
  onDelete: (node: FileNode) => void
  onMove: (sourcePath: string, targetDir: string) => void
}

const EXTENSION_ICONS: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
  json: '📋', css: '🎨', html: '🌐',
  py: '🐍', java: '☕', xml: '📄',
  md: '📝', yml: '⚙️', yaml: '⚙️',
  sh: '🖥️', sql: '🗃️', go: '🐹',
  rs: '🦀', rb: '💎', php: '🐘'
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_ICONS[ext] || ''
}

export function FileTreeNode({
  node,
  depth,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onFileClick,
  onCreateFile,
  onRename,
  onDelete,
  onMove
}: FileTreeNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggleDir(node.path)
    } else {
      onFileClick(node)
    }
  }, [node, onToggleDir, onFileClick])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      onRename(node, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, node, onRename])

  const handleDragStart = useCallback((e: DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }, [node.path])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (node.isDirectory) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }, [node.isDirectory])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (sourcePath && sourcePath !== node.path) {
      onMove(sourcePath, node.path)
    }
  }, [node.path, onMove])

  const contextActions: ContextMenuAction[] = node.isDirectory
    ? [
        { label: '新建文件', onClick: () => onCreateFile(node.path, 'file') },
        { label: '新建文件夹', onClick: () => onCreateFile(node.path, 'directory') },
        { label: '重命名', onClick: () => { setRenameValue(node.name); setIsRenaming(true) } },
        { label: '删除', onClick: () => onDelete(node), danger: true }
      ]
    : [
        { label: '重命名', onClick: () => { setRenameValue(node.name); setIsRenaming(true) } },
        { label: '删除', onClick: () => onDelete(node), danger: true }
      ]

  return (
    <>
      <div
        className={`flex cursor-pointer items-center gap-1 py-0.5 pr-2 text-xs select-none ${
          isSelected ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]' : 'text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
        } ${isDragOver ? 'bg-[var(--primary-lighter)] outline outline-1 outline-[var(--primary)]' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {node.isDirectory ? (
          <>
            <ChevronRight
              size={14}
              className={`shrink-0 text-[var(--foreground-subtle)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            {node.loading ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-[var(--foreground-subtle)]" />
            ) : isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-amber-500" />
            ) : (
              <Folder size={14} className="shrink-0 text-amber-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            <span className="shrink-0 text-xs leading-none">{getFileIcon(node.name)}</span>
          </>
        )}
        {isRenaming ? (
          <input
            className="ml-1 min-w-0 flex-1 rounded border border-[var(--primary)] bg-[var(--background)] px-1 py-0 text-xs outline-none"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ml-1 truncate">{node.name}</span>
        )}
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
