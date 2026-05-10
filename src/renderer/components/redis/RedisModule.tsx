import type { AirCodeModule } from '../../../shared/types'

function Redis() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Redis</h3>
        <p className="text-xs">Connect to a Redis instance</p>
      </div>
    </div>
  )
}

export const RedisModule: AirCodeModule = {
  id: 'redis',
  name: 'Redis',
  icon: 'redis',
  component: Redis
}
