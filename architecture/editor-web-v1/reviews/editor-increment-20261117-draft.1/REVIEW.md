# 首个编辑器增量的架构源码接收补充

版本：editor-increment-source-review-20261117-draft.1；基线editor-web-v1-draft.4。本文只记录手工阅读源码和官方直接依赖元数据的结论；不修改实现、根M1清单或冻结契约，不是系统性质量扫描、编译、运行或真实人员批准。

## 1. 范围结论

editor/web、editor/host-contract、editor/hosts/tauri和editor/docs作为独立编辑器项目范围可以继续采用。宿主位于editor内不改变其依赖方向：React → Host/UX port → Rust会话/设备编排 → 纯C ABI → C++领域权威；不能因目录独立而复制项目/事务/工作流规则。当前源码以Windows宿主为首个接入面，Android的SO/DT_NEEDED/JNI系统端口仍是后续接入，不由同一Rust源码自动证明Android Core可用。

四份复制的Host1.0/UX1.1 TS/Schema与冻结源字节一致。Core12方法/单会话、结果单槽与上限、DLL受控目录/符号/ABI版本/进程驻留等在源码中有对应结构；这只是边界符合性观察，未证明FFI调用、DLL制品、平台锁/原子替换或关闭恢复实际正确。

**允许首增量只声明UX1.1的describe/snapshot/locale.select/events.read四个方法。** implementedMethods与supportedUxProtocols反映实际实现，不能因引用完整七方法类型而报告七方法已完成。旧UX1.0没有实现时声明仅1.1是当前有界接入；将来提供1.0时必须遵守原闭合投影，不能把1.1字段塞进去。未实现的课程方法返回能力不足，空课程列表/guideCatalogHash=null、学习profile memory_only不能标成已保存进度。

当前81键七语目录声明completeProductCoverage=false、translationReview=draft_not_human_reviewed，这个范围声明应保留。它仅覆盖本增量已实现界面文字，不能代表213操作面/88状态/28组合或完整引导已翻译。UI实际七语画稿/翻译审阅和真实环境仍由各角色接收。模型/Runtime/导出/LAN/课程能力未实现时保留不可用原因。

## 2. 当前需要写回的契约点

以下结论绑定[源码观察](inputs/source-observation.json)及对应冻结源码，均为代码路径推断，execution_status=not_run；没有实际复现或测试通过记录。

### AR-INC-01 / P2：提交前拒绝应明确not_submitted

位置：editor/hosts/tauri/src/wire.rs的Fault::new；lib.rs的permit/core_dispatch；core.rs的core.submit/upload.write/blob.read提交前校验；editor/web/src/core-client.ts的submit异常分类。

当前普通Fault默认outcome=not_applicable。队列满、会话不可用或本机提交前参数拒绝即使没有调用gg_submit/二进制ABI，也可能带此值返回；CoreClient只把not_submitted视为确定未受理，其余包装为RESULT_UNKNOWN。结果是确定被宿主拒绝的提交进入未知恢复，session.state中没有originCallId任务，lookup也可能永远not_found。

要求：在提交类调用中按实际受理边界明确outcome。尚未调用原生提交、或ABI明确拒绝时为not_submitted；原生已可能受理但回复/执行边界不明时为submitted_unknown；只读状态/取消/释放等非提交语义用not_applicable。不要把所有异常统一改为not_submitted。permit/大小/参数/CLOSING等提前出口也要覆盖。修正由宿主coding负责，不需改冻结Schema或项目领域规则。

技术接收：确定提交前拒绝不进入假未知；可能受理的异常仍保留原call/request/字节并核对，不能自动换ID重放。

### AR-INC-02 / P2：异常超前的UX事件游标必须能恢复

位置：editor/hosts/tauri/src/locale.rs的ux.events.read分支，当前157—159行。

afterSeq大于实际d.seq时gap=true，但空批nextSeq仍回显afterSeq。调用方按UX契约在gap后重读snapshot并使用返回游标，会保留同一个不可能的未来位置，后续真实事件也持续被过滤。

要求：在合法但超前的游标恢复分支返回真实当前可继续位置（例如当前尾序列），并明确gap；保留正常批次最后消费位置和空批正常游标规则。不得仅清除gap而保留错误位置，不把新游标写到另一协议/服务epoch。UX1.1当前仅一个投影也应满足所声明的events.read行为。

技术接收：游标超前后能够重新订阅之后的真实事件，且不会声称原缺口已完整回放；无需新增公开方法或修改Core事件。

### AR-INC-03 / P2：语言提交成功反馈尚未在选择面板呈现

位置：editor/web/src/components.tsx的LanguagePicker状态区，当前40—45行；catalogue.json的现有键清单。

当前面板展示saving/failed/reconciling/read_only，提交后的idle/committed或unchanged没有对应成功提示；产品LANGUAGE-SETTINGS.md要求成功后用新选择语言给短提示。有效勾选改变不能替代该明确的成功/无障碍反馈。

要求：依据真实已提交/unchanged收据、当前服务/意图身份提供一次成功反馈，使用新语言资源键；accepted不能触发成功，旧意图不能迟到弹错提示。已选相同语言不产生额外文件副作用。具体视觉/文案按产品/UI接收，不由架构代签。

## 3. 并行开发中已变化的观察

初次阅读后，程序员持续写回；本轮重新读过现行core-client.ts、App.tsx及localization.tsx，以下不再列为当前未解决项：

- wait以received（业务结果取回并解析）决定task.release；结果取回失败保留原任务/字节，清理失败不逆转已知业务收据。
- confirm返回真实CoreResult，项目尚未投影时可用已核实projectId恢复读取，不只清未知标志。
- LocaleProvider加入ticket、store身份/localeRevision和同ticket终态的过滤，避免已提交/失败状态被迟到accepted退回saving。

这里只确认文本修正存在，不能写为“恢复测试通过”。相关反例仍应进入coding基础自测文案和独立quality系统文案，执行仍需用户真实会话授权。后续SERVICE_RESTARTED需重新协商的完整流程仍按第四版约束接续；清描述本身不等于已完成重新连接。

## 4. 依赖与开发接续

[兼容补充](COMPATIBILITY-ADDENDUM.md)记录官方tag和注册表的直接元数据。tauri-build2.7.4与tauri2.12.5的同tag对应关系可成立；附加Rust包可继续作为C1候选直接声明。没有生成Cargo.lock/package-lock、安装或完整解析，不能标selected/verified。

程序员报告本机Node24.18.0/npm11.16.0与候选Node24.22.3/npm11.19.1不同；本轮未执行版本命令，仅将其记作开发侧报告。C1固定值不因此被实机旧值替代。实际Rust/MSVC/SDK/LLVM-MinGW/Core制品/资源组合及免费使用条件仍按前版接收。

本补充不改implementation文件。接续顺序：实现者修正AR-INC-01—03并保留小增量回退 → 逐项写回源码/文档摘要 → coding基础与独立quality计划各自登记not_run → 在实际授权后另记构建/基础/系统验证；不能把本接收文档当运行或发布批准。

状态：source_scope_fit=conditional；implementation_status=source_written_not_built（开发侧报告，未由本轮构建核实）；quality_verified=false；release_permitted=false；真实人员整版reviews=[]。
