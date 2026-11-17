# UI作者缺口对照表

2026-11-17；本表是UI侧逐项读稿发现的41项记录，不是净新增页面数量。产品经理逐项范围审阅以product-scope-review-20261117.md最终回复为准。

既有507张画板保留；本轮仅核对与交接，未补画这些缺口，未执行产品测试、截图比较或设备操作。P0/P1表示设计优先顺序，不代表生产事故等级。

|ID|优先级|界面/工具|现有稿缺口|补齐方式|范围|
|---|---|---|---|---|---|
|UI-AUD-01|P0|创建与项目配置|创建向导缺玩法/视角/联网模式/模板完整选择及后续改配、模块组合影响|补现有页/向导|当前本地|
|UI-AUD-02|P0|手机表单关键字段|手机仅绘制前五项，模型API Key、MCP动作权限、目标签名引用未出现|修正现有画板|当前本地|
|UI-AUD-03|P0|变更审阅语义|AI提案、版本差异、LAN冲突、源工程重导入共用电脑/手机属性对比，需各自差异语义与三方基线|修正现有页并补业务状态|当前本地|
|UI-AUD-04|P0|项目管理与存储|项目设置、改名复制、打包交换、独占锁只读、保存失败另存与迁移确认|页面/抽屉/状态|当前本地|
|UI-AUD-05|P0|创作会话工作台|Plan/执行切换、计划确认、上下文附件、会话分支/摘要、逐项提案、停止与结果待确认|补现有页及抽屉|当前本地|
|UI-AUD-06|P1|预制体与批量对象|创建模板、实例覆盖树、传播影响/冲突、解除关联、父子变换与批量编辑|编辑面板与弹窗|当前本地|
|UI-AUD-07|P1|精灵与图集导入|精灵切片、脚点/锚点、过滤压缩、图集、目标覆盖、派生资源/原件与重导入预览|专用工作台|当前本地|
|UI-AUD-08|P0|游戏界面可视化布局|组件树/控件库/锚点布局/焦点路径/数据绑定，标题暂停HUD背包等模板实际画布|专用编辑工作台及模板|当前本地|
|UI-AUD-09|P1|物理形状与关节|多边形/复合碰撞体可视编辑、关节参数与碰撞矩阵、预设变更影响|补专用编辑面板|当前本地|
|UI-AUD-10|P1|粒子曲线与发射器|颜色/尺寸曲线、形状、子发射器、挂点、预算、循环与自然完成不同状态|补现有工作台|当前本地|
|UI-AUD-11|P1|帧动画与补间|切片序列、片段、关键帧/曲线、帧事件、控制器冲突与引用|完整时间轴编辑工作台|当前本地|
|UI-AUD-12|P1|骨骼绑定与权重|部件/骨架/静止姿态/槽位/网格/权重涂抹/IK/蒙皮换肤及导入重导入|专用工作台及导入流程|当前本地|
|UI-AUD-13|P1|动画混合与方向|分层混合、优先级/中断、方向映射、动作锁定及事件绑定|补现有图的专业面板|当前本地|
|UI-AUD-14|P1|音频剪辑与混音|当前页复用生成候选；缺裁剪/循环/淡变、总线推子、静音独奏、声像/衰减与发声优先级|音频编辑及混音工作台|当前本地|
|UI-AUD-15|P0|本机音效模型管理|模型下载/离线导入、版本、许可证、空间、校验、缺依赖与卸载|共享本机组件管理|当前本地|
|UI-AUD-16|P1|地图创建与投影|横版/俯视/等距、方格/六边格、逻辑尺寸、投影、兼容素材、图层选择|新建/设置向导及状态|当前本地|
|UI-AUD-17|P1|地图区域与占地|多层室内/屋顶、脚点、占地、坡道、门/传送/触发区、动态导航影响|补现有页的编辑面板|当前本地|
|UI-AUD-18|P1|小地图与快速旅行|楼层/标记、迷雾、跨图导航、快速旅行条件与安全落点|专用配置面板|当前本地|
|UI-AUD-19|P1|局部随机地图|种子、约束、分布、锁定区、保留手改、局部重生成预览|专用生成与差异面板|当前本地|
|UI-AUD-20|P0|关卡实际编辑与战役|目标AND/OR、胜败/结算/重试/检查点、难度、解锁与关卡关系图|补编辑页和流转图|当前本地|
|UI-AUD-21|P1|数值表与平衡参数|字段类型/主外键/公式、导入批改、引用、种子/样本与平衡方案参数；现有主要是表和结果曲线|补表编辑与模拟配置|当前本地|
|UI-AUD-22|P1|RPG实体编辑|角色成长、技能/命中/消耗、物品装备/背包、Buff叠加中断、NPC任务奖励|实体详情编辑与规则面板|当前本地|
|UI-AUD-23|P1|SLG经营实体编辑|建筑占地、配方链/仓储、生产队列、科技树、行军/领地/波次等编辑|实体详情和规则工作台|当前本地|
|UI-AUD-24|P1|24类模板与专属工具|只绘8个示例；缺卡牌区域时序、节奏谱面、消除棋盘、棋类合法步、竞速检查点等专属编辑器|模板详情与专用工具；复用通用模块|当前本地；联网部分后续|
|UI-AUD-25|P0|完整工作流语义|数值子图、状态机/行为树、变量/端口、子流程接口版本、分组、自然语言摘要与手机列表模式|补图种类和属性抽屉|当前本地|
|UI-AUD-26|P0|工作流调试工作台|断点、单步、端口值、调用栈、事件时间线、变量监视、模拟/回放/真实区分|修正现有专用工作台|当前本地|
|UI-AUD-27|P1|API契约实际编辑|环境/操作/消息/schema字段、认证、重试幂等、来源覆盖、模拟与真实请求确认|补实际编辑页和重导入比较|当前本地配置；远程执行后续|
|UI-AUD-28|P0|离线构建组件管理|目标组件版本、下载/本地导入、体积、校验、更新移除、缺项恢复|本机组件管理共享框架|当前本地|
|UI-AUD-29|P0|四目标独立设置|当前通用表单主要APK；缺H5路径缓存环境、wx/tt独立AppID/分包/域名与目标能力替代|各目标独立标签页|当前本地导出|
|UI-AUD-30|P0|签名身份与更新检查|创建/导入/安全备份、包名签名版本兼容、权限来源和风险定位|设置页及确认状态|当前本地|
|UI-AUD-31|P1|试玩调参与性能诊断|从关卡/检查点/事件启动，变量监视、碰撞/路径叠加、运行调参应用差异|补现有页与差异弹窗|当前本地|
|UI-AUD-32|P1|多语内容管理与本语稿|翻译导入导出/回退/覆盖、宽高适配；英日韩新视觉稿尚未制作|补现有面板与本语状态稿|当前本地|
|UI-AUD-33|P0|LAN发送与信任管理|发送项目/选定资源及依赖选择器、发送方向、设备信任列表、自动范围与撤销说明|补选择器、列表与授权状态|当前本地|
|UI-AUD-34|P0|LAN领域冲突与生命周期|图拓扑/删除对编辑/二进制冲突，发现与传输断开区别、原子提交中不可取消、锁屏/源变更|补领域视图及阶段状态|当前本地|
|UI-AUD-35|P0|工程精确能力与来源任务|三引擎具体子格式能力、稳定来源映射、四类对账/许可、待补行为任务详情与重导入|补现有向导与任务详情|Windows转换；Android报告|
|UI-AUD-36|P0|扩展配置深层界面|MCP stdio参数/依赖/目录/权限重授权，Skill导入附件/依赖/版本差异回退，模型各API格式与作用域|补表单分支、详情与选择器|当前本地|
|UI-AUD-37|P2|平台账号与积分任务|登录/授权恢复、配额、报价冻结结算退款、媒体收件箱/部分成功/待对账与账单|后续页面和状态|云端暂缓|
|UI-AUD-38|P2|联网运营细化|房间/区服/迁区/AOI、可信经济、维护公告、审计、封禁、备份和版本恢复|后续工作台与受控操作|后续联网|
|UI-AUD-39|P3|未来写出与终端|三Writer独立能力与损失报告流程，Apple/平板是编辑器宿主的独立适配|分离未来扩展设计基线|未来扩展|
|UI-AUD-40|P0|最新表现层与localOnly边界|设计交接仍写Qt/Flutter，需要对齐React/TypeScript+Tauri薄宿主；本地内容上下文选择应展示和执行localOnly出站限制。|修正接入规格与权限/上下文状态；不改变设计tokens或领域核心|当前本地|
|UI-AUD-41|P0|平台宿主与共享核心异常|缺少项目服务未就绪/版本能力不兼容、队列满、取消过晚、提交结果未知、只读恢复、WebView重建后的用户可理解恢复视图；技术诊断按需展开。|共享状态组件与对应上下文恢复入口|当前本地|

