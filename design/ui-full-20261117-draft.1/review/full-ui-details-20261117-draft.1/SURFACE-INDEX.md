# 逐操作面总目录

版本full-ui-details-20261117-draft.1；2026-11-17。213为操作面数（页面/模式/抽屉/弹窗），不是新增213个主页。每个链接进入具体字段、子控件、动作确认/撤销、领域状态与返回上下文。全部planned_not_drawn/not_run。

## 全局/工作区/任务/版本（8）

|ID|名称|形态/父页|入口|平台/归属|字段组/子控件/动作/状态|
|---|---|---|---|---|---|
|[SUR-GL-001](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:7)|统一本地任务中心与任务详情|subview / generation-tasks|全局任务指示/后台通知/各工具查看任务|desktop/android / L|5/0/2/3|
|[SUR-GL-002](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:39)|工作区布局与编辑器偏好|subview / settings|设置→工作区/快捷操作|desktop/android / L|4/0/2/2|
|[SUR-GL-003](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:69)|全部工具、搜索与新手学习入口|subview / tools|更多工具/快捷工具搜索|desktop/android / L|4/0/2/2|
|[SUR-GL-004](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:99)|核心/宿主能力与只读恢复状态|subview / recovery|启动/打开项目/能力拒绝提示|desktop/android / L|4/0/2/2|
|[SUR-GL-005](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:129)|跨模块通知与后台完成收件|subview / generation-tasks|通知中心/任务标记|desktop/android / L|4/0/2/2|
|[SUR-GL-006](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:159)|历史两版本差异与变更来源|subview / diff|历史→选择两个版本→比较|desktop/android / L|5/0/2/2|
|[SUR-GL-007](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:190)|构建产物与导出版本详情|subview / build-result|导出任务完成→结果；历史构建→某版本|desktop/android / L|5/0/3/2|
|[SUR-GL-008](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/GLOBAL-SURFACES.md:222)|进入试玩前的草稿与固定版本选择|subview / preview|场景/关卡/工作流→试玩；有未提交表单或未保存修改时|desktop/android / L|4/0/3/3|

## 对话控件/选择器/活动（10）

|ID|名称|形态/父页|入口|平台/归属|字段组/子控件/动作/状态|
|---|---|---|---|---|---|
|[SUR-CH-001](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:7)|对话工作台顶栏与当前轮次|subview / chat|项目→对话/会话列表→打开|desktop/android / L|5/0/2/2|
|[SUR-CH-002](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:38)|输入区、附件与发送目的地|subview / chat|对话底部输入/添加上下文|desktop/android / L|4/0/2/2|
|[SUR-CH-003](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:68)|澄清问题与资源偏好卡|subview / chat|当前轮需要玩法/资源答案|desktop/android / L|4/0/2/2|
|[SUR-CH-004](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:98)|本轮模型选择器|drawer / chat|顶栏/输入区模型入口|desktop/android / L|4/0/2/2|
|[SUR-CH-005](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:128)|本轮Skill选择与实际载入|drawer / chat|输入区Skill入口|desktop/android / L|3/0/2/2|
|[SUR-CH-006](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:157)|本轮工具/资料范围选择|drawer / chat|输入区工具入口/授权详情|desktop/android / L|4/0/2/2|
|[SUR-CH-007](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:187)|计划、工具活动与授权卡|subview / chat|执行轮次步骤/工具展开|desktop/android / L|3/0/2/2|
|[SUR-CH-008](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:216)|会话列表、分支与上下文摘要|subview / sessions|会话入口/历史消息更多|desktop/android / L|4/0/2/2|
|[SUR-CH-009](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:246)|本轮结果与版本/待办摘要|subview / chat|轮次结束/任务通知|desktop/android / L|4/0/2/2|
|[SUR-CH-010](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/CHAT-CONTROLS.md:276)|助手活动与脱敏用量详情|subview / assistant-log|轮次更多→活动/用量|desktop/android / L|4/0/2/2|

## 项目/场景/资源/引擎/试玩（54）

