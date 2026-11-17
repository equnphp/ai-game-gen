# EditorHostPort 1.0 精确行为契约

版本：editor-web-v1-draft.2；状态：可编码的契约文档，尚未实现/编译/执行。权威机器定义：[host.schema.json](contracts/host.schema.json)、[editor-host.d.ts](contracts/editor-host.d.ts)。JSON Schema为2020-12；types、Schema与本文一起定义行为，语义约束不能仅靠JSON Schema注解验证。

## 1. 三种适配器与封装

ProductionTauriAdapter、BrowserCoreAdapter、MockHostAdapter均实现EditorHostPort.dispatch(request)。请求固定为{protocol:"1.0",callId:UUIDv4,method,params}；响应带同protocol/callId/method及ok:true,result，或ok:false,error，禁止同时出现result/error。每方法参数/结果字段以Schema的oneOf区分，未知字段拒绝。

每个callId为宿主调用关联ID，不等于Core requestId。浏览器真实适配器将其原样映射为driverRequestId，结果再映回；同一连接不复用callId。模拟必须明确adapterKind=mock、真实buildId=null，不在生产失败时静默回退mock。构建ID只来自实际产物元信息，不能填旧原型build_id。

## 2. 方法全集

|方法|参数/返回要点|实现映射与失败|
|---|---|---|
|host.describe|{}→协议/host实例/adapter/build/ABI/方法/硬限|静态接口与真实已加载ABI分开；Core未加载为null，不冒报可用|
|session.open|grantRef、requiredCapabilities→OPEN、sessionToken、三个实例ID、能力、初始cursor|可信宿主解析grant后创建Core并查询能力；本版每宿主最多1活Session，第二个SESSION_LIMIT|
|session.state|sessionToken→状态、projectState、activeTasks、tasks[]、结果缓存占用|任务清单包含taskRef/coreRequestId/originCallId，支撑受理响应丢失后的恢复|
|session.close|sessionToken、drain/cancel、deadlineMs1—30000→CLOSED、最后durable revision或null|独立状态机，见第5节；超时不报关闭成功|
|core.submit|sessionToken、requestUtf8→TaskTicket|标准Base64承载精确Core UTF8原字节，解码≤2MiB；不改Core Schema或请求幂等|
|upload.write|sessionToken、uploadId、offset、chunk→TaskTicket|gg_upload_write；块1—1MiB，offset十进制u64，领域顺序/重复规则沿M1|
|blob.read|sessionToken、contentHash、offset、maxBytes1—1MiB→TaskTicket|gg_blob_read，只读项目可达内容，无外部路径/URL|
|task.status|sessionToken、taskRef→state、cancellable、原生state JSON字节|gg_task_poll；不能用phase推断完成|
|task.result|sessionToken、taskRef→终态、Core result JSON、可选binary|仅终态；单结果槽缓存，见第4节；Core失败仍是已取得结果，不改为宿主未受理|
|task.cancel|sessionToken、taskRef→cancelRequested:true|只表示GG_OK取消请求受理；BUSY的too-late信息留Core error，仍查终态|
|task.release|sessionToken、taskRef→released:true|仅终态；成功后token失效，重复调用TASK_INVALID，不能推断领域写失败|
|events.read|sessionToken、cursor或null、limit1—100→nextCursor、gap、events[]|映射gg_read_events；seq转十进制字符串，原事件字节同时保留|

TaskTicket强制包含originCallId和coreRequestId（Core JSON受理时为其requestId；二进制方法为null）。新taskRef只在原生受理成功后签发，不为失败受理伪造任务。

## 3. 标识、数值、字节及能力

UUID均为小写v4。sessionToken=s1.<hostInstanceUUID>.<sessionGenerationUUID>；taskRef=t1.<sessionGenerationUUID>.<randomTaskUUID>；grantRef=g1.<randomUUID>。它们是带代次的不透明注册表键，不含Core指针/句柄或磁盘路径，随机ID本身不替代origin/宿主权限校验。

