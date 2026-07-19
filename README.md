# AirCode

基于 [Pi Agent Harness](https://github.com/earendil-works/pi) 的通用智能体平台。桌面端使用 Tauri 2 + React，Agent 运行时由 Node host 嵌入 `@earendil-works/pi-coding-agent`。

## 环境要求

| 依赖 | 版本建议 |
|------|----------|
| Node.js | ≥ 22 |
| npm | 随 Node 附带 |
| Rust / Cargo | stable（通过 [rustup](https://rustup.rs)） |
| Xcode CLT（macOS） | `xcode-select --install` |

确认 Rust 优先使用 rustup：

```bash
export PATH="$HOME/.cargo/bin:$PATH"
rustc --version
cargo --version
```

## 安装依赖

```bash
git clone <repo-url> AirCode
cd AirCode
npm install --ignore-scripts
```

> 使用 `--ignore-scripts` 与 Pi 供应链建议一致。Agent host 依赖系统已安装的 `node`。

## 开发运行（桌面应用）

先构建共享包与 Node host，再启动 Tauri 开发模式：

```bash
npm run build -w @aircode/shared
npm run build -w @aircode/runtime
npm run build:host -w @aircode/desktop
npm run dev
```

或直接：

```bash
npm run dev
```

（根目录 `dev` 脚本会先构建 `shared` / `runtime`，再进入桌面应用。）

首次启动会编译 Rust 依赖，可能较慢。窗口打开后即可与智能体对话。

### 配置模型 API Key

Pi 通过环境变量或自身认证读取密钥。开发前请至少配置一种 Provider，例如：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# 或
export OPENAI_API_KEY=sk-...
```

然后在同一终端执行 `npm run dev`。

## CLI 冒烟（无 UI）

用于验证 Agent 会话与工具循环，不启动桌面壳：

```bash
npm run build -w @aircode/shared
npm run build -w @aircode/runtime
export ANTHROPIC_API_KEY=sk-ant-...
npm run smoke -- "列出当前目录的文件"
```

## 生产构建

```bash
npm run build -w @aircode/shared
npm run build -w @aircode/runtime
npm run build -w @aircode/desktop
```

桌面安装包由 Tauri 输出到：

```text
apps/desktop/src-tauri/target/release/bundle/
```

仅构建前端 / host（不打包应用）可用：

```bash
npm run build
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式启动桌面应用 |
| `npm run smoke -- "<prompt>"` | CLI 冒烟 |
| `npm run typecheck` | 全仓 TypeScript 检查 |
| `npm run build` | 构建 shared / runtime / smoke-cli / host / UI |
| `npm run clean` | 清理构建产物与 `node_modules` |

## 仓库结构

```text
packages/shared     # Tauri 契约与 DTO
packages/runtime    # AgentHost（Pi SDK 封装）
apps/desktop        # Tauri + React + Node host
apps/smoke-cli      # 无 UI 冒烟入口
```

## 故障排查

- **`rustc` / `cargo` 找不到或版本不对**：确保 `~/.cargo/bin` 在 `PATH` 前面，并已安装 rustup stable。
- **Agent host 启动失败**：先执行 `npm run build:host -w @aircode/desktop`，确认存在 `apps/desktop/host-dist/index.js`；可用 `AIRCODE_HOST_JS` 指定脚本路径。
- **会话无模型 / 请求失败**：检查是否导出了对应 Provider 的 API Key。
