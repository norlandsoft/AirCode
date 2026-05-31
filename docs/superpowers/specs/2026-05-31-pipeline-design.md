# Pipeline CI/CD Feature Design

## Overview

Add a new "Pipeline" tab type to AirCode, enabling users to create and run local task automation pipelines. Each pipeline consists of an ordered list of shell command nodes that execute sequentially — for example: `npm install` → `npm run lint` → `npm run build` → `./deploy.sh`.

**Scope**: Local task automation with pure shell commands, UI-based visual creation, manual trigger, embedded terminal output.

## Data Model

### Pipeline Definition

```typescript
interface Pipeline {
  id: string                    // Auto-generated: pipeline_{counter}_{timestamp}
  name: string                  // User-defined, e.g. "Frontend Build & Deploy"
  projectId: string             // Associated project ID
  nodes: PipelineNode[]         // Ordered list of nodes
  createdAt: number             // Unix timestamp
  updatedAt: number             // Unix timestamp
}

interface PipelineNode {
  id: string                    // Auto-generated
  name: string                  // Node label, e.g. "Install Dependencies"
  command: string               // Shell command, e.g. "npm install && npm run build"
  workDir?: string              // Optional working directory, defaults to project root
  env?: Record<string, string>  // Optional environment variables
}
```

### Execution Record

```typescript
interface PipelineRun {
  id: string
  pipelineId: string
  status: "running" | "success" | "failed" | "cancelled"
  startedAt: number
  finishedAt?: number
  nodeRuns: NodeRun[]
}

interface NodeRun {
  nodeId: string
  status: "pending" | "running" | "success" | "failed" | "skipped"
  exitCode?: number
  output?: string               // Terminal output (pushed in chunks)
  startedAt?: number
  finishedAt?: number
}
```

### Persistence

- Pipeline definitions: `~/.aircode/pipelines/{project_hash}.json` — one file per project
- Execution records: in-memory only, cleared on app exit
- One pipeline per project (v1). Pipeline tab is auto-created per project when user opens it; not auto-created like git tab

## UI Layout

### Edit Mode

```
┌──────────────────────────────────────────┐
│ Pipeline Name: "前端构建部署"    [▶ 运行] │
├──────────────────────────────────────────┤
│  ①── 安装依赖          npm install       │
│  │                                       │
│  ②── 代码检查          npm run lint      │
│  │                                       │
│  ③── 构建              npm run build     │
│  │                                       │
│  ④── 部署              ./deploy.sh       │
│                                          │
│  ＋── 添加节点                            │
└──────────────────────────────────────────┘
```

- Top bar: pipeline name (editable) + run button
- Body: vertically stacked node cards connected by numbered circles and vertical lines
- Each node card shows name + command preview
- Click a node to expand inline editor (name, command textarea, work dir, env vars)
- Bottom: "Add Node" button with dashed circle

### Run Mode

```
┌──────────────────────────────────────────────────────┐
│ Pipeline: "前端构建部署"  [运行中]           [■ 停止]  │
├──────────────┬───────────────────────────────────────┤
│ ✓ 安装依赖   │ $ npm run build                       │
│   1.2s       │ vite v5.4.0 building for production...│
│ ✓ 代码检查   │ transforming...                        │
│   3.5s       │ ✓ 42 modules transformed.              │
│ ● 构建       │ rendering chunks...                    │
│   运行中...  │ computing gzip...                      │
│ ○ 部署       │ dist/index.html    0.45 kB             │
│   等待中     │ dist/assets/index.js  145 kB           │
│              │ ▌                                     │
└──────────────┴───────────────────────────────────────┘
```

- Top bar: pipeline name + status badge + stop button
- Left panel (220px): node status list with icons (✓ success / ● running / ○ pending) and elapsed time
- Right panel: embedded xterm.js terminal showing real-time output of selected node
- Click any node in left panel to switch terminal to that node's output
- When pipeline finishes, show final result with "Return to Edit" button

### First-Time Empty State

- Display centered placeholder: "No pipeline yet" + "Create Pipeline" button
- Clicking creates a new empty pipeline and switches to edit mode

## Backend API

### New file: `backend/api/pipeline.py`

```python
class PipelineApi:
    def __init__(self, root_api) -> None:
        self._api = root_api
        self._pipelines_dir = Path.home() / ".aircode" / "pipelines"
        self._pipelines_dir.mkdir(parents=True, exist_ok=True)
        self._runs: dict[str, PipelineRun] = {}      # In-memory run state
        self._processes: dict[str, subprocess.Popen]  # Running subprocesses
```

### API Methods

| Method | Description | Return |
|--------|-------------|--------|
| `get_pipeline(project_id)` | Load pipeline definition for a project | `Pipeline` dict or `None` |
| `save_pipeline(data)` | Create or update pipeline definition | `{"success": True}` |
| `run_pipeline(pipeline_id)` | Start sequential execution of all nodes. Runs in a background thread to avoid blocking the API bridge | `{"run_id": "..."}` |
| `stop_pipeline(run_id)` | Stop a running pipeline (SIGTERM) | `{"success": True}` |
| `get_run_status(run_id)` | Get current execution status | `PipelineRun` dict |

