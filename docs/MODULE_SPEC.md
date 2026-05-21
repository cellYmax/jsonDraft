# Module Spec

最后更新：2026-05-22

## Core Types

### `JsonMode`

位置：`src/lib/jsonTools.ts`

```ts
type JsonMode = "json" | "jsonc";
```

- `json`：严格 JSON，不允许注释和尾逗号。
- `jsonc`：允许注释和尾逗号。

### `FileState`

位置：`src/lib/fileState.ts`

```ts
type FileState = {
  path: string | null;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
  sizeBytes: number;
};
```

字段约束：

- `path=null` 表示草稿或未另存的新文件。
- `name` 用于 UI 展示，可能来自示例、空白模板或本地文件名。
- `originalContent` 是 dirty 判断基线。
- `sizeBytes` 使用 `TextEncoder` 计算 UTF-8 字节数。

### `ParseIssue`

位置：`src/lib/jsonTools.ts`

```ts
type ParseIssue = {
  message: string;
  line: number;
  column: number;
  offset: number;
  severity: "error";
};
```

### `JsonSummary`

位置：`src/lib/jsonTools.ts`

```ts
type JsonSummary = {
  valid: boolean;
  rootType: RootType;
  itemCount: number | null;
  currentPath: string;
  formatState: FormatState;
};
```

### `ParseResult`

位置：`src/lib/jsonTools.ts`

```ts
type ParseResult = {
  value: unknown;
  issues: ParseIssue[];
  summary: JsonSummary;
  tree: JsonTreeNode[];
  treeTruncated: boolean;
};
```

## Tauri Commands

位置：`src-tauri/src/lib.rs`

### `open_json_file() -> FilePayload`

行为：

- 弹出打开文件对话框。
- 文件过滤器包含 `json`、`jsonc` 和全部文件。
- 拒绝超过 10MB 文件。
- 读取为 UTF-8 字符串。
- 用户取消时返回 `"CANCELLED"`。

### `open_json_file_at(path: string) -> FilePayload`

行为：

- 直接按路径打开文件，用于最近文件。
- 同样执行 10MB 限制。
- 读取失败时返回中文错误。

注意：

- 当前实现不限制路径必须来自最近文件，调用方需要保证只把可信的用户历史路径传入。

### `save_json_file(path: string, content: string) -> SaveResult`

行为：

- 将 `content` 写入指定路径。
- 返回路径、文件名和写入字节数。

### `save_json_file_as(content: string) -> FilePayload`

行为：

- 弹出保存文件对话框。
- 默认文件名为 `untitled.json`。
- 写入后返回完整文件 payload。

## `fileState.ts`

### 工厂函数

- `createDemoFileState()`：加载 `examples/customer-profile.json`，作为默认启动内容。
- `createBlankFileState()`：创建 `未命名.json` 空白模板。
- `createEmptyFileState()`：当前等同于 `createDemoFileState()`，保留语义入口。
- `fileStateFromPayload(payload)`：把 Tauri 返回值转换为干净文件状态。

### 状态转换

- `updateFileContent(state, content)`：更新内容、字节大小和 dirty。
- `markSaved(state, result?)`：把当前内容标记为已保存，并更新路径、文件名、字节大小。

### 工具函数

- `byteSize(content)`：返回 UTF-8 字节数。
- `formatBytes(bytes)`：格式化为 `B`、`KB` 或 `MB`。

## `jsonTools.ts`

### `analyzeJson(content, mode, cursorOffset?)`

职责：

- 根据模式选择解析选项。
- 为空内容生成用户可读错误。
- 将 `jsonc-parser` 错误转换为 `ParseIssue`。
- 解析成功后生成：
  - JS value
  - 根类型
  - 对象键数量或数组长度
  - 当前 JSON Path
  - 排版状态
  - 扁平树节点列表

边界：

- 无效内容不返回树。
- 树最多 250 个节点。
- `cursorOffset` 会被限制在 `[0, content.length]`。

