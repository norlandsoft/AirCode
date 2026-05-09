import * as ftp from 'basic-ftp'
import type { FtpConnectOptions, FtpFileInfo } from '../../shared/types'

const connections = new Map<string, ftp.Client>()

export async function createConnection(opts: FtpConnectOptions): Promise<string> {
  const id = crypto.randomUUID()
  const client = new ftp.Client()
  client.ftp.verbose = false

  await client.access({
    host: opts.host,
    port: opts.port || 21,
    user: opts.user,
    password: opts.password,
    secure: opts.secure ?? false
  })

  connections.set(id, client)
  return id
}

export async function disconnect(id: string): Promise<void> {
  const client = connections.get(id)
  if (!client) throw new Error(`FTP connection ${id} not found`)
  client.close()
  connections.delete(id)
}

export async function listDirectory(id: string, path: string): Promise<FtpFileInfo[]> {
  const client = connections.get(id)
  if (!client) throw new Error(`FTP connection ${id} not found`)

  const items = await client.list(path)
  return items.map((item) => ({
    name: item.name,
    path: path === '/' ? `/${item.name}` : `${path}/${item.name}`,
    isDirectory: item.isDirectory,
    size: item.size,
    modifiedAt: item.modifiedAt,
    permissions: item.permissions?.toString() || ''
  }))
}

export async function download(connId: string, remotePath: string, localPath: string): Promise<void> {
  const client = connections.get(connId)
  if (!client) throw new Error(`FTP connection ${connId} not found`)
  await client.downloadTo(localPath, remotePath)
}

export async function upload(connId: string, localPath: string, remotePath: string): Promise<void> {
  const client = connections.get(connId)
  if (!client) throw new Error(`FTP connection ${connId} not found`)
  await client.uploadFrom(localPath, remotePath)
}

export async function remove(connId: string, path: string): Promise<void> {
  const client = connections.get(connId)
  if (!client) throw new Error(`FTP connection ${connId} not found`)
  await client.remove(path)
}

export async function rename(connId: string, oldPath: string, newPath: string): Promise<void> {
  const client = connections.get(connId)
  if (!client) throw new Error(`FTP connection ${connId} not found`)
  await client.rename(oldPath, newPath)
}

export async function mkdir(connId: string, path: string): Promise<void> {
  const client = connections.get(connId)
  if (!client) throw new Error(`FTP connection ${connId} not found`)
  await client.ensureDir(path)
}
