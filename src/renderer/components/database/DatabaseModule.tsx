import type { AirCodeModule } from '../../../shared/types'

function Database() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Database</h3>
        <p className="text-xs">Connect to a database</p>
      </div>
    </div>
  )
}

export const DatabaseModule: AirCodeModule = {
  id: 'database',
  name: 'Database',
  icon: 'database',
  component: Database
}
