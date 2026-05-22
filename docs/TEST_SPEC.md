# Test Spec

最后更新：2026-05-22

## 测试与开发命令

包管理器为 `pnpm`（见 `pnpm-lock.yaml`）。

### 前端

| 命令 | 说明 |
| --- | --- |
| `pnpm run dev` | 启动 Vite dev server（端口 1420，浏览器，无 Tauri 壳）。 |
| `pnpm run preview` | 预览生产前端构建。 |
| `pnpm run build` | `tsc`（类型检查，不产出）+ `vite build`，是事实上的“能否编译”检查。 |

### 桌面（Tauri）

| 命令 | 说明 |
| --- | --- |
| `pnpm run tauri dev` | 启动完整桌面应用（Rust 后端 + Vite HMR）。 |
| `pnpm run tauri build` | 产出生产桌面安装包。 |
| `pnpm run tauri` | 透传到 Tauri CLI。 |

### 测试

| 命令 | 说明 |
| --- | --- |
| `pnpm test` | 一次性 Vitest 运行（CI 模式）。 |
| `pnpm run test:watch` | 监听模式（TDD）。 |
| `pnpm test src/lib/jsonTools.test.ts` | 跑单个文件。 |
| `pnpm test -t "format"` | 按测试名过滤。 |

### Rust / 后端

`src-tauri/` 没有 `cargo` 脚本写进 `package.json`，直接调用：

```bash
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
cargo run --package json-draft --bin json-draft --manifest-path src-tauri/Cargo.toml
```

crate 名为 `json-draft`，库目标重命名为 `json_draft_lib`（避免 Windows 二进制/库重名冲突）。

### Lint / Format

**未配置**。仓库无 ESLint、Prettier、Biome 配置。代码质量仅依赖 TypeScript strict：

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

`pnpm run build`（包含 `tsc`）是事实上的 lint。

### 推荐 pre-commit 序列

```bash
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
```

日常开发建议：

- 改 `src/lib/*.ts`：至少 `pnpm test`。
- 改 React UI：至少 `pnpm run build`，并手工打开界面验证。
- 改 Tauri Rust：至少 `cargo check`。
- 改文件 IO：必须在 Tauri 应用中手工验证打开、保存、另存为。

## 测试框架与约定

- **Vitest 4.1.6** 作为 test runner。
- **jsdom** 作为 DOM 环境。
- **Testing Library**（`@testing-library/react`、`jest-dom`、`user-event`）已安装但**目前没有 React 组件测试**，属于待补能力。
- 测试配置 inline 在 `vite.config.ts` 的 `test:` 字段（无独立 `vitest.config.ts`）：

  ```ts
  test: { environment: "jsdom", globals: true }
  ```

- `globals: true`：直接使用 `describe`、`it`、`expect`，无需 import。
- 测试与源码**同目录**，命名 `<module>.test.ts`。
- **无 fixtures 目录**：内联测试数据；演示内容通过 `?raw` 从 `examples/` 引入。
- 新增 JSON 转换函数时，**必须**同步加 `*.test.ts` 用例（见 `docs/MODULE_SPEC.md` 契约）。

## 现有单测覆盖

### `src/lib/jsonTools.test.ts`

覆盖：

- 严格 JSON 有效解析。
- 严格 JSON 错误行列。
- JSONC 注释和尾逗号。
- 严格 JSON 拒绝 JSONC 语法。
- 字符串未闭合、无效 Unicode 转义、无效转义字符的专用错误消息。
- 光标 JSON Path。
- 光标节点 `currentRange`（有效 JSON）、无效 JSON 时为 null、空文档时为 null。
- 树形导航节点生成。
- 严格 JSON 格式化。
- JSONC 格式化保留注释。
- JSON/JSONC 压缩。
- 压缩并转义。
- 去除转义。
- 非 dot-safe key 的路径字符串。
- `filterTreeNodes` 空查询/label/path/preview 匹配以及无结果情形。

### `src/lib/fileState.test.ts`

覆盖：

- 默认启动为干净示例文件。
- 新建空白文件。
- 打开文件 payload 转换。
- 编辑后 dirty，改回原文后 clean。
- 保存后更新路径、基线和 dirty。
- `applySaveResult` 在内容未改变时清 dirty。
- `applySaveResult` 在 save-race 中保留新编辑为 dirty，仅前进基线和路径。

### `src/lib/recentFiles.test.ts`

覆盖：

- 空 storage / 缺失 key 时返回空数组。
- 过滤掉非 schema 项与 `null`。
- 损坏 JSON 时返回空数组。
- `loadRecentFiles` 与 `saveRecentFiles` 都按 `MAX_RECENT_FILES` 截断。
- `addRecentFile` 把新条目置顶并按 path 去重。
- `removeRecentFile` 移除目标 path，path 不存在时返回等价副本。

### `src/lib/jsonDiff.test.ts`

覆盖：

- 相同基本类型返回空数组。
- 不同基本类型返回单条根级 `changed`。
- 对象 vs 数组等异类型返回单条根级 `changed`，不深入。
- 对象按左序优先 + 右侧新增遍历，输出条目同时携带 `path` 与 `segments`。
- 嵌套对象按 `$.user.age` 路径定位，`segments` 为 `["user", "age"]`。
- 数组按下标对齐，长度不同时多余项视为 added，`segments` 为 `[index]`。
- `null` vs 缺失视为 `removed`。
- 非 dot-safe 键使用 `["..."]`，`segments` 仍是原 key 字符串。
- 键序不同但值结构相同视为相等。
- `0` vs `-0` 视为 `changed`。
- `summarizeDiff` 按 kind 计数，`unchanged` 不计入。

## 手工验证清单

### 启动与首屏

