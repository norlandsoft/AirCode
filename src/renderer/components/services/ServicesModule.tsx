import type { AirCodeModule } from '../../../shared/types'

function Services() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <div className="mb-3 text-4xl">⚙</div>
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Service Manager</h3>
        <p className="text-xs">Define and manage local services</p>
      </div>
    </div>
  )
}

export const ServicesModule: AirCodeModule = {
  id: 'services',
  name: 'Services',
  icon: '⚙',
  component: Services
}
