import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { TabBar } from './components/layout/TabBar'
import { StatusBar } from './components/layout/StatusBar'
import { useAppStore } from './stores/app'
import { moduleRegistry } from './modules/registry'
import { ProjectModule } from './components/project/ProjectModule'
import { TerminalModule } from './components/terminal/TerminalModule'
import { DockerModule } from './components/docker/DockerModule'
import { DatabaseModule } from './components/database/DatabaseModule'
import { RedisModule } from './components/redis/RedisModule'
import { SettingsModule } from './components/settings/SettingsModule'

moduleRegistry.register(ProjectModule)
moduleRegistry.register(TerminalModule)
moduleRegistry.register(DockerModule)
moduleRegistry.register(DatabaseModule)
moduleRegistry.register(RedisModule)
moduleRegistry.register(SettingsModule)

export default function App() {
  const { activeModuleId } = useAppStore()
  const modules = moduleRegistry.getAll()

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden border-l border-[var(--border)]">
          <TabBar />
          <div className="flex-1 overflow-hidden relative">
            {/* Welcome screen */}
            {!activeModuleId && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--sidebar-fg)]">
                <div className="text-center">
                  <h2 className="mb-2 text-2xl font-light">AirCode</h2>
                  <p className="text-sm">Select a module from the sidebar to begin</p>
                </div>
              </div>
            )}
            {/* All modules stay mounted, toggle visibility */}
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="absolute inset-0"
                style={{ display: activeModuleId === mod.id ? 'block' : 'none' }}
              >
                <mod.component />
              </div>
            ))}
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
