# GameGen 核心契约 V3.7

版本：`arch-v3.7-draft.2`。关联：[总体架构](ARCHITECTURE.md)。以下是领域契约设计，不是已存在的接口或可用服务；正式 OpenAPI、JSON Schema、C 头文件与测试向量在对应开发增量内生成并评审。字段名按此设计冻结前可修订，修订必须升级本版本和基线。

## 1. 一致的身份与版本

|字段|语义与边界|
|---|---|
|projectId / documentId / objectId|随机稳定 ID；名称、目录和内容变化不改变对象身份|
|revision|项目完整事务提交后单调递增的 64 位整数；JSON/JS 边界使用十进制字符串|
|transactionId / proposalId|分别识别已提交事务与未提交提案，不以消息 ID 替代|
|requestId / idempotencyKey|请求追踪与重复动作识别；幂等范围至少包含账户/项目、动作与 key|
|assetId / contentHash|资源逻辑身份与 SHA-256 内容身份分开|
|formatVersion / nodeCatalogVersion / irVersion|文档格式、节点语义、可执行产物分别版本化|
|runId / invocationId / taskId|一次 AI 轮次、工具动作与后台任务分别识别|
|buildId / artifactHash|一次构建及其具体产物；重试可引用相同输入快照，输出文件仍校验哈希|
|schemaRef / credentialRef|类型 Schema 与设备凭据的受控引用，不能嵌入可执行代码或秘密|

时间戳使用 UTC 和明确精度，日志显示按用户时区转换。运行时相对计时使用单调时钟；线上经济用服务器可信时间。随机操作显式记录种子和算法版本。金钱/积分用整数最小单位；普通数值区分整数、浮点、定点及单位。

## 2. DocumentCore 与存储模型

建议项目库表及其约束：

|表/集合|主要内容|一致性要求|
|---|---|---|
|projects|projectId、formatVersion、headRevision、目标集、默认场景|单项目一个 headRevision|
|documents|documentId、kind、schemaVersion、body、contentHash|body 为类型化文档；同事务更新引用索引|
|references|ownerId、fieldPath、targetId、required、domain|必需引用失效允许草稿存在，阻断编译/发布|
|transactions|transactionId、revision、parentRevision、作者来源、操作、逆操作、摘要|revision、幂等范围唯一；提交与文档修改原子完成|
|assets|assetId、contentHash、mediaType、license/source、importSettings|内容先落盘再让引用事务成功|
|snapshots|revision、manifestHash、创建原因、是否锁定|已有快照不可原地改写|
|view_state|选中对象、缩放、布局、草稿|与玩法文档分开；视图丢失不损坏项目语义|
|jobs|任务ID、输入版本、状态、checkpoint、错误|只保存非敏感恢复数据；重启先对账|

实际 SQLite 表结构可按剖析细化，但权威文档只能有一个存储所有者。数据库不被 OpenCode/MCP 直接打开。全文搜索与缩略图可以单独索引，索引版本落后时回源，不以索引重建反写文档。

`Scene` 保存实体与实例引用；`Prefab` 保存共享定义；`PrefabOverride` 保存显式字段覆盖，更新原型时只合并未覆盖字段。`Level` 引用地图和目标，不把一次通关状态写入设计；玩家的永久进度、临时关卡进度与试玩存档分别存储。

## 3. 事务 API

领域接口可以通过 JNI/C ABI、本机 IPC 或测试驱动调用，其语义一致：

|操作|输入|输出与约束|
|---|---|---|
|ReadProject / ReadDocuments|projectId、revision、ID集合、字段范围|一致只读视图；权限不足按对象返回原因|
|QueryReferences|对象/资源 ID、方向、revision|影响对象及路径；返回完整性/分页信息|
|ProposePatch|baseRevision、operations、context、idempotencyKey|proposalId、规范化补丁、语义差异、风险、所需权限|
|ValidateProposal|proposalId、proposalHash、目标集|错误/警告、引用/域/能力/预算诊断、validatedHash|
|CommitProposal|proposalId、validatedHash、expectedRevision、授权范围|transactionId、newRevision、持久化状态；原子提交|
|Undo / Redo|transactionId、expectedRevision|新事务；冲突时返回依赖与可选分支，不修改历史原件|
|CreateSnapshot|revision、原因|不可变 snapshotId、manifestHash|
|SubscribeChanges|projectId、afterRevision|已提交事务序列；游标过期要求快照恢复|

