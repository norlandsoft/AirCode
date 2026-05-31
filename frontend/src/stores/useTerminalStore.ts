import { create } from "zustand"
import type { TerminalSession } from "@/lib/types"
import { api } from "@/lib/api"

interface TerminalState {
  sessions: Map<string, TerminalSession>
  outputBuffers: Map<string, string>

  createSession: (cwd?: string) => Promise<TerminalSession | null>
  writeToSession: (id: string, data: string) => Promise<void>
  resizeSession: (id: string, cols: number, rows: number) => Promise<void>
  destroySession: (id: string) => Promise<void>
  appendOutput: (id: string, data: string) => void
}

export const useTerminalStore = create<TerminalState>((set, _get) => ({
  sessions: new Map(),
  outputBuffers: new Map(),

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
      return { sessions, outputBuffers }
    })
  },

  appendOutput: (id: string, data: string) => {
    set((state) => {
      const outputBuffers = new Map(state.outputBuffers)
      const existing = outputBuffers.get(id) || ""
      outputBuffers.set(id, existing + data)
      return { outputBuffers }
    })
  },
}))

if (typeof window !== "undefined") {
  window.__aircode_on_terminal_output = (id: string, data: string) => {
    useTerminalStore.getState().appendOutput(id, data)
  }
}
