import { useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TabBar } from './components/layout/TabBar'
import { StatusBar } from './components/layout/StatusBar'
import { useAppStore } from './stores/app'
import { moduleRegistry } from './modules/registry'
import { EditorModule } from './components/editor/EditorModule'
import { TerminalModule } from './components/terminal/TerminalModule'
import { FtpModule } from './components/ftp/FtpModule'
import { ServicesModule } from './components/services/ServicesModule'

function registerModules() {
  moduleRegistry.register(EditorModule)
  moduleRegistry.register(TerminalModule)
  moduleRegistry.register(FtpModule)
  moduleRegistry.register(ServicesModule)
}

export default function App() {
  useEffect(() => {
    registerModules()
  }, [])

  const { activeModuleId, activeTabId, sidebarCollapsed } = useAppStore()
  const activeModule = activeModuleId ? moduleRegistry.get(activeModuleId) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex flex-1 flex-col overflow-hidden border-l border-[var(--border)]">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            {activeModule ? (
              <activeModule.component key={activeTabId} />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
                <div className="text-center">
                  <h2 className="mb-2 text-2xl font-light">AirCode</h2>
                  <p className="text-sm">Select a module from the sidebar to begin</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