- 应用启动不白屏。
- 默认显示 `customer-profile.json` 示例内容。
- 右侧校验状态为通过。
- 树形导航可见，内容不撑破区域。
- 树形导航可收缩和展开。

### 文件操作

- 打开 `examples/customer-profile.json`。
- 打开 `examples/order-list.json`。
- 打开 `examples/app-config.jsonc`，切换 JSONC 后校验通过。
- 打开 `examples/invalid-for-error-demo.json`，错误面板显示错误。
- 保存已有路径文件。
- 无路径草稿保存时进入另存为。
- 另存为新文件后状态变为已保存。
- 有未保存修改时，新建、打开、关闭应用会提示确认。

### 解析与模式

- JSON 模式下 `{ "a": 1, }` 应报错。
- JSONC 模式下 `{ "a": 1, }` 应通过。
- JSON 模式下 `// comment` 应报错。
- JSONC 模式下 `// comment` 应通过。
- 切换模式不应改变编辑器内容。

### 转换功能

- 格式化 `{"a":1}` 得到两空格缩进和末尾换行。
- 压缩格式化后的 JSON 得到单行标准 JSON。
- JSONC 压缩会去掉注释并输出标准 JSON。
- 压缩并转义得到 JSON 字符串字面量。
- 去除转义可还原 `"{\"a\":1}"`。
- 去除转义无效文本时显示错误，不清空原内容。

### 错误定位与导航

- 点击错误列表项，Monaco 光标跳到对应行列。
- 光标移动时“当前位置”路径更新。
- 点击树节点，Monaco 跳到对应位置。
- 复制当前路径可写入剪贴板。
- 快速复制“压缩”和“转义”可写入剪贴板。
- 光标变化时，树形导航的当前节点自动滚入可视区域。
- 树形导航搜索框可按 label / path / preview 过滤；输入无匹配时显示“没有匹配节点”。
- 编辑器内光标所在节点出现柔和绿色背景高亮；光标移到根节点之外的任意子节点都能正确刷新；JSON 无效时高亮消失；切回有效后恢复。

### JSON Diff

- 工具栏 Diff 按钮可打开/关闭 Diff 面板；状态栏出现“已打开/关闭 Diff 视图”通知。
- 进入 Diff 时左侧自动填入当前编辑器内容，右侧空白；关闭后回到编辑器内容不丢。
- “互换” 按钮可一键互换左右内容。
- 任一侧无效 JSON 时下方提示“两侧都是合法 JSON 后才会展示差异。”，并在输入区头部显示“JSON 无法解析”。
- 两侧都合法时按结构化方式列出差异；改动键序但值结构一致显示“两侧 JSON 完全一致。”。
- 数组按下标对齐；对象 key 顺序不影响差异。
- 含特殊字符的键（如 `a-b`）路径形式为 `$["a-b"]`。
- 滚动任一 Monaco 编辑器，另一侧立即跟随；不会出现来回抖动。
- 点击 diff 行：两侧 Monaco 都把对应节点 reveal 到中心并选中；`added` 仅在右侧定位，`removed` 仅在左侧定位。

### 保存与原子写

- 保存到只读目录或不存在目录时返回中文错误，不留下临时文件。
- 写入完成后目标目录里看不到 `.{name}.{pid}.{counter}.jsondraft-tmp` 文件。
- 中途被强制结束（如 kill 进程）后，目标文件保留旧内容或新内容之一，不会出现半截内容。

### 最近文件

- 打开文件后出现在最近文件列表顶部。
- 重复打开同一路径不会产生重复项。
- 最近文件最多 5 条。
- 打开不存在的最近文件时，应从列表移除并显示错误。
- 清空最近文件后列表为空。

## 回归风险矩阵

| 改动区域 | 高风险回归 | 必跑检查 |
| --- | --- | --- |
| `lib/jsonTools.ts` | 模式解析错误、Path 错误、转换丢内容 | `pnpm test` |
| `lib/fileState.ts` | dirty 状态错误、保存后基线错误 | `pnpm test` |
| `lib/recentFiles.ts` | 损坏 JSON 崩溃、最近文件丢失 | `pnpm test` |
| `lib/jsonDiff.ts` | 误报相等、漏报差异、路径错误 | `pnpm test` |
| `lib/clipboard.ts` | 剪贴板写入失败 | 手工浏览器/Tauri 复制 |
| `hooks/useShortcuts.ts` | 快捷键失效、与浏览器冲突 | `pnpm run build` + 手工 |
| `hooks/useNotice.ts` | 通知不消失或错误被自动清除 | 手工触发各 tone |
| `hooks/usePathHighlight.ts` | 高亮卡在旧节点 / 切换文件后未清理 / 整文档变色 | 手工移动光标、切换有效/无效 |
| `hooks/useCloseProtection.ts` | dirty 被静默丢弃 | Tauri 手工关窗 |
| `components/TreePanel.tsx` | 折叠/搜索/滚动失效 | `pnpm run build` + 手工 |
| `components/DiffPanel.tsx` | 输入解析卡顿、互换丢失内容、列表崩溃 | `pnpm run build` + 手工 Diff 切换 |
| `App.tsx` 命令编排 | 未保存内容丢失、保存竞态 | `pnpm run build` + 手工文件操作 |
| `src-tauri/src/lib.rs` | 文件读写失败、权限缺失 | `cargo check` + Tauri 手工检查 |
| `App.css` | 布局溢出、状态栏遮挡 | 浏览器/Tauri 多尺寸检查 |

## 未来可补充的自动化

- React Testing Library 覆盖工具栏按钮和状态栏变化。
- Playwright 覆盖打开页面后的基本 UI 交互。
- Tauri command 层的 Rust 单测或集成测试。
- 大 JSON 样本的性能基准。
