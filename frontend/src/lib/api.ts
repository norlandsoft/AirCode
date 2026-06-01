import type { FileEntry, GitCommit, GitFileStatus } from "./types"

interface ApiResponse {
  error?: string
  [key: string]: unknown
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        get_platform(): Promise<ApiResponse>
        get_app_info(): Promise<ApiResponse>
        open_file_dialog(): Promise<ApiResponse>
        open_folder_dialog(): Promise<ApiResponse>
        project: {
          list_directory(dir_path: string): Promise<ApiResponse>
          get_project_info(dir_path: string): Promise<ApiResponse>
          create_file(dir_path: string, name: string, is_dir?: boolean): Promise<ApiResponse>
          delete_item(item_path: string): Promise<ApiResponse>
          rename_item(old_path: string, new_name: string): Promise<ApiResponse>
        }
        editor: {
          read_file(file_path: string): Promise<ApiResponse>
          write_file(file_path: string, content: string): Promise<ApiResponse>
          search_in_project(project_path: string, query: string, file_pattern?: string): Promise<ApiResponse>
          get_language(file_path: string): Promise<ApiResponse>
        }
        terminal: {
          create(cwd?: string): Promise<ApiResponse>
          write(id: string, data: string): Promise<ApiResponse>
          resize(id: string, cols: number, rows: number): Promise<ApiResponse>
          destroy(id: string): Promise<ApiResponse>
        }
        git: {
          status(project_path: string): Promise<ApiResponse>
          log(project_path: string, count?: number): Promise<ApiResponse>
          diff(project_path: string, file_path?: string, staged?: boolean): Promise<ApiResponse>
          commit(project_path: string, message: string): Promise<ApiResponse>
          branch_list(project_path: string): Promise<ApiResponse>
          checkout(project_path: string, branch: string): Promise<ApiResponse>
          init(project_path: string): Promise<ApiResponse>
          add(project_path: string, file_path?: string): Promise<ApiResponse>
          reset(project_path: string, file_path?: string): Promise<ApiResponse>
          checkout_file(project_path: string, file_path: string): Promise<ApiResponse>
          show(project_path: string, hash: string): Promise<ApiResponse>
          show_stat(project_path: string, hash: string): Promise<ApiResponse>
          push(project_path: string): Promise<ApiResponse>
          fetch(project_path: string): Promise<ApiResponse>
        }
        settings: {
          get_settings(): Promise<ApiResponse>
          update_settings(values: Record<string, unknown>): Promise<ApiResponse>
          get_project_config(project_path: string): Promise<ApiResponse>
          update_project_config(project_path: string, values: Record<string, unknown>): Promise<ApiResponse>
          get_workspace(project_path: string): Promise<ApiResponse>
          save_workspace(project_path: string, data: Record<string, unknown>): Promise<ApiResponse>
          get_secrets(): Promise<ApiResponse>
          update_secrets(values: Record<string, unknown>): Promise<ApiResponse>
        }
        pipeline: {
          get_pipeline(project_path: string): Promise<ApiResponse>
          save_pipeline(project_path: string, pipeline: Record<string, unknown>): Promise<ApiResponse>
          run_pipeline(project_path: string): Promise<ApiResponse>
          stop_pipeline(run_id: string): Promise<ApiResponse>
          get_run_status(run_id: string): Promise<ApiResponse>
        }
      }
    }
    __aircode_on_terminal_output?: (id: string, data: string) => void
    __aircode_on_pipeline_event?: (runId: string, event: { type: string; nodeId: string; status?: string; data?: string }) => void
  }
}

const isPyWebView = typeof window !== "undefined" && "pywebview" in window

