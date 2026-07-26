# AirCode

基于 **Claude Agent SDK** 的远程开发 WebUI：在浏览器中操作 Claude Code、管理 Git、编辑代码、运行 Shell CI/CD。无登录。

## 架构

```
apps/web         Vite + React + @air/design
apps/server      Hono REST + SSE
packages/runtime AgentHost / Git / ShellJobs / SQLite 设置
packages/shared  HTTP 契约 / 事件 DTO
```

## 配置原则

| 来源 | 内容 |
|------|------|
| `.env` | **仅** `PORT`、`CLAUDE_HOME`（应用 Home） |
| SQLite | API Key、模型、供应商、**当前项目目录**、最近项目等 |
| 项目目录 | 智能体 / 文件树 / Git / CI 的工作目录，在 Web「项目」中选择 |

默认 `CLAUDE_HOME=~/.aircode`，库文件 `{CLAUDE_HOME}/settings.db`。

## 准备

1. 构建 AirOne design：

```bash
cd /opt/AirOne/packages/design && npm run build
```

2. 环境变量（可选）：

```bash
cp .env.example .env
# PORT=10300
# CLAUDE_HOME=~/.aircode
```

3. 依赖：

```bash
pnpm install
# 或 bash scripts/link-deps.sh
```

## 运行

```bash
pnpm run build
pnpm run dev
```

- Web http://127.0.0.1:10330（dev）
- API http://127.0.0.1:10300（绑定 `0.0.0.0`）

首次打开需在「项目」中选择工作目录，并在「设置」中填写 API Key / 模型。

## 能力

1. **Claude Code 对话**：多会话、SSE、工具内联标签、resume
2. **Git 管理**：status / diff / branch / stage / commit / pull / push / fetch
3. **代码编辑**：文件树 + Monaco 可写编辑
4. **CI/CD**：Shell 任务面板（项目内 `.aircode/tasks.json`）
5. **多端适配**：桌面 / Pad / 手机导航
6. **本地 SQLite 设置** + **项目选择器**
