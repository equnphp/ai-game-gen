# editor-web 第三版：承接产品新增交互与可跳过引导

版本：editor-web-v1-draft.3；2026-11-17。用户本轮指出“产品经理增加了新需求”；已实际读取“产品经理”会话最新交付和三份独立产品包。本文只交架构，不修改产品规格、画稿、实现或M1根清单，不授予自动化/发布权限。

## 1. 接收事实与范围

|产品包|实际输入|架构承接|
|---|---|---|
|onboarding-20261117-draft.1|4个GUIDE-REQ、12个GUIDE-AC、G01—06、6个GUIDE-VIEW、12类共享状态|[引导架构](ONBOARDING.md)、独立本机UX/偏好服务|
|chat-states-20261117-draft.1|12组88个原子状态（85 L、3 R）、28个组合（27 L、1 R）|[对话与编辑状态](EDITOR-STATE.md)，多轴状态投影而非单一loading|
|full-ui-details-20261117-draft.1|213操作面（199 L/13 R/1 F）、1195字段组/538子控件、485动作、522领域状态、24共享交互、23旅程|完整范围映射、渐进展示、操作效果分类、草稿/保存/试玩与空间语义|

以上是产品文档中的操作面/状态定义，不是新增同数量顶层页面、OpenCode内部状态码或已实现画板。输入已按实际字节冻结于inputs/product/，摘要见[产品基线](inputs/product-baselines.json)，会话来源见[真实消息](inputs/product-conversation.json)。真实人员整版审阅在源文件仍pending，不能凭聊天或文档工具代签。

## 2. 对既有架构的决定

React/TypeScript、Tauri 2、Rust薄宿主、C++20共享项目/领域权威继续。新增 **LocalUXService（引导与设备偏好）**、**ChatReadModel**、**EditorActionCoordinator** 和 **语义目标注册表**。这些服务同源用于Windows/Android，不复制工作流、物理、事务等游戏领域规则。

- LocalUXService是Rust宿主中的本地UX编排/偏好模块；不是把游戏领域迁到Rust。课程/步骤进度不进入项目SQLite、LAN、工程包、游戏包或自动遥测。
- ChatReadModel消费Agent/Core/工具/资源/费用来源的真实独立事件。回复流结束、工具完成、候选生成、提案可用、durable保存、游戏实际运行分别表达。
- ActionCoordinator复用正常命令入口，为手改/Agent/教程提供相同授权、提案、冲突、任务和保存栅栏；教程不取得特殊写项目权限。
- SemanticTargetRegistry以SUR-ID、字段/动作ID、业务对象ID定位DOM与视口投影，不按中文文案或屏幕像素找目标。

## 3. 契约隔离

[第二版精确HostPort/Driver/FFI](../draft.2/ARCHITECTURE.md)原样保留：HostPort1.0的12方法、Core Driver1.0的14方法及其Schema/TS均不修改。课程偏好不是Core op，不给原消息1.0添加未声明字段。

新增可选 **EditorUXPort1.0**，见[UX-CONTRACTS.md](UX-CONTRACTS.md)、[UX Schema](contracts/editor-ux.schema.json)、[TS声明](contracts/editor-ux.d.ts)。宿主必须单独声明该能力；旧Core driver不因支持Core12/14方法便被视为支持UX。浏览器真实UX联测也必须连接同一Rust UX服务，不能用JS mock偏好冒充真实持久化。

## 4. 数据与信任边界

项目持久化/历史属于C++；会话草稿和阅读锚点属于编辑器/Agent本机缓存；引导/折叠偏好属于本机设备profile。三类数据的revision、恢复和导出路径互不混用。教程“操作已完成”与“学习记录已落盘”分别显示。

localOnly覆盖资源、项目、索引、缩略图、报告及自动摘要；由受管出站策略阻止远程模型/MCP/日志绕传。普通勾选、工具授权、后续R分类或教学示例不能解禁。新引导默认离线，模型/Key/MCP/Skill/积分均非前置；固定教学例子明确标识，不伪造真实AI结果。

## 5. UI范围与当前M1

新产品详细页/字段/状态输入已接收，不再笼统记作“产品未定义”；实际新画稿、适配/四语视觉和整版接收仍未完成。此前第二版EW-UI-IN前置的已提供/待绑定状态见[开发交接](DEVELOPMENT-HANDOFF.md)。

M1仍无GUI，ABI1.0/消息1.0/DDL1不变；现有scene/settings支持不等于图VM、模板完整装载或试玩Runtime已具备。G03工作流、G05固定快照试玩等在缺能力时明确blocked/只读讲解/可跳过，不能用mock完成全教程。完整本地产品的199 L义务保留为后续实施范围，不被“最小M1”削减。

云端仍暂缓，13 R和3个chat计费状态只作后续设计/本地契约或模拟说明；不部署账号计费/房间运营。四目标仍H5、WebView+C++WASM APK、微信小游戏、抖音小游戏；Cocos仅参考，Writer/Apple/平板仍独立扩展。

## 6. 文件与状态

- [ONBOARDING.md](ONBOARDING.md)：欢迎/跳过/重开、课程/证据、profile存储和恢复。
- [EDITOR-STATE.md](EDITOR-STATE.md)：88状态归属、渐进披露、任务效果、保存试玩、localOnly和空间语义。
- [UX-CONTRACTS.md](UX-CONTRACTS.md)：新UX命令/状态/持久化及测试接入。
- [开发交接](DEVELOPMENT-HANDOFF.md)：依赖、验收映射与旧前置状态变化。
- [产品到模块映射](contracts/product-architecture-map.json)：213面、88状态和12引导验收逐项保留源ID/范围，不当实现覆盖率。
- [独立清单](.architecture-mcp.json)、[baseline.json](baseline.json)、[文档完整性](documentation-check.json)。

本轮没有运行安装、构建、模型/MCP、测试、静态扫描、截图或设备操作。execution_status=not_run、quality_verified=false、release_permitted=false。产品定义和本版契约不是实际可用性或发布证明；原M1开发和真实角色待办由其索引独立记录。
