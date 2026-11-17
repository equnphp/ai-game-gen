# EditorHostPort与可测性接口契约

版本：editor-web-v1-draft.1；接口族：EditorHostPort 1.0草案。以下是后续宿主/前端契约，不是新增M1 op或已经实现的函数。C ABI1.0和消息1.0继续以[既有API](../../handoff/local-core-v1/api.md)、[头文件](../../handoff/local-core-v1/spec/gg_core_v1.h)及[Schema](../../handoff/local-core-v1/spec/messages.schema.json)为准。

## 1. 适配器与责任

ProductionTauriAdapter连接真实本机桥接；BrowserCoreAdapter通过测试专用本机代理连接同一C++共享库；MockHostAdapter只用于组件/状态展示。三者声明adapterKind、contractVersion、coreVersion、capabilities和实际buildId，实际未构建的buildId为空。生产不自动降级到mock；未实现能力返回UNSUPPORTED，不报成功。

React持有UI状态及只读项目投影；Rust持有Core/task/buffer等句柄映射；C++拥有领域权威。UI无数据库或操作系统文件任意权限。

## 2. 逻辑端口

|方法/数据|输入与结果|约束|
|---|---|---|
|openSession|宿主签发的授权根引用→不透明sessionToken、能力/版本|真实权限由平台验证；初始化/I/O离开UI线程|
|submit|sessionToken、已编码UTF-8请求字节→taskRef/requestId|先校验消息大小；原字节透传gg_submit，不重排JSON|
|taskStatus / taskResult|有效taskRef→状态/有界结果或结构化error|GG_OK仅受理，终态才代表完成；Native buffer复制后由原分配方release|
|cancel|taskRef→取消请求受理状态|不推断终态；committing/已提交按原契约|
|subscribe / resync|会话、事件游标→有序事件/重查标记|有界缓冲，序号缺口、重建均要求权威查询|
|readProjection|已声明投影及ID/分页→投影、revision、schemaVersion|只读，受能力/授权根约束，不接受任意SQL或任意字段路径|
|platformAction|已注册文件选择/系统动作→受限能力引用|不可把绝对路径当通用授权；无任意shell/eval|
|closeSession|会话→释放结果/必要恢复信息|停止新请求，按原语义处理任务/释放，不能销毁并发使用的句柄|

实际binding采用schema生成TS类型及显式Rust FFI声明；新增C ABI函数必须单独改版，不在桥接层伪造已有函数。上述逻辑方法可组合既有poll/read_events/result/submit等C ABI调用，命名不要求一对一。

## 3. 请求、事务与重试

既有请求字段protocolVersion/requestId/op/projectId/expectedRevision/params原样使用，严格拒绝未知顶层/非法输入。提交前先固定完整UTF-8字节并保存requestId；同次重试复用同字节，同ID不同字节仍是幂等冲突。

revision/64位计数在JS保持十进制字符串，禁止Number转化。原生句柄只存在Rust内；sessionToken/taskRef是带代次校验的不透明标识，不能反推出地址。异常在C++/Rust边界转结构化错误，不能跨FFI展开。

领域写入走document.propose→document.validate→document.commit；草稿、提案、已校验、提交中、durable保存分开显示。expectedRevision冲突刷新投影并让上层明确处理，不自动强行覆盖。

超时/断连的写入结果为unknown时用request.lookup确认，不换ID盲重放。重连不承诺原taskRef仍有效；持久请求ID/项目revision用于恢复。只在durable=true后显示已保存，task failed/cancelled各有状态。

## 4. 状态投影

|投影|数据/归属|目前能力|
|---|---|---|
|project/document|projectId、documentId、versionId、revision、内容哈希及只读原因|复用M1 project.read/document.list/read|
|scene/entities|稳定entityId、parentId、transform、sprite引用、schema/revision|由M1 scene文档派生只读投影，不新增任意数据库查询|
|resources|assetId、contentHash、来源/许可、localOnly、ready、字节数|复用M1 asset接口；原始字节按分块/租约读取|
|selection/layout/draft|选区、面板展开、焦点、未提交草稿|UI会话所有；不能冒充已提交项目状态|
|workflow/map|图节点/端口/边、地图等及诊断|属于后续模块，能力未交接时UNSUPPORTED，不塞进extensions执行|
|render/hit-test|camera、viewport、实体/命中、渲染输入摘要|渲染模块后续只读投影；M1不因此获得渲染能力|
|runtime/step|种子、tick、输入、可控时钟、模拟摘要|预览模块测试能力；发布关闭可变控制，不是M1已实现功能|

投影以业务ID定位，不用数组下标。快照与事件带sourceRevision；过期投影不能写回覆盖。虚拟化列表按ID查找/滚动可达；树节点聚合状态与分页状态明确，不能用“DOM中未挂载”判定业务对象不存在。

## 5. 事件与任务

Host event封装hostSessionEpoch、递增eventSeq（十进制字符串）、core请求/任务引用、类型、revision及有限payload；原核心事件保留语义，宿主新增序号不改核心幂等键。新epoch使旧游标失效。

事件批次最多256条且≤1MiB，若Core更严取更小限制；慢消费者触发resync_required，不阻塞数据库提交。投影更新可以合并，提交终态必须可恢复查询。等待任务使用事件加有界状态查询、deadline和取消信号，不用固定sleep判断成功。

前端最多16个未结束领域任务，不突破Core队列32/2MiB消息/8MiB结果/1MiB分块4在途等现有限额。前端预算与核心拒绝分别报告，不无界重试。

## 6. UI语义与可测性端口

DOM优先role/label/name，testId稳定为组件用途加业务ID；国际化文案可变，业务ID不变。控件显式暴露可见/禁用/忙碌/校验错误，键盘焦点可追踪。自绘视口保留语义可查询的场景树和属性面板。

测试可查询坐标变换、命中实体、当前选区及真实渲染输入投影；可变预览seed/clock/step/input仅在测试构建+宿主授权后启用。操作仍进入真实输入/命令链路，直接命令测试不能替代至少一组真实点击/输入/拖拽链路。

UI测试的通过记录必须声明adapterKind/core build/前端 build/宿主/WebView/fixture/数据根；Mock不得标真实核心联测。对象状态正确不能证明最终像素、遮挡、字体、动画或设备性能。

## 7. 本机驱动协议与隔离

测试专用JSON Lines驱动以持久Core服务一段会话，每行包含driverProtocol、driverRequestId、method、params；驱动层标识不替代Core requestId。响应只输出stdout，诊断到stderr并脱敏。首个EW-T01锁定驱动Schema，未定义的方法拒绝，不接受代码文本或SQL。

浏览器适配代理由测试启动器按需建立：仅回环、随机端口、随机token、origin allowlist、有限消息/连接、临时项目授权根。前端不得获取token后扩权访问任意文件。每用例独立项目根；停止时等待/取消、释放buffer/task/Core、退出代理。发布包不含驱动插件、远程调试和测试授权；生产资源和帮助/外链不会复用测试origin。

## 8. 失败与演进

必须明确表示：core未就绪、版本不兼容、能力不支持、权限拒绝/撤销、网络代理断连、队列满、冲突、资源未ready、取消过晚、提交结果未知、恢复只读及WebView重建。错误保留稳定code、requestId/taskId和可恢复分类，用户提示与内部诊断分离，秘密不随错误输出。

可选字段/新投影通过能力协商演进；旧适配器不能理解的必需能力拒绝。协议不兼容升major；Core ABI/数据schema升级另起变更。当前接口是架构契约，无实现/运行证据。
