# GameGen 架构入口

当前版本：`arch-v3.7-draft.1`，日期：2026-11-14。承接V3.5完整功能、V3.6助手扩展与产品V3.7三引擎导入/仅LAN同步与产品V3.8共享核心/扩展需求；纳入用户确认的共享创作组件、未来三引擎可编辑工程和移动/平板编辑器。

- [总体架构](architecture/v3.7/ARCHITECTURE.md)
- [共享核心与多终端表现层](architecture/v3.7/SHARED-CORE-AND-CLIENTS.md)
- [三引擎导入与局域网同步](architecture/v3.7/IMPORT-AND-LOCAL-SYNC.md)
- [未来三引擎可编辑工程导出](architecture/v3.7/PROJECT-EXPORT-EXTENSION.md)
- [四目标游戏运行与导出](architecture/v3.7/FOUR-TARGET-ARCHITECTURE.md)
- [完整功能与24玩法家族覆盖](architecture/v3.7/FEATURE-COVERAGE.md)
- [核心契约](architecture/v3.7/CONTRACTS.md)、[增量计划](architecture/v3.7/DELIVERY-PLAN.md)、[决定与交接](architecture/v3.7/DECISIONS-AND-HANDOFF.md)
- [GPL开闭源边界](architecture/v3.7/OPEN-SOURCE-BOUNDARY.md)、[免费依赖候选](architecture/v3.7/REUSE-CANDIDATES.md)
- [证据基线](architecture/v3.7/baseline.json)、[文档完整性记录](architecture/v3.7/documentation-check.json)

Windows/Android共用C++领域与应用核心、编译/运行、资源、转换、同步合并和策略，通过稳定C ABI接客户端；表现层负责布局/交互与系统适配。移动Flutter、桌面Qt均为待评审路线。iPhone/iPad/Android平板是未来编辑器，游戏仍为H5、WebView/WASM APK、微信小游戏、抖音小游戏。

Cocos Creator/LayaAir/Godot的源工程Reader与未来可编辑工程Writer分开设计。Cocos仅参考，不集成其源码/运行时/SDK/适配器/模板/构建服务；独立读写用户工程格式，输出到用户的目标工具环境。GPL方向、独立游戏允许闭源商用、必需组件无强制商业授权费的约束保持。

本轮只交付架构/验收计划文档，未执行项目脚本、测试、扫描、压测、安全验证、截图比较或设备操作。execution_status=not_run、quality_verified=false、release_permitted=false。architecture_mcp/workflow_mcp/quality_mcp未提供可调用能力，未取得正式documents_ready或ready_for_coding结论，也未登记人员批准。

上一版本完整快照：[arch-v3.6-draft.3](architecture/history/arch-v3.6-draft.3/project-root/ARCHITECTURE.md)。历史详细设计和输入保留，不覆盖产品负责人维护的需求文件。
