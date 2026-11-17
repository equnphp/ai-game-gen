# 编辑器首增量详细架构与交接

版本：editor-increment.1-architecture.draft.1；2026-11-17；实际项目根I:/code/GameGen/editor。本文承接上级editor-web-v1-draft.4，补齐本独立根的技术材料；源码已由开发侧写入，编译/运行未验证。产品正式增量规格和真实版本接收尚缺，不将补文档追记成已完成的前序审批。

## 需求与约束

当前迭代ITER-EDITOR-INCREMENT-1，范围为Windows首宿主、项目/Scene/属性/任务/资源的常规闭环，以及七语本机选择。LC-REQ-01/02/03/04/07只覆盖本增量实际入口；LANG-REQ-01—03的当前文字子集承接LANG-AC-01—09，不把82键草稿当全213操作面已支持七语。Core父需求/规则、语言产品包和上级架构的字节与版本见[UPSTREAM-RECEIPT.json](UPSTREAM-RECEIPT.json)。

当前技术规则已提供，正式产品范围规格/.product-mcp.json及上游真实接收仍待产品角色补齐。所有代码归属engineering。保留C++20核心共享Windows/Android的长期决定，当前Android Core/Tauri宿主接入未完成，不能用窄窗CSS证明Android可用。云端继续暂缓；图VM/Agent/完整引导/Driver14代理/四游戏目标和三Reader/LAN等不纳入本增量完成声明，完整产品范围由上级包保留。

## 架构形态与部署

采用本机模块化单体：React/TypeScript DOM与SVG → 受限Tauri IPC → Rust Host/LocalUX → 纯C ABI Core DLL。UI、宿主、随包资源和Core制品作为兼容组合接收。无生产HTTP/LAN监听、新云服务或微服务。独立editor路径方便接收和回退，不改变领域权威归属。

Windows Rust使用MSVC target，受控目录动态加载原LLVM-MinGW生产的纯C ABI DLL；不跨C++ ABI/导入库混链接。DLL进程驻留，借用输入只在调用期有效，输出复制后由原DLL释放。没有实际DLL/SDK/MSVC/WebView/完整锁/构建回执时仅source_written_not_built，不能填已测buildId。

## 模块与依赖

|模块/项目内路径|责任与边界|
|---|---|
|web/|React表现、合法草稿、视图/选区/输入与读取投影；不拥有第二套项目事务规则|
|host-contract/|冻结Host1.0与UX1.1类型/Schema和薄Tauri适配；字节编解码不改原Core请求|
|hosts/tauri/src/core.rs、ffi.rs|唯一CoreSessionManager、任务/token映射、原生buffer租约/单槽/关闭生命周期|
|hosts/tauri/src/locale.rs|LocalPreferencesActor，设备语言文件、单写、seq/ticket/真实落盘；教学未实现不冒报|
|web/src/localization.tsx、components.tsx|统一LanguagePicker、离线目录、保持业务组件的标签刷新与真实收据通知|
|docs/及各角色清单|已收到的规格、基础/系统文案和未执行记录；角色各自单写，不代填审批|

前端依赖Host/UX端口，Rust领域操作依赖C ABI，C++不反向依赖React/Tauri/Rust UI类型。平台目录/加载器属于薄端口。必要依赖无强制付费路线；C1附加直接元数据见inputs/upstream/review/dependency-metadata.json，selected=false/verified=false，精确直接声明不代替完整传递锁。

## 前后端接口契约

Host1.0公开12方法：host.describe、session.open/state/close、core.submit、upload.write、blob.read、task.status/result/cancel/release、events.read。规范封装、UUIDv4、十进制u64字符串、规范Base64与闭合字段沿host-contract/host.schema.json及已受领CONTRACT.md，不新增Core op。

每宿主当前最多1活Core会话，随机代次token绑定可信main窗口；原Core授权根由宿主提供，不接受UI任意磁盘路径。32任务槽/前端16在途调用；Core JSON≤2MiB，块≤1MiB，宿主一个结果槽、JSON+binary解码总额≤8MiB，线编码≤16MiB；事件环256、单次读取≤100。拿到终态不等于结果已取回；仅实际取回并处理后释放，清理失败不逆转已知业务收据。

