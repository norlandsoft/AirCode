# AirCode - CLAUDE.md

- 使用中文回答所有问题

## 产品目标

AirCode 是基于 **Pi Agent Harness**（`@earendil-works/pi-*`）的通用智能体平台，能力对齐 Claude Code / Codex：多模型对话、工具循环、会话、Skills / Extensions。不自研 Agent Loop，运行时嵌入官方 SDK。

## 技术边界

- **运行时底座**：`@earendil-works/pi-coding-agent`（`createAgentSession`）+ `pi-ai` + `pi-agent-core`
- **平台封装**：`packages/runtime`（`AgentHost`），UI 禁止直接依赖 Pi 包
- **桌面壳**：Tauri 2（Rust 壳 + React WebView）
- **Agent 进程**：Node sidecar（`apps/desktop/host`），通过 stdio JSON-RPC 与 Rust 通信；Rust 再以 Tauri command / event 暴露给前端
- **契约**：`packages/shared`（Tauri command 名、事件名、DTO）
- **冒烟**：`apps/smoke-cli`（无 UI 验证会话）

## Monorepo

```
packages/shared     # Tauri 契约 / DTO
packages/runtime    # AgentHost（Pi SDK 封装）
apps/desktop        # Tauri + React + Node host
apps/smoke-cli      # CLI 冒烟
```

```bash
npm install --ignore-scripts
npm run build -w @aircode/shared && npm run build -w @aircode/runtime
npm run build:host -w @aircode/desktop
npm run dev          # Tauri 桌面应用（需本机 Rust / cargo）
npm run smoke -- "列出当前目录文件"   # CLI 冒烟（需配置 API Key）
npm run typecheck
```

依赖安装优先 `--ignore-scripts`（与 Pi 供应链建议一致）。开发机需安装 Rust（`cargo`）与系统 Node（用于启动 agent host）。

## Pi / Tauri 集成约定

- 会话创建：`createAgentSession` + `ModelRuntime` + `SessionManager`（仅在 Node host）
- 事件：Pi → `AgentEventDto` → host stdout → Rust `emit("session:event")` → 前端 `listen`
- 前端只通过 `@tauri-apps/api` 的 `invoke` / `listen`（见 `src/lib/api.ts`），禁止直接访问 Node / Pi
- 扩展点（自定义工具、Skills、Extensions）挂在 `runtime` / host，不进 UI 层
- 首期权限与 Pi 默认一致（用户同权）；危险操作拦截后续再做

---

## 智能体开发规范

以下规则约束在本仓库中工作的 AI 编程助手（Claude / Cursor Agent 等）。

### 工作原则

1. **先读后改**：修改前先阅读相关文件与调用链，禁止凭猜测大面积改写。
2. **最小改动**：只改完成任务所需的代码；禁止顺手重构、扩 scope、添加未要求的文档或注释。
3. **中文沟通**：与用户对话使用中文；代码、标识符、提交说明主体使用英文。
4. **可验证**：改完后尽量通过 `typecheck` / `lint` / 相关测试；无法运行时说明原因与风险点。
5. **不擅自提交**：除非用户明确要求，否则不执行 `git commit` / `push`。

### 任务拆解

- 复杂任务先列出简短计划，再逐步实现；每步保持可编译、可运行。
- 涉及架构或技术选型时，先给出 1–2 个方案与取舍，再动手。
- 发现需求模糊时先提问，不要假设后大规模实现。
- 不要绕过 `packages/runtime` 在 UI 中直接调用 Pi SDK。
- 不要重新引入 Electron。

### 安全边界

- 禁止执行未经验证的用户输入作为命令或代码。
- 禁止拼接 shell 命令；使用参数数组形式调用子进程。
- 禁止提交密钥、`.env`、证书等敏感文件。
- 不编写 exploit / 恶意代码；本地漏洞仅允许修复，不提供利用载荷。

### Git 与协作

- 提交信息简洁说明「为什么」，不要添加 `Co-Authored-By`。
- 不修改 git config；不使用破坏性命令（`push --force`、hard reset 等），除非用户明确要求。
- PR / 提交只包含与任务相关的文件。

### 文档与注释

- 默认不新增 Markdown 文档，除非用户要求。
- 注释只解释非显而易见的意图；禁止叙述「做了什么」的废话注释。
- 用户可见 UI 文案使用中文。

---

## TypeScript / JavaScript 编码规范

### 语言与模块

- 全面使用 TypeScript；新增代码禁止隐式 `any`。
- 开启并遵守 `strict`；优先用 `unknown` + 收窄，而不是 `any`。
- 使用 ESM（`import` / `export`）；避免 CommonJS（`require`），除非对接遗留模块。
- 公共 API、数据模型、Tauri 载荷必须有明确类型，放在 `@aircode/shared`。
- 优先 `const` / `let`，禁止 `var`；优先具名导出。

### 命名

- 文件：组件用 `PascalCase.tsx`，工具 / store / hook 用 `camelCase.ts`。
- 类型 / 接口 / 组件：`PascalCase`。
- 函数 / 变量 / 属性：`camelCase`。
- 常量：`UPPER_SNAKE_CASE`（仅限真正的常量配置）。
- Tauri command：`{module}_{action}`；事件：`{module}:{action}`。

### 错误处理

- Host / Tauri 边界捕获异常，返回明确错误或抛给 `invoke`；前端映射为 `{ ok: false, error }`。
- UI 层展示中文错误提示；底层日志可用英文。
- 禁止空 `catch`；至少记录或向上传递。

### React

- 仅使用函数组件 + Hooks。
- 所有 Agent 调用经过 `src/lib/api.ts`，禁止组件内散落 `invoke`。
- 不要默认添加 `useMemo` / `useCallback`。

### Tauri / Node host

- Rust 只做进程编排与 IPC 中继，不实现 Agent 业务逻辑。
- Node host 生命周期随应用启停；stdio JSON-RPC 保持一行一条消息。
- 可通过 `AIRCODE_HOST_JS` 覆盖 host 脚本路径。

### 测试与质量

- 纯逻辑优先单测；契约变更时同步更新 shared、Rust 命令与 host。
- 提交前尽量确保 `npm run typecheck` 可通过。
