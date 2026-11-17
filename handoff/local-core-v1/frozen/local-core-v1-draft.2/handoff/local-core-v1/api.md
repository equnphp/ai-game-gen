# SDK与消息协议1.0

版本：local-core-v1-draft.2；配套[ABI头文件](spec/gg_core_v1.h)。本文件决定参数、错误与状态；无函数实现或编译证据。

## 1. ABI、线程和内存

ABI使用64位句柄和默认8字节对齐，Windows __cdecl、Android平台C调用约定。配置struct_size必须为v1实际sizeof，abi_version=0x00010000，flags/reserved=0；不满足返回GG_E_ABI/ARGUMENT。后续结构只在新函数或显式size版本下增长；major不同拒绝，minor新增可选能力，不改变旧函数语义。C++内部抛出的异常必须在边界捕获，不返回STL/Qt/JNI对象。

gg_core_create在非UI线程调用，可执行授权根检查。其余submit/upload/read只复制输入和入队；poll/read_events只读内存；真实I/O在Core执行线程。函数可由多个宿主线程调用；调用者不得与同一对象destroy/release并发，也不得在调用未返回前释放输入。每个Core执行队列串行，提交/查询不绕过队列。每进程句柄带代次注册、0无效，失效句柄不直接解引用；重复销毁返回HANDLE，不能复用成别的项目指针。

每个out buffer调用前必须清零；库返回的data在gg_buffer_release前只读有效，不能由宿主free。release验证token并清0；无租约视为成功，伪造/过期token返回HANDLE。禁止复制buffer所有权；Core销毁后已发放buffer仍能释放。全部error是独立JSON，不依赖线程局部last_error。错误分为ABI受理失败（gg_status!=OK）与已受理任务的领域失败（任务FAILED，结构化error）；GG_OK仅代表受理。

## 2. JSON基础规则

所有JSON为UTF-8，无BOM/重复键/非法UTF-8；深度≤32，消息≤2MiB，单文档≤1MiB，字符串禁止NUL，业务数字有限。所有64位revision/字节计数在JSON里是无前导零十进制字符串；UUID为小写标准36字符UUIDv4；哈希是`sha256:`+64个小写十六进制。标识不可复用；时间只展示，不排序事务。

请求格式：

```json
{"protocolVersion":"1.0","requestId":"11111111-1111-4111-8111-111111111111","op":"document.propose","projectId":"22222222-2222-4222-8222-222222222222","expectedRevision":"3","params":{"operations":[{"kind":"set_field","documentId":"33333333-3333-4333-8333-333333333333","path":"/entities/44444444-4444-4444-8444-444444444444/name","value":"主角"}]}}
```

顶层键固定：protocolVersion、requestId、op、projectId（项目命令必填）、expectedRevision（领域写必填）、params。未知顶层/操作字段拒绝，避免拼错被忽略；未知业务扩展字段按第4节处理。expectedRevision必须等于同项目当前head；查询可省略，只读某快照时用snapshotId，不接受任意SQL或任意JSON路径写入。

幂等摘要是精确请求UTF-8字节的SHA-256，requestId在同项目内绑定op+请求摘要；同ID同字节返回原结果，同ID不同字节（包括改格式）IDEMPOTENCY_CONFLICT。宿主重试必须保存原字节，不自行重排键或改requestId。提案的规范化输出由固定JSON库、按键排序、紧凑UTF-8编码生成；不宣称RFC8785兼容。documentHash对实际存储body字节计算，hashVersion=gg-json-v1；不同hashVersion不直接比较字节等价。

## 3. 操作全集与参数

下表所有JSON操作经gg_submit；返回值包含在任务result.data，失败见第7节。表中全部字段必填，标注optional者例外；请求均有requestId。