### `formatJsonContent(content, mode)`

- 严格 JSON：`JSON.parse` + `JSON.stringify(value, null, 2)`，末尾换行。
- JSONC：使用 `jsonc-parser` 的 `format` 和 `applyEdits`，末尾换行。
- 输入无效时抛出中文错误。

### `minifyJsonContent(content, mode)`

- 输入必须按当前模式有效。
- 输出标准 JSON。
- JSONC 注释不会保留。

### `escapeMinifiedJsonContent(content, mode)`

- 等价于 `JSON.stringify(minifyJsonContent(content, mode))`。
- 输出是 JSON 字符串字面量。

### `unescapeJsonContent(content, mode)`

行为：

- 先尝试把输入作为完整 JSON 字符串解析。
- 如果失败，再尝试给输入补外层双引号解析。
- 解码后按当前模式格式化。
- 严格 JSON 模式格式化失败时，会尝试按 JSONC 格式化一次。
- 仍失败则抛出“去除转义后的内容不是有效 JSON。”

## `App.tsx`

### 状态

- `file`：当前文件内容和保存状态。
- `mode`：`json` 或 `jsonc`。
- `cursor`：Monaco 当前行、列和 offset。
- `recentFiles`：localStorage 中的最近文件，最多 5 条。
- `treeCollapsed`：树形导航收缩状态。
- `notice`：底部状态栏提示。
- `editorRef` / `monacoRef`：编辑器实例引用。

### 派生值

`parseResult` 通过 `useMemo` 从 `file.content`、`mode`、`cursor.offset` 派生。

### 主要事件

- `newBlankFile()`：新建空白文件。
- `restoreDemoFile()`：恢复示例文件。
- `openFile()`：调用 `open_json_file`。
- `openRecentFile()`：调用 `open_json_file_at`。
- `saveFile()`：有路径时保存，无路径时另存为。
- `saveFileAs()`：调用 `save_json_file_as`。
- `formatContent()`：格式化当前内容。
- `minifyContent()`：压缩当前内容。
- `escapeContent()`：压缩并转义。
- `unescapeContent()`：去除转义并格式化。
- `copyDerivedContent()`：复制压缩或转义结果。
- `copyCurrentPath()`：复制当前 JSON Path。
- `jumpToIssue()`：跳转解析错误。
- `jumpToTreeNode()`：跳转树节点。

### 快捷键

- `Cmd/Ctrl+N`：新建。
- `Cmd/Ctrl+O`：打开。
- `Cmd/Ctrl+S`：保存。
- `Cmd/Ctrl+Shift+S`：另存为。
- `Cmd/Ctrl+Enter`：格式化。
- `Cmd/Ctrl+Shift+M`：压缩。
- `Cmd/Ctrl+Shift+E`：压缩并转义。
- `Cmd/Ctrl+Shift+U`：去除转义。

## 样式模块

位置：`src/App.css`

要求：

- 侧栏内容必须在固定区域内滚动，不能撑破主布局。
- 树形导航需要支持较多节点的纵向滚动。
- 工具栏按钮文字不能挤压到不可读。
- 状态栏需要保持一行可读，通知文本可截断。

## 扩展接口建议

新增编辑器转换功能时：

1. 优先在 `jsonTools.ts` 增加纯函数。
2. 为纯函数补 Vitest 单测。
3. 在 `App.tsx` 增加 handler，只负责编排状态和错误提示。
4. 在工具栏或侧栏增加 UI。
5. 更新 `PRODUCT_SPEC.md` 和本文件。

新增 Tauri 能力时：

1. 先确认该能力是否必须在后端完成。
2. 在 `src-tauri/src/lib.rs` 增加 command。
3. 更新 `src-tauri/capabilities/default.json` 权限。
4. 在前端新增对应 TypeScript payload 类型。
5. 更新 `ARCHITECTURE_SPEC.md` 和本文件。
