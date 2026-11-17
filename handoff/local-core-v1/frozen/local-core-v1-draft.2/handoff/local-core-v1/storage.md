# 数据、资源与版本详细设计

版本：local-core-v1-draft.2。精确表/约束/索引见[DDL](spec/project_v1.sql)，未执行SQL。表中的UUID/哈希格式、JSON重复键和领域约束由核心验证；SQL外键不是完整业务校验的替代。

## 1. 项目布局与权威来源

```text
<authorized_root>/demo.ggproject/
  project.sqlite         唯一权威：文档、历史、资源分块与元信息
  project.sqlite-wal     SQLite管理，不手工删除/跨端拷贝
  project.sqlite-shm     SQLite管理，不当作同步文件
  .gglock                独占锁载体，关闭时释放句柄，不以删文件解锁
  cache/                 缩略图/可重建物化资源，不是提交依据
```

只允许应用私有本机文件系统；网络盘、可移除/云同步目录和Android外部存储不在本包支持域。数据库页/日志持久化交给标准SQLite VFS。新建项目目录后，初始化DDL、project/初始文档/revision0/request结果/初始快照在一个事务内完成；失败目录保留为incomplete，不能显示正常项目或覆盖已有目录。再次相同create请求先核对库内request摘要；存在不同内容返回ALREADY_EXISTS，损坏/半初始化要求恢复，不自动重用目录。

连接：sqlite3_open_v2 FULLMUTEX，设置foreign_keys=ON、journal_mode=WAL、synchronous=FULL、trusted_schema=OFF、busy_timeout=1000、wal_autocheckpoint=1000；sqlite3_db_config关闭扩展加载并启用defensive模式，限制SQL长度/绑定参数。初始化的user_version/application_id由受信DDL设置，后续每次打开校验。SQL只来自编译进核心的固定语句/迁移，不能执行库内文本。连接创建/销毁由执行线程拥有，平台锁先于打开写连接获取。

## 2. Schema与身份

project仅一行；project_id稳定，branch_id为本地线性分支身份，未来同步再定义DAG。本包revision为0—INT64_MAX单调本地序号，不跨项目排序，JSON使用十进制字符串。transaction_id、version_id、snapshot_id由核心CSPRNG生成UUIDv4，业务document/entity/assetId由宿主先生成；两端等价比较忽略本地时间/事务UUID，不能因此改变领域对象ID。

document_versions不可变，body_json是按固定JSON库紧凑序列化后的UTF-8；对象键排序，数组顺序保留，有限数值、负零归零，禁止重复键、超深和NaN。document_heads表示当前成员，删除即移除head，旧版本保留。引用索引随版本创建，同一候选事务先完成所有操作再检查全部必需引用、父子环和默认场景。实体ID只在所属Scene内解析；跨Scene实体引用当前拒绝。相同documentId跨kind复用拒绝，即使旧head已删除也不允许抢身份。

identities为永久身份注册/墓碑：所有成功进入领域的document/entity/asset UUID在项目内唯一，scope_id分别为项目ID/所属Scene文档ID/项目ID，type_name记录文档kind或实体/资产类型。首次领域提交同事务登记，删除/GC不删此表；新创建不能复用旧ID或改kind/scope。Undo/Redo/restore是恢复原身份，不是重新分配。仅上传未attach的assetId尚未成为领域身份。document_heads和snapshot_documents用复合外键约束documentId与versionId对应，不能串到另一文档版本。

Settings与Scene的字段及可编辑路径以API第4节为准。未知extensions只保留不执行；不认识的必需kind/schema使项目只读，不允许写入后丢掉高级字段。snapshot.restore也要做当前Schema/能力检查，未知必需语义不能通过恢复绕过只读。

## 3. 资源原子边界

M1的内容寻址仓仍以SHA-256标识，但权威字节放blob_chunks。上传先建STAGING对象和uploads，不创建assets/asset_heads。每个1MiB块短事务存块、块hash和received_size；重复块核对原字节。finish流式检查长度/offset连续性与完整SHA-256，在短事务将blob标READY和upload改READY；相同hash已存在READY时复用它，旧暂存blob留给GC。空资源允许byteLength=0，finish按空输入hash，禁止写零长度块。

