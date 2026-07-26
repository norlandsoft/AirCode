# AirCode - CLAUDE.md

- 使用中文回答所有问题

## 产品目标

AirCode 是模仿 Cursor 的 **Claude Code / Agent SDK 客户端**：多会话对话、工具循环、文件树预览。无登录。

配置原则：

- **`.env` 仅** `PORT`、`CLAUDE_HOME`（应用 Home）
- **SQLite**（`{CLAUDE_HOME}/settings.db`）：API Key、模型、项目目录等
- **智能体工作目录** = Web「项目」中选择的项目目录

前端 UI 使用 `/opt/AirOne/packages/design`（`@air/design`）：`ChatView` / `ChatInput` / `CodeEditor` / `Splitter` 等。

## 技术边界

- **运行时**：`@anthropic-ai/claude-agent-sdk`（`query`），封装于 `packages/runtime` 的 `AgentHost`
- **服务端**：`apps/server`（Hono，REST + SSE）
- **Web**：`apps/web`（Vite + React + `@air/design`）
- **契约**：`packages/shared`
- 禁止在 UI 中直接调用 Claude Agent SDK
- 不引入 Tauri / Electron；不做登录系统

## Monorepo

```
packages/shared   # HTTP 契约 / DTO
packages/runtime  # AgentHost / Git / Jobs / SQLite
apps/server       # HTTP Agent 服务
apps/web          # Cursor 风格客户端
```

```bash
pnpm install
pnpm run build
pnpm run dev
pnpm run typecheck
```

## 集成约定

- 会话：`AgentHost.createSession` / `prompt` / `abort`；Claude `session_id` 用于 `resume`
- 事件：SDK message → `AgentEventDto` → SSE（`event: session`）→ Web EventSource
- 工具展示：正文内联 `<tool_use>` / `<tool_result>`，供 ChatView 分段渲染
- 前端只通过 `apps/web/src/lib/api.ts` 访问服务
- 项目：`PUT /api/project` 选择 cwd；文件 / Git / Jobs / Agent 均基于该目录

## 智能体开发规范

1. 先读后改；最小改动；中文沟通
2. 不擅自 git commit / push
3. TypeScript strict；ESM；公共类型放 `@aircode/shared`
4. UI 文案中文；优先 `@air/design`，禁止 antd