补丁操作只允许类型化的 CreateObject、SetField、DeleteObject、ConnectPorts、DisconnectPorts、Reorder、AttachAsset、SetOverride 等领域操作。数组元素按稳定 ID 寻址；禁止用脆弱数组下标表示跨轮次对象身份。删除操作先查必需引用，级联规则显式列出。批量画笔应归并为一个完整用户手势事务，旋转/中断不能提交半个手势。

提交时必须再次核对 validatedHash、权限和 expectedRevision，避免“检查之后内容又变了”。相同幂等键、相同请求摘要返回原提交结果；同键不同内容返回 `IDEMPOTENCY_CONFLICT`。进程崩溃后请求方可按 key 查询是否已提交，再决定重试。

常见错误统一包含 `code`、用户可理解摘要、对象/字段定位、是否可重试、原因和可用恢复动作。主要错误码：`REVISION_CONFLICT`、`INVALID_REFERENCE`、`TYPE_MISMATCH`、`DOMAIN_DENIED`、`PERMISSION_REQUIRED`、`UNSUPPORTED_TARGET`、`BUDGET_EXCEEDED`、`STORAGE_FULL`、`MIGRATION_REQUIRED`、`CANCELLED`。错误正文和诊断附件先脱敏。

## 4. 工作流、节点目录与编译契约

|对象|必需字段/规则|
|---|---|
|GraphDocument|graphId、graphKind、executionDomain、schemaVersion、nodes、edges、parameters、editorLayout|
|NodeDefinition|nodeType、version、端口定义、域、副作用、权限、预算、取消、重入、目标实现、迁移规则|
|NodeInstance|nodeId、nodeType/version、类型化参数、引用、子图引用；无任意脚本正文|
|Port|portId、方向、执行/数据、类型、单位、可空、集合、对象作用域、连接数量规则|
|CompiledGraph|irVersion、graphHash、catalogVersion、instructions、constants、capabilities、sourceMap|
|Diagnostic|severity、ruleId、graphId、nodeId、portId/fieldPath、目标平台、修复提示|

编译依次做结构、类型/单位、引用、图语义、执行域、副作用、循环/异步预算、目标能力与节点版本检查。输入固定、工具版本固定时生成规范化 IR；不能承诺平台压缩/签名产物逐字节一致，需分别说明可重现边界。

服务器专属节点不能被客户端图引用，也不能打入客户端 bundle。编辑工具节点不可进入成品。纯计算子图不读真实时钟、不做网络/存储写入；需要时间或随机性时通过显式输入，便于测试和重播。

图 VM 任务包含 taskId、ownerScope、parentTask、cancelToken、budget 和 resumeState。任务终态为 completed、failed、cancelled、budget_exhausted；效果另外保留自然结束/停止/打断原因。异步完成结果携带调用序号，旧结果不能唤醒已经取消或重新启动的状态。

断点/单步暂停的是声明的运行实例；联网客户端暂停不能冻结服务器。模拟网络/发奖节点使用隔离适配器，追踪记录明确标记 simulated。调用栈、变量快照和源映射不能含认证头或密钥。

## 5. RuntimeCore 与平台服务

|接口族|契约|
|---|---|
|RuntimeLifecycle|LoadBundle、CreateInstance、Start、Pause、Resume、Stop、Dispose；重复停止/释放安全|
|Simulation|固定 tick 输入，最大补帧数、超时策略明确；帧渲染与逻辑更新解耦|
|EntityHandle|instanceId + index/generation，销毁后拒绝旧句柄|
|InputService|ActionMap、设备事件、触控/键鼠/手柄映射；焦点丢失释放按下状态|
|RenderService|平台无关命令、资源句柄、帧所有权；上下文丢失可重建|
|AudioService|播放句柄、分组、暂停/恢复、音量、完成原因；宿主手势限制返回明确状态|
|AssetService|异步读取、内容哈希、解码、依赖、引用计数/预算、取消；资源释放不越权影响其他实例|
|StorageService|存档Schema/版本、原子写与迁移；试玩/测试/生产命名空间隔离|
|NetworkService|连接配置、能力、认证引用、请求/流、背压、取消与状态；不默认重试非幂等写|
|Clock/Random|单调/可信/模拟时间分开；可复现随机源可注入|

