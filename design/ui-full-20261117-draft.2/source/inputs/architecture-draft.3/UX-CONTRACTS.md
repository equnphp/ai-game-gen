# EditorUXPort 1.0：设备偏好与课程编排契约

版本：editor-web-v1-draft.3。本文及 [Schema](contracts/editor-ux.schema.json)、[TS声明](contracts/editor-ux.d.ts)是接口设计；没有运行Schema验证器、tsc或宿主。Core HostPort1.0的12方法、Core Driver1.0的14方法保持第二版字节不变。

## 1. 归属与入口

LocalUXService运行于Rust本机宿主，通过单独EditorUXPort提供服务。同一OS用户/应用profile只有一个写入者；Tauri多窗口、移动WebView重建和测试页面绑定到该服务。项目规则、事务、工作流和引擎运行仍由C++及其正常应用入口负责。课程开始不等于创建练习，更不授权模型或工具调用。

生产端由Tauri受限invoke映射；服务从可信传输上下文取得workspace身份和正常编辑会话，不接受网页自报任意路径、Core句柄或项目绑定。活动窗口切换经宿主会话协调器更新；旧窗口不能用旧run操作新窗口的课程。浏览器测试端见第7节。

协议请求字段为uxProtocol="1.0"、callId、method、params；响应回显uxProtocol、callId、method，并仅带ok=true/result或ok=false/error。对象均关闭额外字段。callId是单次传输关联，commandId是有副作用意图的幂等身份；两者不替代Core request_id。UUID与U64编码沿用第二版：64位非负计数使用十进制字符串，不能在JS number中累加。

## 2. 六个公开方法

|方法|参数|结果/效果|
|---|---|---|
|ux.describe|空对象|服务实例UUID、协议/配置schema版本、适配器类型、课程能力、目录摘要及全部硬限|
|ux.snapshot|serviceInstanceId|本机profile完整只读快照及当前活动run|
|ux.preferences.update|serviceInstanceId、commandId、expectedProfileRevision、changes|更改autoHints、showLearningProgress或一个hintSuppression；至少一个变更，不接受项目字段|
|ux.guide.intent|serviceInstanceId、commandId、guideId、guideVersion、expectedGuideRevision、action|受约束的课程意图，结果含当前profile|
|ux.preferences.reset|serviceInstanceId、commandId、expectedProfileRevision、scope、resetHintPreferences|只重置一个课程或全部课程记录；是否同时重置提示开关必须显式给出|
|ux.events.read|serviceInstanceId、afterSeq、limit|nextSeq、gap和最多100个本机UX事件|

ux.describe的adapterKind只可为tauri-local、browser-real-local、mock，必须如实显示。当前课程为guide.basics / onboarding-20261117-draft.1，步骤G01—G06。availableGuides中的available表示本机课程说明可打开；缺Graph、Runtime等按missingCapabilities及每步blocked表达，不意味着所有实操能力可用。guideCatalogHash只在实际接收课程资源目录后给真实摘要；null不能当成接收通过。本版没有提供已运行课程包。

ux.guide.intent的action严格为：

- welcome.dismiss、start、resume、replay：只带kind。
- select_step、acknowledge、skip_step：kind、runId、stepId。
- end：kind、runId。

不提供mark_completed、任意setStatus、任意项目patch或自动发送模型的方法。acknowledge只能记“已了解”，操作完成只能由宿主私有ActionReceiptObserver取得正常Core/Preview回执后推进。G01仅已了解；G02支持合法外观编辑实际生效的正常回执，不强迫在G05之前持久化；G03必须durable；G04本地例子已了解，可选真实发送并合法采用才完成；G05必须当前合法变更durable且实际进入同一固定快照试玩；G06必须真实退出试玩。详见[步骤证据](ONBOARDING.md)。

start只建立/接管课程UI会话；练习/已有项目选择通过正常项目操作另行确认并私有绑定，不能由start隐式造项目。resume使用原课程进度；replay明确新run并重置该课程步骤，保留原项目、草稿和布局。select_step改变学习焦点，不提交业务修改。skip_step、end、welcome.dismiss不附加二次确认，也不取消业务任务。welcome.dismiss仅处理尚未处理的欢迎；已有活动run时不能借它结束别人正在进行的课程。