### Execution Engine

```
run_pipeline(pipeline_id):
  1. Load pipeline definition from JSON file
  2. Create PipelineRun with status "running"
  3. For each node in order:
     a. Update nodeRun status to "running", push to frontend via evaluate_js
     b. Start subprocess.Popen with node.command, node.workDir, node.env
     c. Read stdout/stderr line by line, push to frontend via evaluate_js
     d. Wait for process to complete, check exit_code
     e. exit_code == 0 → mark success, continue to next node
     f. exit_code != 0 → mark failed, skip remaining nodes
  4. All nodes done → mark pipeline as success/failed
```

### Real-time Push

Reuse the existing terminal push pattern with a new global callback:

```javascript
window.__aircode_on_pipeline_output = function(runId, nodeId, data) { ... }
```

- Backend calls `_evaluate_js` to invoke this callback during node execution
- Frontend store listens and updates `nodeRun.output` + xterm rendering

## Frontend Architecture

### Store: `frontend/src/stores/usePipelineStore.ts`

**State:**
- `pipelines: Record<projectId, Pipeline>` — pipeline definitions per project
- `activeRun: PipelineRun | null` — current execution record
- `selectedNodeId: string | null` — which node's output is displayed in terminal

**Actions:**
- `loadPipeline(projectId)` — fetch from backend
- `savePipeline(projectId, pipeline)` — persist to backend
- `addNode(projectId, node)` — add a node
- `updateNode(projectId, nodeId, updates)` — edit a node
- `removeNode(projectId, nodeId)` — delete a node
- `reorderNodes(projectId, nodeIds[])` — reorder nodes
- `runPipeline(projectId)` — trigger execution
- `stopPipeline(runId)` — stop execution
- `onPipelineOutput(runId, nodeId, data)` — receive real-time output
- `onNodeStatusChange(runId, nodeId, status)` — receive node status updates

### Components: `frontend/src/components/tabs/PipelineTab.tsx`

```
PipelineTab
├── PipelineHeader          // Name + run/stop button + status badge
├── PipelineEditor          // Edit mode (rendered when !activeRun)
│   ├── NodeList            // Node list container
│   │   ├── NodeItem        // Single node card (name + command preview)
│   │   └── AddNodeButton   // Bottom add button
│   └── NodeEditor          // Inline node editing panel
│       ├── Name input
│       ├── Command textarea
│       ├── Working directory input
│       └── Environment variables input
└── PipelineRunner          // Run mode (rendered when activeRun)
    ├── RunNodeList         // Left panel: node status list
    │   └── RunNodeItem     // Node + status icon + elapsed time
    └── RunOutput           // Right panel: terminal output
        └── TerminalView    // xterm.js rendering selected node output
```

### Key Interactions

1. **First open**: No pipeline → show empty state + "Create Pipeline" button
2. **Edit node**: Click NodeItem → expand NodeEditor, auto-save on change
3. **Drag reorder**: Drag NodeItem to reorder, save on drop
4. **Run switch**: Click run → view switches from PipelineEditor to PipelineRunner
5. **During run**: Left panel updates node status in real-time, right panel shows current node output
6. **Switch output**: Click any node in run mode to view its output
7. **Run complete**: Show final result, "Return to Edit" button available

## Integration Points

| File | Change |
|------|--------|
| `frontend/src/lib/types.ts` | Add `"pipeline"` to `TabType` union |
| `frontend/src/stores/useTabStore.ts` | Add pipeline to `TAB_ICONS` / `TAB_TITLES` |
| `frontend/src/components/workspace/Workspace.tsx` | Add `{tab.type === "pipeline" && <PipelineTab />}` |
| `frontend/src/components/workspace/TabBar.tsx` | Add "New Pipeline" button option |
| `frontend/src/lib/api.ts` | Add `pipeline` namespace type + mock implementation |
| `backend/api/pipeline.py` | New file: PipelineApi class |
| `backend/api/base.py` | Import and instantiate PipelineApi |

## Error Handling

| Scenario | Handling |
|----------|----------|
| Node command fails (exit_code ≠ 0) | Mark node as failed, skip remaining nodes, pipeline → failed |
| Empty pipeline (0 nodes) | Disable run button, show hint "Add at least one node" |
| Command not found | Node → failed, terminal shows error (e.g. "command not found") |
| Double-click run | Run button becomes stop button while running |
| Manual stop | SIGTERM to subprocess, mark current + remaining nodes as cancelled |
| Save failure | Show error toast, preserve local edits |
| Long-running commands | No timeout, continuous output push |
| Large output | Cap at 10,000 lines per node, truncate oldest |
| App exit during run | SIGTERM all running subprocesses |
| Project switch | Load new project's pipeline, running pipeline continues in background |
| Empty command node | Skip node (mark skipped), continue to next |

## MVP Scope

**Included:**
- Pipeline tab creation and editing
- Node CRUD + reorder
- Sequential execution + embedded terminal output
- Run/stop control
- Real-time node status display

**Excluded (future iterations):**
- Multiple pipelines per project
- Pipeline templates
- Conditional branching / parallel execution
- Scheduled / event-driven triggers
- Execution history persistence