asset.attach事务创建不可变assets元信息、asset_heads成员，更新upload为ATTACHED，并同时写领域revision、历史、快照、幂等结果。READY不等于已加入项目，attach成功才可被当前文档引用。assetId不复用；相同内容不同来源/许可分别建asset元信息。附件元信息不能包含凭据或宿主绝对路径。后续修改许可/来源应新增受版本化语义，不允许直接改旧快照看到的元信息。

外部CAS/缩略图只从READY字节物化到cache，失败只影响缓存，不影响“已保存”。这明确调整旧总架构的外部资产先落盘方案。未来BlobStore实现可以迁移到外部CAS，但必须另设计跨存储原子提交、断电和备份规则；不能直接把blob_chunks换成路径后沿用本包通过结论。

## 4. 快照、历史与GC

每个领域事务生成不可变快照manifest：{formatVersion,projectId,branchId,revision,documents:[按documentId排序的id/versionId/hash],assets:[按assetId排序的id/hash]}，哈希对实际gg-json-v1字节计算。保留最新20个未锁定自动点，锁定点不计入20个、最多128个；pin只改保留标记，不改快照内容/领域revision。快照表记录全部当前文档/资产成员，不复制字节。

history_entries仅存普通edit/attach/restore事务的线性200项窗口。Undo取最后applied=1项，应用其inverse指针增量并标0；Redo取最早连续待redo项，应用forward并标1；两者各生成自己的审计事务和快照，不能把旧revision写回head。新普通编辑删除所有applied=0栈项，再append；旧transactions仍不可变，但不再保证无限可撤销。

GC根集合为当前document/asset heads、所有保留快照、200项历史forward/inverse引用。任意活跃proposal/upload/其他任务存在则不执行GC；调用maintenance.gc先dryRun显示可回收量。删除顺序：不受保护快照成员→不可达旧document_versions及refs→不可达assets→无任何assets/upload引用的blob及chunks。requests与transactions摘要不GC，防止旧requestId重放；可裁剪不再可撤销的forward/inverse正文为审计摘要，但M1默认不裁剪，以免引入第二套保护规则。GC与快照保留政策不删除锁定点；空间不足时明确失败，不能偷偷删除保护根。

## 5. 备份、迁移与兼容

maintenance.backup排队后通过SQLite backup API复制一致库，目标为授权根backups中的新名称，完成校验后报告checksum/revision。不复制活跃db单文件，不把WAL/SHM做同步协议。备份本身含资产，可能耗时/占空间；取消可删除未完成的新备份临时文件，不能改原库。

v1只实现新建0→1，不存在声称可自动迁移的旧正式格式。较新user_version拒绝写；较旧未知版本返回MIGRATION_REQUIRED。后续迁移必须有已注册迁移ID：独占打开→backup API备份→在同卷副本逐步迁移→quick_check/外键/引用/manifest验证→关闭所有连接→以平台安全替换协议切换并保留原件；失败停在原版本。只有新增迁移包实际规定并验证替换协议后才开放，不把本段通用流程视为已实现任意迁移。

读取文档时核对其实际body字节hash，读取资源块时核对块hash；完整资源消费时再核对整体contentHash。失败返回数据损坏诊断并禁止对该不一致状态继续写入，不以坏内容生成新快照。打开阶段只做版本/结构/数据库完整性与必要引用检查，不把扫描全部1GiB资源计入2秒打开预算；全量资源核验是独立显式维护计划，不在无授权时自动运行。

官方依据：[WAL](https://www.sqlite.org/wal.html)、[同步设置](https://www.sqlite.org/pragma.html#pragma_synchronous)、[备份API](https://www.sqlite.org/backup.html)。本设计只承诺在SQLite/OS/文件系统正确执行持久化语义的环境中验证目标，不把硬件故障或恶意删除称为能自动恢复。

GC执行前先清理不再需要且没有活跃任务的CANCELLED/ATTACHED上传暂存记录；READY/UPLOADING尚可续传的上传作为保护根。requests中的已提交意图仍保留，不因清理暂存允许旧ID重新执行；重复旧upload_begin返回原结果，若对应暂存已清理则后续status明确NOT_FOUND，须以新意图重新上传。