跨 ABI 的返回缓冲区由核心提供释放函数，异步回调只携带稳定句柄和事件，不把临时指针交给 UI。运行状态修改在实例自己的执行队列进行；平台完成回调先入队，不从任意线程直接修改世界。

## 6. 地图、导航、遮挡与关卡

`MapDefinition` 包含投影、逻辑格尺寸、chunk 索引、图层与可用 surface。`Surface` 有稳定 surfaceId、位置/高度、连接关系与移动规则。`MapInstance` 绑定地图版本和局部状态；`World` 组织地图连接；`Level` 组织目标、奖励和关卡转换。

导航节点用 cell/区域 + surfaceId 表示，同 x/y 下的桥面与地面互不推断连通。坡道/楼梯以显式 transition 连接，声明最大尺寸/高度/移动能力和代价。障碍修改先更新地图 revision，再异步重建受影响 chunk，提交时核对 topologyVersion。重建中的行为采用明确策略：保留旧版只读导航或暂停相关寻路，不能在部分新版图上运行。

表现对象单独声明 sprite 脚点、视觉高度、占地、碰撞形状和遮挡部件。渲染排序不能成为碰撞与导航权威。随机生成输出携带 seed、generatorVersion、内容版本和锁定区域，校验安全出生点、必达路径和资源引用后提交。

关卡结算按 levelRunId + settlementType 幂等。相同逻辑时刻胜败按主 PRD 默认失败优先；永久奖励与临时状态分别提交。循环地图拓扑可合法存在，解锁/科技前置的不可满足环需要诊断。

## 7. Agent 与工具桥

GameGen 的 AgentAdapter 对外只暴露稳定领域事件，不将上游全部 SDK 对象传到 UI。事件信封包含 sessionId、runId、eventId、单调 sequence、kind、time、payload 和脱敏标记；客户端按游标续收并去重。事件种类至少为 message、tool_start/result、permission_request、proposal、usage、state、error。

轮次状态：queued → running → awaiting_user/awaiting_permission → running → succeeded/failed/cancelled/interrupted。取消本地生成与取消已发生的外部动作分别回报。恢复时核对模型请求、外部动作和项目事务，不从最后一条可见文字推断执行状态。

领域工具建议如下：

|工具|可见范围|结果/副作用|
|---|---|---|
|project.read / search|用户选定对象及允许依赖|带来源、revision 的只读内容|
|catalog.search|已安装节点/模板能力|类型、目标和使用约束|
|patch.propose / validate|当前项目授权范围|提案与诊断，不直接写文件|
|patch.commit|通过校验且已获授权提案|唯一核心事务；超出自动应用范围要求用户决定|
|preview.run|固定快照与模拟适配器|隔离试玩、追踪和诊断|
|asset.request|报价/来源与授权范围|媒体任务，结果先进入收件箱|
|contract.import|指定文档及允许引用|类型化契约草案，不执行文档脚本|

MCP 工具必须声明 read/propose/external_write/cost/deploy 等能力和目标范围；未声明或发现能力变化时重新计算权限。项目修改权限不等同于外部发布授权。Skill 内容哈希、MCP 目录版本、模型能力及权限快照随 run 保存，秘密不保存到该快照。

## 8. 模型连接与凭据

ModelProfile 包含 providerId、sourceType、apiFormat、baseUrl、pathOverride、modelId、authType、credentialRef、capabilities、limits、version。OpenAI 的 Chat/Responses 是不同消息 API，Messages 的 API Key/Bearer 是鉴权选择；Go 是账户/服务来源。模型不具备工具能力时只允许讨论/规划。

地址规范化只能在规则明确时去重版本段；界面展示最终请求地址。跨域重定向不继承认证；额外请求头不得携带明文认证值。客户端直连的局域网/回环能力与平台代理的出站策略分别实现。

