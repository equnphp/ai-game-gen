# 剩余事项的责任分类

版本：local-core-v1-handoff.3。真实开发指令已经核实，未代签审批。

|类别|事项|状态与接续动作|
|---|---|---|
|架构已补齐|开发授权来源、UI不适用、阶段/上游版本绑定、官方依赖来源|当前根architecture/workflow已登记；draft.2契约及冻结文件保留|
|架构已补齐|工程交付归属|LC-IMPL-01 / engineering / native/已加到architecture.delivery、workflow.delivery与workflow.scope；无范围重叠|
|开发已写回|源码与基础自测计划|源码写入状态由开发报告，未构建；.coding当前implementation.1，15项全部not_run；实际文件hash已读入workflow|
|依赖已接收|SQLite完整ZIP、JSON单头、Mbed官方包|已按实际字节核对发布者校验；不表示编译或安全验证通过|
|研发实施接收|Ninja/LLVM/CMake/NDK实际工具包|继续按固定来源接收并记录observed，未取得时不伪造；不悄悄换版/系统库|
|研发可直接修复|Mbed自有配置目录可见性、hash私有头|按hash-subset.md与vendor-source-note.md；最小私有头common.h/alignment.h，无需扩大加密C模块；代码单写者修复并自记状态|
|产品清单所有者写回|.product-mcp.json的5项风险/依赖元信息及LC-IMPL-01归属|精确补丁product-metadata.patch.json已准备未应用；无新增业务决定；先保留旧版、核验hash/id再升版|
|独立质量所有者写回|.quality-plan-mcp.json的LC-IMPL-01归属|quality-metadata.patch.json已准备未应用；保持执行not_run，不能代签质量结果|
|所有者写回后的架构接续|产品/质量文件摘要与workflow上游绑定|文件实际变更后由当前单写者重冻并顺序重绑；不得提前填预测hash|
|真实角色评审|需求、架构、UI不适用分类、开发交付接收|尚未登记；ready_for_coding/ready_for_stage保持实际工具值；编码指令不等同整版角色审批|
|产品或用户业务决定|本包新增范围选择|本次未发现新增M1业务歧义；云端/GUI/Reader/LAN/完整发行仍属后包|

本包的技术契约没有新增待定ABI/DDL问题。文件所有者同步与真实角色审阅是明确的未完成事项。当前没有构建、测试、扫描、设备或发布记录。
