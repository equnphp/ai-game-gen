# core-test-driver 1.0 与本机回环代理

版本：editor-web-v1-draft.2。完整Schema：[driver.schema.json](contracts/driver.schema.json)，共用类型：[editor-host.d.ts](contracts/editor-host.d.ts)；共享方法语义见[CONTRACT.md](CONTRACT.md)。

## 1. 与当前CLI的区别

当前[native/tools/core-driver/main.cpp](../../../../native/tools/core-driver/main.cpp)读原始Core JSON并阻塞轮询到终态，缺独立submit/status/result/cancel/events/binary方法。它只算首版阻塞CLI；没有driverProtocol握手，不是本版异步宿主。新实现建议另建tools/core-test-host，不在本次修改现有工具或默认回退旧协议。

## 2. 帧与关联

采用持久进程stdin/stdout UTF8 JSON Lines；单帧最大16777216字节（不含LF），输出LF，无BOM；输入可接收CRLF但只剥终止CR。JSON内换行必须转义。先按字节限帧再解码，不将无界一行读进内存。

请求固定driverProtocol="1.0"、driverRequestId=UUIDv4、method、params。响应回同协议/ID/method，ok=true/result或ok=false/error互斥。HostPort12方法直接使用同params/result定义；driver另有describe/shutdown共14方法。callId与driverRequestId映射不改变Core requestId。

一个连接内driverRequestId永不重用，不承担重试幂等；Core写重试仍依原Core requestId和原字节。异步响应可乱序，但每个有效接受的唯一请求至多一个正常响应；一行响应不可与另一行交织。stdout只协议，stderr是脱敏诊断。句柄、token、绝对根、凭据、文档正文不进普通日志。

非法UTF8/JSON/空行/超长帧/未知方法或协议形状，以及重复driverRequestId，均为协议故障：若stdout仍可用输出一条kind=protocol_error、driverRequestId=null的控制记录，随后停止受理并清理退出；不能给重复ID输出第二个关联响应。控制记录error.code=PROTOCOL_ERROR或UNSUPPORTED_PROTOCOL，outcome=not_applicable。客户端将所有未确认Core写按unknown处理，不靠控制记录推断落盘。

## 3. 非阻塞调度和错误

读帧/校验/请求分派不等待Core任务终态。core.submit、upload.write、blob.read受理后立即返回TaskTicket；task.status/result/cancel/release、events.read独立请求，同一Core actor仅串行短FFI步骤，不阻止取消。

最多16个未完成驱动调用，满时在原生受理前QUEUE_FULL；Core32任务/8MiB原预算仍独立。完整16MiB编码响应同时最多一个，其他小响应有界，写stdout必须有背压。客户端持续读stdout，不能发完16个大请求后停读等待；帧写出阻塞不构成Core任务失败。

已受理任务的FAILED在task.result里是ok=true、state=FAILED和Core原error JSON；wrapper错误才ok=false。响应丢失可通过session.state.tasks找回originCallId。二进制统一规范Base64，upload每块≤1MiB，Core JSON请求≤2MiB、result总解码≤8MiB；不得把16MiB帧上限当业务输入上限。单结果槽/重复读取/释放语义与HostPort一致。

## 4. 启动、描述和退出

启动器创建全新fixture目录，验证真实根及祖先无软链接/重解析逃逸，将其作为可信启动参数/私有配置传给driver。driver只为该fixture注册一个grantRef，不接收每请求绝对路径，也不默认授权工作区/用户项目目录。driver.describe返回driverProtocol、hostInstanceId、fixtureGrant、adapterKind、implementedMethods和固定limits；UI前先核对握手及必需方法，旧CLI或残缺实现明确拒绝。

driver.shutdown(deadlineMs)停止新会话/受理，按session.close(drain)流程关闭Core；清理成功先写STOPPED响应、flush，再exit0。超时返回TIMEOUT并保持STOPPING/会话CLOSING，仅允许状态、结果、取消、释放、close、describe及再次shutdown，不伪报成功退出。

stdin EOF、终止信号或协议故障：停止受理，最多30秒尽力有序清理；能够关闭才正常释放。仍忙则记录非成功退出和未确认请求信息，进程结束不能宣称任务取消/提交失败；保留fixture用于下一次恢复。DLL进程驻留，不在失败清理中强卸载。删除临时目录是启动器依据其已登记目录清单的后续动作，不由driver接受任意delete路径。

## 5. BrowserCoreAdapter回环代理

生产Tauri走原生IPC，无该代理。浏览器真实联测时，启动器建立127.0.0.1随机端口HTTP代理，唯一RPC为POST /rpc；不绑定0.0.0.0/局域网/公网，当前不使用WebSocket或SSE。每启动256bit随机Bearer token只经私有启动通道传给测试适配器内存，不进URL/命令行/DOM/localStorage/日志/项目。

浏览器请求必须同时满足：
- Authorization Bearer相等、Host为确切回环地址/端口、Origin为启动器登记的唯一http测试UI origin；拒绝null、file、通配及任意外部origin。
- OPTIONS仅返回精确Origin和POST/Authorization/Content-Type允许项；实际POST仍验token和Origin，不因CORS已放行免鉴权。
- Content-Type application/json，鉴权后才受限读取body；最多16MiB并受并发/速率预算。Core/二进制还受各自更小限制。
- body为driver envelope，但浏览器只可使用12个Host方法，不能调用driver.shutdown/describe控制面。启动器私有stdio通道持有这两个方法权限。
- session/grant绑定当前token/origin/principal和唯一fixture根；不能借参数切换到真实项目/其他根。

代理将Host callId映射driverRequestId，一直读取child stdout并按ID分派HTTP响应。HTTP客户端断开不取消Core任务、不遗失driver任务注册表；调用方恢复时以session.state任务清单/原Core requestId查实，不把网络错误当未提交。新代理若重启driver则host代次变化，旧会话全部失效。

停止顺序：拒绝新HTTP受理→私有通道driver.shutdown→等成功响应/进程退出→关闭listener并清除内存token→保留或按fixture清单处理目录。超时/崩溃保留故障fixture，不伪造干净退出。生产构建、LAN同步和第三方游戏预览均不能打开这个测试控制面。

## 6. Schema的离线解析和语义

driver.schema.json以相对host.schema.json引用共享定义；两者$id使用保留.invalid域作标识，不访问该域。验证器须本地注册两个Schema；不允许校验器从网络自动取Schema。JSON Schema只定义形状/范围，Base64规范和解码长度、UTF8/重复键、权限、代次、状态机和跨字段预算由实现强制。

本轮只写协议，没有运行validator、TypeScript编译、driver进程或端到端测试。实现后接收记录必须分别填文档、源码、构建、实际自测状态。

## 7. 关联ID的有界生命周期

每driver连接最多登记65536个唯一driverRequestId；到65000后停止新的session.open/core.submit/upload.write/blob.read受理（LIMIT_EXCEEDED），保留最后536个ID供状态/结果/取消/释放/close/shutdown等清理。到硬上限触发协议控制记录和有界退出清理。seen-ID集合因此有界，不能无限保留UUID，也不能忘掉旧ID后允许重复执行。启动器应在接近阈值前主动关闭并用新driver进程/新host代次启动下一场fixture。该阈值是测试driver生命周期，不限制生产编辑器项目的持久requestId账本。
