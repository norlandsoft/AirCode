# AirCode

基于 [Pi Agent Harness](https://github.com/earendil-works/pi) 的通用智能体平台。通过 **HTTP** 提供 Agent 服务，并附带 **Web 客户端**。

## 架构

```text
Browser (apps/web)
    │  REST + SSE
    ▼
HTTP Server (apps/server) ──► AgentHost (packages/runtime) ──► Pi SDK
```

## 环境要求

| 依赖 | 版本建议 |
|------|----------|
| Node.js | ≥ 22 |
| npm | 随 Node 附带 |

## 安装依赖

```bash
git clone <repo-url> AirCode
cd AirCode
npm install --ignore-scripts
```

> 使用 `--ignore-scripts` 与 Pi 供应链建议一致。

## 开发运行

同时启动 HTTP 服务（默认 `8787`）与 Web 开发服务器（`5173`，`/api` 代理到后端）：

```bash
npm run build -w @aircode/shared
npm run build -w @aircode/runtime
npm run dev
```

浏览器打开：<http://127.0.0.1:5173>

也可分开启动：

```bash
npm run dev:server   # http://127.0.0.1:8787
npm run dev:web      # http://127.0.0.1:5173
```

### 配置模型 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# 或
export OPENAI_API_KEY=sk-...
```

在同一终端执行 `npm run dev`。

## HTTP API（摘要）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/sessions` | 创建会话 |
| `GET` | `/api/sessions/:id` | 会话状态 |
| `POST` | `/api/sessions/:id/prompt` | 发送提示 |
| `POST` | `/api/sessions/:id/steer` | 运行中插入指令 |
| `POST` | `/api/sessions/:id/abort` | 中断 |
| `DELETE` | `/api/sessions/:id` | 销毁会话 |
| `GET` | `/api/sessions/:id/events` | SSE 事件流 |

## CLI 冒烟（无 UI）

```bash
npm run build -w @aircode/shared
npm run build -w @aircode/runtime
export ANTHROPIC_API_KEY=sk-ant-...
npm run smoke -- "列出当前目录的文件"
```

## 生产构建与运行

```bash
npm run build
NODE_ENV=production npm run start
```

服务默认监听 `8787`，并在存在 `apps/web/dist` 时托管 Web 静态资源。可用 `PORT` 覆盖端口。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并行启动 server + web |
| `npm run dev:server` | 仅 HTTP 服务 |
| `npm run dev:web` | 仅 Web（需后端已启动） |
| `npm run smoke -- "<prompt>"` | CLI 冒烟 |
| `npm run typecheck` | 全仓 TypeScript 检查 |
| `npm run build` | 构建全部包 |
| `npm run start` | 生产模式启动 server |
| `npm run clean` | 清理构建产物与 `node_modules` |

## 仓库结构

```text
packages/shared     # HTTP 契约与 DTO
packages/runtime    # AgentHost（Pi SDK 封装）
apps/server         # HTTP Agent 服务（REST + SSE）
apps/web            # Web 客户端
apps/smoke-cli      # 无 UI 冒烟入口
```

## 故障排查

- **会话无模型 / 请求失败**：检查是否导出了对应 Provider 的 API Key。
- **Web 连不上 API**：确认 server 已在 `8787` 监听；开发态依赖 Vite 对 `/api` 的代理。
- **CORS**：开发态已对浏览器 Origin 开放；生产建议同域由 server 托管静态资源。
