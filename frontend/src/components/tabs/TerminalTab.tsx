import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { useTerminalStore } from "@/stores/useTerminalStore"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"

interface TerminalTabProps {
  tabId: string
}

export function TerminalTab({ tabId }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const lastOutputLenRef = useRef(0)

  const createSession = useTerminalStore((s) => s.createSession)
  const writeToSession = useTerminalStore((s) => s.writeToSession)
  const resizeSession = useTerminalStore((s) => s.resizeSession)
  const destroySession = useTerminalStore((s) => s.destroySession)
  const outputBuffers = useTerminalStore((s) => s.outputBuffers)
  const updateTab = useTabStore((s) => s.updateTab)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )

  // Track output for this terminal
  const sessionId = sessionIdRef.current
  const output = sessionId ? outputBuffers.get(sessionId) || "" : null

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#45475a",
      },
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    const cwd = activeProject?.path
    createSession(cwd).then((session) => {
      if (session) {
        sessionIdRef.current = session.id
        updateTab(tabId, { title: `终端: ${session.id.replace("term_", "")}` })
      }
    })

    term.onData((data) => {
      const sid = sessionIdRef.current
      if (sid) {
        writeToSession(sid, data)
      }
    })

    const onResize = () => {
      fitAddon.fit()
      const sid = sessionIdRef.current
      if (sid) {
        resizeSession(sid, term.cols, term.rows)
      }
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      const sid = sessionIdRef.current
      if (sid) {
        destroySession(sid)
      }
      term.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!termRef.current || !output) return
    const newContent = output.slice(lastOutputLenRef.current)
    if (newContent) {
      termRef.current.write(newContent)
    }
    lastOutputLenRef.current = output.length
  }, [output])

  return <div ref={containerRef} className="h-full w-full" />
}
