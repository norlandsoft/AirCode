import { create } from "zustand"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import type { TerminalSession } from "@/lib/types"
import { api } from "@/lib/api"

interface TerminalState {
  sessions: Map<string, TerminalSession>
  outputBuffers: Map<string, string>
  terminals: Map<string, { term: Terminal; fitAddon: FitAddon; container: HTMLDivElement | null }>

  createSession: (cwd?: string) => Promise<TerminalSession | null>
  writeToSession: (id: string, data: string) => Promise<void>
  resizeSession: (id: string, cols: number, rows: number) => Promise<void>
  destroySession: (id: string) => Promise<void>
  appendOutput: (id: string, data: string) => void
  attachTerminal: (sessionId: string, term: Terminal, fitAddon: FitAddon) => void
  detachTerminal: (sessionId: string) => void
  replayBuffer: (sessionId: string, term: Terminal) => void
  setContainer: (sessionId: string, container: HTMLDivElement | null) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: new Map(),
  outputBuffers: new Map(),
  terminals: new Map(),

  createSession: async (cwd?: string) => {
    const a = await api()
    const result = await a.terminal.create(cwd)
    if (result.error) return null

    const session: TerminalSession = {
      id: result.id as string,
      pid: result.pid as number,
      cwd: result.cwd as string,
    }

    set((state) => {
      const sessions = new Map(state.sessions)
      sessions.set(session.id, session)
      const outputBuffers = new Map(state.outputBuffers)
      outputBuffers.set(session.id, "")
      return { sessions, outputBuffers }
    })

    return session
  },

  writeToSession: async (id: string, data: string) => {
    const a = await api()
    await a.terminal.write(id, data)
  },

  resizeSession: async (id: string, cols: number, rows: number) => {
    const a = await api()
    await a.terminal.resize(id, cols, rows)
  },

  destroySession: async (id: string) => {
    const a = await api()
    await a.terminal.destroy(id)
    set((state) => {
      const sessions = new Map(state.sessions)
      sessions.delete(id)
      const outputBuffers = new Map(state.outputBuffers)
      outputBuffers.delete(id)
      const terminals = new Map(state.terminals)
      const entry = terminals.get(id)
      if (entry) {
        entry.term.dispose()
        terminals.delete(id)
      }
      return { sessions, outputBuffers, terminals }
    })
  },

  appendOutput: (id: string, data: string) => {
    const state = get()
    // Write directly to attached terminal for real-time display
    const entry = state.terminals.get(id)
    if (entry?.term) {
      entry.term.write(data)
    }
    // Always buffer for replay, but cap to prevent unbounded memory growth.
    // Keep last ~500KB which is enough for meaningful replay context.
    const MAX_BUFFER_SIZE = 500_000
    set((state) => {
      const outputBuffers = new Map(state.outputBuffers)
      let buf = (outputBuffers.get(id) || "") + data
      if (buf.length > MAX_BUFFER_SIZE) {
        buf = buf.slice(buf.length - MAX_BUFFER_SIZE)
      }
      outputBuffers.set(id, buf)
      return { outputBuffers }
    })
  },

  attachTerminal: (sessionId: string, term: Terminal, fitAddon: FitAddon) => {
    set((state) => {
      const terminals = new Map(state.terminals)
      terminals.set(sessionId, { term, fitAddon, container: null })
      return { terminals }
    })
  },

  detachTerminal: (sessionId: string) => {
    set((state) => {
      const terminals = new Map(state.terminals)
      const entry = terminals.get(sessionId)
      if (entry) {
        terminals.set(sessionId, { ...entry, container: null })
      }
      return { terminals }
    })
  },

  replayBuffer: (sessionId: string, term: Terminal) => {
    const buffer = get().outputBuffers.get(sessionId) || ""
    if (buffer) {
      term.write(buffer)
    }
  },

  setContainer: (sessionId: string, container: HTMLDivElement | null) => {
    set((state) => {
      const terminals = new Map(state.terminals)
      const entry = terminals.get(sessionId)
      if (entry) {
        terminals.set(sessionId, { ...entry, container })
      }
      return { terminals }
    })
  },
}))

if (typeof window !== "undefined") {
  window.__aircode_on_terminal_output = (id: string, data: string) => {
    useTerminalStore.getState().appendOutput(id, data)
  }
}
