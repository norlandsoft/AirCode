import { useRef, useCallback, type ReactNode } from 'react'

interface ResizablePanelProps {
  side: 'left' | 'right'
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
  collapsed?: boolean
  children: ReactNode
  onWidthChange?: (width: number) => void
}

export function ResizablePanel({
  side,
  defaultWidth,
  minWidth = 150,
  maxWidth = 500,
  collapsed = false,
  children,
  onWidthChange
}: ResizablePanelProps) {
  const widthRef = useRef(defaultWidth)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = widthRef.current

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const diff = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + diff))
      widthRef.current = newWidth
      onWidthChange?.(newWidth)
      const panel = document.getElementById('resizable-panel-content')
      if (panel) panel.style.width = `${newWidth}px`
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [side, minWidth, maxWidth, onWidthChange])

  if (collapsed) {
    return <div className="hidden" />
  }

  return (
    <div className="relative flex h-full shrink-0" style={{ width: widthRef.current }}>
      <div id="resizable-panel-content" className="h-full overflow-hidden" style={{ width: widthRef.current }}>
        {children}
      </div>
      <div
        className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors"
        style={{ [side === 'left' ? 'right' : 'left']: 0 }}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
