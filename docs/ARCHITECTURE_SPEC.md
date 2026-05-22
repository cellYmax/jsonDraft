# Architecture Spec

最后更新：2026-05-22

## 技术栈

- 桌面容器：Tauri 2
- 后端：Rust
- 前端：Vite + React + TypeScript
- 编辑器：Monaco Editor
- JSONC 解析：`jsonc-parser`
- 图标：`lucide-react`
- 测试：Vitest

## 两层结构概览

```text
┌──────────────────────────────────────────────────┐
│  React Frontend (src/)                           │
│  - All JSON business logic                       │
│  - All UI state, dirty tracking, mode switching  │
│  - Recent files, tree nav, JSONPath, diagnostics │
└──────────────────────────────────────────────────┘
                  ↕ tauri.invoke
┌──────────────────────────────────────────────────┐
│  Rust Backend (src-tauri/)  — thin I/O only      │
│  - File I/O only (open/save dialogs + read/write)│
│  - 10MB hard limit                               │
│  - Returns "CANCELLED" sentinel on user cancel   │
└──────────────────────────────────────────────────┘
```

**关键规则：** JSON 解析或转换永远不写在 Rust。所有业务逻辑保留在 `src/lib/`，纯函数、可测。

## Tauri Commands 一览

| Command | 用途 |
| --- | --- |
| `open_json_file()` | 弹出打开对话框，读文件（≤10MB），返回 `FilePayload` |
| `open_json_file_at(path)` | 按已知路径读文件（最近文件用） |
| `save_json_file(path, content)` | 写入已知路径 |
| `save_json_file_as(content)` | 弹出保存对话框，写入 |

所有跨边界结构使用 `#[serde(rename_all = "camelCase")]`，JS 收到的是 `{ filePath, fileName, content, sizeBytes }`。详细行为见 `docs/MODULE_SPEC.md`。

## 目录职责

```text
src/
  App.tsx                 # 主 UI、应用状态、命令编排
  App.css                 # 主界面样式
  ErrorBoundary.tsx       # React 错误兜底
  main.tsx                # 前端入口
  lib/
    fileState.ts          # 文件状态、dirty 判断、大小格式化
    jsonTools.ts          # JSON/JSONC 解析、格式化、压缩、树节点
src-tauri/
  src/lib.rs              # Tauri commands 和插件注册
  tauri.conf.json         # Tauri 窗口、构建和打包配置
  capabilities/default.json # Tauri 权限声明
examples/                 # 内置示例和手工验证样本
docs/                     # 项目规格文档
```

## 分层边界

### Tauri 后端职责

后端只做本地能力，不做业务解析：

- 打开文件选择框。
- 保存文件选择框。
- 读取本地文件内容。
- 写入本地文件内容。
- 限制打开文件大小。
- 返回结构化 payload。

后端不负责：

- JSON 解析。
- JSON/JSONC 模式判断。
- 格式化、压缩或转义。
- dirty 状态。
- 最近文件。
- UI 错误展示。

### 前端职责

前端负责全部编辑器业务：

- 维护 `FileState`、当前模式、光标、最近文件、通知。
- 调用 Tauri commands。
- 使用 `jsonTools.ts` 做实时解析和转换。
- 配置 Monaco JSON 诊断选项。
- 展示错误、结构摘要、JSON Path 和树形导航。
- 处理快捷键和关闭保护。

## 数据流

### 打开文件

```text
User
  -> App.openFile()
  -> invoke("open_json_file")
  -> Rust read file and return FilePayload
  -> fileStateFromPayload()
  -> setFile()
  -> analyzeJson()
  -> UI refresh
```

### 编辑内容

```text
Monaco onChange
  -> updateFileContent()
  -> FileState.dirty recalculated
  -> analyzeJson(content, mode, cursorOffset)
  -> Sidebar/statusbar refresh
```

### 保存文件

```text
User
  -> App.saveFile()
  -> invoke("save_json_file" | "save_json_file_as")
  -> Rust write file
  -> applySavedResult()
  -> markSaved() or preserve newer editor content as dirty
```

### 转换内容

```text
User
  -> format/minify/escape/unescape handler
  -> jsonTools transform
  -> updateFileContent()
  -> analyzeJson()
  -> UI refresh
```

## 安全与权限

- 文件选择和保存通过 `rfd` 由用户主动触发。
- `open_json_file_at` 只用于打开最近文件中已有路径。
- 打开文件大小上限为 `10 * 1024 * 1024` 字节。
- Tauri capabilities 只包含默认权限、剪贴板写入和 opener 默认权限。
- 前端不启用远程 Schema 请求。
- v1 不执行 JSON 内容中的任何代码。

## 核心不变量

- `FileState.originalContent` 表示最近一次干净状态的内容。
- `FileState.dirty === (content !== originalContent)`，保存过程中的并发编辑除外，此时保存基线是 `savedContent`，当前内容保持 dirty。
- 切换 JSON/JSONC 模式不得改写 `file.content`。
- 格式化、压缩、压缩转义必须先通过当前模式解析。
- JSONC 压缩和压缩转义输出标准 JSON，不保留注释。
- JSONC 格式化应尽量保留注释。
- 无效 JSON 不构建树形导航。
- 树形导航最多展示 250 个节点，避免大型结构拖慢 UI。
- 用户取消 Tauri 对话框不是错误状态。

## 性能假设

- v1 目标文件小于 10MB。
- 解析在前端同步完成，依赖 React `useMemo` 缓存 `(deferredContent, mode, deferredCursorOffset)` 组合，并使用 `useDeferredValue` 把内容/光标延迟，让按键输入保持 UI 流畅。
- 树形导航限制节点数量，避免深层或宽表结构造成侧栏卡顿。
- Monaco 自动布局负责编辑器尺寸变化。

## 可扩展方向

- 多标签：需要把单个 `FileState` 扩展为文件集合，并重写保存/关闭保护。
- Schema 校验：需要独立 schema 模块，并重新启用或自定义 Monaco schema diagnostics。
- 大文件：需要延迟解析、虚拟树、worker 化解析和更精细的 Tauri 读取策略。
- Diff/历史：需要新增快照模型，不应塞进 `FileState`。
