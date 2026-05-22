# AI Coding Guide

最后更新：2026-05-22

这份文档给后续 AI 助手使用。目标是让 AI 能继续稳定维护 jsonDraft，而不是每次重新猜项目结构。

## 项目上下文

jsonDraft 是一个本地桌面 JSON 编辑器：

- Tauri 2 提供本地文件读写和窗口能力。
- React + TypeScript 负责全部业务状态和 UI。
- Monaco Editor 负责编辑体验。
- `jsonc-parser` 负责 JSONC 解析、Path、格式化和树结构来源。
- v1 聚焦单文件，目标文件小于 10MB。
- UI 文案默认中文。

先读：

1. `docs/PRODUCT_SPEC.md`
2. `docs/ARCHITECTURE_SPEC.md`
3. `docs/MODULE_SPEC.md`
4. 和任务相关的源码文件

## AI 改码原则

- 不要把 JSON 解析逻辑写进 `App.tsx`；新增解析/转换能力优先放进 `src/lib/jsonTools.ts`。
- 不要把文件 dirty 规则散落到 UI；优先使用 `src/lib/fileState.ts`。
- 不要让 Tauri 后端承担格式化、压缩、校验等前端业务。
- 不要自动保存用户内容，除非产品规格明确改变。
- 不要在 JSONC 压缩时承诺保留注释；当前设计是输出标准 JSON。
- 不要启用远程 Schema 请求，除非新增 Schema 功能并更新安全说明。
- 不要无提示丢弃未保存修改。
- 不要移除 10MB 文件限制，除非同步实现大文件策略。
- 不要强制重写 README 或 specs 中与当前任务无关的内容。

## 项目约定（必读）

### 中文 UI / 英文代码

- **所有面向用户的文案使用简体中文** —— UI 标签、toast、错误信息（包括 Rust 返回的）、文档。
- **所有标识符、注释、commit message 使用英文。**
- 新增功能时，中文文案沿用 `docs/PRODUCT_SPEC.md` 的语气（简洁、中性、技术化）。

Rust 端中文错误示例：

```rust
"无法读取文件：{path}"
"文件超过 10MB，v1 暂不支持打开。"
```

### CANCELLED 是 sentinel，不是错误

Tauri 文件对话框命令在用户取消时返回**字符串字面量 `"CANCELLED"`**，**不会抛异常**。前端 handler 必须显式判断并提示“操作已取消”。

```ts
const result = await invoke<string>("save_json_file_as", { content });
if (result === "CANCELLED") { /* 取消提示 */ return; }
```

### Rust ↔ JS 命名通过 Serde