## 来源与现有入口

- **UI-AUD-01 创建与项目配置**：现有入口 `new-project`、`templates`；来源 [PRODUCT-REQUIREMENTS-V3.5.md](../../../PRODUCT-REQUIREMENTS-V3.5.md)。
- **UI-AUD-02 手机表单关键字段**：现有入口 `model-form`、`mcp-form`、`target-settings`；来源 [design/ui-full-20261117-draft.1/source/render.mjs](../../../design/ui-full-20261117-draft.1/source/render.mjs)。
- **UI-AUD-03 变更审阅语义**：现有入口 `proposal`、`diff`、`lan-conflict`、`engine-conflict`；来源 [design/ui-full-20261117-draft.1/source/render.mjs](../../../design/ui-full-20261117-draft.1/source/render.mjs)。
- **UI-AUD-04 项目管理与存储**：现有入口 `projects`、`settings`、`recovery`；来源 [PRODUCT-REQUIREMENTS-V3.5.md](../../../PRODUCT-REQUIREMENTS-V3.5.md)。
- **UI-AUD-05 创作会话工作台**：现有入口 `chat`、`sessions`、`proposal`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-06 预制体与批量对象**：现有入口 `prefab`、`scene`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-07 精灵与图集导入**：现有入口 `import-assets`、`asset-detail`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-08 游戏界面可视化布局**：现有入口 `game-ui`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-09 物理形状与关节**：现有入口 `physics`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-10 粒子曲线与发射器**：现有入口 `particles`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-11 帧动画与补间**：现有入口 `animation`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-12 骨骼绑定与权重**：现有入口 `skeleton`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-13 动画混合与方向**：现有入口 `animation-graph`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-14 音频剪辑与混音**：现有入口 `audio`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-15 本机音效模型管理**：现有入口 `generate-audio`、`settings`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)、[WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-16 地图创建与投影**：现有入口 `map`；来源 [MAP-LEVEL-REQUIREMENTS-V3.5.md](../../../MAP-LEVEL-REQUIREMENTS-V3.5.md)。
- **UI-AUD-17 地图区域与占地**：现有入口 `map`、`map-height`、`map-path`、`world`；来源 [MAP-LEVEL-REQUIREMENTS-V3.5.md](../../../MAP-LEVEL-REQUIREMENTS-V3.5.md)。
- **UI-AUD-18 小地图与快速旅行**：现有入口 `map`、`world`、`game-ui`；来源 [MAP-LEVEL-REQUIREMENTS-V3.5.md](../../../MAP-LEVEL-REQUIREMENTS-V3.5.md)。
- **UI-AUD-19 局部随机地图**：现有入口 `map`；来源 [MAP-LEVEL-REQUIREMENTS-V3.5.md](../../../MAP-LEVEL-REQUIREMENTS-V3.5.md)。
- **UI-AUD-20 关卡实际编辑与战役**：现有入口 `levels`；来源 [MAP-LEVEL-REQUIREMENTS-V3.5.md](../../../MAP-LEVEL-REQUIREMENTS-V3.5.md)。
- **UI-AUD-21 数值表与平衡参数**：现有入口 `data`、`economy`；来源 [PRODUCT-REQUIREMENTS-V3.5.md](../../../PRODUCT-REQUIREMENTS-V3.5.md)。
- **UI-AUD-22 RPG实体编辑**：现有入口 `rpg`、`quests`、`dialogue`；来源 [PRODUCT-REQUIREMENTS-V3.5.md](../../../PRODUCT-REQUIREMENTS-V3.5.md)、[GENRE-MODULE-REQUIREMENTS-V3.5.md](../../../GENRE-MODULE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-23 SLG经营实体编辑**：现有入口 `slg`；来源 [GENRE-MODULE-REQUIREMENTS-V3.5.md](../../../GENRE-MODULE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-24 24类模板与专属工具**：现有入口 `templates`、`tools`；来源 [GENRE-MODULE-REQUIREMENTS-V3.5.md](../../../GENRE-MODULE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-25 完整工作流语义**：现有入口 `workflow`、`nodes`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-26 工作流调试工作台**：现有入口 `graph-debug`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-27 API契约实际编辑**：现有入口 `api`、`api-import`、`api-review`、`protocol`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-28 离线构建组件管理**：现有入口 `publish`、`settings`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-29 四目标独立设置**：现有入口 `target-settings`、`publish`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-30 签名身份与更新检查**：现有入口 `target-settings`、`overlays`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-31 试玩调参与性能诊断**：现有入口 `preview`、`diagnostics`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-32 多语内容管理与本语稿**：现有入口 `localization`、`settings`、`all`；来源 [STUDIO-ENGINE-REQUIREMENTS-V3.5.md](../../../STUDIO-ENGINE-REQUIREMENTS-V3.5.md)。
- **UI-AUD-33 LAN发送与信任管理**：现有入口 `lan-devices`、`lan-scope`、`lan-diff`；来源 [LOCAL-LAN-SYNC-REQUIREMENTS-V3.7.md](../../../LOCAL-LAN-SYNC-REQUIREMENTS-V3.7.md)。
- **UI-AUD-34 LAN领域冲突与生命周期**：现有入口 `lan-conflict`、`lan-transfer`；来源 [LOCAL-LAN-SYNC-REQUIREMENTS-V3.7.md](../../../LOCAL-LAN-SYNC-REQUIREMENTS-V3.7.md)。
- **UI-AUD-35 工程精确能力与来源任务**：现有入口 `engine-analysis`、`engine-mapping`、`engine-report`、`engine-conflict`；来源 [PROJECT-IMPORT-REQUIREMENTS-V3.7.md](../../../PROJECT-IMPORT-REQUIREMENTS-V3.7.md)。
- **UI-AUD-36 扩展配置深层界面**：现有入口 `models`、`model-form`、`mcp`、`mcp-form`、`skills`、`skill-detail`；来源 [ASSISTANT-EXTENSIONS-REQUIREMENTS-V3.6.md](../../../ASSISTANT-EXTENSIONS-REQUIREMENTS-V3.6.md)。
- **UI-AUD-37 平台账号与积分任务**：现有入口 `generate-image`、`generation-tasks`、`settings`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-38 联网运营细化**：现有入口 `realtime`、`server-graph`、`multiplayer`；来源 [WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md](../../../WORKFLOW-NETWORK-REQUIREMENTS-V3.5.md)。
- **UI-AUD-39 未来写出与终端**：现有入口 `future-export`；来源 [CORE-EDITOR-EXTENSION-REQUIREMENTS-V3.8.md](../../../CORE-EDITOR-EXTENSION-REQUIREMENTS-V3.8.md)。
- **UI-AUD-40 最新表现层与localOnly边界**：现有入口 `chat`、`overlays`、`settings`；来源 [ARCHITECTURE.md](../../../ARCHITECTURE.md)、[architecture/CURRENT.json](../../../architecture/CURRENT.json)、[architecture/editor-web-v1/ARCHITECTURE.md](../../../architecture/editor-web-v1/ARCHITECTURE.md)、[architecture/editor-web-v1/INTERFACES.md](../../../architecture/editor-web-v1/INTERFACES.md)。
- **UI-AUD-41 平台宿主与共享核心异常**：现有入口 `recovery`、`diagnostics`、`settings`、`chat`；来源 [architecture/editor-web-v1/INTERFACES.md](../../../architecture/editor-web-v1/INTERFACES.md)。
