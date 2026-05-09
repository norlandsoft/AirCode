import type { AirCodeModule } from '../../../shared/types'

function Ftp() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <div className="mb-3 text-4xl">📁</div>
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">FTP Client</h3>
        <p className="text-xs">Connect to an FTP server</p>
      </div>
    </div>
  )
}

export const FtpModule: AirCodeModule = {
  id: 'ftp',
  name: 'FTP',
  icon: '📁',
  component: Ftp
}
