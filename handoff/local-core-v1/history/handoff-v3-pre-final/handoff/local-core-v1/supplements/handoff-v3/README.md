# 本地一期接续开发交接

版本：local-core-v1-handoff.3；日期：2026-11-17。基础技术契约仍为local-core-v1-draft.2的ABI1.0、消息1.0、format/schema1；本次不修改C头、DDL、消息Schema或native实现。

- [开发授权与实际接收](authorization.md)：真实用户指令、可推进范围与基线评审的区别。
- [无GUI阶段记录](ui-not-applicable.md)：本包UI不适用，不复用旧浏览器原型作为验收依据。
- [固定依赖接收说明](dependency-receipt.md)、[补充锁定清单](dependencies.receipt.lock.json)、[hash最小编译边界](hash-subset.md)。
- [剩余事项分类](remaining-items.md)：架构补齐、业务决定、真实角色评审分别登记。
- baseline.json、documentation-check.json、tool-reports.json记录本次实际文件/版本/摘要和工具结果；不是运行或发布证明。

当前C++实现由开发会话负责，架构会话单写本目录及根architecture/workflow清单。本次未改native/、.coding-mcp.json、产品和质量清单。已有draft.2冻结件继续保留；当前补充引用旧契约，不能把元数据版本变化理解为ABI升级。
