# 事务、幂等与故障恢复

版本：local-core-v1-draft.1；所有步骤为实现规范，没有执行故障演练。

## 1. 校验与提交序列

1. SDK校验ABI/长度/句柄并复制输入，任务入队；受理失败不占requestId、不改变项目。执行线程严格解析消息，先在requests查ID+精确请求hash。已有相同记录直接返回，hash不同立即拒绝。
2. 检查RootGrant/只读/项目身份，检查expectedRevision和资源预算。document.propose在内存生成完整候选文档与引用、正逆指针计划，绑定baseRevision/coreInstanceId/规范化操作hash；不写领域head。validate检查Schema、类型、所有候选引用/环、上限及资源READY，并生成validatedHash。
3. commit任务执行时再次核对proposal/validatedHash、expectedRevision、权限/只读、候选引用和READY。任一失败不进入写事务。允许取消的最后时点在BEGIN IMMEDIATE前；通过取消闸门后设置COMMITTING，之后取消只能返回CANCEL_TOO_LATE。
4. BEGIN IMMEDIATE；重新读取head并CAS检查。计算newRevision=head+1，超过INT64_MAX拒绝。插入transactions审计；插入不可变document_versions及refs（或assets元信息）；更新document_heads/asset_heads与project派生name/defaultScene；写新的快照成员/manifest；更新history栈；插入requests成功结果；最后更新project.head_revision，COMMIT。全部属于同一SQLite事务。
5. COMMIT返回成功后，核心才能把任务标SUCCEEDED/durable=true并发project.committed。进程在成功返回前退出时，宿主重开用request.lookup确认，不以是否收到事件判断提交。COMMIT/I/O返回不确定错误，停写并标RECOVERY_REQUIRED；重开恢复后查requests和head，不能盲目按新requestId重放。

asset.attach、history.undo/redo、snapshot.restore使用同一提交管线；差别只有候选状态如何生成。快照恢复按目标manifest恢复文档/资产成员，保留project/branch身份，生成新revision及可撤销的restore项；不是覆盖数据库文件。维护操作（pin/upload chunks/GC/backup）不推进领域revision，但仍在同一执行队列和各自SQLite事务内，幂等结果与其修改一起记录。

## 2. 正逆增量与历史

transactions.forward_json/inverse_json内容为{documentHeads:{documentId:versionId|null},assetHeads:{assetId:presentBoolean}}；Settings中的name/defaultScene属于文档，project列只是同事务更新的查询缓存。null表示该文档在当前状态不存在。批次中的create/delete/set/remove先形成新不可变文档版本；历史只切换版本指针，不能修改旧body。inverse指向旧版本，因而扩展字段不会在Undo时丢失。restore可以涉及超过64个对象，其内部指针增量来自已核验快照，不接受外部伪造“系统批次”跳过64操作限制。

Undo/Redo仅处理当前全局线性栈顶/下一项，不能指定任意旧事务回滚。先校验切换后的整体引用与支持Schema，再写新事务；任何矛盾返回HISTORY_CONFLICT并保留当前head。新普通编辑清redo窗口；Undo/Redo自身不进入普通可撤销栈，避免无限嵌套。超过200项的旧审计仍可读，但不保证可撤销；锁定快照用于长期恢复。

## 3. 重复、重启与取消

|时点|结果与恢复|
|---|---|
|入队前取消/队列满|没有领域修改，调用者可按同一字节重试|
|QUEUED/RUNNING且未进入提交闸门|可标CANCELLED，不写成功request记录；上传已有暂存块保留状态供明确取消/续传|
|COMMITTING|取消返回CANCEL_TOO_LATE；调用者继续等或重开lookup，不能显示“已撤销”|
|提交成功、事件/返回丢失|requests与新revision已在同一事务，重试同字节返回原结果|
|同ID不同请求|IDEMPOTENCY_CONFLICT，不替换旧请求|
|proposal后其他任务提交|旧baseRevision冲突，重新propose/validate，不自动覆盖|
|Core重启|内存proposal/task/事件游标失效；已提交requests/文档/资源/快照恢复；上传按持久化offset查询|

上传write按uploadId+offset+块hash幂等，所有顺序/总长由核心决定；取消上传标CANCELLED并禁止后续write/attach，清理只动未附着暂存。已attach后需要撤销领域事务而不是“取消上传”。重复attach用相同requestId返回原结果，不重复增加revision。

## 4. 失败矩阵

|故障点|必须保留的状态|实现动作与预期|
|---|---|---|
|初始化中断|已有项目全不变；新目录可标incomplete|不能自动覆盖/显示正常项目；核对初始化事务/request后决定恢复|
|写document_versions后、COMMIT前|旧head和旧完整引用|SQLite回滚/WAL恢复，无半次批量编辑|
|资源任意块后中断|当前项目没有半资源引用|重新查询offset，续传或显式取消；未READY不可attach|
|finish坏哈希/缺块|无READY内容和领域引用|HASH_MISMATCH/UPLOAD_INCOMPLETE；保留暂存诊断，不伪造成功|
|attach事务任意点失败|旧领域状态；暂存/READY允许成为未引用数据|不得先写head后补资源；孤立资源交GC|
|SQLITE_FULL/权限撤销|旧确认提交不能消失|ROLLBACK；任务失败、停止受影响写入；空间预检查不能替代处理数据库错误|
|COMMIT后进程退出|完整新状态或可判定原状态|重开/lookup，不根据网络、事件或任务缓存推断|
|WAL/页/外键损坏|原db/WAL/SHM原样保留|停写、脱敏报告、只读尝试或备份恢复；不自动删日志/repair覆盖|
|备份/迁移失败|原库仍可用或明确损坏状态|不切换未校验副本，不删除原件；迁移未注册直接拒绝|
|缓存/缩略图损坏|权威数据库不受影响|删坏缓存后重建，不修改项目文档|

## 5. 保存目标与关闭

本包每次成功领域提交即持久化，不等待2秒批量刷盘。未来宿主连续手势可合并为单次用户事务，但手势中断不能提交半组操作；未提交草稿必须保持dirty。2秒自动保存是宿主调度+核心持久化的联合验收，不能仅凭核心COMMIT证明完整UI满足该目标。

关闭：停止生产新任务→等待/取消在途非提交任务→查询不确定提交→project.flush→project.close释放连接/锁→释放终态任务/缓冲区→destroy。系统强杀无法走关闭时，重开仍按数据库恢复。没有常驻云/后台进程负责兜底，也不需要云账本来判定本地事务。