提交类错误outcome按实际原生受理边界区分not_submitted/submitted_unknown，读取等用not_applicable；未知保留原call/request/字节先查任务或request.lookup。取消请求不是最终取消。close进入CLOSING后拒绝新写，允许收据读取和后续close；超时保留CLOSING，drain/cancel、项目关闭、释放任务及destroy有序，不热卸DLL。

UX1.1本增量只声明ux.describe、ux.snapshot、ux.locale.select、ux.events.read四方法。完整1.1有七方法不代表当前全实现；supportedUxProtocols只含真实支持版本，旧1.0/课程未实现不声明。UX事件游标异常超前返回gap和真实尾位置，随后重读snapshot；不把UX游标混入Core事件。精确参数仍按host-contract/editor-ux.schema.json与受领UX-CONTRACTS.md。

AR-INC-01/02/03已按现行源码复核到对应修正，状态source_correction_reviewed_not_executed，见[WRITEBACK-REVIEW.json](WRITEBACK-REVIEW.json)；历史核对件保留，不以文本修正伪造实测关闭。

## 数据设计与迁移

Core仍是项目、文档、revision、资源、历史的唯一权威；ABI1.0/消息1.0/DDL1不变。本增量不迁移或降级写原M1库。UI数值/IME草稿与durable文档分开，正常提案→校验→提交；revision冲突保留草稿。自动保存触发不代表已保存，只有Core durable确认后显示成功。

语言在宿主私有editor-profile/editor-locale-v1.json，schema1、≤8KiB、localeStoreId/localeRevision与Core及学习进度分开。本机每profile一个写者；最多1写工作/1最新待存意图、32通道、128意图回执；临时文件同步/原子替换/有界上一副本，损坏保留证据，未来schema不强写。结果不明核对文件；成功持久化后应用，失败保留旧有效值，英文安全回退不自动覆盖配置。项目/LAN/游戏/云/遥测不带语言偏好。

首启有效显式本机选择优先，其次en，系统/项目/账号不覆盖。七规范ID为en/zh-Hans/zh-Hant/ja/ko/es/fr；简繁独立，逐键英文回退不重置选择。accepted、committed和effective分开；通道seq、actor ticket和同ticket的store/revision/终态过滤迟到。通知只为本窗口最新service/command/ticket的真实成功触发一次。

## UI技术路线与边界

按受领UI draft.2 tokens/浅色构图和最新七语产品规则编写当前入口；所有普通控件用语义DOM，Scene是现有结构的投影，不等于游戏Runtime/试玩。语言切换不以locale重挂根组件，不重开Core、丢草稿/视口/选区/撤销历史、任务或重发业务；已有聊天/用户项目/第三方原文/游戏语言不改写。

editor/.design-mcp.json的33个当前场景仍是planning，最终参考画稿/状态、七语、字体、资源摘要和真实接收未闭合。UI消息报告draft.2 SVG改中文文件名；本轮没有遍历/渲染画稿，最终索引与摘要由UI绑定，不能由文件名变更推定七语画稿已完成。首增量的欢迎卡/跳过不等于完整GUIDE已交付。

计划接收环境Windows11 x64、1440×960/100%和390×844窄窗，实际OS/WebView/字体/构建待填；Android390×844/844×390仅后续计划，不视为现阶段原生通过。固定SUR/field/action/对象身份用于DOM与投影定位，标签可随语言变更；不要求以识图完成常规功能观察，视觉/设备验收仍独立。

## 扩展能力与触发条件

