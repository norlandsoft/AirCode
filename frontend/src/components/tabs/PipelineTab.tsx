import { useState, useEffect, useRef } from "react"
import { Play, Square, Plus, Trash2, Pencil, ArrowLeft } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { usePipelineStore } from "@/stores/usePipelineStore"
import type { Tab, PipelineNode, PipelineRun } from "@/lib/types"

interface PipelineTabProps {
  tab: Tab
}

export function PipelineTab({ tab: _tab }: PipelineTabProps) {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const projectPath = activeProject?.path || ""
  const projectId = activeProject?.id || ""

  const pipeline = usePipelineStore((s) => s.pipelines[projectPath])
  const activeRun = usePipelineStore((s) => s.activeRun)
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId)

  const loadPipeline = usePipelineStore((s) => s.loadPipeline)
  const createPipeline = usePipelineStore((s) => s.createPipeline)
  const addNode = usePipelineStore((s) => s.addNode)
  const updateNode = usePipelineStore((s) => s.updateNode)
  const removeNode = usePipelineStore((s) => s.removeNode)
  const updatePipelineName = usePipelineStore((s) => s.updatePipelineName)
  const runPipeline = usePipelineStore((s) => s.runPipeline)
  const stopPipeline = usePipelineStore((s) => s.stopPipeline)
  const selectNode = usePipelineStore((s) => s.selectNode)
  const exitRunMode = usePipelineStore((s) => s.exitRunMode)

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    if (projectPath) {
      loadPipeline(projectPath)
    }
  }, [projectPath, loadPipeline])

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-sm text-text-muted mb-3">还没有流水线</p>
          <button
            onClick={() => createPipeline(projectPath, projectId, "新流水线")}
            className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            创建流水线
          </button>
        </div>
      </div>
    )
  }

  if (activeRun) {
    return (
      <RunModeView
        pipeline={pipeline}
        run={activeRun}
        selectedNodeId={selectedNodeId}
        onSelectNode={selectNode}
        onStop={stopPipeline}
        onExit={exitRunMode}
      />
    )
  }

  const handleRun = async () => {
    if (pipeline.nodes.length === 0) return
    await runPipeline(projectPath, projectId)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-2">
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={pipeline.name}
              onChange={(e) => updatePipelineName(projectPath, projectId, e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false) }}
              className="rounded border border-panel-border bg-panel-bg px-2 py-0.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          ) : (
            <span
              className="flex items-center gap-1.5 text-sm font-medium text-text-primary cursor-pointer hover:text-blue-400"
              onClick={() => setEditingName(true)}
            >
              {pipeline.name}
              <Pencil size={12} className="text-text-muted" />
            </span>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={pipeline.nodes.length === 0}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Play size={12} /> 运行
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-0">
          {pipeline.nodes.map((node, index) => (
            <NodeItem
              key={node.id}
              node={node}
              index={index}
              isEditing={editingNodeId === node.id}
              onEdit={() => setEditingNodeId(editingNodeId === node.id ? null : node.id)}
              onUpdate={(updates) => updateNode(projectPath, projectId, node.id, updates)}
              onRemove={() => {
                removeNode(projectPath, projectId, node.id)
                if (editingNodeId === node.id) setEditingNodeId(null)
              }}
              projectPath={projectPath}
              projectId={projectId}
            />
          ))}
        </div>

        <button
          onClick={() => {
            addNode(projectPath, projectId, {
              name: `步骤 ${pipeline.nodes.length + 1}`,
              command: "",
            })
          }}
          className="mt-3 flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-panel-border">
            <Plus size={12} />
          </div>
          添加节点
        </button>
      </div>
    </div>
  )
}

