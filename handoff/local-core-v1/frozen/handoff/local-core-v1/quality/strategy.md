# 独立质量计划

版本：local-core-v1-draft.1；owner=independent_quality编制角色，真实审阅/执行者待指派。使用quality_mcp规则/模板编制；无身份认证或人员批准。所有详细用例见[cases.json](cases.json)，execution_status=not_run、quality_verified=false、release_permitted=false。

## 范围与需求依据

对象是本地一期C++ SDK、项目事务、资源和双端薄宿主；LC-REQ-01—07及LC-AC-01—14逐条对应。完整产品UI、三引擎导入、LAN网络协议、图VM/游戏可玩性、四目标发布、云端、Apple端未在本包实现，不以本计划覆盖声明它们已验证。父AC-030/073/074仅部分实现，保留后续验收。

## 风险与优先级

P0风险是已确认事务丢失、半资源引用、路径越权、未知格式被强写和重复意图重复执行；P1为取消/结果池/历史保留不一致与双端差异；P2为不影响领域完整性的缓存和诊断问题。先覆盖P0正常/失败矩阵，再扩性能边界；不得降低架构阈值获得通过。

## 测试层次与适用性

|类别|适用性/内容|具体排除与责任|
|---|---|---|
|functional|适用；项目/文档/历史/资源/快照/任务正常与失败；Q01—15/20—22|完整玩法/GUI后包；owner独立quality|
|integration|适用；ABI与SQLite/平台锁/二进制块、同请求结果、Windows/Android等价；Q16/18/26|不接云/Reader/LAN；owner独立quality|
|regression|适用；稳定fixture、extensions/历史、重开/原版本只读、接口兼容；Q17/19/27|旧浏览器原型行为不当作原生实现证据；owner独立quality|
|performance|适用；固定fixture的打开/提交/取消、内存/背压/资产流式；Q21/23/24|超1GiB大世界与多人并发另包；owner独立quality，阈值归architecture|
|security|适用；路径/符号链接、恶意JSON/SQLite、权限与凭据/诊断、依赖来源；Q02/05/25/28|没有公网端点，不做不存在的云渗透；实际安全操作另待授权；owner独立quality|
|accessibility|本包不适用；没有界面、焦点、触摸/读屏控件|后续GUI必须另立四语、键鼠/触控/读屏验收；本判断由本包架构范围决定，未伪造UI人员批准|
|device|适用；Windows本机目录/锁与Android私有目录、进程回收、ABI/16KiB页；Q16/18/26|iOS/平板具体设备和商店发行不在本包；owner独立quality|
|recovery|适用；COMMIT前后中断、FULL/IOERR、WAL、备份/GC/迁移拒绝；Q12—15/22/27|无远程机房/云容灾演练；owner独立quality|

## 用例与验收追溯

cases.json包含28条独立用例，每条有LC需求/验收ID、前置、步骤、数据、预期、环境、owner和not_run。coding基础计划为单元/主路径/失败路径子集，不能代替这里的系统性覆盖；父需求未在本包覆盖的部分继续由后续包验收。

## 环境数据与依赖

platforms.md是版本输入；Windows x64 SSD/4核/8GiB，Android arm64/4GiB/API26+，实际设备编号/OS补丁/构建ID未指定。功能数据含空项目、100个16KiB文档、1,000实体、100MiB资产、64MiB边界、坏hash/缺块、20+锁定快照、201历史项、未知Schema、符号链接和空间不足。仅定义fixture，不声称已经创建/跑通。

性能目标由architecture.md确定：普通批次提交p95≤200ms、打开p95≤2s、非提交取消≤1s、无I/O SDK入队/poll p95≤10ms，各100次冷/热分开；任务32、块1MiB/4个、结果8MiB。允许的动作是先记录真实瓶颈并回架构评估，不靠改样本/删除失败数据获得通过。没有当前基线数据，不承诺既定硬件已达标。

## 安全与隐私方案

默认仅本地数据，无网络/遥测/云备份；检查RootGrant、SQLite扩展关闭、参数化SQL、JSON边界/重复键、句柄所有权、外部Schema不可执行、来源许可与日志脱敏。Mbed仅hash模块不等于已完成安全审计。实际扫描/攻击载荷/工具执行必须有用户真实会话明确授权，计划文件不能授权。

## 进入退出标准

文档进入：冻结本包需求/ABI/DDL/环境与用例来源；文档退出：字段和追溯完整，排除有依据，实际人员接收单独记录。实际执行进入还需真实用户会话授权、真实实现/构建/fixture/设备；没有这些保持not_run。实际退出依真实失败关闭与覆盖记录，文档通过不能授权发布。

## 缺陷与回归策略

缺陷登记id、关联需求/用例、环境/构建、复现、实际/期望、严重级、owner、修复版本、复测和剩余风险；当前无虚构缺陷或通过记录。实现后coding只提交基础范围证据；独立quality单独维护系统性结果。文档门禁通过仅表示documents_ready，真实接收/批准与运行/发布分别记录。

## 执行授权与结果模板

默认不运行。未来记录user_request原文、授权范围、build_id、OS/ABI/设备、依赖/工具版本、fixture摘要、case_id、实际步骤/结果、证据路径、失败/跳过原因和执行人。所有空的运行字段保持未填，不复制旧原型结果，不由清单标志授权执行。
