# AirCode

基于 **Claude Agent SDK** 的远程开发 WebUI：在浏览器中操作 Claude Code、管理 Git、编辑代码、运行 Shell CI/CD。无登录，开发机直连。

## 架构

```
apps/web         Vite + React + @air/design（ChatView / ChatInput / CodeEditor / Splitter）
apps/server      Hono REST + SSE
packages/runtime AgentHost / Git / ShellJobs / 工作区 FS
packages/shared  HTTP 契约 / 事件 DTO
```

UI 组件来自 `/opt/AirOne/packages/design`（Vite alias）。

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
# 远程访问：HOST=0.0.0.0，并设置 AIRCODE_CORS_ORIGIN
```

3. 依赖：优先 `pnpm install`；若 registry 不稳定：

```bash
bash scripts/link-deps.sh
```

## 运行

```bash
npm run build
npm run dev
```

- Web http://127.0.0.1:5173
- API http://127.0.0.1:8787（默认绑定 `0.0.0.0`）

## 能力

1. **Claude Code 对话**：多会话、SSE 流式、工具内联标签、resume、自动放行工具
2. **Git 管理**：status / diff / branch / stage / commit / pull / push / fetch
3. **代码编辑**：文件树 + Monaco 可写编辑（⌘S 保存）
4. **CI/CD**：Shell 任务面板（`.aircode/tasks.json` 预置 + 自定义命令 + 流式日志）
5. **多端适配**：桌面三栏；Pad/手机底部导航切换会话 / 文件 / 编辑 / 对话 / Git / 任务