host重启换hostInstanceId，成功Core新建换sessionGeneration；销毁/撤销后旧token SESSION_INVALID，任务release后TASK_INVALID，ID永不复用。token不匹配当前principal、会话或代次均拒绝，不能访问另一个WebView/客户端的任务。无界tombstone不必保留，随机新ID不重用。

所有64位值为0或无前导零十进制字符串，范围0—18446744073709551615，Schema给出严格范围模式；JS可用BigInt比较，不转Number。FFI u64保留精度，Core事件raw JSON中seq可能是数值，Rust以u64解析并提供外层seq字符串；客户端游标只用外层值，不从JSON.parse后的浮点seq构造。

所有二进制/原Core JSON统一用{decodedBytes,base64}，RFC4648标准字母表、规范padding、禁止URL-safe变体/空白；解码后长度必须严格相等。Json2≤2MiB，Json8≤8MiB，binary≤1MiB；JSON还需UTF8、无BOM/重复键/非法值、深度≤32及原Core约束。contentEncoding和x-semantic-rules是注解，不等于实际解码校验。

本版不另设Tauri原生ArrayBuffer传输：三适配器保持同一规范Base64契约，未来优化另协商版本。原请求编码一次后复用原字节重试；禁止解析后重排JSON再用原requestId。

能力仅列实际支持项：core.project_store、core.scene_documents、core.asset_stream、core.events、editor.graph、preview.control。session.open检查requiredCapabilities，缺失返回UNSUPPORTED并清理创建对象，不给半可用token；M1不得把图/预览能力报true。协议固定1.0，不兼容版本UNSUPPORTED_PROTOCOL；原生ABI非1.0则VERSION_MISMATCH。支持同major未来minor需另写协商，本版不自动猜兼容。

## 4. 任务、事件、缓存与预算

原状态QUEUED/RUNNING/COMMITTING/SUCCEEDED/FAILED/CANCELLED不变；GG_OK仅受理，task.result.state=FAILED/CANCELLED仍正常返回Core终态JSON。宿主错误与领域失败分开：error.coreStatus/coreErrorJson保留原受理错误；Core领域error留result原JSON。

每Session保留最多32个原生活跃/未释放任务；宿主最多16个未完成调用，上传最多4个未处理块；Core既有预算更严时仍先拒绝，不能替换成无界缓存。

**每Session一个结果槽，解码总额≤8MiB。** task.result在调用gg_task_take_result前取得空槽；被其他task占用时返回BUSY，不消费其原生binary。首次取结果将JSON和binary复制为宿主拥有字节并释放两个原生buffer；之后同task重复读取宿主缓存，直到task.release。JSON+binary解码合计不超8MiB，binary本版不超1MiB；不能二次调用Core索取已消费binary。缓存任务释放成功后腾槽；关闭状态机可按任务依次消费/释放。缓存不TTL丢弃、不先报提交失败。非预期超限/非法Core返回是CORE_CONTRACT_VIOLATION，停相关会话并保留恢复信息。

缓存8MiB不是全进程内存上限：另有Core8MiB预算、最多一个16MiB编码输出、有限小响应队列和输入帧。编码输出必须串行限流，不为16个调用各分配16MiB。释放调用后仍被响应序列化持有的宿主字节可延长到写出结束，不涉及跨DLL free。

Core事件环容量256，但单次读取limit只能1—100。本版纠正draft.1里“批次256”的宽泛描述。cursor含hostInstanceId/sessionId/coreInstanceId/afterSeq，均校验；null映射当前Core after=0。Core nextSeq/gap决定nextCursor；每个事件带精确外层seq字符串和原JSON字节。单批原事件JSON解码合计≤1MiB，wire Base64膨胀另计。超过预算不推进已交付游标，应降低读取数重取；单事件就超预算返回CORE_CONTRACT_VIOLATION。

