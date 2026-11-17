# 已与产品经理会话核对的UI待补范围

2026-11-17。范围核对已完成；原设计仍有未关闭缺口。正式逐项依据为[产品经理审阅结论](product-scope-review-20261117.md)，修订product-scope-review-20261117-draft.1，SHA-256 f9a2a3d5c9e2fb0e24cf8334eebf042a6ebee3ebd81fb9a830829b125bbe65d7。这是会话角色间的范围确认，不代替真实人员对设计批准。

## 数量口径

- 原稿：79业务页+1公共浮层分组，507张中文画板。该数量只表示已登记资产，不证明完整编辑能力已画出。
- 产品经理与UI自查已归并67项：31项P0、35项P1、1项P2。P0/P1/P2表示设计修订顺序，不表示生产事故。
- 范围：63项当前本地UI义务，1项本地配置与后续运行分别处理，2项后续联网/平台云端，1项未来扩展。
- 67是补齐/纠正条目数；同一工作台可承载多个模式，不能直接算作新增67个页面。
- 41项UI自查均有产品需求依据并完成对应，见[结构化归并清单](product-confirmed-gap-register-20261117.json)。旧自查文件中的pending字段保留其编制时状态，不据此覆盖本次归并结果。

## 还缺哪些界面与模式

|范围|待补或纠正内容|产品登记|
|---|---|---|
|项目与交换|模板详情、项目设置、GameGen自有工程包导入/导出、恢复迁移与只读/锁定状态|PSR-001—003、065—066|
|资源制作|精灵切片、瓦片集、导入设置、多类型资源详情、兼容选择器、重名/依赖校对|PSR-004—006|
|本机能力与安全|离线组件/本机模型/运行依赖管理、凭据/签名管理、手机完整字段|PSR-007—009|
|画面与组件|预制体覆盖传播、相机/控制高级属性、物理形状/关节/碰撞矩阵、粒子曲线与预算|PSR-010—013|
|动画和音频|真实骨骼绑定/网格/权重/IK、帧与补间曲线、动画过渡与混合、音频剪辑与总线混音|PSR-014—017|
|地图与世界|地图列表/设置/投影变更、区域/楼层/占地/遮挡、局部随机生成、小地图/探索/导航|PSR-018—022|
|关卡与战役|关卡详情、AND/OR复合目标、胜败/重试/检查点、章节与解锁图|PSR-023—024|
|RPG实体与任务|角色/职业/成长、技能阶段/命中、Buff、物品装备/掉落、任务目标、对白和行为树|PSR-025—031|
|SLG与数值|建筑/配方/队列、科技/策略、刷新波次、数值Schema/公式/导入、经济模拟输入与结果|PSR-032—036|
|类型专属工具|棋盘规则、卡牌/牌组/区域时序、节奏谱面、竞速/体育、战棋/回合、生存/放置等参数|PSR-037—042|
|工作流与变更|完整图/变量/端口/子流程、手机编辑、真实调试、AI提案/历史/同步/重导入的各自差异语义|PSR-043—045|
|对话与扩展|Plan/执行、上下文与localOnly阻止、模型API分支、MCP stdio/OAuth/能力目录、Skill导入编辑版本|PSR-046—049|
|试玩与任务|真实运行预览、运行调参回写确认、诊断、统一本地任务中心与保存状态|PSR-050—051|
|四语与发布|编辑器/游戏语言分开、四语实际新稿、四目标独立设置、预检和构建/产物状态|PSR-052—054|
|局域网与迁移|内容/方向/依赖/接收同意、资源共享、分型冲突与撤销、逐项迁移修复、Android只读报告|PSR-055—058|
|覆盖与当前技术基线|修正语义映射/统计、React/TypeScript+Tauri接入、宿主/核心未就绪和恢复状态|PSR-059—060|
|接口配置|完整API/schema编辑、来源与人工覆盖、三方重导入、协议目标矩阵；配置/模拟与真实运行分开|PSR-061|
|后续联网与平台云端|连接/服务器/房间/区服/AOI/运营；账号/积分账单/媒体收件箱/待对账等|PSR-062—063|
|未来扩展|三Writer可编辑工程写出及Apple/平板编辑器布局各自登记|PSR-064|
|游戏内界面编辑器|组件树/控件库/布局/安全区/数据与事件绑定、焦点和输入预览、游戏内UI模板|PSR-067|

## 怎样补，不重复增加主页

