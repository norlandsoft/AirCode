export type FtpFileInfo = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: Date
  permissions: string
}

export type FtpConnection = {
  id: string
  host: string
  port: number
  user: string
  connected: boolean
}

export type FtpTransferProgress = {
  fileId: string
  fileName: string
  bytesTransferred: number
  totalBytes: number
  direction: 'upload' | 'download'
}
