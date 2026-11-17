# 本地核心实现基础自测计划

版本：local-core-v1-implementation.1；日期：2026-11-17。归属 engineering/coding。本文只定义改动单元、主路径、失败路径，所有条目 execution_status=not_run。没有编译、运行项目脚本、测试、扫描、设备操作或截图比较。build_id 为空，quality_verified=false，release_permitted=false。

## 本次改动与边界

技术输入为架构师的 handoff/local-core-v1（原始开发输入 local-core-v1-draft.2，补齐版以架构师最终交接记录为准）。独立系统质量方案继续使用 handoff/local-core-v1/quality/strategy.md 和 cases.json，本计划不替代专项质量验收。

共用前置条件：由后续用户真实会话明确授权所列操作；使用全新临时授权根目录和固定UUID；取得匹配工具链产生的实际库，并记录制品/依赖/输入哈希。Windows x64 与 Android API26+ arm64 分开记录，当前均无实际构建或设备结果。

## 基础自测用例

|ID|类别|需求/验收|输入、步骤|预期|执行|
|---|---|---|---|---|---|
|B-LC-01|changed_unit|LC-REQ-01 / LC-AC-01|固定项目/设置/场景UUID；create→read→close→open|初始身份、内容、revision0一致|not_run|
|B-LC-02|changed_unit|LC-REQ-02 / LC-AC-04|非法UTF-8、重复JSON键、超深、未知参数、坏变换/父环/越权路径分别提交|结构化拒绝，head不变|not_run|
|B-LC-03|changed_unit|LC-REQ-02 / LC-AC-03|两个文档的合法批次propose→validate→commit→重开|一个新revision，完整旧/新状态|not_run|
|B-LC-04|main_path|LC-REQ-01 / LC-AC-01|用同一原始create字节关闭后重试|返回原始创建结果，不覆盖项目|not_run|
|B-LC-05|main_path|LC-REQ-04 / LC-AC-06|2MiB+17字节分块→finish→attach；第二assetId上传相同字节、不同来源|同内容hash、独立来源许可，可引用与读取|not_run|
|B-LC-06|failure_path|LC-REQ-02 / LC-AC-04|校验后提交另一事务，再用旧提案提交；同ID改请求字节；删除后重用稳定ID|版本冲突/幂等冲突/身份冲突，不产生半批次|not_run|
|B-LC-07|failure_path|LC-REQ-04 / LC-AC-07|乱序/同offset异字节/缺块/坏expectedHash/未attach读|拒绝半资源引用，保留暂存offset和旧head|not_run|
|B-LC-08|failure_path|LC-REQ-07 / LC-AC-13|在独立副本中限定授权的FULL/IOERR/权限撤销；重开lookup|旧确认状态保留；未知提交不盲重放；不删WAL|not_run|
|B-LC-09|changed_unit|LC-REQ-03 / LC-AC-05|多对象及extensions；Undo两次→Redo一次→新编辑→Redo|批次整体恢复；新revision递增；redo窗口清除|not_run|
|B-LC-10|main_path|LC-REQ-05 / LC-AC-09|锁定旧点→多次提交→restore→undo；备份到新文件|锁定点保留；恢复新事务；备份一致且原件不覆盖|not_run|
|B-LC-11|main_path|LC-REQ-06 / LC-AC-10|相同业务ID与操作序列分别经C ABI和JNI调用|业务结果/拒绝原因一致；排除本地随机审计ID/墙钟|not_run|
|B-LC-12|failure_path|LC-REQ-07 / LC-AC-12|QUEUED/RUNNING/COMMITTING各阶段取消；32任务/4块/结果预算背压|取消与提交互斥；提交后不报已取消；容量满受理前拒绝|not_run|
|B-LC-13|changed_unit|LC-REQ-07 / LC-AC-14|空/伪造/已释放句柄、输出未清零、重复buffer所有权；Core销毁后释放buffer|拒绝非法租约；有效租约只由本库释放|not_run|
|B-LC-14|failure_path|LC-REQ-01 / LC-AC-02|两Core同目录/目录别名、较新格式、额外SQLite触发器、软链接/重解析点|第二写者/不支持结构/逃逸拒绝；不覆盖旧库|not_run|
|B-LC-15|main_path|LC-REQ-05 / LC-AC-08|超过20个自动快照和200条普通历史后GC dryRun→执行|保留锁定点/头/窗口引用，墓碑和成功请求摘要不删|not_run|

领域参考文件：core/document/document.cpp；会话/事务：core/application/session.cpp；资源/维护：core/assets/assets.cpp；任务/ABI：core/tasks/core.cpp、sdk/src/abi.cpp；平台：platform/platform.cpp。所有路径以 native/ 为根。

尚无实际覆盖：编译器/CRT组合、JNI打包、Android16KiB页设备、Windows/Android重开等价、崩溃/满盘恢复、并发竞态、性能预算、安全和可访问性。源码阅读与依赖字节校验都不计为运行测试通过。

## 正常与失败路径

正常路径是授权目录新建/重开、合法提案提交、资源完成后attach、撤销重做和快照恢复；失败路径包括非法输入、陈旧revision、重复意图、半资源、目录逃逸、存储错误和取消闸门。对应步骤与数据逐项见上表。

## 预期结果与恢复

只有持久化成功才新增revision并返回成功收据，失败保留旧完整head；不确定COMMIT在重开后request.lookup。坏库、未登记的备份文件和未完成上传保留诊断状态，不覆盖原件、不删除WAL或强抢锁。预期不等于观测结果。

## 执行状态与限制

15条用例全部not_run。没有DLL/SO或设备执行证据，无法给出正确性、恢复、并发、安全、性能或发布通过结论。工具只检查本文与清单完整性；其通过不改变quality_verified=false、release_permitted=false。
