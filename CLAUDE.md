# AirCode - CLAUDE.md

- 使用中文回答所有问题

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
- 当前尚无明确产品需求时，不要自行 invent 功能、目录或架构。

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
- 公共 API、数据模型、store 状态必须有明确类型。
- 优先 `const` / `let`，禁止 `var`；优先具名导出，便于重构与 tree-shaking。

### 命名

- 文件：组件用 `PascalCase.tsx`，工具 / store / hook 用 `camelCase.ts`（如 `useTabStore.ts`、`pathUtils.ts`）。
- 类型 / 接口 / 组件：`PascalCase`。
- 函数 / 变量 / 属性：`camelCase`。
- 常量：`UPPER_SNAKE_CASE`（仅限真正的常量配置）。
- 领域方法命名保持全仓一致，推荐 `{verb}{Noun}`（如 `readFile`、`listDirectory`）。
- 事件 / 通道名推荐 `{module}:{action}`（如 `editor:save`）。

### 错误处理

- 边界层（API / IPC / 路由 handler）捕获异常，返回明确错误结构（如 `{ error: string }` 或 Result），禁止未处理异常泄漏。
- UI 层展示中文错误提示；底层日志可用英文。
- 禁止空 `catch`；至少记录或向上传递。

### React（若使用）

- 仅使用函数组件 + Hooks。
- 外部副作用与后端调用集中在 `lib/` 或 hooks 中，组件内避免散落裸调用。
- 按关注点拆分 zustand（或同等）store，避免巨型全局 store。
- 优先 Tailwind 工具类；自定义 CSS 集中管理，不随意新建样式体系。
- 组件按功能目录组织：`components/{feature}/`。
- 不要默认添加 `useMemo` / `useCallback`；遵循项目既有性能与 React Compiler 约定。

### Node（若使用）

- 路径使用 `node:path` 与 `URL` / `fileURLToPath`，注意跨平台。
- 子进程与长生命周期资源必须可清理（关闭、卸载、超时）。
- 对外暴露的 API 保持最小表面积，参数做类型校验。

### 样式与 UI

- 沿用项目既有设计语言与组件库，不引入平行 UI 体系。
- 用户可见字符串使用中文；保持基本无障碍与语义化标签。

### 测试与质量

- 纯逻辑优先单测；契约变更时同步更新类型与 mock。
- 提交前尽量确保 `typecheck` 与 `lint` 可通过（若环境具备）。
