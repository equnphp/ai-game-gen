# 三引擎工程导入与局域网同步详细设计

版本：`arch-v3.7-draft.1`；日期：2026-11-14。产品输入：REQ-038/AC-058—064、REQ-039/AC-065—072；具体产品版本与文件摘要见baseline。本文只编制架构/验收定义，execution_status=not_run、quality_verified=false、release_permitted=false。

## 1. 当前范围和依赖

Windows提供Cocos Creator 2.4.x/3.x、LayaAir 2.x/3.x、Godot 3.x/4.x源工程导入入口；每类按源格式分代，精确子版本/对象兼容证据在ReaderProfile中逐项登记。产品范围包含三个家族，不表示未知子版本可强行读取。名单外引擎、发布产物反编译、完整3D、回写源工程均不加入当前实现。

转换后是GameGen原生文档/资源/受限工作流，可通过局域网发给Android继续编辑，再接回Windows。局域网发现、配对、传输、报告、缩略图与恢复记录均不经互联网/ADB/云中继；无需平台账号。localOnly随内容传播，禁止自动把导入内容交给云模型或远程MCP。

实现为共享核心中的InterchangeCore、SyncCore、PolicyCore与宿主适配，不新增云资源服务或微服务。格式读取器独立实现，**不依赖Cocos引擎/SDK/适配器或原工程执行环境**；读用户工程数据不改变Cocos仅参考的决定。

## 2. 导入流水线与中间模型

SourceAccessGrant → DetectEngine → FreezeInventory → ParseReadOnly → BuildMigrationIR → ResolveReferences → SemanticMapping → PreviewReport → UserChoices → ValidateNativeDocuments → CommitNewProject。

源工程保持只读。清单记录授权根、相对路径、大小、内容摘要、引擎/格式、读入规则与来源许可。大文件逐块流式读取，不把全部音频/贴图放内存；源文件在读取期间变化则使受影响结果过期，重读后生成新输入摘要，禁止混合不同源版本。任务暂存与最终项目分开，失败/取消不覆盖源工程或既有GameGen项目。

MigrationIR是内部的版本化转换中间模型，不是对外“通用工程导入”入口。包含SourceObjectKey、对象树、组件/属性、资源引用、场景/Prefab关系、图块、时间轴、事件/脚本引用、单位/坐标约定与未映射信息。SourceObjectKey由sourceProjectIdentity、engineFamily、formatGeneration、sourceId组成；源ID缺失或冲突时明确诊断，不仅靠文件名生成覆盖关系。

映射规则将源对象转换成现有Scene/Prefab/Map/Level/Graph/Data/Asset文档；通过正常ProposePatch/Validate/Commit路径创建。MigrationIR不成为运行时第二权威，原脚本不成为GameBundle执行内容。项目/资源ID的新身份与来源映射分别保留。

|Reader家族|分代边界与读取重点|未知/受限处理|
|---|---|---|
|CocosCreatorReader|2.4与3.x分开Profile；工程元信息、UUID/meta、场景/Prefab、组件、2D资源与引用|独立解析数据，不复制其序列化运行器；复杂自定义组件/插件转待补任务|
|LayaAirReader|2.x/3.x工程、IDE场景/预制体、资源/UI/动画、物理与逻辑引用分开映射|按实际格式标记解析器版本；不通过安装Laya IDE/执行构建恢复缺失信息|
|GodotReader|3.x/4.x配置/场景/资源、节点/信号/图块/动画；文本与二进制编码分开能力项|文本格式不等于所有二进制资源支持；不运行tool脚本或自动加载引擎解析资源|

