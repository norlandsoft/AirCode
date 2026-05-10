import { create } from 'zustand'

export interface TerminalSession {
  id: string
  pid: number
  title: string
  cwd?: string
}

interface TerminalState {
  sessions: TerminalSession[]
  activeSessionId: string | null
  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id
    })),

  removeSession: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeSessionId =
        state.activeSessionId === id
          ? sessions.length > 0
            ? sessions[sessions.length - 1].id
            : null
          : state.activeSessionId
      return { sessions, activeSessionId }
    }),

  setActiveSession: (id) => set({ activeSessionId: id })
}))
