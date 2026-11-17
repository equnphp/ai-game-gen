# EditorUXPort 1.1：语言意图与兼容投影

版本：editor-web-v1-draft.4。Schema与TS是架构声明，未运行验证器或编译。旧[UX1.0](../draft.3/UX-CONTRACTS.md)、[Schema1.0](../draft.3/contracts/editor-ux.schema.json)保留原字节。

## 1. 显式协商与兼容范围

新版UI发送uxProtocol="1.1"的ux.describe，核对supportedUxProtocols、implementedMethods、locale资源/通道。只有声明实现1.1和ux.locale.select的宿主才允许真实语言保存。旧宿主不支持时显示组件版本不匹配/升级说明，不把JS mock或localStorage当作真实保存；默认安全英文不意味着新功能已交付。

1.0客户端继续使用原6方法和1.0闭合响应投影，不能收到localeState等新增字段。新版1.1保留原6方法的业务含义，扩充describe/snapshot/事件/错误及新增第7方法。请求/响应封装仍为uxProtocol、callId、method、params以及ok/result或error。协议识别先于未知字段校验，未知版本返回UNSUPPORTED_PROTOCOL，不能先执行再发现不兼容。

同一LocalUXService共享课程事实、语言文件和业务会话；1.0/1.1事件分别投影到独立有界环，游标命名空间=(serviceInstanceId,uxProtocol)，不可跨版本复用。每环256条、每次读最多100；gap按前版规则重读对应snapshot。1.0不含语言事件，旧profileRevision不因语言选择递增。

Core Host12方法、Core Driver14方法、C ABI1.0/消息1.0/DDL1不变。新语言协议不进入Core驱动。

## 2. 七个方法

|方法|1.1行为|
|---|---|
|ux.describe|原能力/硬限，增加supportedUxProtocols和locale描述；同一可信UI连接复用同一selectionChannelId|
|ux.snapshot|原ProfileSnapshot加必需localeState；guide revision与locale revision分开|
|ux.preferences.update|仍只更改教学提示偏好，不能借changes追加locale|
|ux.guide.intent|仍按真实正常回执判断课程，所有跳过/退出语义不变|
|ux.preferences.reset|仍仅课程记录/提示范围，不能清语言或布局|
|ux.events.read|1.1事件联合含GuideEvent/LocaleEvent，独立1.1游标|
|ux.locale.select|提交一个规范语言选择意图，accepted回执不等于committed|

describe.locale包含七项规范ID/本语言名称、defaultLocale=en、fallbackLocale=en、localeSchemaVersion=1、selectionChannelId、latestSelectionSeq及实际资源目录版本/摘要/具备资源的locale列表。描述目录版本/摘要可为null，资源列表可为空；这只表达实际资源接收状态，不让缺译变成已完成。七项规范集合必须与[locale-policy](contracts/locale-policy.json)一致，无重复ID；Schema结构检查不替代集合/权限/状态语义检查。

## 3. 语言选择参数与身份

ux.locale.select的params严格为：

- serviceInstanceId：当前宿主实例；重启必换。
- commandId：该次用户意图UUID。
- selectionChannelId：宿主为可信workspace/WebView代次分配的选择通道。
- selectionSeq：本通道单调u64字符串，首次新意图为"1"，不能使用JS浮点累计。
- locale：仅en / zh-Hans / zh-Hant / ja / ko / es / fr。

通道由受限Tauri传输或测试启动器的可信连接绑定，不接受网页借别的窗口通道代改顺序；关闭/重载回收，最多32个。通道不足报明确容量错误，不能驱逐仍活动通道或改项目。旧/非递增意图LOCALE_INTENT_STALE；未知或失配通道LOCALE_CHANNEL_INVALID。重试相同commandId与完全相同参数先查幂等记录，不能因seq相同误判为新旧冲突；同ID不同意图IDEMPOTENCY_CONFLICT。

全部UX共享最近128个意图回执窗口；出窗口/重启不能宣称无限去重，先snapshot/核对持久身份，用户主动重试才用新意图。前版课程请求的幂等/版本规则保持；语言没有expectedProfileRevision，不能被课程异步进度阻断。它以通道seq抵御同一UI乱序，以actor ticket定义跨窗口接受次序。