凭据库支持 Create、Replace、AuthorizeUse、Revoke、Delete 与设备本地加密备份策略。返回值只含 credentialRef 和状态，不向图/Agent 返回原始 Key。进程间凭据交付的方式应在 OpenCode 技术验证中固定，并通过错误日志、崩溃文件、会话库、导出与截图的泄露测试。

## 9. 平台任务与账本

任务提交包含 accountId、sourceType、requestId、quoteId、quoteVersion、budgetAuthorization、outputSpec、idempotencyKey。服务端重新核对报价有效期、权限、余额和预算，不信任客户端价格。

任务状态：created、reserved、queued、running、cancel_requested、reconciling、delivered、failed、cancelled。交付项有独立 outputId、hash、可用性和结算数量；部分交付可部分结算。账本条目有 ledgerEntryId、accountId、taskId、businessKey、entryType、amount、unit 和关联原流水。余额不足、供应商未知状态、下载失败都不能通过简单重复提交解决。

数据库事务边界包含本地任务状态、账本流水与 outbox；供应商调用在事务外。Worker 领取带版本的任务并记录尝试，避免多 worker 同时结算。供应商回调验签并按事件键去重，轮询与回调走同一状态机。对账发现不一致先冻结受影响任务处理，给出人工修复记录。

## 10. 游戏网络与 API 契约

InterfaceContract 保存来源文档版本、operation/channel ID、输入输出 Schema、认证引用、错误码、幂等、限流及人工覆盖。重导入以“来源基线/当前手改/新来源”三方合并，无法映射时保留冲突。

实时消息建议信封为 protocolVersion、gameId、environment、sessionId、instanceId、sequence、ack、commandId、worldVersion、messageType、payload。服务端按会话验证归属和单调序号；重放检查 commandId。快照有 snapshotVersion、mapVersion、serverTick 和基础增量游标。

客户端有界发送队列，对写操作定义离线拒绝/保留待确认策略；不能自动重放所有旧命令。服务器慢消费者按策略合并状态更新、丢弃可替代旧快照或断开，关键交易消息不静默丢弃。

TargetCapabilityProfile 按目标与最低宿主版本记录 native、gateway、unsupported，附证据及限制。网关转换须描述认证、顺序、流能力和错误映射；选择后修改项目配置事务。H5、APK 容器、微信、抖音分别评估，任何未知项在发布前按不支持处理。

## 11. 构建清单与发布记录

BuildManifest 至少包含 projectId/revision、sourceManifestHash、formatVersion、compilerVersion、nodeCatalogVersion、runtimeVersion、adapterVersion、toolchainHashes、targetProfile、所需权限、资源/许可证、服务契约版本和签名证书指纹。私钥、密码、模型/MCP 凭据不得出现。

开源/导出许可字段增加 runtimeLicense、exceptionVersion、runtimeSourceRef、thirdPartyNotices 和 contentLicenseSummary。sourceRef绑定不可变源码版本与可获取位置，不能只指向随时变化的默认分支。Asset/Template记录来源、权利人、许可、是否复制代码以及是否进入游戏；未知许可阻断相应资源的公开发行，不自动把用户独立内容改为GPL。

构建状态：queued → validating → compiling → processing_assets → packaging → signing → verifying → succeeded；可进入 failed/cancelled。最终输出写入临时位置，经包结构、资源、签名和摘要检查后原子发布为已完成产物。取消不撤销已安装应用，安装/上传另有动作状态。

发布兼容性包含 IR/节点/运行时兼容、服务 API/地图版本、存档迁移与签名身份。支持读取新格式的能力通过显式版本区间声明；旧客户端不能猜测执行新节点。发布回退需检查数据是否可逆；不可逆数据库变更使用先扩展后收敛或备份恢复方案，不能仅回退二进制。

## 12. 契约验收与兼容策略

每条契约至少有正常、无权限、非法输入、重复、冲突、取消、中断与恢复样例。序列化 corpus 在 native/Android/WASM 边界共用；数字边界、Unicode、单位、缺失/未知字段和资源引用单列。

不兼容改动升级主版本，并提供迁移或明确拒绝；迁移先备份、在新位置执行并验证，成功后切换。节点语义改变创建新版本，旧图保留原版本或通过明确迁移提案升级。正式实现不得使用“自动修复”默默改变用户玩法。