function NodeItem({
  node,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
}: {
  node: PipelineNode
  index: number
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<PipelineNode>) => void
  onRemove: () => void
  projectPath: string
  projectId: string
}) {
  const hasCommand = node.command.trim().length > 0

  return (
    <div className="flex items-stretch">
      <div className="flex flex-col items-center" style={{ width: 28 }}>
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {index + 1}
        </div>
        <div className="flex-1 w-px bg-panel-border" />
      </div>

      <div className="ml-2 flex-1 mb-1">
        <div
          onClick={onEdit}
          className={`cursor-pointer rounded border px-3 py-2 ${
            isEditing ? "border-blue-500 bg-blue-500/5" : "border-panel-border bg-panel-bg hover:border-panel-hover"
          }`}
        >
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input
                value={node.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="节点名称"
                className="w-full rounded border border-panel-border bg-panel-bg px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
              />
              <textarea
                value={node.command}
                onChange={(e) => onUpdate({ command: e.target.value })}
                placeholder="Shell 命令，如 npm run build"
                rows={2}
                className="w-full resize-none rounded border border-panel-border bg-panel-bg px-2 py-1 font-mono text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
              />
              <input
                value={node.workDir || ""}
                onChange={(e) => onUpdate({ workDir: e.target.value || undefined })}
                placeholder="工作目录（默认项目根目录）"
                className="w-full rounded border border-panel-border bg-panel-bg px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted shrink-0">Shell</span>
                <select
                  value={node.shell || "zsh"}
                  onChange={(e) => onUpdate({ shell: e.target.value as "zsh" | "bash" })}
                  className="rounded border border-panel-border bg-panel-bg px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="zsh">zsh</option>
                  <option value="bash">bash</option>
                </select>
              </div>
              <div className="flex justify-end gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove()
                  }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={10} /> 删除
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-primary">{node.name}</span>
              <div className="flex items-center gap-2">
                <span className="rounded bg-panel-hover px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  {node.shell || "zsh"}
                </span>
                <span className={`text-[11px] font-mono ${hasCommand ? "text-text-muted" : "text-yellow-500"}`}>
                  {hasCommand ? node.command : "未设置命令"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RunModeView({
  pipeline,
  run,
  selectedNodeId,
  onSelectNode,
  onStop,
  onExit,
}: {
  pipeline: { id: string; name: string; nodes: PipelineNode[] }
  run: PipelineRun
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
  onStop: () => Promise<void>
  onExit: () => void
}) {
  const outputRef = useRef<HTMLPreElement>(null)

  const selectedNodeRun = run.nodeRuns.find((nr) => nr.nodeId === selectedNodeId)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [selectedNodeRun?.output])

  const statusLabel: Record<string, { text: string; color: string }> = {
    running: { text: "运行中", color: "bg-blue-500/20 text-blue-400" },
    success: { text: "成功", color: "bg-green-500/20 text-green-400" },
    failed: { text: "失败", color: "bg-red-500/20 text-red-400" },
    cancelled: { text: "已取消", color: "bg-gray-500/20 text-gray-400" },
  }

  const pipelineStatus = statusLabel[run.status] || statusLabel.running

  const nodeStatusIcon: Record<string, { icon: string; color: string }> = {
    pending: { icon: "○", color: "text-gray-500" },
    running: { icon: "●", color: "text-blue-400 animate-pulse" },
    success: { icon: "✓", color: "text-green-400" },
    failed: { icon: "✗", color: "text-red-400" },
    skipped: { icon: "⊘", color: "text-gray-600" },
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{pipeline.name}</span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${pipelineStatus.color}`}>
            {pipelineStatus.text}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {run.status === "running" ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              <Square size={10} /> 停止
            </button>
          ) : (
            <button
              onClick={onExit}
              className="flex items-center gap-1 rounded bg-panel-bg border border-panel-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-panel-hover"
            >
              <ArrowLeft size={10} /> 返回编辑
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 shrink-0 overflow-y-auto border-r border-panel-border p-3">
          <div className="flex flex-col gap-0">
            {pipeline.nodes.map((node, i) => {
              const nodeRun = run.nodeRuns.find((nr) => nr.nodeId === node.id)
              const status = nodeRun?.status || "pending"
              const icon = nodeStatusIcon[status] || nodeStatusIcon.pending
              const isSelected = selectedNodeId === node.id

              return (
                <div key={node.id} className="flex items-stretch">
                  <div className="flex flex-col items-center" style={{ width: 24 }}>
                    <span className={`text-xs ${icon.color}`}>{icon.icon}</span>
                    {i < pipeline.nodes.length - 1 && <div className="flex-1 w-px bg-panel-border" />}
                  </div>
                  <button
                    onClick={() => onSelectNode(node.id)}
                    className={`ml-1.5 flex-1 rounded px-2 py-1.5 text-left text-xs mb-1 border ${
                      isSelected
                        ? "border-blue-500/30 bg-blue-500/10 text-text-primary"
                        : "border-transparent hover:bg-panel-hover text-text-secondary"
                    }`}
                  >
                    <div className="font-medium truncate">{node.name}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {status === "running"
                        ? "运行中..."
                        : nodeRun?.finishedAt && nodeRun?.startedAt
                          ? `${(nodeRun.finishedAt - nodeRun.startedAt).toFixed(1)}s`
                          : status === "pending"
                            ? "等待中"
                            : ""}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-[#0d0d1a] overflow-hidden">
          {selectedNodeRun ? (
            <pre
              ref={outputRef}
              className="h-full overflow-y-auto p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all"
            >
              {selectedNodeRun.output || (
                <span className="text-gray-600">
                  {selectedNodeRun.status === "pending"
                    ? "等待执行..."
                    : selectedNodeRun.status === "running"
                      ? "执行中..."
                      : "无输出"}
                </span>
              )}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-600">
              点击左侧节点查看输出
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
