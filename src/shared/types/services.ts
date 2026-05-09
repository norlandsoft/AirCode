export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export type ServiceInstance = {
  id: string
  name: string
  command: string
  args: string[]
  cwd: string
  status: ServiceStatus
  pid?: number
  startedAt?: Date
  healthCheckUrl?: string
}

export type ServiceLogEntry = {
  serviceId: string
  timestamp: Date
  stream: 'stdout' | 'stderr'
  data: string
}