## 13. 四宿主导出契约补充

详见[四目标设计](FOUR-TARGET-ARCHITECTURE.md)。targetId仅取h5_browser、android_webview、wechat_minigame、douyin_minigame；targetProfile包含最低宿主、系统、ABI、图形与WASM特性、规则集哈希。unknown能力在发布资格判断中不得记为supported，完整功能缺口必须留账并阻塞受影响完整交付，不删除原验收。

WasmLoader以runtimeHash/coreAbiVersion/imports加载，桥接标准WebAssembly、WXWebAssembly、TTWebAssembly的调用与返回差异。HostCapabilities在实例创建时冻结，经验证的动态变化通过生命周期事件传入。FeatureBinding包含featureId、required/optional、targetImplementation、gatewayContract、constraints、evidenceRef与result；平台专属功能不强行标为等价。

AssetVariant包含assetId/sourceHash/importSettingsHash/targetProfile/outputHash/decodedBudget；PackagePlan包含主包/分包、依赖、代码与资源位置、目标规则集和包体报告。不得将可远端下载资源推断为允许远端可执行代码。

BuildManifest增加coreAbiVersion、runtimeProfile、wasmFeatureSet、adapterHash、targetRulesetHash、minHostRequirements、resolvedCapabilities、moduleClosure、assetVariants、packagePlan、saveSchemaVersion、gameProtocolVersion、licenseSourceBundleRef。ABI缓冲区所有权与memory.grow后的视图失效由桥显式处理；异步完成携带ownerScope/generation，旧实例结果被拒绝。

CoverageRecord绑定requirementRef/sourceHash/component/scenarioId/targets/hostEnvironments/versions/plannedIncrement/buildId/artifactHash/evidence/result/owner，默认result=not_run。执行与文档状态分离，quality_verified=false、release_permitted=false；不存在的执行证据不能由文档哈希代替。

## 14. 共享SDK、工程转换与LAN契约

SDK共享Command/Query/Event/Task语义，通过稳定C ABI提供GetAbiInfo/GetCapabilities/OpenProject/SubmitCommand/ReadSnapshot/Subscribe/CancelTask/CloseSession。命令携带expectedRevision/requestId，事件带cursor/projectRevision/taskId；UI不直接写库。详见[共享核心](SHARED-CORE-AND-CLIENTS.md)。

ImportSession绑定sourceInventoryHash、ReaderProfile、ruleSetHash、SourceObjectKey→targetId、迁移IR及报告。ReimportBaseline绑定上次源和上次目标快照，当前手改与新转换结果三方比较。原脚本只为不执行迁移输入，不进入GameBundle；缺失逻辑登记阻塞。

ProjectSnapshot增加branchId、snapshotId、parentSnapshotIds、manifestHash和本地revision，祖先关系用于跨端合并；revision不能跨分支比较。TransferPlan绑定sourceSnapshotHash、targetBaseHash、content/依赖/删除、policy/license、授权和空间预算；CommitTransfer重查expectedLocalRevision、grantEpoch与validatedManifestHash，经同一事务核心原子提交。

DeviceIdentity与TrustGrant分开，后者限定peer/project/actions/expiry/epoch；WSS/HTTPS只访问已配对身份及授权内容哈希，不接受任意本地路径。ContentPolicy的localOnly及来源限制跨派生数据、同步和出站端口继承，错误包括LOCAL_ONLY_DENIED、PEER_NOT_TRUSTED、GRANT_REVOKED、SOURCE_CHANGED、SNAPSHOT_DIVERGED、CONTENT_HASH_MISMATCH、FORMAT_PROFILE_UNSUPPORTED。

ProjectExportTarget与GamePackageTarget分离；前者当前仅设计未来CocosCreator/LayaAir/Godot三类Writer，具体格式Profile另冻结。SEM来自创作快照，ExportManifest记录writer/rules/ID映射/依赖/许可/损失与人工选择。单向新目录输出不默认承诺无损往返。完整字段与状态见[导入同步](IMPORT-AND-LOCAL-SYNC.md)、[工程写出](PROJECT-EXPORT-EXTENSION.md)。