官方[Cocos meta说明](https://docs.cocos.com/creator/3.8/manual/en/asset/meta.html)、[Godot TSCN格式](https://docs.godotengine.org/en/4.5/engine_details/file_formats/tscn.html)说明各自身份/引用与格式代际；[LayaAir工程说明](https://layaair.com/3.x/doc-en/basics/UnityToLayaAir/readme.html)也体现其独立工程组织。读取方案据此按家族/代际划分，不推断全量兼容，不执行这些来源项目。

## 3. 语义映射、行为与重导入

TransformRules显式处理坐标方向、像素/米、角度、锚点、父子变换、Z/排序、颜色/混合、物理时间步、动画事件与实例覆盖。源工程没有通行面、任务或关卡语义时，不从画面位置猜出桥面、出生安全点或奖励规则；生成可定位的待确认映射。

BehaviorMapper只识别已定义、受版本约束的生命周期/输入/计时/碰撞/状态/数值/API模式。脚本经纯解析读取，不调用解释器、编译后执行、包管理器或原工程钩子；未知反射/线程/动态库等转MigrationIssue。候选图与人工/AI图走同一类型、权限、执行域、预算与目标校验；可执行代码字符串节点始终禁止。

每个对象/行为有converted、confirmed_substitution、pending、excluded之一，记录sourceRef、targetRefs、ruleVersion、severity、reason和用户选择。四类统计可对账；文件创建、结构转换完整、逻辑就绪与四目标可发布分别计算。严重缺失可保留可编辑草稿，但阻塞试玩/发布时必须定位原因。

ReimportBaseline保留上次源清单摘要、映射规则/ID映射、上次转换目标快照。重导入比较“旧源转换基线/当前GameGen/新源转换结果”，按稳定对象字段与领域拓扑做三方差异；源删除与目标编辑冲突、拓扑变更冲突都交用户选择。只有校验后的解决方案才能生成新事务，绝不直接覆盖project.db。

SourceReferenceArchive可在本机保留源脚本参考，但默认不进入游戏包/设备同步包。其localOnly、许可和来源标签不得因重命名、摘录或生成工作流而自动清除。

## 4. 本地内容策略与出站边界

PolicyCore定义ContentPolicy：localOnly、allowedLocalDevices/scopes、originRefs、licenseRestrictions、retention与policyVersion。派生资源、缩略图、嵌入索引、转换报告、错误附件及从原代码生成的候选图继承限制；组合内容采用更严格策略。内容标签存入项目/归档/同步清单，未知策略字段按失败关闭处理。

所有可访问内容的出口须经过同一EgressPolicy：Agent上下文打包、远程模型、远程MCP、Skill附件、媒体请求、遥测、崩溃/日志上传、云备份、发布/工程导出。被拒绝时给出对象与目的地原因，不把拒绝转成隐式脱敏摘要或另一工具调用。localOnly不禁止用户自行输入且不自动附带本地内容的文字讨论。

“用户选择游戏/工程导出”与“自动上传”分别授权。导出到本机仍执行许可/内容范围检查；平台上传或发给新设备需要目的地/动作范围确认。localOnly项目不能自动走旧版默认上下文或云同步路径。凭据始终独立本机存储：API Key、签名私钥、设备身份密钥、平台登录态、私人聊天历史不得进项目共享清单。

第三方MCP进程若可绕过PolicyCore读取原目录，应通过文件授权、挂载范围或进程隔离收窄；无法建立约束时不授予localOnly目录访问权。提示词或Skill文字不能替代执行边界。本轮没有实际隔离/泄露验证证据。

## 5. 发现、网络与设备信任

优先Windows在所选可信LAN接口启动本机接收服务，Android主动连接；同一会话双向发起控制与内容请求，手机也能发回修改。系统允许时可交换服务角色，但Android/未来Apple后台常驻接收不是成功前提。服务类型暂定`_gamegen-sync._tcp.local`（项目私有约定，非已注册标准），端口由系统分配，服务停用后撤销广播。

mDNS/DNS-SD仅公布临时发现ID、友好名、协议主版本和必要能力摘要，不公布稳定硬件ID、项目清单、路径或资源哈希。发现不等于认证；组播不可用提供局域网二维码/手动地址，仍执行同一配对流程。网络隔离且单播不通时要求修复LAN，不端口扫描、不借助云中继。

网络适配器返回选定interfaceId、地址/作用域和路由；连接只使用该局域网接口。IPv6链路本地地址保留scopeId，多网卡/网络切换重新核对原设备身份与目的路由。拒绝跟随重定向到未授权主机，不使用公网DNS/证书服务作为本地传输必要步骤，不因失败自动切蜂窝、VPN、公网代理或UPnP。仅检查RFC1918地址不足以证明实际路由符合本地策略，平台桥需绑定所选网络。

### 5.1 首次配对方案

二维码优先：由用户在可信设备界面显示局域网端点、设备公钥摘要、一次性高熵随机token和过期时间；接收端扫描后固定公钥身份，通过TLS证明持有对应密钥并消费token，两端确认设备与内容范围。token建议256位随机、有效期120秒、仅一次成功，二维码不含私钥或项目。人工输入地址仅解决寻址，不允许跳过身份验证。

无相机采用经审阅的PAKE短码流程候选，例如[RFC 9382 SPAKE2](https://www.rfc-editor.org/rfc/rfc9382.html)：临时短码参与认证密钥交换、转录绑定双方身份和会话、双向密钥确认，再绑定长期设备公钥与TLS身份。具体密码套件/库与TLS通道绑定须在安全设计评审中冻结；不自行发明加密协议，不把短码直接作TLS密码/长期密钥，不用“接受任意自签证书+HTTP传短码”替代认证。未具备经审阅的实现时该配对方式保持不可用，二维码路径也须独立验证。

建议短码有效期120秒、每次会话最多5次失败后关闭并重新发起；这些为初始安全阈值，非已测结果。配对前仅允许受限握手消息，限制大小/频率；不返回项目目录。长期DeviceIdentity与TrustGrant分开，后者按对端、项目、动作、期限和用户确认保存。撤销提升grantEpoch并终止任务/连接，已接收副本不声称可远程擦除。

### 5.2 已配对会话与系统权限

控制与内容采用TLS保护的WSS/HTTPS，同一配对身份可双向认证。优先TLS1.3；若最低平台确需TLS1.2，必须单列密码套件/支持理由和复验，不能自动降级为明文。证书/公钥轮换由旧身份签名和用户确认或重新配对，不能永久关闭证书验证。长期私钥留系统安全存储，开发证书与用户设备信任分开。

Windows仅绑定选中可信私网接口，入站规则限制应用/端口与必要网段；防火墙问题提供应用级修复，不能要求整体关闭。Android按OS与target SDK处理NSD/系统选择器和LAN权限，权限拒绝后保持本地编辑。官方[局域网权限文档](https://developer.android.com/privacy-and-security/local-network-permission)现将target 37+的直接LAN访问与`ACCESS_LOCAL_NETWORK`关联，也提供系统选择器路径；实际最低版本/target组合在实现前冻结，不能为逃避权限而降target。未来Apple适配Bonjour与[局域网隐私声明](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)，保留相同信任/核心语义。

## 6. 同步协议、快照与提交

协议主版本不兼容即拒绝；次版本通过显式capabilities与必需字段协商。状态：discovered → pairing → authenticated → negotiating → awaiting_scope → planning → awaiting_confirmation → transferring → verifying → merging → committing → completed；可进入paused、cancelled、failed、needs_repair。文件收完不等于项目提交成功。

|消息/接口族|主要字段与边界|
|---|---|
|Hello/Capabilities|protocolVersion、ephemeralId、core/schema/catalog范围、功能、消息/块预算；不含项目目录|
|AuthorizeScope|peerIdentity、grantEpoch、项目/资源与read/send/receive/merge动作、有效期、确认摘要|
|CreateSnapshot|projectId、branchId、已提交revision、snapshotId、manifestHash、parentSnapshotIds；从核心一致视图生成|
|PlanTransfer|transferId、sourceSnapshotHash、targetBaseHash、文档/资源/删除标记、依赖、contentHash/size、policy/license、限额|
|NeedContent/ReadChunk|授权transfer、对象哈希、偏移、长度、chunkHash；不接受任意文件路径|
|ResumeStatus|任务/源快照/内容版本、已确认块位图、暂存清单；源变化产生新计划|
|PrepareMerge/ResolveConflict|共同祖先、本地/远端、类型化差异、用户选择、预计新引用；不按revision大小跨分支排序|
|CommitTransfer|expectedLocalRevision、validatedManifestHash、grantEpoch、idempotencyKey；复查权限/引用/策略并原子提交|
|Cancel/Revoke/QueryResult|独立任务状态与事务结果；超时先查是否提交，不盲目重放|

branchId与snapshot祖先关系补充现有projectId/revision。revision仅在本地分支提交序列内单调；不同设备的revision不能直接比较。关联未知来源或同ID异来源时另建副本/明确关联。源端不发送正在写入的SQLite/WAL，接收端不直接替换数据库。

新资源先在授权暂存仓流式校验块与完整contentHash，引用闭包齐全后导入CAS，再通过事务登记项目新版本。CAS已存在内容仅在许可与策略允许时复用；相同字节不代表相同逻辑ID或可共享授权。失败产生的未引用块可延后回收，不删除其他项目仍引用的内容。

幂等作用域为peerIdentity/project/transferId/manifestHash/action；同键不同输入拒绝。CommitTransfer保存结果可查询，进程在已提交未回包间崩溃仍返回原结果。取消/撤销发生在提交前则不提交；发生在提交后保留已产生历史，不能假装撤销已交付副本。

## 7. 三方合并、空间与任务预算

默认手动同步、双端明确范围。独立对象/字段按领域规则合并；同字段、工作流拓扑、主键/外键、删除仍有引用、二进制资源冲突保留三方版本。合并结果重新验证类型、引用、工作流、策略与目标能力，再产生完整事务。自动模式遇冲突/删除/升级/扩大权限暂停，不以时间戳覆盖。

接收所需空间估算为缺失内容暂存 + 必需资源安装开销 + 文档/迁移暂存 + 恢复点 + 安全余量；磁盘不足先拒绝计划，不能清理用户已有完整项目腾空间。任务检查点绑定源快照/块摘要，进程重开后只恢复仍获授权的任务。旧输入变化使相关暂存失效但不损坏有效块/原项目。

以下为待环境冻结/评审的工程预算，不是吞吐承诺或测试结果：

|项目|初始设计值/目标|依据、边界与调整条件|
|---|---|---|
|传输块|1 MiB，末块可短；协议接受64 KiB—4 MiB的协商值|平衡重传/内存；改变块方案不改变整体内容哈希|
|并发/背压|单项目1个提交所有者；设备最多2个活动传输，每任务最多4个在途块；总内容缓冲目标≤16 MiB|超出排队，控制/取消消息优先；测量后改配置，不默认无界线程|
|进度/任务|>500ms可见；进度事件最多每250ms一次；取消控制处理目标≤1秒|适用于前台可调度、正常LAN，不包含OS挂起或同步磁盘调用的最坏时长|
|发现|同一可互通LAN前台发现目标10秒内；超时提供扫码/手动连接|AP隔离/组播禁用/权限拒绝分别诊断，不宣称扫码能穿透隔离|
|输入解析|流式/有界树；按Profile限制深度、单记录/压缩膨胀、文件数和总输出，缺失预算拒绝分析|真实样本与设备预算不足，精确限制为开发前必填Profile；不对任意大工程承诺成功|
|恢复/安全|失败完整版本丢失0；未授权读取/上传0；校验失败提交0|产品业务护栏，必须通过以后真实证据验证|
|性能样本|规划小项目与大音频/多小文件项目，分别记录冷启动、RSS、WASM/资源内存、吞吐和恢复耗时|具体规模/设备待冻结；不编造MB/s或大世界容量|

## 8. 交接、验收与演进

依赖顺序：I0精确Reader/对象目录与只读清单→I1原生文档转换与报告→I2行为映射/三方重导入；L0发现/配对→L1固定副本与资源依赖→L2增量/续传/领域合并→L3共享库与手机试玩往返。每个增量有独立恢复边界，不能以只复制图片验收完整REQ-038，或以传文件成功验收完整REQ-039。

AC-058—064绑定ReaderProfile、来源映射、合法工作流、报告、重导入、localOnly与跨端继续编辑；AC-065—072绑定LAN无公网、信任/撤销、完整依赖、续传原子性、冲突、隐私、试玩往返及四语/权限状态。各项详细系统用例交独立quality角色，文档默认not_run。

新增平台只增加宿主发现/网络/文件/凭据实现，不改变SyncCore合并语义。新增工程格式须经产品更新白名单及格式Profile；内部MigrationIR不能变成名单外通用入口。未来工程写出使用独立Writer接口，不能假定Reader天然可逆，详见[工程导出扩展](PROJECT-EXPORT-EXTENSION.md)。
