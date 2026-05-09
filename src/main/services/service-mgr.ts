import { spawn, ChildProcess } from 'child_process'
import type { ServiceDefinition, ServiceInstance, ServiceStatus } from '../../shared/types'

const services = new Map<string, ServiceInstance>()
const processes = new Map<string, ChildProcess>()

export function defineService(def: ServiceDefinition): void {
  const instance: ServiceInstance = {
    id: def.id,
    name: def.name,
    command: def.command,
    args: def.args || [],
    cwd: def.cwd || process.cwd(),
    status: 'stopped',
    healthCheckUrl: def.healthCheckUrl
  }
  services.set(def.id, instance)
}

export function startService(
  id: string,
  onLog: (stream: 'stdout' | 'stderr', data: string) => void,
  onStatusChange: (status: ServiceStatus) => void
): void {
  const svc = services.get(id)
  if (!svc) throw new Error(`Service ${id} not defined`)
  if (svc.status === 'running') throw new Error(`Service ${id} is already running`)

  svc.status = 'starting'
  onStatusChange('starting')

  const proc = spawn(svc.command, svc.args, {
    cwd: svc.cwd,
    env: { ...process.env as Record<string, string> },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  processes.set(id, proc)

  proc.stdout?.on('data', (data: Buffer) => {
    onLog('stdout', data.toString())
  })

  proc.stderr?.on('data', (data: Buffer) => {
    onLog('stderr', data.toString())
  })

  proc.on('spawn', () => {
    svc.status = 'running'
    svc.pid = proc.pid
    svc.startedAt = new Date()
    onStatusChange('running')
  })

  proc.on('exit', (code) => {
    svc.status = code === 0 ? 'stopped' : 'error'
    svc.pid = undefined
    processes.delete(id)
    onStatusChange(svc.status)
  })

  proc.on('error', () => {
    svc.status = 'error'
    processes.delete(id)
    onStatusChange('error')
  })
}

export function stopService(id: string): void {
  const proc = processes.get(id)
  if (!proc) throw new Error(`Service ${id} is not running`)
  proc.kill('SIGTERM')
}

export function listServices(): ServiceInstance[] {
  return Array.from(services.values())
}

export function getService(id: string): ServiceInstance | undefined {
  return services.get(id)
}
