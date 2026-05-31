export function TitleBar() {
  return (
    <div className="flex h-9 items-center justify-between border-b border-panel-border bg-panel-bg px-4 select-none">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-accent">AirCode</span>
        <span className="text-xs text-text-muted">v0.1.0</span>
      </div>
      <div className="text-xs text-text-muted">本地开发工作站</div>
    </div>
  )
}