gap或实例不匹配必须重查项目/任务，不能从事件缺失推断事务未发生。terminal结果以任务/持久request.lookup为准。分页/投影之外的图/渲染接口本版不新增Core op；后续模块未交接返回UNSUPPORTED。

## 5. 关闭、重连和失败

session.open初始化在宿主工作线程完成，成功前不发token；对外状态OPEN→CLOSING→CLOSED，异常可FAILED。session.close原子进入CLOSING，拒绝新submit/upload/blob请求；仍允许state/status/result/cancel/release/events和再次close。drain不主动取消，cancel对可取消任务请求取消，不把too-late当已取消。

关闭器作为同一个Core actor状态机处理所有终态、结果槽和租约，必要时通过原始标准project.close请求关闭项目，生成并保留其内部requestId。必须先处理在途写入并逐次消费/释放普通终态任务，至少腾出一个任务槽提交内部project.close；确认其成功后释放close任务/全部buffer，再调用gg_core_destroy。全部成功才返回CLOSED；deadline返回TIMEOUT且sessionState=CLOSING，保持库/句柄，不强卸载，不将超时改报未提交。再次close可继续，不另建第二Core抢项目锁。

短暂传输断连不自动取消事务。同一host/身份且会话仍存活时，重新describe→session.state，按tasks[].originCallId/coreRequestId找回受理任务，查询终态并补读事件。若host/session已失效则旧taskRef不可用；新会话按项目和原Core requestId执行request.lookup，再决定原字节重试，不换ID盲重放。上传用upload_status/offset/相同字节规则恢复。WebView旋转/重绑同一平台宿主可保留Core；身份变化或宿主进程死亡则按新代次处理。

error固定code/messageKey/retryable/outcome，可附coreStatus/coreErrorJson/affectedCoreRequestId/sessionState；messageKey非空且不泄漏路径/SQL/正文。outcome=not_submitted表示原生未受理；submitted_unknown表示可能已受理，必须查原Core requestId；not_applicable用于读/句柄/协议等不代表领域写状态的失败。传输无响应/崩溃不能伪造有序错误返回，客户端也必须按unknown处理。

## 6. 统一错误映射补充

无效会话/代次或principal为SESSION_INVALID；无效/已释放/跨会话任务为TASK_INVALID；有效Session下外来cursor为CURSOR_INVALID（重新读cursor=null并重查投影，不自行换Core）。非终态result为NOT_READY；其他任务占结果槽为BUSY。

GG_E_ARGUMENT映射CORE_ABI并保留coreStatus=1；GG_E_ABI→VERSION_MISMATCH；GG_E_HANDLE按对象→SESSION_INVALID或TASK_INVALID；QUEUE_FULL/NOT_READY/BUSY/LIMIT按同名宿主码；GG_E_INTERNAL→CORE_ABI。coreStatus原值和有界原error字节保留，outcome按实际受理边界填写。host.describe可在Core未加载时返回coreAbi=null；session.open才给LIBRARY_NOT_FOUND/LIBRARY_INVALID/权限/能力错误。

SessionInfo.activeTasks必须等于tasks.length；resultSlotTask只能为该清单中的task或null。scope正确但状态CLOSING时新领域任务为SESSION_CLOSING，state等恢复方法继续可用。Core事件序号不匹配的cursor不推进客户端游标。

结果细则：origin为blob.read时binary必须为块对象（EOF为decodedBytes=0/base64为空），其他M1任务binary为null。SUCCEEDED与Core result.ok=true一致，FAILED/CANCELLED与ok=false一致，否则CORE_CONTRACT_VIOLATION。session.state.tasks仅列对该principal暴露的任务；内部project.close任务不对外发taskRef，仍计入Core32槽并由关闭器独占管理。

宿主deadline使用单调时钟；预览固定seed/可控时钟不替代真实超时或安全token/UUID的系统随机源。Host只做线协议/基础编码/权限/能力检查，Core业务字段与领域合法性仍由同一C++规则判定，不在Rust/TS复制第二套规则。
