# jsonDraft Specs

本目录记录 jsonDraft 的产品、架构、模块接口、测试和 AI 协作约束。后续继续开发时，先读这里，再改代码。

## 文档索引

- [产品规格](./PRODUCT_SPEC.md)：v1 范围、用户流程、功能验收标准和非目标。
- [架构规格](./ARCHITECTURE_SPEC.md)：Tauri/React 边界、数据流、安全约束和关键不变量。
- [模块接口规格](./MODULE_SPEC.md)：核心类型、Tauri commands、解析模块、文件状态模块和 UI 状态。
- [测试规格](./TEST_SPEC.md)：现有测试、回归用例、手工验证清单和风险矩阵。
- [AI 生码指南](./AI_CODING_GUIDE.md)：给后续 AI 助手的上下文、改动规则和常用 prompt。

## 维护规则

1. 功能行为变化时，同步更新 `PRODUCT_SPEC.md`。
2. 模块边界、命令接口、核心类型变化时，同步更新 `ARCHITECTURE_SPEC.md` 和 `MODULE_SPEC.md`。
3. 新增风险点或修复过的回归问题，同步更新 `TEST_SPEC.md`。
4. 如果希望 AI 后续稳定续写代码，把新的约束写进 `AI_CODING_GUIDE.md`。
5. 文档应描述当前代码事实；规划内容放在明确的“后续方向”里。