|op|params与前置|成功data|
|---|---|---|
|core.capabilities|{}；无需项目|abiVersion、protocolVersion、formatVersion、schemaVersions、limits、capabilities；本包未实现能力不能报true|
|project.create|directory：授权根的单级新目录名；name：1—80字符；projectId/defaultSceneId/settingsId：调用者UUID；无已开项目|projectId、branchId、headRevision="0"、初始文档ID；重复创建见事务文档|
|project.open|directory；mode=read_write或read_only；无已开项目|projectId、branchId、headRevision、recoverySummary、readOnlyReasons|
|project.close|{}；项目任务按顺序完成/取消，释放写锁|closed=true、lastDurableRevision|
|project.read|{}|id、name、formatVersion、headRevision、rootDocuments、readOnlyReasons|
|document.list|afterId：optional；limit：1—100|按documentId字典序分页的id/kind/schemaVersion/versionId/contentHash；nextAfterId|
|document.read|documentId；snapshotId：optional|完整body、kind、schemaVersion、versionId、contentHash、revision|
|document.propose|operations：1—64；expectedRevision必填|proposalId、baseRevision、proposalHash、normalizedOperations、diagnostics；没有数据库领域提交|
|document.validate|proposalId、proposalHash|validatedHash、diagnostics、requiredAssets、baseRevision；必需引用/类型等错误不能返回可提交令牌|
|document.commit|proposalId、validatedHash；expectedRevision必填|transactionId、revision、snapshotId、durable=true；提交前重新核对权限、head与输入摘要|
|history.undo / history.redo|{}；expectedRevision必填|transactionId、revision、snapshotId、undoneTransactionId或redoneTransactionId|
|history.read|limit：1—100；beforeRevision：optional|可撤销/可重做窗口和只读事务摘要；不含文档秘密正文|
|asset.upload_begin|assetId、byteLength、mediaType、source={kind,displayName}、license={identifier,status}、expectedHash：optional|uploadId、chunkBytes=1048576、nextOffset="0"；不创建可引用asset|
|asset.upload_status|uploadId|state、receivedBytes、byteLength、contentHash：optional；没有上传凭据|
|asset.upload_finish|uploadId|contentHash、byteLength、state="READY"；验证所有字节、长度和可选expectedHash后才READY|
|asset.attach|uploadId；expectedRevision必填|assetId、contentHash、revision、transactionId、snapshotId；元信息与hash引用原子提交|
|asset.upload_cancel|uploadId|cancelled=true；已attach则ALREADY_COMMITTED，不能撤销别的领域事务|
|asset.read|assetId|hash、byteLength、mediaType、source、license、localOnly=true；字节用gg_blob_read|
|snapshot.list|limit：1—100；afterId：optional|snapshotId、revision、reason、locked、manifestHash；nextAfterId|
|snapshot.pin|snapshotId、locked：boolean|snapshotId、locked；维护元信息，不改变领域revision；锁定上限128|
|snapshot.restore|snapshotId；expectedRevision必填|新transactionId/revision/自动snapshotId；恢复文档/资产引用，保留既有历史|
|request.lookup|targetRequestId|not_found或原op/状态/result/error；判断超时提交是否已完成|
|project.flush|{}|durableRevision；确认已有提交与必要checkpoint，不自动提交RAM提案|
|maintenance.backup|backupName：授权根backups下单级文件名，不覆盖|backupId、revision、checksum、relativePath；SQLite backup API产物|
|maintenance.gc|dryRun：boolean|可删除行/字节、保留原因；只在无提案/上传/其他任务时执行；不改变业务revision|

project.create/open的directory只能是1—64字符、[a-zA-Z0-9_-]+`.ggproject`，拒绝绝对路径、盘符、斜杠、..和重解析逃逸；原有外部目录导入属于后包，不绕过授权根。其他业务名称允许Unicode，不能拿name拼路径。Core持有项目权限，不靠params传“admin=true”。

## 4. 文档与操作

v1可编辑文档kind为project.settings和scene；所有documentId、entityId及assetId由调用者预先生成，不因保存/重开变化。初始ProjectSettings body={name,defaultSceneId,extensions:{}}；初始Scene body={name,entities:{},extensions:{}}。entity map键为稳定UUID；entity={name,parentId:null|UUID,transform:{x,y,rotation,scaleX,scaleY},sprite:null|{assetId},extensions:{}}；变换数字有限，scaleX/scaleY≠0，parent不能成环。实体max10000/文档。Scene内实体的创建/删除通过完整映射更新，不用数组下标。

操作仅四类：create_document{documentId,documentKind,schemaVersion=1,body}、set_field{documentId,path,value}、remove_field{documentId,path}、delete_document{documentId}。只允许预先注册的可编辑字段路径：settings的/name、/defaultSceneId；Scene的/name、/entities/<UUID>、其/name、/parentId、/transform或其五个分量、/sprite。禁止修改ID/kind/schemaVersion，禁止自由脚本节点。create_document可以携带extensions；extensions只作为不执行的扩展数据原样保留，本包不提供任意路径写它。实体删除不隐式级联；被子实体/根场景/必需sprite引用的对象删除明确INVALID_REFERENCE。一次批次可同时修复引用后再整体校验。

未知extensions字段保持语义值；文档新增未知非extensions字段或不认识的schemaVersion可只读保留，禁止修改该文档。未知必需文档kind导致项目只读，不静默跳过。当前不编辑workflow/map；未来完整图Schema接入后仍经同一事务接口，不能把任意脚本当临时图实现。

## 5. 二进制分块与读取

gg_upload_write的upload_id是上述UUID，offset必须等于receivedBytes，块长1—1MiB；除最后块外固定1MiB，不能超过byteLength。已保存相同offset/相同字节返回原nextOffset；同offset不同字节拒绝CHUNK_CONFLICT；越界/乱序拒绝RANGE_ERROR。每块自己的短SQLite事务只影响暂存数据，不推进领域head。finish按offset流式哈希，不能一次加载完整资源。重复内容复用READY blob；每个assetId的来源/许可仍独立。