|ID|名称|形态/父页|入口|平台/归属|字段组/子控件/动作/状态|
|---|---|---|---|---|---|
|[SUR-ST-001](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:77)|项目工作台与项目操作|page / projects|启动/项目导航|desktop/android / L|5/0/3/3|
|[SUR-ST-002](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:117)|新建游戏分步向导|subview / new-project|项目→新建|desktop/android / L|6/0/3/3|
|[SUR-ST-003](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:158)|模板详情与首次引导|drawer / templates|模板卡→详情；首次进入编辑器→可跳过引导|desktop/android / L|6/0/4/3|
|[SUR-ST-004](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:200)|项目设置与模块变更|subview / projects|项目菜单→项目设置|desktop/android / L|7/0/3/3|
|[SUR-ST-005](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:242)|重命名、复制、移动、归档与删除项目|dialog / projects|项目卡更多菜单|desktop/android / L|5/0/2/3|
|[SUR-ST-006](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:289)|导出GameGen完整工程包|subview / projects|项目菜单→导出工程包|desktop/android / L|5/0/2/3|
|[SUR-ST-007](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:328)|导入GameGen工程包与兼容审阅|subview / projects|打开工程包→导入预览|desktop/android / L|5/0/2/3|
|[SUR-ST-008](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:367)|恢复点、锁定与历史版本|subview / history|项目→历史→恢复点|desktop/android / L|5/0/3/2|
|[SUR-ST-009](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:406)|异常恢复、格式升级与只读打开|page / recovery|异常退出重开/高版本工程/保存失败→恢复|desktop/android / L|5/0/3/3|
|[SUR-ST-010](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:446)|编辑器偏好、语言与布局|subview / settings|设置→界面/保存/辅助使用|desktop/android / L|6/0/2/3|
|[SUR-ST-011](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:486)|场景对象树与选择工作区|page / scene|画面导航/对象引用定位|desktop/android / L|5/0/3/3|
|[SUR-ST-012](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:526)|变换、多选与调整父子关系|drawer / scene|选对象→属性→变换/拖动树改变父级|desktop/android / L|6/0/2/3|
|[SUR-ST-013](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:566)|组件与新手能力卡|drawer / scene|选对象→添加能力/组件|desktop/android / L|5/0/3/3|
|[SUR-ST-014](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:606)|删除对象与引用处理|dialog / scene|对象更多→删除|desktop/android / L|4/0/3/2|
|[SUR-ST-015](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:644)|从对象组创建预制体|dialog / prefab|选对象组→创建预制体|desktop/android / L|4/0/2/2|
|[SUR-ST-016](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:681)|实例覆盖与继承树|subview / prefab|选预制体实例→查看覆盖|desktop/android / L|5/0/3/2|
|[SUR-ST-017](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:720)|预制体传播与覆盖冲突确认|dialog / prefab|应用到模板/全部实例/升级定义|desktop/android / L|4/0/2/2|
|[SUR-ST-018](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:757)|精灵外观、渲染层与材质参数|drawer / scene|对象→外观→高级|desktop/android / L|7/0/2/2|
|[SUR-ST-019](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:797)|摄像机、视口与安全区|subview / camera|画面→摄像机；选相机对象|desktop/android / L|6/29/2/2|
|[SUR-ST-020](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:891)|输入动作与设备重绑|subview / controls|输入与角色控制→动作映射|desktop/android / L|6/0/3/2|
|[SUR-ST-021](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:931)|虚拟控件布局与角色控制预设|subview / controls|输入→手机布局/角色控制|desktop/android / L|6/21/3/2|
|[SUR-ST-022](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1012)|游戏UI真实布局工作台|page / game-ui|更多工具→游戏UI；对象→UI组件|desktop/android / L|6/22/3/3|
|[SUR-ST-023](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1088)|UI数据、事件、焦点与本地化绑定|drawer / game-ui|选控件→数据/事件/焦点/文本|desktop/android / L|7/0/3/2|
|[SUR-ST-024](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1129)|资源库、目录与批量管理|page / assets|资源导航/对象资源引用→资源库|desktop/android / L|5/0/4/3|
|[SUR-ST-025](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1170)|多类型资源详情与依赖|subview / asset-detail|资源卡→详情；错误→定位资源|desktop/android / L|6/0/3/2|
|[SUR-ST-026](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1210)|兼容资源选择与替换范围|drawer / assets|对象/组件/节点/对白字段→选择资源|desktop/android / L|5/0/3/2|
|[SUR-ST-027](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1249)|批量资源导入与重名校对|subview / import-assets|资源→导入；拖入授权文件|desktop/android / L|6/0/3/3|
|[SUR-ST-028](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1290)|精灵切片、锚点与九宫格|subview / asset-detail|图片资源→导入设置→切片|desktop/android / L|6/0/3/2|
|[SUR-ST-029](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1330)|图集、瓦片集与方向素材定义|subview / asset-detail|资源→图集/瓦片集→编辑|desktop/android / L|6/0/3/2|
|[SUR-ST-030](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1370)|字体资源、字形与回退|subview / asset-detail|字体资源→导入设置；游戏UI文本→字体详情|desktop/android / L|6/0/3/2|
|[SUR-ST-031](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1410)|资源重导入、替换与版本比较|dialog / asset-detail|资源→重导入/替换版本|desktop/android / L|5/0/3/2|
|[SUR-ST-032](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1449)|资源预算与优化预览|subview / assets|资源库→占用；导出预检→大资源定位|desktop/android / L|5/0/3/2|
|[SUR-ST-033](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1488)|运动预设与刚体参数|subview / physics|对象→运动与碰撞|desktop/android / L|6/21/3/3|
|[SUR-ST-034](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1578)|碰撞形状可视编辑|subview / physics|物理→编辑碰撞体|desktop/android / L|5/8/3/2|
|[SUR-ST-035](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1637)|碰撞分组矩阵、查询与事件|subview / physics|物理→分组/查询与事件|desktop/android / L|5/0/2/2|
|[SUR-ST-036](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1675)|关节两端、限位与电机|drawer / physics|物理→添加/编辑关节|desktop/android / L|5/0/2/2|
|[SUR-ST-037](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1713)|粒子预设、发射与生命周期|subview / particles|对象→特效；资源→粒子|desktop/android / L|7/21/3/2|
|[SUR-ST-038](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1790)|粒子曲线、子发射器与预算|subview / particles|粒子→高级曲线/子发射器/预算|desktop/android / L|6/7/3/2|
|[SUR-ST-039](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1849)|帧动画片段与时间轴|subview / animation|帧资源→片段；对象→动作时间轴|desktop/android / L|6/0/3/2|
|[SUR-ST-040](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1889)|补间轨道、关键帧与缓动曲线|subview / animation|动画→补间/曲线|desktop/android / L|5/6/2/2|
|[SUR-ST-041](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1944)|动画/音频/粒子事件与挂点绑定|drawer / animation|时间轴标记/资源完成事件→属性|desktop/android / L|5/0/2/2|
|[SUR-ST-042](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:1982)|骨架层级、静止姿态与插槽|subview / skeleton|骨骼→骨架模式|desktop/android / L|5/0/3/2|
|[SUR-ST-043](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2021)|蒙皮网格、绑定与顶点权重|subview / skeleton|骨骼→网格/权重模式|desktop/android / L|5/13/3/2|
|[SUR-ST-044](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2096)|皮肤、挂点、约束与IK|drawer / skeleton|骨骼→皮肤/挂点/约束|desktop/android / L|5/0/2/2|
|[SUR-ST-045](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2134)|外部骨骼资源导入与重导入|subview / skeleton|资源→导入骨骼包/骨骼资源重导入|desktop/android / L|6/0/2/2|
|[SUR-ST-046](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2173)|动画状态、过渡、混合与方向|subview / animation-graph|动画控制图→状态/过渡/层/方向|desktop/android / L|6/0/3/2|
|[SUR-ST-047](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2213)|音频剪辑、循环点与格式|subview / audio|音频资源→编辑|desktop/android / L|5/0/3/2|
|[SUR-ST-048](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2252)|混音总线、空间音频与并发策略|subview / audio|音频→混音/对象音频组件→路由|desktop/android / L|6/0/3/2|
|[SUR-ST-049](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2292)|本机音效参数、候选与采用|subview / generate-audio|音效缺失卡→本机生成；资源→生成音效|desktop/android / L|5/5/4/3|
|[SUR-ST-050](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2343)|隔离试玩控制台与运行视图|page / preview|全局试玩；场景/关卡/检查点/事件→试玩|desktop/android / L|6/5/4/5|
|[SUR-ST-051](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2398)|问题定位、资源归因与性能观察|subview / diagnostics|错误提示/试玩诊断/资源预算→问题详情|desktop/android / L|6/0/4/3|
|[SUR-ST-052](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2440)|运行调参回写与停止试玩确认|dialog / preview|试玩属性→应用到工程；退出试玩有调参|desktop/android / L|5/0/3/2|
|[SUR-ST-053](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2479)|游戏内容语言表、文本键与资源变体|page / localization|项目→游戏内容本地化；UI/对白文本键→定位|desktop/android / L|7/0/4/3|
|[SUR-ST-054](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/studio/DETAILS.md:2522)|语言表导入映射与翻译差异审阅|subview / localization|语言表→导入CSV/JSON；翻译建议→审阅|desktop/android / L|6/0/4/3|

