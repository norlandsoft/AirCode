# AirCode

基于 **Claude Agent SDK** 的 Cursor 风格编程助手。无登录，本机直连。

## 架构

```
apps/web         Vite + React + @air/design（ChatView / ChatInput / CodeEditor / Splitter）
apps/server      Hono REST + SSE
packages/runtime AgentHost（@anthropic-ai/claude-agent-sdk）
packages/shared  HTTP 契约 / 事件 DTO
```

UI 组件来自 `/opt/AirOne/packages/design`（Vite alias，无需登录）。

## 准备

1. 构建 AirOne design：

```bash
cd /opt/AirOne/packages/design && npm run build
```

2. 配置 API Key：

```bash
cp .env.example .env
# 填入 ANTHROPIC_API_KEY=
# 可选 AIRCODE_WORKSPACE=/path/to/project
```

3. 依赖：优先 `pnpm install`；若 registry 不稳定，可复用 AirOne 的 pnpm store：

```bash
# 需已有 vendor/tgz 内 claude-agent-sdk / dotenv / concurrently 等 tarball
bash scripts/link-deps.sh
```

## 运行

```bash
npm run build
npm run dev
```

- Web http://127.0.0.1:5173
- API http://127.0.0.1:8787

## 首期能力

- 左侧会话列表
- 中间文件树 + Monaco 只读预览
- 右侧 Agent 对话（流式 + `<tool_use>` / `<tool_result>` 内联标签）
- 无登录；`permissionMode: acceptEdits`