|维度|当前/暂缓|依据、代价与量化触发|
|---|---|---|
|可扩展|now：版本端口/共享权威/能力声明；未来平台与完整模块defer|出现1项不兼容字段/身份变化即升版交接；代价为类型/资源/宿主投影维护，不借此复制领域|
|本机可恢复|now：原请求、收据、单写和原子文件；云HA defer|已确认durable提交丢失≥1次即停止该组合放行并保留故障证据；目标0，尚未测得，不承诺损坏自动修复RTO|
|高负载|now：前述硬限与明确拒绝；海量优化defer|32任务/1结果槽/文件预算达到上限即背压或拒绝，不静默丢结果；先测实际瓶颈再改预算，不拆微服务|
|并发|now：单会话/唯一写者、通道seq/ticket与CAS；多人同编defer|旧意图覆盖较新已保存值≥1次即停止该组合接收并修正排序；同一项目第二写者拒绝，队列不无界扩张|

这些是设计阈值，不是本轮测得能力。架构承担阈值与演进，编码承担相应基础文案，独立quality负责系统性方案。

## 安全威胁与控制

威胁面包括不可信UI/工程数据、路径越界、过期代次、重复/未知提交、恶意二进制/资源、动态库替换和受限内容出站。控制包括固定受限IPC/main能力、授权根/路径与Schema校验、有界规范字节、受控DLL/摘要/符号/ABI接收、原分配器租约释放、CSP与不执行项目脚本。

localOnly覆盖项目及派生报告/索引/缩略图/摘要；当前增量不因切语言调用模型、下载翻译或收费，Key不进DOM/项目/日志。任意同用户本机恶意代码不被本库隔离；源码中存在控制不能当安全验证结论。依赖实际LICENSE/NOTICE/传递图、平台授权资格和制品摘要待接收。

## 运维与恢复职责

本机包/资源/依赖维护由平台coding承担，真实维护人待登记；项目恢复沿Core事务文档，语言恢复沿独立文件/原提交身份，不自动重放未知写入。异常DLL/版本/权限/存储不明时保留原数据与诊断，禁用对应能力，不静默换mock或云路径。

业务数据回退不强行降级库：回退匹配的editor UI/宿主/Core资源组合并保留原项目/偏好副本。版本升级前保留兼容制品、Schema与恢复入口；损坏修复或断电恢复未演练，无在线SLA/值班/多副本部署。源码提交推送由程序员按其实际用户授权处理；本文不操作Git，也不把源码提交等同应用发布验收。

## 敏捷增量与回退

WIP1主要增量、最多2待集成。EW-I1（Host/FFI/会话/任务）→EW-I2（项目/Scene/资源常规入口）→EW-I3（语言持久化/标签/真实反馈）→EW-I4（接收闭合与后续真实验证，执行另授权）。前三项当前source_written_not_built；AR三项写回仅源码复核。每项按兼容组合回退，保留原任务/原件，不把教程/语言重置作为项目回滚。

独立[CODING-HANDOFF.json](CODING-HANDOFF.json)给出约束/依赖与源码状态；[WORKFLOW-INTEGRATION.json](WORKFLOW-INTEGRATION.json)只给流程所有者待合入字段/摘要，不修改其正在维护的.workflow/.coding/.design/.quality清单。

## 验证方案与风险

基础17项、独立系统8类和design planning文案由原角色维护，全部not_run；本架构不重复编造系统用例或报告。技术接收目标：假成功/未知重放/未授权出站/旧意图覆盖=0；核心平台UI类型入侵=0；字节/槽/文件硬限满足；普通Core固定fixture目标open p95≤2s、普通commit p95≤200ms、poll/入队p95≤10ms、可取消阶段≤1s，均继承计划、尚无执行证据。

主要风险为完整依赖锁与原生制品未接收、首次链接/类型正确性未知、七语资源/字体/实际布局未审、未知恢复全路径未运行以及正式产品/UI输入和角色接收未闭合。基础B-EW-17当前REQ02/AC07归属与产品AC07的REQ03存在追溯口径待对齐，由coding/产品修正，不在此代改。

正式ready_for_coding=false、reviews=[]；这表示整版文档/接收未闭合，不否认已真实授权的源码开发。本轮只补架构材料和源级复核，execution_status=not_run、quality_verified=false、release_permitted=false。