所有跨边界 Rust 结构使用：

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePayload { file_path: String, file_name: String, ... }
```

JS 收到的是 `{ filePath, fileName }`。TypeScript 类型中**不要**用 snake_case 键。

### 文件大小限制只在 Rust 强制

`MAX_FILE_BYTES = 10 * 1024 * 1024` 由 **Rust 端**校验，前端不要重复校验，直接让 Rust 错误冒泡到 UI。

### 状态变更必须走 helper

`FileState` 是单一事实来源。所有状态转换必须经过 `src/lib/fileState.ts` 中的纯函数：

- `createDemoFileState()` / `createBlankFileState()` —— 初始态
- `fileStateFromPayload(payload)` —— Rust I/O 之后
- `updateFileContent(state, content)` —— 编辑器变更
- `markSaved(state, savedContent?)` —— 写入成功且当前内容未改变时
- `applySaveResult(state, result, savedContent)` —— 写入成功后的统一入口（自动处理 save-race）

**不要在 `App.tsx` 中直接 inline 修改 `FileState`**，永远调用 helper。

### useMemo 派生模式

`parseResult` 通过 `useMemo` 从 `(deferredContent, mode, deferredCursorOffset)` 派生，其中 `deferredContent` 和 `deferredCursorOffset` 由 `useDeferredValue` 提供，避免大文件每次按键都同步重算解析。新增影响解析/分析的状态时，扩展这个依赖元组——**不要**新建并行的 `useEffect`。

### 启动必有示例

应用**永远不能以空白编辑器启动**。`createDemoFileState()` 通过 Vite 的 `?raw` query 导入 `examples/customer-profile.json` 作为初始状态。如果改这个默认，必须同步 `docs/PRODUCT_SPEC.md`。

### 树截断

JSON 树形导航上限为 `MAX_TREE_NODES = 250`。`ParseResult` 返回 `treeTruncated: boolean`，UI 在 true 时显示截断提示。

### 文档是契约

`docs/*.md` 描述当前事实，不是规划。改行为时：

1. 更新相关 SPEC：`PRODUCT_SPEC`、`ARCHITECTURE_SPEC`、`MODULE_SPEC`、`TEST_SPEC`。
2. 更新文档头部日期。
3. 本文 “常见任务定位” 表是 “该改哪个文件” 的权威查表。

## 常用开发命令

```bash
pnpm install
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
cargo run --package json-draft --bin json-draft
```

完整命令列表见 `docs/TEST_SPEC.md` 顶部和 `package.json` scripts。

## 推荐改动流程

1. 用 `rg` 或 `rg --files` 查找相关代码。
2. 读 specs，确认当前行为和约束。
3. 小步修改代码。
4. 为纯逻辑补单测。
5. 运行相关检查。
6. 如果行为、接口或约束变化，同步更新 docs。
7. 最后说明改了哪些文件、验证了什么、还有什么风险。

## 新增功能模板

给 AI 的任务可以这样写：

```text
请基于 docs/PRODUCT_SPEC.md 和 docs/MODULE_SPEC.md，为 jsonDraft 增加 [功能名]。
要求：
- 保持 Tauri 后端只负责本地能力。
- 纯 JSON/JSONC 逻辑放在 src/lib/jsonTools.ts，并补 Vitest。
- UI 文案用中文。
- 不破坏现有快捷键和 dirty 状态。
- 修改完成后运行 pnpm test 和 pnpm run build。
- 如果功能改变规格，请更新 docs。
```

## 修 bug 模板

```text
jsonDraft 现在出现 [现象]。
请先定位原因，再做最小修复。
要求：
- 不重构无关代码。
- 如果是解析或文件状态问题，补对应单测。
- 如果是布局问题，检查 src/App.css 中侧栏、树形导航、状态栏相关样式。
- 修复后说明根因和验证结果。
```

## 常见任务定位

| 任务 | 优先查看 |
| --- | --- |
| JSON/JSONC 解析错误 | `src/lib/jsonTools.ts`, `src/lib/jsonTools.test.ts` |
| 格式化、压缩、转义 | `src/lib/jsonTools.ts`, `src/App.tsx` handlers |
| dirty 状态不对 | `src/lib/fileState.ts`, `src/lib/fileState.test.ts` |
| 打开/保存失败 | `src-tauri/src/lib.rs`, `src/App.tsx` save/open handlers |
| 最近文件 | `src/lib/recentFiles.ts`, `src/App.tsx` rememberFile / openRecentFile |
| 通知 | `src/hooks/useNotice.ts`, `src/components/StatusBar.tsx` |
| 关闭确认 | `src/hooks/useCloseProtection.ts` |
| 快捷键 | `src/hooks/useShortcuts.ts` |
| 工具栏按钮 | `src/components/Toolbar.tsx` |
| 状态栏 | `src/components/StatusBar.tsx` |
| 侧栏面板 | `src/components/Sidebar.tsx` 装配 + `*Panel.tsx` 子组件 |
| 树形导航（搜索/折叠/滚动） | `src/components/TreePanel.tsx` + `filterTreeNodes` in `jsonTools.ts` |
| 剪贴板 | `src/lib/clipboard.ts` |
| 白屏 | `src/ErrorBoundary.tsx`, `index.html`, browser console, Tauri logs |
| 权限问题 | `src-tauri/capabilities/default.json` |

## UI 约束

- 右侧侧栏是信息面板，不要放大型编辑功能。
- 树形导航必须在区域内滚动或可收缩。
- 状态栏一行展示，通知可以截断。
- 按钮尽量使用 `lucide-react` 图标。
- 中文文案要短，避免按钮被挤爆。
- 现有产品是工作型工具，不要改成营销首页或重装饰页面。

## 测试期望

最小验证：

- 改纯逻辑：`pnpm test`
- 改前端 UI：`pnpm run build`
- 改 Rust/Tauri：`cargo check --package json-draft --manifest-path src-tauri/Cargo.toml`

涉及文件读写、对话框、窗口关闭保护的改动，需要手工跑 Tauri 应用验证。

## 交付说明模板

```text
已完成：
- [改动 1]
- [改动 2]

验证：
- pnpm test
- pnpm run build

注意：
- [剩余风险或未做事项]
```
