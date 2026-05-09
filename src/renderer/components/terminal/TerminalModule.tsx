import type { AirCodeModule } from '../../../shared/types'

function Terminal() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <div className="mb-3 text-4xl">⌨</div>
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Terminal</h3>
        <p className="text-xs">Create a new terminal session</p>
      </div>
    </div>
  )
}

export const TerminalModule: AirCodeModule = {
  id: 'terminal',
  name: 'Terminal',
  icon: '⌨',
  component: Terminal
}
