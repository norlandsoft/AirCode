import { useCallback } from 'react'
import type { AirCodeModule } from '../../../shared/types'
import { useTerminalStore } from '@/stores/terminal'
import { XTermTerminal } from './XTermTerminal'
import { Icon } from '@/lib/icons'

function Terminal() {
  const { sessions, activeSessionId, addSession, removeSession, setActiveSession } = useTerminalStore()

  const createSession = useCallback(async () => {
    const result = await window.api.terminal.create({})
    addSession({
      id: result.id,
      pid: result.pid,
      title: `Terminal ${result.pid}`
    })
  }, [addSession])

  const closeSession = useCallback(async (id: string) => {
    await window.api.terminal.kill(id)
    removeSession(id)
  }, [removeSession])

  return (
    <div className="flex h-full">
      {/* Main terminal area */}
      <div className="flex-1 overflow-hidden bg-[#1e1e2e]">
        {sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-3 text-[var(--text-sm)] text-[#6c7086]">No terminal sessions</p>
              <button
                onClick={createSession}
                className="rounded-[var(--radius-md)] bg-[var(--primary)] px-3 text-[var(--text-xs)] font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
                style={{ height: 'var(--height-input)' }}
              >
                New Terminal
              </button>
            </div>
          </div>
        ) : (
          sessions.map((session) => (
            <XTermTerminal
              key={session.id}
              sessionId={session.id}
              active={session.id === activeSessionId}
            />
          ))
        )}
      </div>

      {/* Right panel - session list */}
      <div className="flex w-[180px] flex-shrink-0 flex-col border-l border-[#313244] bg-[#181825]">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[#313244] px-3" style={{ height: 'var(--height-toolbar)' }}>
          <span className="text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[#6c7086]">
            Sessions
          </span>
          <button
            onClick={createSession}
            className="flex items-center justify-center rounded-[var(--radius-sm)] text-[#6c7086] transition-colors hover:bg-[#313244] hover:text-[#cdd6f4]"
            style={{ width: '22px', height: '22px' }}
            title="New Terminal"
          >
            <Icon name="plus" size={13} />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center justify-between px-3 py-1 text-[var(--text-xs)] transition-colors ${
                session.id === activeSessionId
                  ? 'bg-[#313244] text-[#cdd6f4]'
                  : 'text-[#6c7086] hover:bg-[#1e1e2e] hover:text-[#a6adc8]'
              }`}
            >
              <button
                className="flex-1 text-left truncate"
                onClick={() => setActiveSession(session.id)}
              >
                {session.title}
              </button>
              <button
                className="ml-1 hidden items-center justify-center rounded-[var(--radius-sm)] p-0.5 text-[#6c7086] transition-colors hover:bg-[#45475a] hover:text-[#f38ba8] group-hover:flex"
                onClick={() => closeSession(session.id)}
                title="Close"
              >
                <Icon name="trash" size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="border-t border-[#313244] px-3 py-1 text-[var(--text-xs)] text-[#585b70]">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

export const TerminalModule: AirCodeModule = {
  id: 'terminal',
  name: 'Terminal',
  icon: 'shell',
  component: Terminal
}
