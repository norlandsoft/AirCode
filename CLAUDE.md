# AirCode - CLAUDE.md

- 使用中文回答所有问题

## 产品目标

AirCode 是基于 **Claude Code 内核**（fork 自 cc-haha，MIT）的 Web 智能体工作台：
本地 Server（Bun）托管 Web UI，浏览器即可使用完整 Claude Code 能力，支持 H5 远程访问（手机/其他电脑通过令牌继续会话）。无登录、无桌面客户端。

## 架构边界

- **CLI 内核**：`src/`（Claude Code 本体 fork）。每会话由 Server spawn 一个 CLI 子进程（`stream-json` 双工 + 内部 `/sdk/<sid>` WS）。模型调用、工具循环、权限、技能、记忆全在内核。
- **本地 Server**：`src/server/`（`Bun.serve` 单进程）。REST `/api/*`、客户端 WS `/ws/<sessionId>`、供应商协议代理 `/proxy/*`、H5 静态托管 `desktop/dist`、H5 访问令牌与请求来源分类（`h5AccessPolicy.ts`）。
- **Web UI**：`desktop/`（React 19 + Vite + Zustand + Tailwind 4）。构建产物即浏览器客户端；Electron 能力经 `src/lib/desktopHost/browserHost.ts` 降级，禁止在 UI 中引入 Electron 依赖。
- **已移除**：Electron（`desktop/electron`、`src-tauri`）、IM 渠道（adapters/telegram 等）。`adapters/common` 的 SessionStore 仍被 server 会话 API 复用，勿删。

## 关键机制

- 会话/消息持久化 = CLI 的 jsonl 转录（`~/.claude/projects/{path}/{sessionId}.jsonl`），Server 直接读写，CLI/UI 天然互通。
- 供应商配置在 `~/.claude/cc-haha/providers.json` + `settings.json`；切换供应商 = 给 CLI 子进程注入 `ANTHROPIC_*` env；OpenAI 协议供应商经 `/proxy/*` 双向转换。
- 权限审批：CLI `control_request` → Server 广播 `permission_request`（多端）→ 任一端 `permission_response` 回写；连接建立回放快照。
- 断连不杀任务：客户端断开后任务继续跑，宽限期后才清理 CLI；重连 `sync_state` 恢复。
- H5 远程访问：Server 设 → H5 访问开启令牌；远程请求需 `Authorization: Bearer <token>`（WS 用 `?token=`）+ Origin 白名单；本机回环直连始终可信。

## 开发规范

1. 先读后改；最小改动；中文沟通
2. 不擅自 git commit / push
3. TypeScript strict；ESM；运行时用 Bun（≥1.3）
4. UI 文案中文；沿用现有 Tailwind 设计变量，不引入 antd 等新 UI 库
5. 禁止恢复 Electron / IM 渠道相关代码路径

## 常用命令

```bash
./bin/aircode          # 构建（首次）+ 启动 Server（默认 127.0.0.1:3456）
bun run start          # 直接启动 Server
bun run web:build      # 构建 Web UI（desktop/dist）
bun run web:dev        # Web UI 开发模式
```