const mockApi = {
  get_platform: async () => ({ system: "Darwin", machine: "arm64" }),
  get_app_info: async () => ({ name: "AirCode", version: "0.1.0", dev_mode: true }),
  open_file_dialog: async () => ({ path: null }),
  open_folder_dialog: async () => ({ path: "/tmp/mock-project" }),
  project: {
    list_directory: async (dir_path: string) => ({
      path: dir_path,
      entries: [
        { name: "src", path: `${dir_path}/src`, is_dir: true, size: 0, modified: Date.now() / 1000 },
        { name: "README.md", path: `${dir_path}/README.md`, is_dir: false, size: 256, modified: Date.now() / 1000 },
        { name: "package.json", path: `${dir_path}/package.json`, is_dir: false, size: 512, modified: Date.now() / 1000 },
      ] as FileEntry[],
    }),
    get_project_info: async (dir_path: string) => ({
      name: dir_path.split("/").pop(),
      path: dir_path,
      is_git_repo: true,
      exists: true,
    }),
    create_file: async () => ({}),
    delete_item: async () => ({ success: true }),
    rename_item: async () => ({}),
  },
  editor: {
    read_file: async (file_path: string) => ({
      content: `// ${file_path}\nconsole.log("Hello from mock editor")\n`,
      path: file_path,
      name: file_path.split("/").pop(),
      language: "javascript",
      encoding: "utf-8",
      size: 64,
      modified: Date.now() / 1000,
    }),
    write_file: async () => ({ success: true }),
    search_in_project: async () => ({ results: [], truncated: false, count: 0 }),
    get_language: async (file_path: string) => ({
      language: file_path.endsWith(".py") ? "python" : "javascript",
    }),
  },
  terminal: {
    create: async (cwd?: string) => ({ id: "term_mock", pid: 12345, cwd: cwd || "/tmp" }),
    write: async () => ({ success: true }),
    resize: async () => ({ success: true }),
    destroy: async () => ({ success: true }),
  },
  git: {
    status: async () => ({
      branch: "main",
      staged: [] as GitFileStatus[],
      unstaged: [] as GitFileStatus[],
      untracked: [] as string[],
    }),
    log: async () => ({
      commits: [
        { hash: "abc123", author: "dev", email: "dev@test.com", timestamp: Date.now() / 1000, message: "Initial commit" },
      ] as GitCommit[],
    }),
    diff: async () => ({ diff: "" }),
    commit: async () => ({ success: true }),
    branch_list: async () => ({
      branches: [{ name: "main", is_current: true }],
    }),
    checkout: async () => ({ output: "" }),
    init: async () => ({ output: "Initialized empty Git repository" }),
    add: async () => ({ output: "" }),
    reset: async () => ({ output: "" }),
    checkout_file: async () => ({ output: "" }),
    show: async () => ({ diff: "mock commit diff" }),
    show_stat: async () => ({ files: [] }),
    push: async () => ({ output: "" }),
    fetch: async () => ({ output: "" }),
  },
  settings: {
    get_settings: async () => ({
      version: 1,
      theme: "dark",
      fontSize: 16,
      terminal: { shell: "/bin/zsh", fontSize: 14 },
      editor: { tabSize: 2, wordWrap: true, fontSize: 14 },
      recentProjects: [],
      window: { width: 1400, height: 900 },
    }),
    update_settings: async () => ({ success: true }),
    get_project_config: async () => ({
      path: "",
      name: "",
      gitUserName: null,
      gitUserEmail: null,
      ignorePatterns: ["node_modules", ".git", "dist"],
      editorOverrides: {},
    }),
    update_project_config: async () => ({ success: true }),
    get_workspace: async () => ({}),
    save_workspace: async () => ({ success: true }),
    get_secrets: async () => ({
      gitTokens: {},
      sshKeyPath: null,
      customTokens: {},
    }),
    update_secrets: async () => ({ success: true }),
  },
  pipeline: {
    get_pipeline: async () => ({ pipeline: null }),
    save_pipeline: async () => ({ success: true }),
    run_pipeline: async () => ({ run_id: "run_mock_123" }),
    stop_pipeline: async () => ({ success: true }),
    get_run_status: async () => ({
      run: {
        id: "run_mock_123",
        pipelineId: "pipeline_mock",
        status: "success",
        startedAt: Date.now() / 1000 - 5,
        finishedAt: Date.now() / 1000,
        nodeRuns: [],
      },
    }),
  },
}

type PyWebViewApi = NonNullable<Window["pywebview"]>["api"]

async function getApi() {
  if (isPyWebView && window.pywebview) {
    return window.pywebview.api
  }
  return new Promise<PyWebViewApi>((resolve) => {
    if (window.pywebview) {
      resolve(window.pywebview.api)
      return
    }
    window.addEventListener("pywebviewready", () => {
      resolve(window.pywebview!.api)
    })
    setTimeout(() => {
      resolve(mockApi as unknown as PyWebViewApi)
    }, 2000)
  })
}

let _api: PyWebViewApi | null = null

export async function api() {
  if (!_api) {
    _api = await getApi()
  }
  return _api
}

export { mockApi, isPyWebView }
