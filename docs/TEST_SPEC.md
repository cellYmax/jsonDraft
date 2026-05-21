# Test Spec

最后更新：2026-05-22

## 测试命令

```bash
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
```

日常开发建议：

- 改 `src/lib/*.ts`：至少运行 `pnpm test`。
- 改 React UI：至少运行 `pnpm run build`，并手工打开界面验证。
- 改 Tauri Rust：至少运行 `cargo check --package json-draft --manifest-path src-tauri/Cargo.toml`。
- 改文件 IO：需要在 Tauri 应用中手工验证打开、保存、另存为。

## 现有单测覆盖

### `src/lib/jsonTools.test.ts`

覆盖：

- 严格 JSON 有效解析。
- 严格 JSON 错误行列。
- JSONC 注释和尾逗号。
- 严格 JSON 拒绝 JSONC 语法。
- 光标 JSON Path。
- 树形导航节点生成。
- 严格 JSON 格式化。
- JSONC 格式化保留注释。
- JSON/JSONC 压缩。
- 压缩并转义。
- 去除转义。
- 非 dot-safe key 的路径字符串。

### `src/lib/fileState.test.ts`

覆盖：

- 默认启动为干净示例文件。
- 新建空白文件。
- 显式创建示例文件。
- 打开文件 payload 转换。
- 编辑后 dirty，改回原文后 clean。
- 保存后更新路径、基线和 dirty。

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

### 最近文件

- 打开文件后出现在最近文件列表顶部。
- 重复打开同一路径不会产生重复项。
- 最近文件最多 5 条。
- 打开不存在的最近文件时，应从列表移除并显示错误。
- 清空最近文件后列表为空。

## 回归风险矩阵

| 改动区域 | 高风险回归 | 必跑检查 |
| --- | --- | --- |
| `jsonTools.ts` | 模式解析错误、Path 错误、转换丢内容 | `pnpm test` |
| `fileState.ts` | dirty 状态错误、保存后基线错误 | `pnpm test` |
| `App.tsx` 文件操作 | 未保存内容丢失、保存竞态 | `pnpm run build` + 手工文件操作 |
| `App.tsx` UI 状态 | 侧栏溢出、按钮禁用错误 | `pnpm run build` + 浏览器/Tauri 手工检查 |
| `src-tauri/src/lib.rs` | 文件读写失败、权限缺失 | `cargo check` + Tauri 手工检查 |
| `App.css` | 布局溢出、状态栏遮挡 | 浏览器/Tauri 多尺寸检查 |

## 未来可补充的自动化

- React Testing Library 覆盖工具栏按钮和状态栏变化。
- Playwright 覆盖打开页面后的基本 UI 交互。
- Tauri command 层的 Rust 单测或集成测试。
- 大 JSON 样本的性能基准。
