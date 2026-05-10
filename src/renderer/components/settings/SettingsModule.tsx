import { useState, useEffect, useCallback } from 'react'
import type { AirCodeModule } from '../../../shared/types'

interface SettingsGroup {
  id: string
  label: string
  items: Array<{ id: string; label: string }>
}

const groups: SettingsGroup[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      { id: 'workspace', label: 'Workspace' }
    ]
  }
]

function Settings() {
  const [activeGroup, setActiveGroup] = useState('general')
  const [activeItem, setActiveItem] = useState('workspace')
  const [workspacePath, setWorkspacePath] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.get('workspace.path').then((val) => {
      setWorkspacePath(val || '')
    })
  }, [])

  const saveWorkspace = useCallback(async () => {
    await window.api.settings.set('workspace.path', workspacePath)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [workspacePath])

  const resetWorkspace = useCallback(async () => {
    const defaultPath = ''
    setWorkspacePath(defaultPath)
    await window.api.settings.set('workspace.path', defaultPath)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [])

  return (
    <div className="flex h-full">
      {/* Left panel - groups and items */}
      <div className="w-[200px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] overflow-y-auto">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="px-4 pt-4 pb-1 text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
              {group.label}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`w-full px-4 py-1.5 text-left text-[var(--text-sm)] transition-colors ${
                  activeGroup === group.id && activeItem === item.id
                    ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                    : 'text-[var(--foreground-muted)] hover:bg-[var(--hover-bg)]'
                }`}
                onClick={() => {
                  setActiveGroup(group.id)
                  setActiveItem(item.id)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Right panel - content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeItem === 'workspace' && (
          <div>
            <h2 className="mb-1 text-[var(--text-base)] font-semibold text-[var(--foreground)]">Workspace</h2>
            <p className="mb-5 text-[var(--text-xs)] text-[var(--foreground-subtle)] leading-relaxed">
              Set the default workspace directory. Falls back to <code className="rounded-[var(--radius-sm)] bg-[var(--sidebar-bg)] px-1.5 py-0.5 font-[var(--font-code)] text-[var(--text-xs)]">~/.air-code</code> if not specified.
              You can also use the <code className="rounded-[var(--radius-sm)] bg-[var(--sidebar-bg)] px-1.5 py-0.5 font-[var(--font-code)] text-[var(--text-xs)]">AIR_CODE_WORKSPACE</code> environment variable.
            </p>

            <div className="space-y-2">
              <label className="block text-[var(--text-xs)] font-medium text-[var(--foreground-muted)]">
                Workspace Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="e.g. /Users/eric/projects"
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--background)] px-2.5 text-[var(--text-sm)] font-[var(--font-code)] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                  style={{ height: 'var(--height-input)' }}
                />
                <button
                  onClick={saveWorkspace}
                  className="rounded-[var(--radius-md)] bg-[var(--primary)] px-3 text-[var(--text-xs)] font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
                  style={{ height: 'var(--height-input)' }}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
              <div className="flex items-center gap-3 pt-0.5">
                <button
                  onClick={resetWorkspace}
                  className="text-[var(--text-xs)] text-[var(--foreground-subtle)] transition-colors hover:text-[var(--primary)]"
                >
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const SettingsModule: AirCodeModule = {
  id: 'settings',
  name: 'Settings',
  icon: 'settings',
  component: Settings
}
