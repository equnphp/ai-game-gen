# GameGen 架构入口

当前方案：[V3.6 总体架构](architecture/v3.6/ARCHITECTURE.md)。

- [核心数据与接口契约](architecture/v3.6/CONTRACTS.md)
- [技术验证、开发增量与验收计划](architecture/v3.6/DELIVERY-PLAN.md)
- [GPL 开源与闭源商业服务边界](architecture/v3.6/OPEN-SOURCE-BOUNDARY.md)
- [输入基线与验证状态](architecture/v3.6/baseline.json)

版本：`arch-v3.6-draft.1`，日期：2026-11-14。方案基于 V3.5 完整需求及 V3.6 助手扩展，包含 Android、Qt 桌面、自研 C++ 引擎、工作流、模型/MCP/Skill、四目标导出与服务端。已纳入本次用户确认：APK 使用 WebView + C++ 编译的 WASM；代码按 GPL 开源/私有服务划分，用户独立生成的游戏允许闭源商用。

这是供评审和组织技术验证的架构设计。现有浏览器原型仍是交互样例；当前没有原生引擎、Android/Qt 成品或服务器性能证据。人员审批为空，尚未满足正式功能开发准入条件。技术验证可以按计划先行开展。

本会话没有可调用的 `architecture_mcp` 工具，因此尚未通过该工具生成正式 `.architecture-mcp.json`，也未执行其检查、评审、开发交接或门禁。`baseline.json` 是本方案自己的证据索引，不冒充 MCP 门禁结果。工具可用后应导入本方案并按返回模板补全清单。

历史依据：[V3.3 架构研究](ARCHITECTURE-V3.3.md)、[工作流与 OpenCode 约束](WORKFLOW-ARCHITECTURE.md)。历史文件保留原版本。
