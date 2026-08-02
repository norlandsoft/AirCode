# AirCode

基于 **Claude Code 内核**的 Web 智能体工作台（源自 [cc-haha](https://github.com/NanmiCoder/cc-haha)，MIT）。

纯浏览器使用，无桌面客户端：本地 Server 托管 Web UI，任何能访问该端口的设备（本机、局域网手机/电脑）打开浏览器即可使用完整 Claude Code 能力。

## 快速开始

需要 [Bun](https://bun.sh) ≥ 1.3：

```bash
bun install
(cd desktop && bun install && bun run build)
./bin/aircode
```

打开 http://127.0.0.1:3456 ，在「设置 → 服务商」中配置模型（支持 Anthropic 官方、ChatGPT/Grok OAuth、DeepSeek、智谱 GLM、Kimi、MiniMax、LM Studio、Ollama 及任意 Anthropic/OpenAI 兼容网关）。

## 架构

```
浏览器（desktop/ 的 React 构建产物，即 H5 客户端）
   │ REST /api/* + WebSocket /ws/<sessionId>
本地 Server（src/server，Bun.serve 单进程）
   │  · 会话/供应商/权限/定时任务/技能/记忆/MCP 管理
   │  · /proxy/* 供应商协议转换（Anthropic ↔ OpenAI）
   │  · H5 远程访问：令牌 + 请求来源分类 + Origin 白名单
   │ Bun.spawn（每会话一个 CLI 子进程，stream-json 双工）
Claude Code CLI 内核（src/entrypoints/cli.tsx）
   · 模型调用、工具循环、权限系统、技能、记忆、子代理
```

## 远程使用（H5 访问）

1. 以 `SERVER_HOST=0.0.0.0 ./bin/aircode` 启动（或置于反向代理后）。
2. 本机浏览器打开「设置 → H5 访问」，开启并生成访问令牌，配置允许的 Origin。
3. 远程设备浏览器访问 `http://<部署机IP>:3456`，输入令牌即可继续所有会话——锁屏、断网不影响正在运行的任务（服务端常驻 + 断连宽限期）。
4. 公网部署请使用 HTTPS 反代，代理 `/api/*`、`/proxy/*`、`/ws/*`（开启 WebSocket Upgrade），保留 Host 与 `X-Forwarded-*` 头。

## 与 cc-haha 的差异

- 移除 Electron 桌面壳（终端/桌宠/自动更新等原生能力），Web UI 通过 `browserHost` 降级在浏览器运行
- 移除 IM 渠道适配器（Telegram/飞书/微信/钉钉/WhatsApp）及其设置页
- 保留：Claude Code CLI 内核、本地 Server 全部 REST/WS API、供应商管理与协议代理、H5 远程访问、定时任务、技能市场、Agents、记忆、MCP、诊断等

## 常用命令

```bash
./bin/aircode                 # 构建（首次）并启动 Server
bun run start                 # 直接启动 Server（bun run src/server/index.ts）
bun run web:dev               # Web UI 开发模式（vite）
bun run web:build             # 重新构建 Web UI
```

Server 选项：`--host` / `--port`（或 `SERVER_HOST` / `SERVER_PORT`，默认 127.0.0.1:3456）、`--auth-required`（强制鉴权）、`--cli-path`（指定 CLI）。

## 目录

```
src/            Claude Code 内核 + 本地 Server（迁移核心）
  server/       REST/WS/H5/代理/鉴权
desktop/        Web UI（React + Vite，构建产物即浏览器客户端）
bin/aircode     启动器
legacy/         原 AirCode 实现（已废弃，仅存档参考）
docs/           cc-haha 原始文档
```

## 许可

基于 MIT 许可的 cc-haha 修改，见 [LICENSE](LICENSE) 与 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
