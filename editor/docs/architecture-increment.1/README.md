# 独立editor首增量架构交接

版本：editor-increment.1-architecture.draft.1；2026-11-17。根架构清单为[editor/.architecture-mcp.json](../../.architecture-mcp.json)，本包不改根M1和上级冻结架构。

- [详细架构（11节）](ARCHITECTURE.md)
- [编码交接](CODING-HANDOFF.json)与[说明](CODING-HANDOFF.md)
- [上游字节接收](UPSTREAM-RECEIPT.json)、[三项源码写回复核](WRITEBACK-REVIEW.json)
- [产品/UI/流程待办](ROLE-HANDOFF.md)、[流程所有者待合入记录](WORKFLOW-INTEGRATION.json)
- [实际文档门禁](DOCUMENT-GATES.json)、[文件基线](baseline.json)

技术材料已提供，三AR仅source_correction_reviewed_not_executed。正式产品/设计/阶段绑定与真实版本接收仍未闭合，get_coding_handoff返回ready_for_coding=false、documents_incomplete。没有构建、测试、扫描、截图或设备操作，quality_verified=false、release_permitted=false。

inputs是只读证据快照，不作为第二套实现。新增角色接收或上游改变时请保留本冻结包并建立后续版本，重新计算受影响输入与实际批准；勿把源级修正改称实测通过。
