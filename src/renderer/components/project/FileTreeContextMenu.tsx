import { useEffect, useRef } from 'react'

export interface ContextMenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface FileTreeContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export function FileTreeContextMenu({ x, y, actions, onClose }: FileTreeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - actions.length * 32 - 10)

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
            action.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
          }`}
          onClick={() => {
            action.onClick()
            onClose()
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