gg_blob_read只读当前项目可达或受快照/历史保护的READY内容，offset≤length，max_bytes=1—1048576；offset=length返回空binary且eof=true。task JSON返回offset/byteLength/contentHash/eof，binary单独返回原字节。不接受外部路径/URL。输入块全部复制返回后宿主可释放；最多4个未处理块，超限背压。取消读不会取消已经提交的其他项目命令。

## 6. 任务、事件与生命周期

任务状态QUEUED→RUNNING→SUCCEEDED/FAILED/CANCELLED；写入临界区为COMMITTING，进入后取消返回领域CANCEL_TOO_LATE并继续查询结果。不能把取消请求本身当最终取消成功。poll返回taskId、state、phase、cancellable、progress、coreInstanceId；phase非完成凭证。take_result仅终态可用，返回{ok,requestId,op,data,error}；成功error=null，失败data=null；二进制只取一次，其他result可重复读直到task_release。宿主必须在处理终态后释放task和两个buffer；最多32活跃任务/8MiB完成结果，未消费则阻止新增任务，不静默丢结果。

全局事件环最多256条，seq在Core实例中递增；read_events limit1—100，返回coreInstanceId/events/nextSeq/gap。宿主发现实例更换或gap=true时丢旧游标并重新查询项目/任务；事件不可用不能推翻持久化request.lookup。project.committed事件只有COMMIT成功后产生，含revision、transactionId、requestId和changedDocumentIds，不含正文。关闭前先停止入队，处理/取消在途任务，project.close成功后释放所有task，再destroy；已有输出buffer可独立释放。UI旋转只转移宿主订阅，不销毁其他页面仍用的Core。

## 7. 结构化错误与可重试性

error={code,messageKey,requestId,retryable,projectId,revision,location:{documentId,fieldPath},recoveryActions:[]}，不存在的定位字段省略，不泄漏系统绝对路径/SQL/正文。messageKey由后续四语UI翻译，core不拼接界面文案。

|code|处理|
|---|---|
|INVALID_MESSAGE / TYPE_MISMATCH / INVALID_PATH / INVALID_REFERENCE|修复输入；不可原样自动重试|
|REVISION_CONFLICT / PROPOSAL_EXPIRED|查询head，重新提案/校验；不自动覆盖|
|IDEMPOTENCY_CONFLICT / CHUNK_CONFLICT|换成正确原请求或新意图的新ID，禁止覆盖旧记录|
|PERMISSION_DENIED / PROJECT_BUSY / READ_ONLY|重新授权、关闭另一写者或使用只读；不能强抢|
|UNSUPPORTED_FORMAT / MIGRATION_REQUIRED / UNSUPPORTED_SCHEMA|保持原件，使用合适版本/迁移计划；不能强行降级写|
|QUEUE_FULL / LIMIT_EXCEEDED|消费结果/等待容量或明确调整支持域；不得无界排队|
|STORAGE_FULL / IO_ERROR / DATABASE_CORRUPT|保留原件并停相关写入；释放空间/只读导出/备份恢复，未知提交先lookup|
|HASH_MISMATCH / UPLOAD_INCOMPLETE|取消暂存或补正确块，不能创建READY引用|
|HISTORY_EMPTY / NOT_FOUND / SNAPSHOT_LIMIT|明确无结果/范围，领域head不变|
|CANCELLED / CANCEL_TOO_LATE / ALREADY_COMMITTED|分别表示未提交取消、已过提交边界、已生效；成功提交不能伪报取消|
|INTERNAL_ERROR / RNG_UNAVAILABLE|停当前任务并脱敏诊断，未查清提交结果前不重放|

提案在当前Core内最长10分钟、最多8个、合计≤8MiB；绑定head和coreInstanceId，Core关闭/版本变化即失效，旧值不能跨会话提交。失败请求不推进revision；持久化幂等表只保存最终领域写结果及摘要，验证失败/受理失败没有“成功事务”。保留所有已提交request摘要直到项目删除；结果正文可压缩成transaction/revision引用，不能因过期使旧ID重新执行。

持久化幂等只覆盖成功领域写及需要修改库的维护操作；读查询每次读取当前排队位置的状态，不存旧查询结果。proposal/validate在本Core会话内按原字节去重，失效后明确PROPOSAL_EXPIRED；二进制写按uploadId/offset/块字节去重。入队必须预留结果预算：领域提交预留4KiB最小持久化收据，查询/二进制按最大结果预留；预算不足在受理前返回QUEUE_FULL。不得在COMMIT成功后因展示结果内存不足改报未提交。

gg_task_cancel在COMMITTING/已提交阶段返回GG_E_BUSY，并在error.code给出CANCEL_TOO_LATE/ALREADY_COMMITTED；QUEUED/RUNNING成功受理取消返回GG_OK，但最终状态仍以poll/lookup为准。其他同步受理错误按头文件gg_status区分，不占用业务requestId。