## 地图/关卡/数值/玩法（66）

|ID|名称|形态/父页|入口|平台/归属|字段组/子控件/动作/状态|
|---|---|---|---|---|---|
|[SUR-GM-001](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:107)|地图列表与引用管理|subview / world|世界→地图列表|desktop/android / L|4/0/2/3|
|[SUR-GM-002](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:145)|新建地图与视角|dialog / map-manager|地图列表→新建|desktop/android / L|6/4/2/3|
|[SUR-GM-003](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:199)|地图属性与投影参数|drawer / map|地图→属性→高级|desktop/android / L|5/3/2/3|
|[SUR-GM-004](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:246)|切换投影与地图版本影响|dialog / map.settings|地图属性→更换投影/引用地图升级|desktop/android / L|4/0/2/3|
|[SUR-GM-005](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:284)|地形笔刷与选区|subview / map|地图→画地面|desktop/android / L|5/3/3/3|
|[SUR-GM-006](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:332)|自动铺边与手工覆盖|drawer / map|地图→地形连接规则/重建选区边缘|desktop/android / L|4/0/2/3|
|[SUR-GM-007](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:370)|图层楼层与重叠选择|drawer / map|地图→图层/楼层；长按重叠处|desktop/android / L|4/0/3/3|
|[SUR-GM-008](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:409)|高度地形与失效面策略|subview / map-height|地图→高度/桥面|desktop/android / L|5/7/2/4|
|[SUR-GM-009](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:471)|跨通行面连接|drawer / map-path|地图选坡道/楼梯/传送/升降梯→连接属性|desktop/android / L|5/7/2/3|
|[SUR-GM-010](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:527)|占地脚点入口校准|subview / map|选建筑/角色→高级→占地与脚点|desktop/android / L|5/11/2/4|
|[SUR-GM-011](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:593)|建筑放置与拒绝原因|subview / map|地图→放建筑/角色|desktop/android / L|4/6/2/3|
|[SUR-GM-012](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:647)|遮挡部件与屋顶淡出|drawer / map-height|选建筑→高级→遮挡|desktop/android / L|5/2/2/3|
|[SUR-GM-013](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:693)|方向素材与旋转映射|drawer / map|对象→方向/建筑旋转映射|desktop/android / L|5/4/2/3|
|[SUR-GM-014](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:741)|逻辑区域与事件属性|drawer / map|地图→放事件/出生/领地/禁止区|desktop/android / L|6/7/2/3|
|[SUR-GM-015](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:798)|导航规则与路径诊断|subview / map-path|地图→可走区域/寻路试玩|desktop/android / L|6/6/2/3|
|[SUR-GM-016](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:854)|小地图迷雾与玩家可见性|subview / world|世界→玩家地图/导航标记|desktop/android / L|5/3/2/3|
|[SUR-GM-017](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:901)|世界入口与快速旅行|drawer / world|世界连接图→入口/传送/快速旅行|desktop/android / L|5/4/2/3|
|[SUR-GM-018](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:949)|随机地图生成配置|subview / map|地图→生成/局部重生成|desktop/android / L|6/6/2/3|
|[SUR-GM-019](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1005)|生成结果差异与种子生命周期|dialog / map-generator|随机生成→结果预览|desktop/android / L|4/3/2/3|
|[SUR-GM-020](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1051)|地图实例与环境/持久状态策略|drawer / world|世界/地图→实例与公共规则|desktop/android / L|5/3/2/3|
|[SUR-GM-021](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1098)|关卡列表与复用地图|subview / levels|更多→地图关卡→关卡列表|desktop/android / L|4/0/2/3|
|[SUR-GM-022](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1136)|关卡基础属性与可用能力|subview / levels|关卡列表→选择关卡→属性|desktop/android / L|5/8/2/3|
|[SUR-GM-023](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1198)|复合目标与胜败优先级|subview / levels|关卡→目标与失败|desktop/android / L|5/10/2/3|
|[SUR-GM-024](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1262)|出生刷新与敌人波次|subview / levels|关卡/遭遇区/塔防→刷新波次|desktop/android / L|5/9/2/3|
|[SUR-GM-025](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1325)|检查点重试与进度保留|drawer / levels|关卡→检查点/死亡与退出|desktop/android / L|5/4/2/3|
|[SUR-GM-026](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1373)|评分奖励与结算规则|drawer / levels|关卡→结算/评分/奖励|desktop/android / L|5/9/2/3|
|[SUR-GM-027](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1436)|章节与关卡解锁图|subview / levels|关卡→章节/流转图|desktop/android / L|5/3/3/3|
|[SUR-GM-028](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1484)|跨地图关卡流转|drawer / world|关卡→地图组合→切图边|desktop/android / L|5/3/2/3|
|[SUR-GM-029](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1531)|数据表结构与字段定义|subview / data|数值→表→结构|desktop/android / L|5/9/2/3|
|[SUR-GM-030](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1594)|数值表格与批量变更|subview / data|数据表→行编辑/多选|desktop/android / L|5/4/2/3|
|[SUR-GM-031](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1642)|CSV JSON字段映射与导入对照|dialog / data|数值表→导入CSV/JSON|desktop/android / L|5/4/2/3|
|[SUR-GM-032](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1690)|结构化公式与变量引用|drawer / data|数值字段→公式|desktop/android / L|4/6/2/3|
|[SUR-GM-033](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1744)|成长曲线与难度预设|subview / data|角色/科技/升级成本→成长曲线|desktop/android / L|4/3/2/3|
|[SUR-GM-034](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1790)|平衡模拟情景输入|subview / economy|数值→模拟→新建情景|desktop/android / L|5/4/2/3|
|[SUR-GM-035](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1838)|模拟结果流水与方案比较|subview / economy|模拟任务→结果|desktop/android / L|5/3/2/3|
|[SUR-GM-036](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1885)|角色职业与基础成长|subview / rpg|RPG→角色/职业→详情|desktop/android / L|5/7/2/3|
|[SUR-GM-037](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:1941)|技能阶段命中与效果|subview / rpg|RPG→技能→阶段/范围/效果|desktop/android / L|5/24/2/4|
|[SUR-GM-038](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2030)|Buff状态叠加与生命周期|subview / rpg|RPG→状态效果→详情|desktop/android / L|5/10/2/3|
|[SUR-GM-039](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2094)|物品定义与使用效果|subview / rpg|RPG→物品→详情|desktop/android / L|5/6/2/3|
|[SUR-GM-040](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2149)|背包装备槽与溢出规则|subview / rpg|RPG→背包/装备规则|desktop/android / L|5/6/2/3|
|[SUR-GM-041](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2204)|掉落表商店与获取期望|subview / rpg|物品→掉落/商店配置|desktop/android / L|5/5/2/3|
|[SUR-GM-042](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2253)|NPC交互巡逻与日程|subview / rpg|RPG→NPC→行为/交互|desktop/android / L|5/3/2/3|
|[SUR-GM-043](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2300)|任务定义目标与奖励|subview / quests|任务列表→任务详情|desktop/android / L|5/9/2/3|
|[SUR-GM-044](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2363)|对白分支正文与演出|subview / dialogue|对白图→对白/选项节点→属性|desktop/android / L|5/7/2/3|
|[SUR-GM-045](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2419)|剧情阶段与玩家进度预览|drawer / quests|任务/世界→剧情阶段与实例规则|desktop/android / L|4/3/2/3|
|[SUR-GM-046](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2465)|建筑建造升级搬迁规则|subview / slg|经营策略→建筑→详情|desktop/android / L|5/11/2/3|
|[SUR-GM-047](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2530)|配方生产链与资源守恒|subview / slg|经营策略→配方/生产链|desktop/android / L|5/7/2/3|
|[SUR-GM-048](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2586)|仓储配送与生产队列|subview / slg|经营策略→仓储/队列|desktop/android / L|5/10/2/3|
|[SUR-GM-049](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2650)|科技树与解锁依赖|subview / slg|策略→科技树|desktop/android / L|5/3/2/3|
|[SUR-GM-050](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2697)|单位编队与行军规则|subview / slg|策略→单位/编队/行军|desktop/android / L|5/7/2/3|
|[SUR-GM-051](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2753)|领地视野与争夺规则|subview / slg|策略→领地/侦察/迷雾|desktop/android / L|5/4/2/3|
|[SUR-GM-052](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2801)|时间模式与离线收益|drawer / slg|策略/放置→时间与离线结算|desktop/android / L|5/5/2/3|
|[SUR-GM-053](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2855)|回合策略外交与胜利规则|subview / slg|策略→回合阶段/外交/胜利|desktop/android / L|5/5/2/3|
|[SUR-GM-054](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2909)|棋盘形状匹配与消除链|subview / tools|消除/桌游模板→棋盘规则|desktop/android / L|5/9/2/3|
|[SUR-GM-055](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:2972)|机关推箱与合成规则|subview / tools|解谜/合成模板→规则|desktop/android / L|5/7/2/3|
|[SUR-GM-056](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3028)|卡牌定义与牌组构成|subview / tools|卡牌模板→卡牌/牌组|desktop/android / L|5/8/2/3|
|[SUR-GM-057](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3085)|卡牌区域抽洗与效果时序|subview / card-deck-editor|卡牌→区域与回合时序|desktop/android / L|4/8/2/3|
|[SUR-GM-058](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3141)|节奏谱面与时间校准|subview / tools|音乐节奏模板→谱面|desktop/android / L|5/12/2/3|
|[SUR-GM-059](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3212)|竞速赛道检查点与名次|subview / tools|竞速模板→赛道规则|desktop/android / L|4/6/2/3|
|[SUR-GM-060](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3266)|体育队伍局节与得分事件|subview / tools|体育模板→比赛规则|desktop/android / L|4/6/2/3|
|[SUR-GM-061](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3320)|战棋合法步与回合桌游|subview / tools|战棋/棋类模板→行动规则|desktop/android / L|5/6/2/3|
|[SUR-GM-062](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3375)|肉鸽本轮与局外成长|subview / tools|生存/肉鸽模板→本轮规则|desktop/android / L|5/7/2/3|
|[SUR-GM-063](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3431)|放置沙盒与世界时间参数|drawer / tools|放置/沙盒模板→自动化/世界规则|desktop/android / L|5/2/2/3|
|[SUR-GM-064](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3477)|玩法模板详情与组合影响|subview / templates|类型目录→模板详情；当前项目→组合玩法|desktop/android / L|6/4/3/4|
|[SUR-GM-065](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3528)|平台跑酷路线与计分参数|drawer / tools|平台/跑酷模板→路线/机关/计分|desktop/android / L|4/3/2/3|
|[SUR-GM-066](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/gameplay/DETAILS.md:3574)|动作格斗与射击专属参数|subview / tools|动作/格斗/射击模板→战斗参数|desktop/android / L|6/12/2/3|

