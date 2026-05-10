import type { AirCodeModule } from '../../../shared/types'

function Docker() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Docker</h3>
        <p className="text-xs">Manage containers and images</p>
      </div>
    </div>
  )
}

export const DockerModule: AirCodeModule = {
  id: 'docker',
  name: 'Docker',
  icon: 'docker',
  component: Docker
}
