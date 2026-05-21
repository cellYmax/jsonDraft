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

## 常用开发命令

```bash
pnpm install
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
cargo run --package json-draft --bin json-draft
```

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
| 最近文件 | `src/App.tsx` localStorage helpers |
| 树形导航 | `buildTree()` in `jsonTools.ts`, tree panel in `App.tsx`, `App.css` |
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