返回result为commandId、accepted=true、ticket、localeState。accepted仅表示被纳入顺序化处理，不能显示“Language saved”。同一locale可unchanged；存在其他在途选择时再次点原locale仍是新的有效选择，不能直接忽略。

## 4. localeState与持久化事实

localeState具有：

|字段|含义|
|---|---|
|storeSchemaVersion=1 / localeStoreId|语言文件版本/稳定存储实例UUID，无已知有效文件时实例可null|
|localeRevision|该store实例内已确认文件版本；未知/初始为"0"|
|effectiveLocale|当前真正应用的规范语言|
|persistedLocale|已核实有效已存值，无法确认或不存在为null|
|source|default或saved，英文安全回退不自动成为显式选择|
|status|reading / idle / saving / failed / reconciling / read_only|
|availability|new / loaded / read_only / corrupt / future_schema / memory_only|
|latestAcceptedTicket|当前服务epoch最新接受意图顺序号|
|pending|最新待提交commandId/ticket/locale或null|
|lastOutcome|已观察意图终态/未知，带原服务实例与commandId/ticket|
|lastError|稳定错误码或null，无路径/Key/项目内容|

LocaleOutcome.outcome为committed / unchanged / superseded / failed / unknown；failed不得显示保存成功。未知进入reconciling，需核对实际文件；不依据超时断言没有写入。localeRevision仅在已确认文件提交后递增；损坏文件显式修复新建时换localeStoreId，避免把新文件revision误当旧序列。服务重启的ticket从新epoch重新解释，最后提交身份须保存原服务实例/commandId，不能混用同数字ticket。

effective只在已确认持久化后更新；pending可与旧effective同时存在。UI必须分别显示选中有效值、候选与保存状态。单写actor最多1写入工作、1最新待处理意图，在提交闸门排除被替代旧意图。A已实际提交后才接收B，B失败保留核实的A；这不是让迟到A响应覆盖B成功。跨窗口使用权威ticket/存储版本，发起窗口另过滤本地过期选择响应。详见[并发与恢复](LOCALIZATION.md)。

Guide的MutationReceipt.appliedInSession=true与profile持久化规则不变，不能用它给语言选择报成功。prefs.reset/replay不影响localeStoreId/revision或文件。

## 5. 事件、错误与容量

1.1的GuideEvent保留前版字段；LocaleEvent包含seq、kind、localeState、可空commandId/ticket。kind为locale.pending / locale.committed / locale.failed / locale.superseded / locale.reconciled。事件反映实际状态变化，丢事件/gap后重读snapshot；lang切换本身不伪造Core/模型/构建事件。

Error沿用前版代码并增加UNSUPPORTED_LOCALE、LOCALE_CHANNEL_INVALID、LOCALE_INTENT_STALE、LOCALE_STORAGE_FAILED、LOCALE_READ_ONLY、LOCALE_RESULT_UNKNOWN、LOCALE_REVISION_EXHAUSTED；可带localeState安全快照。容量用PROFILE_LIMIT配具体本地化messageKey说明是哪项达到限制。Error.retryable不是自动重放授权。

|新增/继承硬限|值|
|---|---:|
|语言配置文件|8KiB|
|并行语言写入工作 / 最新待处理选择|1 / 1|
|活动选择通道|32|
|共享UX意图回执窗口|128|
|UX请求/响应|64KiB / 512KiB|
|每协议事件环/单次读|256 / 100|

课程profile256KiB/journal8MiB及其他前版限制不变。容量预检在接受副作用前完成，超限拒绝并保留现有状态；不静默截断/清除记录。语言设置读取失败/未来版本保护与普通写失败分别表达，不让英文回退抹掉原件。

## 6. 测试与生产适配

生产继续受限Tauri invoke，UI/宿主/资源作为兼容组合交接；不新增生产HTTP或云语言服务。可选测试proxy1.1的/ux-rpc端点复用，启动回执另声明支持的UX协议含1.1；旧代理仅UX1.0时不能默认接受1.1，也不能自动mock冒充成功。Core /rpc和Driver14语义保持。

测试fixture语言文件与教程profile、项目根各自隔离，由私有启动配置固定；网页不能传任意文件路径。真实自测可通过语言snapshot和DOM语义核对；持久化、平台输入、字体/翻译正确性、布局与最终设备须有各自真实证据。当前没有执行这些操作。
