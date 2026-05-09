import type { AirCodeModule } from '../../../shared/types'

function Editor() {
  return (
    <div className="flex h-full items-center justify-center text-[var(--sidebar-fg)]">
      <div className="text-center">
        <div className="mb-3 text-4xl">📝</div>
        <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">Code Editor</h3>
        <p className="text-xs">Open a file to start editing</p>
      </div>
    </div>
  )
}

export const EditorModule: AirCodeModule = {
  id: 'editor',
  name: 'Editor',
  icon: '📝',
  component: Editor
}
