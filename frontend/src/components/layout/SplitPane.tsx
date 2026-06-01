import { useState, useCallback, useRef, type ReactNode } from "react"

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  /** Minimum right panel width in px */
  minRightWidth?: number
}

/**
 * Horizontal split pane with a draggable divider.
 * Left panel has fixed width, right panel fills the rest.
 */
export function SplitPane({
  left,
  right,
  defaultLeftWidth = 320,
  minLeftWidth = 200,
  minRightWidth = 100,
}: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      document.body.style.cursor = "col-resize"
      // Prevent text selection while dragging
      document.body.style.userSelect = "none"

      const container = containerRef.current
      if (!container) return

      const onMouseMove = (ev: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        const newWidth = ev.clientX - rect.left
        const max = rect.width - minRightWidth
        setLeftWidth(Math.max(minLeftWidth, Math.min(newWidth, max)))
      }

      const onMouseUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
      }

      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)
    },
    [minLeftWidth, minRightWidth]
  )

  return (
    <div ref={containerRef} className="flex h-full">
      <div style={{ width: leftWidth }} className="shrink-0 overflow-hidden">
        {left}
      </div>
      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className="group relative w-px shrink-0 cursor-col-resize bg-panel-border transition-colors hover:bg-blue-500 active:bg-blue-500"
      >
        {/* Wider hit area */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  )
}
