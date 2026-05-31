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
  const initDone = useRef(false)

  const createSession = useTerminalStore((s) => s.createSession)
  const writeToSession = useTerminalStore((s) => s.writeToSession)
  const resizeSession = useTerminalStore((s) => s.resizeSession)
  const attachTerminal = useTerminalStore((s) => s.attachTerminal)
  const detachTerminal = useTerminalStore((s) => s.detachTerminal)
  const replayBuffer = useTerminalStore((s) => s.replayBuffer)
  const setContainer = useTerminalStore((s) => s.setContainer)
  const terminals = useTerminalStore((s) => s.terminals)
  const updateTab = useTabStore((s) => s.updateTab)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )

  // Find existing session for this tab (stored in tab title pattern "终端: xxx")
  const existingSessionId = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    const title = tab?.title || ""
    const match = title.match(/^终端:\s*(.+)$/)
    const id = match ? `term_${match[1]}` : null
    return id && useTerminalStore.getState().sessions.has(id) ? id : null
  })

  useEffect(() => {
    if (!containerRef.current || initDone.current) return
    initDone.current = true

    const init = async () => {
      // Reuse existing session or create new one
      let sessionId: string | null = existingSessionId

      if (!sessionId) {
        const cwd = activeProject?.path
        const session = await createSession(cwd)
        if (!session) return
        sessionId = session.id
        updateTab(tabId, { title: `终端: ${session.id.replace("term_", "")}` })
      }

      // Check if terminal instance already exists in store
      const existing = terminals.get(sessionId)
      if (existing) {
        // Re-attach existing terminal to new container
        existing.term.open(containerRef.current!)
        existing.fitAddon.fit()
        setContainer(sessionId, containerRef.current)
        return
      }

      // Create new Terminal instance
      const term = new Terminal({
        theme: {
          background: "#ffffff",
          foreground: "#1a1b2e",
          cursor: "#4a7dfc",
          selectionBackground: "#e4e6eb",
        },
        fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        cursorBlink: true,
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current!)
      fitAddon.fit()

      // Replay buffered output (for restored sessions)
      replayBuffer(sessionId, term)

      // Store terminal in state
      attachTerminal(sessionId, term, fitAddon)
      setContainer(sessionId, containerRef.current)

      // Handle user input
      term.onData((data) => {
        writeToSession(sessionId!, data)
      })

      // Handle resize
      const onResize = () => {
        fitAddon.fit()
        if (sessionId) {
          resizeSession(sessionId, term.cols, term.rows)
        }
      }

      const resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(containerRef.current!)

      // Don't destroy session on unmount — only detach
      // Session persists across tab switches
      return () => {
        resizeObserver.disconnect()
        detachTerminal(sessionId!)
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full w-full" />
}