## 工作流/扩展/互通/接口/发布（75）

|ID|名称|形态/父页|入口|平台/归属|字段组/子控件/动作/状态|
|---|---|---|---|---|---|
|[SUR-WN-001](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:112)|工作流与图种类选择|subview / workflow|对象行为/更多工具→工作流→新建或切图|desktop/android / L|4/0/2/2|
|[SUR-WN-002](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:140)|按意图与端口筛选节点库|drawer / nodes|工作流添加节点/端口旁添加|desktop/android / L|4/0/2/2|
|[SUR-WN-003](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:168)|类型化节点参数与引用|drawer / workflow|选中节点→属性|desktop/android / L|9/0/2/2|
|[SUR-WN-004](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:201)|点选端口连线与插入|subview / workflow|选择端口→连接；选中线→在线插入|desktop/android / L|3/0/3/2|
|[SUR-WN-005](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:229)|变量、集合与作用范围|drawer / workflow|工作流→变量/黑板|desktop/android / L|4/0/2/2|
|[SUR-WN-006](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:257)|子工作流接口与调用|subview / workflow|选择节点组→提取子流程；子流程→接口|desktop/android / L|4/0/2/2|
|[SUR-WN-007](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:285)|子流程升级与调用者影响|dialog / workflow|子流程版本→更新调用者|desktop/android / L|3/0/2/2|
|[SUR-WN-008](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:312)|并行、循环与异步生命周期|drawer / workflow|选择并行/循环/等待节点→高级|desktop/android / L|6/0/2/2|
|[SUR-WN-009](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:342)|工作流逐步调试工作台|page / graph-debug|工作流→调试；诊断→节点|desktop/android / L|4/0/2/2|
|[SUR-WN-010](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:370)|断点、监视与条件调试|drawer / graph-debug|调试→断点/变量监视|desktop/android / L|4/0/2/2|
|[SUR-WN-011](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:398)|事件时间线、调用栈与回放|subview / graph-debug|调试→事件/任务/调用栈|desktop/android / L|4/0/2/2|
|[SUR-WN-012](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:426)|AI提案与手改三方审阅|page / proposal|对话变更卡→查看修改|desktop/android / L|3/0/2/2|
|[SUR-WN-013](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:453)|部分接受与依赖闭包|drawer / proposal|提案→逐组选择/仅应用无冲突部分|desktop/android / L|3/0/2/2|
|[SUR-WN-014](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:480)|模型服务列表与引用影响|page / models|设置→AI开发助手→模型服务|desktop/android / L|3/0/2/2|
|[SUR-WN-015](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:507)|模型基础连接与API格式|subview / model-form|添加/编辑模型→基础|desktop/android / L|6/0/2/2|
|[SUR-WN-016](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:537)|模型鉴权、密钥与高级选项|drawer / model-form|模型→高级/凭据|desktop/android / L|17/0/2/2|
|[SUR-WN-017](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:578)|模型分项能力诊断|drawer / models|模型→检查连接与能力|desktop/android / L|3/0/2/2|
|[SUR-WN-018](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:605)|已发送轮次的配置快照与来源追溯|drawer / chat|对话已发送轮次→配置详情/来源追溯|desktop/android / L|4/0/3/2|
|[SUR-WN-019](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:634)|MCP连接方式与来源预览|dialog / mcp-form|MCP列表→添加/导入配置|desktop/android / L|3/0/2/2|
|[SUR-WN-020](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:661)|MCP本机stdio参数与运行依赖|subview / mcp-form|MCP连接→本机stdio|desktop/android / L|5/0/2/2|
|[SUR-WN-021](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:690)|MCP远程鉴权与OAuth恢复|subview / mcp-form|MCP连接→HTTP/SSE→授权|desktop/android / L|6/0/2/2|
|[SUR-WN-022](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:720)|MCP能力目录与命名空间|drawer / mcp|MCP服务→工具/资源/提示目录|desktop/android / L|4/0/2/2|
|[SUR-WN-023](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:748)|工具动作授权与在途结果|dialog / permissions|对话/工作流请求受限工具动作|desktop/android / L|3/0/3/2|
|[SUR-WN-024](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:776)|Skill文件/目录包导入预览|dialog / skills|Skill→新增→SKILL.md/目录/安全包/粘贴|desktop/android / L|4/0/2/2|
|[SUR-WN-025](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:804)|Skill正文、附件与匹配设置|subview / skill-detail|Skill详情→编辑正文/附件/启用范围|desktop/android / L|4/0/2/2|
|[SUR-WN-026](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:832)|Skill更新、回退与配置冲突|dialog / skill-detail|Skill→版本→更新/回退|desktop/android / L|3/0/2/2|
|[SUR-WN-027](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:859)|API服务、环境与契约版本|subview / api|接口与服务→服务→新建/环境|desktop/android / L|8/0/2/2|
|[SUR-WN-028](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:891)|HTTP操作请求响应与错误|subview / api|接口列表→操作详情|desktop/android / L|16/0/2/2|
|[SUR-WN-029](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:931)|消息通道、事件与订阅契约|subview / api|API→消息/通道→详情|desktop/android / L|14/0/2/2|
|[SUR-WN-030](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:969)|Schema类型、引用与兼容编辑|drawer / api|操作/消息→Schema→编辑字段|desktop/android / L|13/0/2/2|
|[SUR-WN-031](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1006)|接口文档来源、范围与本地解析|page / api-import|接口与服务→导入文档|desktop/android / L|4/0/2/2|
|[SUR-WN-032](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1034)|接口识别校对与缺项澄清|subview / api-review|接口导入→识别结果|desktop/android / L|4/0/2/2|
|[SUR-WN-033](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1062)|接口文档再次导入三方比较|page / api-review|服务→来源版本→重新导入|desktop/android / L|3/0/2/2|
|[SUR-WN-034](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1089)|协议、传输、编码与安全层|subview / protocol|接口连接→协议设置|desktop/android / L|51/0/2/2|
|[SUR-WN-035](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1164)|四目标协议能力与网关替代|drawer / protocol|协议→目标兼容；导出预检→协议问题|desktop/android / L|4/0/2/2|
|[SUR-WN-036](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1192)|接口模拟、契约检查与结果对照|subview / api|API操作→本地模拟/检查|desktop/android / L|4/0/2/2|
|[SUR-WN-037](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1220)|实时连接监视与重连策略（后续）|page / realtime|接口与服务→实时连接→诊断|desktop/android / R|9/0/2/2|
|[SUR-WN-038](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1253)|附近设备与发现控制|page / lan-devices|项目→附近设备；发送到手机/从电脑接收|windows/android / L|4/0/2/2|
|[SUR-WN-039](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1281)|双端配对、二维码与手动地址|dialog / lan-pair|设备→配对；扫码/手动本地连接|windows/android / L|3/0/2/2|
|[SUR-WN-040](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1308)|设备信任与项目动作授权|subview / lan-scope|已配对设备→授权范围/取消信任|windows/android / L|4/0/2/2|
|[SUR-WN-041](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1336)|发送内容、方向与接收同意|dialog / lan-content-select|已配对设备→发送项目/选资源/发固定版本试玩|windows/android / L|5/0/2/2|
|[SUR-WN-042](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1365)|本地资源库共享范围与按需下载|subview / assets|资源库→分享至设备/从附近设备导入|windows/android / L|4/0/2/2|
|[SUR-WN-043](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1393)|LAN同步变化与空间预览|page / lan-diff|选择内容→查看变化|windows/android / L|4/0/2/2|
|[SUR-WN-044](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1421)|分阶段传输、续传与原子提交|page / lan-transfer|LAN变化确认→传输任务|windows/android / L|4/0/2/2|
|[SUR-WN-045](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1449)|LAN领域冲突与二进制版本|subview / lan-conflict|同步→需要决定的冲突项|windows/android / L|4/0/2/2|
|[SUR-WN-046](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1477)|本地连接诊断与系统权限|drawer / lan-diagnostics|设备不可达/任务错误→诊断|windows/android / L|4/0/2/2|
|[SUR-WN-047](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1505)|接收结果、本地完整性与暂存清理|subview / lan-received|传输提交成功→打开/查看内容；任务→清理暂存|windows/android / L|4/0/2/2|
|[SUR-WN-048](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1533)|Windows源工程与新目标选择|page / engine-import|Windows项目→导入引擎项目|windows / L|4/0/2/2|
|[SUR-WN-049](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1561)|源格式能力与内容分析|subview / engine-analysis|选择源→分析结果|windows / L|4/0/2/2|
|[SUR-WN-050](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1589)|映射、替代与许可选择|subview / engine-mapping|分析→确认映射与许可|windows / L|4/0/2/2|
|[SUR-WN-051](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1617)|迁移逐对象待补与工作流修复|drawer / engine-report|映射/报告→点对象/行为/阻塞项|windows / L|4/0/2/2|
|[SUR-WN-052](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1645)|转换任务与四类结果对账|page / engine-convert|确认映射→转换→报告|windows / L|4/0/3/2|
|[SUR-WN-053](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1674)|源工程更新后的重导入三方比较|page / engine-conflict|导入记录→重新读取更新源工程|windows / L|4/0/2/2|
|[SUR-WN-054](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1702)|Android迁移报告只读模式|subview / engine-report|手机接收项目→查看迁移报告|android / L|4/0/2/2|
|[SUR-WN-055](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1730)|离线组件、本机模型与运行依赖|page / offline-components|设置→离线组件；缺组件提示→修复|desktop/android / L|4/0/2/2|
|[SUR-WN-056](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1758)|签名身份与安全备份|drawer / target-settings|APK目标设置→签名；设置→本机签名身份|desktop/android / L|5/0/3/2|
|[SUR-WN-057](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1788)|APK独立目标设置|subview / target-settings|导出→Android APK→设置|desktop/android / L|20/0/2/2|
|[SUR-WN-058](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1832)|H5独立目标设置|subview / target-settings|导出→H5→设置|desktop/android / L|16/0/2/2|
|[SUR-WN-059](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1872)|微信小游戏独立目标设置|subview / target-settings|导出→微信小游戏→设置|desktop/android / L|12/0/2/2|
|[SUR-WN-060](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1908)|抖音小游戏独立目标设置|subview / target-settings|导出→抖音小游戏→设置|desktop/android / L|12/0/2/2|
|[SUR-WN-061](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1944)|发布预检、包体与修复入口|subview / publish|导出目标→检查能力/资源/许可|desktop/android / L|4/0/3/2|
|[SUR-WN-062](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:1973)|四目标构建任务与产物版本|page / build-progress|预检→本地构建→结果/版本记录|desktop/android / L|4/0/3/2|
|[SUR-WN-063](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2002)|网游权威、数据与运营工作台（后续）|page / multiplayer|接口与服务→房间/持续世界/运营|desktop/android / R|5/0/1/2|
|[SUR-WN-064](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2032)|平台账户、媒体收件箱与积分对账（后续）|page / generation-tasks|后续平台服务→账户/积分；任务→账单/收件箱|desktop/android / R|4/0/1/2|
|[SUR-WN-065](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2061)|未来Writer与编辑器终端扩展索引|subview / future-export|更多→可编辑引擎工程/未来终端说明|desktop/android / F|4/0/2/2|
|[SUR-WN-066](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2089)|服务端工作流与可信校验（后续）|subview / server-graph|联网工作台→服务端规则；自建API→服务图|desktop/android / R|7/0/2/2|
|[SUR-WN-067](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2120)|服务数据、权限与原子交易（后续）|subview / server-data|联网工作台→数据模型/权限/事务|desktop/android / R|7/0/2/2|
|[SUR-WN-068](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2151)|同步字段、可见性与AOI（后续）|subview / multiplayer-authority|联网工作台→同步/AOI|desktop/android / R|8/0/2/2|
|[SUR-WN-069](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2183)|房间、匹配与主持人规则（后续）|subview / multiplayer|联网工作台→房间/匹配|desktop/android / R|9/0/2/2|
|[SUR-WN-070](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2216)|区服实例、容量与唯一归属迁移（后续）|subview / multiplayer|持续世界→区服/分线/实例|desktop/android / R|10/0/2/2|
|[SUR-WN-071](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2250)|服务发布、数据迁移、回退与备份（后续）|subview / server-operations|服务管理→版本/部署/迁移/备份恢复|desktop/android / R|8/0/2/2|
|[SUR-WN-072](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2282)|经济审计、内容举报与受控管理（后续）|subview / server-operations|服务管理→审计/用户与内容管理|desktop/android / R|14/0/2/2|
|[SUR-WN-073](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2320)|平台账号、额度与积分账单（后续）|subview / settings|平台服务→账号/额度/积分账单|desktop/android / R|7/0/3/2|
|[SUR-WN-074](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2352)|图片生成参数、候选比较与本地采用（后续）|subview / generate-image|资源→生成图片；对象外观→后续生成|desktop/android / R|15/0/2/2|
|[SUR-WN-075](/I:/code/GameGen/design/ui-full-20261117-draft.1/review/full-ui-details-20261117-draft.1/workflow/DETAILS.md:2391)|媒体任务、收件箱与恢复入库（后续）|subview / generation-tasks|生成任务→状态/产物收件箱；账单→任务|desktop/android / R|7/0/3/3|

