import { create } from "zustand"
import { api } from "@/lib/api"
import type { Pipeline, PipelineNode, PipelineRun, NodeRun } from "@/lib/types"

interface PipelineState {
  pipelines: Record<string, Pipeline>
  activeRun: PipelineRun | null
  selectedNodeId: string | null

  loadPipeline: (projectPath: string) => Promise<void>
  savePipeline: (projectPath: string, pipeline: Pipeline) => Promise<void>
  createPipeline: (projectPath: string, projectId: string, name: string) => Pipeline
  addNode: (projectPath: string, projectId: string, node: Omit<PipelineNode, "id">) => void
  updateNode: (projectPath: string, projectId: string, nodeId: string, updates: Partial<PipelineNode>) => void
  removeNode: (projectPath: string, projectId: string, nodeId: string) => void
  reorderNodes: (projectPath: string, projectId: string, nodeIds: string[]) => void
  updatePipelineName: (projectPath: string, projectId: string, name: string) => void
  runPipeline: (projectPath: string, projectId: string) => Promise<void>
  stopPipeline: () => Promise<void>
  selectNode: (nodeId: string | null) => void
  exitRunMode: () => void
  onPipelineEvent: (runId: string, event: { type: string; nodeId: string; status?: string; data?: string }) => void
}

let nodeCounter = 0

function generateNodeId(): string {
  nodeCounter++
  return `node_${nodeCounter}_${Date.now()}`
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelines: {},
  activeRun: null,
  selectedNodeId: null,

  loadPipeline: async (projectPath: string) => {
    const a = await api()
    const result = await a.pipeline.get_pipeline(projectPath)
    if (result.error) return
    if (result.pipeline) {
      set((state) => ({
        pipelines: {
          ...state.pipelines,
          [projectPath]: result.pipeline as Pipeline,
        },
      }))
    }
  },

  savePipeline: async (projectPath: string, pipeline: Pipeline) => {
    const a = await api()
    await a.pipeline.save_pipeline(projectPath, pipeline as unknown as Record<string, unknown>)
  },

  createPipeline: (projectPath: string, projectId: string, name: string) => {
    const now = Date.now() / 1000
    const pipeline: Pipeline = {
      id: `pipeline_1_${Date.now()}`,
      name,
      projectId,
      nodes: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: pipeline },
    }))
    get().savePipeline(projectPath, pipeline)
    return pipeline
  },

  addNode: (projectPath: string, _projectId: string, node: Omit<PipelineNode, "id">) => {
    const pipeline = get().pipelines[projectPath]
    if (!pipeline) return
    const newNode: PipelineNode = { ...node, id: generateNodeId() }
    const updated: Pipeline = {
      ...pipeline,
      nodes: [...pipeline.nodes, newNode],
      updatedAt: Date.now() / 1000,
    }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: updated },
    }))
    get().savePipeline(projectPath, updated)
  },

  updateNode: (projectPath: string, _projectId: string, nodeId: string, updates: Partial<PipelineNode>) => {
    const pipeline = get().pipelines[projectPath]
    if (!pipeline) return
    const updated: Pipeline = {
      ...pipeline,
      nodes: pipeline.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
      updatedAt: Date.now() / 1000,
    }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: updated },
    }))
    get().savePipeline(projectPath, updated)
  },

  removeNode: (projectPath: string, _projectId: string, nodeId: string) => {
    const pipeline = get().pipelines[projectPath]
    if (!pipeline) return
    const updated: Pipeline = {
      ...pipeline,
      nodes: pipeline.nodes.filter((n) => n.id !== nodeId),
      updatedAt: Date.now() / 1000,
    }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: updated },
    }))
    get().savePipeline(projectPath, updated)
  },

  reorderNodes: (projectPath: string, _projectId: string, nodeIds: string[]) => {
    const pipeline = get().pipelines[projectPath]
    if (!pipeline) return
    const nodeMap = Object.fromEntries(pipeline.nodes.map((n) => [n.id, n]))
    const reordered = nodeIds.map((id) => nodeMap[id]).filter(Boolean)
    const updated: Pipeline = {
      ...pipeline,
      nodes: reordered,
      updatedAt: Date.now() / 1000,
    }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: updated },
    }))
    get().savePipeline(projectPath, updated)
  },

  updatePipelineName: (projectPath: string, _projectId: string, name: string) => {
    const pipeline = get().pipelines[projectPath]
    if (!pipeline) return
    const updated: Pipeline = { ...pipeline, name, updatedAt: Date.now() / 1000 }
    set((state) => ({
      pipelines: { ...state.pipelines, [projectPath]: updated },
    }))
    get().savePipeline(projectPath, updated)
  },

  runPipeline: async (projectPath: string, _projectId: string) => {
    const a = await api()
    const result = await a.pipeline.run_pipeline(projectPath)
    if (result.error) return
    const run: PipelineRun = {
      id: result.run_id as string,
      pipelineId: "",
      status: "running",
      startedAt: Date.now() / 1000,
      nodeRuns: [],
    }
    const pipeline = get().pipelines[projectPath]
    if (pipeline) {
      run.pipelineId = pipeline.id
      run.nodeRuns = pipeline.nodes.map((n) => ({
        nodeId: n.id,
        status: "pending" as const,
        output: "",
      }))
    }
    set({
      activeRun: run,
      selectedNodeId: pipeline?.nodes[0]?.id || null,
    })
  },

  stopPipeline: async () => {
    const run = get().activeRun
    if (!run) return
    const a = await api()
    await a.pipeline.stop_pipeline(run.id)
  },

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId })
  },

  exitRunMode: () => {
    set({ activeRun: null, selectedNodeId: null })
  },

  onPipelineEvent: (runId: string, event: { type: string; nodeId: string; status?: string; data?: string }) => {
    const run = get().activeRun
    if (!run || run.id !== runId) return

    if (event.type === "node_status" && event.status) {
      const nodeRun = run.nodeRuns.find((nr) => nr.nodeId === event.nodeId)
      if (nodeRun) {
        nodeRun.status = event.status as NodeRun["status"]
        if (event.status === "running") {
          nodeRun.startedAt = Date.now() / 1000
        }
        if (event.status === "success" || event.status === "failed") {
          nodeRun.finishedAt = Date.now() / 1000
        }
      }
      if (event.status === "running") {
        set({ selectedNodeId: event.nodeId })
      }
      set({ activeRun: { ...run } })
    }

    if (event.type === "node_output" && event.data) {
      const nodeRun = run.nodeRuns.find((nr) => nr.nodeId === event.nodeId)
      if (nodeRun) {
        nodeRun.output += event.data
        if (nodeRun.output.length > 500_000) {
          nodeRun.output = nodeRun.output.slice(-500_000)
        }
      }
      set({ activeRun: { ...run } })
    }

    if (event.type === "pipeline_status" && event.status) {
      run.status = event.status as PipelineRun["status"]
      run.finishedAt = Date.now() / 1000
      set({ activeRun: { ...run } })
    }
  },
}))

if (typeof window !== "undefined") {
  window.__aircode_on_pipeline_event = (runId: string, event: { type: string; nodeId: string; status?: string; data?: string }) => {
    usePipelineStore.getState().onPipelineEvent(runId, event)
  }
}
