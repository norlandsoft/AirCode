import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface XTermTerminalProps {
  sessionId: string
  active: boolean
}

export function XTermTerminal({ sessionId, active }: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initializedRef = useRef(false)

  // Initialize terminal once
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const term = new Terminal({
      fontSize: 14,
      fontFamily: "var(--font-code)",
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#585b7066',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8'
      },
      allowProposedApi: true,
      scrollback: 10000
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Write data from main process
    const unsub = window.api.terminal.onData((id, data) => {
      if (id === sessionId) {
        term.write(data)
      }
    })

    // Send user input to main process
    const inputDisposable = term.onData((data) => {
      window.api.terminal.write(sessionId, data)
    })

    // Sync resize to pty
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.api.terminal.resize(sessionId, cols, rows)
    })

    // Open after subscriptions are set up
    term.open(containerRef.current)
    fitAddon.fit()

    // Cleanup on unmount
    return () => {
      resizeDisposable.dispose()
      inputDisposable.dispose()
      unsub()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      initializedRef.current = false
    }
  }, [sessionId])

  // Handle visibility + fit when switching tabs
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.style.display = active ? 'block' : 'none'

    if (active && fitAddonRef.current) {
      requestAnimationFrame(() => {
        try { fitAddonRef.current?.fit() } catch {}
      })
    }

    // Focus the terminal when activated
    if (active && termRef.current) {
      termRef.current.focus()
    }
  }, [active])

  // ResizeObserver for container size changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      if (active && fitAddonRef.current) {
        try { fitAddonRef.current.fit() } catch {}
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active])

  return <div ref={containerRef} className="h-full w-full" style={{ display: active ? 'block' : 'none', padding: '0 8px' }} />
}
