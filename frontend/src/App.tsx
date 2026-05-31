import { useEffect } from "react"
import { TitleBar } from "@/components/layout/TitleBar"
import { StatusBar } from "@/components/layout/StatusBar"
import { ProjectList } from "@/components/project/ProjectList"
import { Workspace } from "@/components/workspace/Workspace"
import { useProjectStore } from "@/stores/useProjectStore"

export default function App() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectList />
        <Workspace />
      </div>
      <StatusBar />
    </div>
  )
}