## 3. 版本、冲突与幂等

serviceInstanceId每次服务进程重建重新生成。除describe外都必须匹配；不匹配返回SERVICE_RESTARTED，客户端重新describe和snapshot，丢弃旧事件游标，不能自动重发项目/工具动作。workspace重建保留profile但不复用旧run/临时任务句柄；继续需重新核对对象和原任务身份。

profileRevision是服务内有效状态版本，任何课程或偏好变化均递增；persistedRevision是已持久化版本，两者独立。preferences.update/reset必须精确CAS expectedProfileRevision。课程意图使用每个guideId+guideVersion的guideRevision，隔离其他提示开关变化。未存在的课程视为revision "0"，第一次建立后单调递增；reset保留版本墓碑和空进度，不能把revision重置为0而产生旧请求重新命中。达到u64上限停止写入并要求兼容迁移，不回绕。

start/resume/replay/select_step/acknowledge/skip_step必须匹配课程版本；步骤动作还要匹配当前run和当前step。CAS失败返回GUIDE_CONFLICT及可用快照，不把旧按钮套到下一步。end对相同当前run是单调退出，可容忍课程revision落后，但不能结束后来创建的run；welcome.dismiss仅将欢迎处理标志置真，重复无害。完成状态不被迟到回执降级；只有用户显式replay/reset才开启新一轮学习。

相同commandId在最近128个命令回执窗口内绑定同一规范化意图，包括预期版本；更换callId不改变意图。完全相同意图返回原处理身份和当前可读状态；同ID不同意图报IDEMPOTENCY_CONFLICT。超出有界回执窗口、进程重启或结果未知时，先读快照并核对run/lastIntentId，不盲目重放start/replay/reset。创建练习的持久journal与Core请求查询另行负责，不能依靠这128个UX回执实现项目幂等。正常业务效果已经durable但学习记录丢失时，显示“学习记录未记住”，不能自动再做一次业务操作。

reset只结束匹配范围的课程UI会话并重置学习记录；重置提示时恢复autoHints/showLearningProgress默认值并清空对应抑制项。welcomeHandled保持已处理，不能因此再次强制欢迎。未匹配课程的活动run不变。无论reset范围如何，项目、历史、选择、模型Key、布局和在途业务任务不变。

## 4. 快照与落盘

ProfileSnapshot含serviceInstanceId、profileSchemaVersion=1、profileRevision、persistedRevision、persistenceState、availability、lastWriteError、welcomeHandled、preferences、courses、activeRun。所有实际字段以Schema为准：

- 课程status：not_started / in_progress / skipped / ended / completed。
- 步骤status：not_started / active / completed / acknowledged / skipped / blocked。
- persistenceState：clean / pending / failed；availability：new / loaded / read_only / corrupt / future_schema / memory_only。
- CourseRecord绑定稳定projectId/entityId/creationIntentId或null，不能存临时Core handle、绝对路径、聊天内容或资源字节。proofRefs是宿主不透明本机证据引用，不是客户端提交的完成证书。
- activeRun包含独立runId、workspaceId、当前step及running/suspended；服务重启的恢复不假定旧run仍运行。

提交UX状态前先序列化计算profile/响应预算，超限时拒绝该次状态变更，保持原状态；不能先产生超限内存快照再承诺稍后存储。普通磁盘写失败与容量预检失败分开。

修改响应的appliedInSession=true表示本次意图在当前内存状态生效；ok不等于已落盘。UI用persistedRevision与对应profileRevision判断是否记住；pending/failed必须显示真实状态。profile.persisted只在实际原子持久化成功后发送，profile.write_failed说明失败版本；失败不得显示“进度已保存”。教程操作完成的回执与学习进度持久化失败可以同时存在，概览分别表述。