新增或补齐可定位子路由/工作台：自有工程包交换、离线组件、精灵切片/瓦片集、地图管理/局部生成、关卡详情/战役图、RPG/SLG实体详情、棋盘/卡牌/谱面、统一本地任务中心。

在现有页面补模式/标签/抽屉：物理、粒子、骨骼、动画、音频、地图占地遮挡、数值公式、模型/MCP/Skill分支、四目标设置与签名。游戏UI、调试、试玩虽然已有页面ID，也必须改为真实对应工作区。

公共弹窗继续复用样式，补真实资源选择、重名校对、模块/投影变更影响、预制体传播、变量/对象引用、试玩调参回写、签名与离线包、接收同意、迁移逐项修复、Skill附件差异、localOnly阻止和恢复确认。不能只用通用横幅代替具体业务内容。

## 优先修的31项

|ID|工作范围|
|---|---|
|PSR-001|new-project / templates；建议 template-detail|
|PSR-004|asset-import-settings / sprite-slicer / tileset-editor（同一资源工作台内模式）|
|PSR-005|asset-detail / assets；兼容资源选择器抽屉|
|PSR-007|offline-components：离线组件与本机模型/运行依赖|
|PSR-008|settings.security / signature-picker|
|PSR-009|model-form / mcp-form / target-settings / lan-scope / settings|
|PSR-012|physics：形状/碰撞矩阵/关节|
|PSR-014|skeleton：骨架/绑定/权重/IK|
|PSR-016|audio：音频编辑/总线混音（保留generate-audio独立）|
|PSR-017|animation-graph：状态/过渡专用属性|
|PSR-018|map-manager / map.settings / projection-change|
|PSR-023|level-detail / goal-editor（levels内详情）|
|PSR-025|rpg-character：角色/职业/成长配置|
|PSR-026|rpg-skill：技能阶段与命中范围|
|PSR-029|quests：任务属性/目标组合/进度预览|
|PSR-032|slg-building / recipe-queue（SLG内详情标签）|
|PSR-043|workflow / nodes：完整图与端口/子流程详情|
|PSR-044|graph-debug：执行会话/断点/值/栈/事件|
|PSR-045|proposal / diff / engine-conflict / lan-conflict|
|PSR-046|chat / overlays.context-picker / permissions|
|PSR-048|mcp-form.stdio / remote-auth / mcp-capabilities|
|PSR-050|preview / diagnostics：运行隔离与性能诊断|
|PSR-051|local-task-center（可复用现任务容器）/ project-save-status|
|PSR-053|target-settings.apk / h5 / wechat / douyin|
|PSR-054|publish.preflight / build-progress / build-result|
|PSR-055|lan-content-select / resource-share-settings（向导步骤/抽屉）|
|PSR-056|lan-conflict / lan-scope / lan-transfer / lan-received|
|PSR-057|engine-analysis / engine-mapping / engine-report / migration-item-detail|
|PSR-058|engine-analysis / engine-mapping / engine-import / projects|
|PSR-059|requirements-trace / scenarios / PAGE-SPECS / locale-mapping|
|PSR-067|game-ui：组件树/控件库/绑定/布局|

## 当前接入和范围边界

当前架构已更新到editor-web-v1-draft.2，路线仍是React/TypeScript共用界面、Tauri薄宿主、C++共享核心。旧Qt/Flutter实施映射需要在下一份设计基线中替换；旧画板、清单与审阅输入保留。

Windows外部工程转换仅三类指定引擎；Android接收与报告。游戏四目标保持H5、WebView+C++WASM APK、微信、抖音。localOnly内容无上传例外，勾选上下文或工具权限不解除该策略。LAN不经过公网/ADB/账号/云中继。

完整产品UI欠账不扩入无GUI的M1范围。最小编辑器真实闭环可先做新建→默认场景→新增实体→改坐标→确认落盘→关闭重开；与完整工作流/引擎/试玩分开交付，不把最小稿当作全产品完整。

## 本轮完成与未完成

已完成双方范围核对、缺口归并和交接文档；当前没有新的业务歧义需要先问用户。具体Reader/Writer子版本、未来终端最低系统、后续容量/费用/许可留对应迭代确认，按未知/不可用状态设计。

这些67项仍为open_design_gap或future_design_backlog，未在本轮补画。后续关闭须有实际新稿和页面/状态定位，不能凭读过清单关闭。未执行产品构建、测试、扫描、截图对比或设备操作；design_scope_complete=false，quality_verified=false，release_permitted=false。
