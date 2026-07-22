# AirCode - CLAUDE.md

- 使用中文回答所有问题

## 产品目标

AirCode 是模仿 Cursor 的 **Claude Code / Agent SDK 客户端**：多会话对话、工具循环、文件树预览。无登录，本机通过 `ANTHROPIC_API_KEY` 直连。

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
packages/runtime  # AgentHost（Claude Agent SDK）
apps/server       # HTTP Agent 服务
apps/web          # Cursor 风格客户端
```

```bash
# 依赖：pnpm install，或 bash scripts/link-deps.sh（复用 AirOne store）
npm run build
npm run dev
npm run typecheck
```

## 集成约定

- 会话：`AgentHost.createSession` / `prompt` / `abort`；Claude `session_id` 用于 `resume`
- 事件：SDK message → `AgentEventDto` → SSE（`event: session`）→ Web EventSource
- 工具展示：正文内联 `<tool_use>` / `<tool_result>`，供 ChatView 分段渲染
- 前端只通过 `apps/web/src/lib/api.ts` 访问服务

## 智能体开发规范

1. 先读后改；最小改动；中文沟通
2. 不擅自 git commit / push
3. TypeScript strict；ESM；公共类型放 `@aircode/shared`
4. UI 文案中文；优先 `@air/design`，禁止 antd