未知未来配置schema保留原文件并只读/内存运行，不静默重写；损坏文件隔离保留并给出恢复入口。只读环境仍允许退出教学覆盖层、查看帮助或在显著标记的内存会话中学习，不得承诺下次启动记住。具体临时文件、同步、替换、备份与练习journal见[本机存储](ONBOARDING.md)。

## 5. 事件、容量与错误

事件是重读快照的提示，不是唯一事实源。seq在serviceInstanceId内单调递增；afterSeq为"0"从当前保留环头读取，nextSeq为本批消费位置；空批保持当前位置。游标落后环头或异常超前时gap=true，客户端重新snapshot并从返回的当前游标恢复。读取不弹出事件，不占用Core事件环。事件只含状态类别/稳定引用/版本/错误码，不含项目内容、Key或路径。

|硬限|值|超限行为|
|---|---:|---|
|profile文件|256 KiB|拒绝继续持久化并告知PROFILE_LIMIT；不静默淘汰进度|
|课程版本记录（含墓碑）/每课步骤|32 / 64|停止新增记录，提供用户主动清理/兼容迁移|
|单功能提示抑制|512|拒绝新增，已有设置不变|
|练习创建journal / 元数据记录 / 在途创建|8 MiB / 128 / 1|不开始新创建，核对原任务或主动清理已终结元数据|
|UX命令回执|128|仅有界幂等窗口，项目效果另有Core/journal身份|
|UX请求 / 响应|64 KiB / 512 KiB|超限拒绝，不截断成伪成功|
|UX事件环 / 单次读取|256 / 100|gap后重读，不能把256作为读取limit|

Error.code枚举见Schema；messageKey为本地化稳定键，retryable仅表示该类错误是否允许重新发起，不授权自动重放。Error.snapshot可附当前安全状态。冲突返回PROFILE_CONFLICT/GUIDE_CONFLICT；能力不足MISSING_CAPABILITY/COURSE_UNAVAILABLE；run/step非法、权限、读写失败分别有独立码。错误文本、诊断、mock输出均不得携带模型Key或原项目内容。

## 6. 不依赖识图的UI观察面

DOM角色/可访问名用于操作；data-surface-id、稳定field/action/step ID定位当前语义目标。引擎视口/图节点提供真实对象与选区投影，绝不因教程需要把业务规则复制到JS。语义注册表读取实际可见/可操作状态；目标缺失、面板未展开、离屏、被键盘遮挡时标blocked并提供打开正常工具/跳过，不能伪造命中。

测试可以经UX snapshot核对课程状态，经Core查询核对业务事实；不能调用私有observer注入“完成”。mock用于表现层例子，结果带mock身份；只有实际操作与真实Core/Preview回执才构成相应联测证据。结构化断言不能证明像素、触摸设备或游戏产物通过。

## 7. 浏览器真实UX测试宿主扩展

后续测试专用editor-test-host用同一Rust CoreSessionManager和LocalUXService。Core部分仍遵守Driver1.0的14方法；既有Core /rpc内容与行为保持不变。旧阻塞C++ CLI不能充当这个宿主，也不把UX envelope发送给Core Driver。

测试loopback代理可选proxyVersion=1.1，新增POST /ux-rpc直接承载上述UXRequest/Response。沿用第二版仅loopback绑定、随机Bearer、受限Origin、固定fixture与大小限制；UX另有64 KiB/512 KiB硬限。启动回执声明editor.ux能力、proxy版本与适配器身份，UX describe再核对协议。1.0代理不支持时显示unsupported，禁止自动降级为mock并继续标真实测试通过。

fixture profile根与fixture project根分开，由测试启动器私有配置；UI不得提交任意profile路径。宿主传输会话绑定固定workspace/Core连接，正常Core动作由同一调度器观察回执，防止两套Core实例各自宣称同一次操作。外部14方法驱动仍可独立用于Core基础测试，但不能给另一UX进程提供未经关联的完成证明。

生产Tauri安装包不启动测试HTTP监听、不带测试密钥或任意状态注入端点。本版只定义接口；实现、构建、启动及自动化执行另行记录。execution_status=not_run、quality_verified=false、release_permitted=false。
