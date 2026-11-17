# 编辑器渐进展示、对话状态与操作效果

版本：editor-web-v1-draft.3。输入：[完整交互](inputs/product/fullui/GLOBAL-INTERACTIONS.md)、[渐进展示](inputs/product/fullui/PROGRESSIVE-DISCLOSURE.md)、[对话88状态](inputs/product/chat/chat-state-catalog.json)、[空间规则](inputs/product/fullui/COMMON-SPACE.md)。

## 1. 213操作面的落地方式

SurfaceRegistry保留产品SUR-ID、父页、形态、入口、平台、L/R/F、字段/动作/状态/REQ/AC/PSR来源及source hash。23页面、129子视图、44抽屉、17对话框沿现有导航组合，不机械造213个主页；199 L保留本地完整产品义务，13 R/1 F不进入当前云端实施。

通用表单用于数值/单位/枚举/引用/校验/继承等基础控件；骨骼权重、图调试、混音、时间轴、地图/棋盘等仍需专门工作台，不能用一张通用属性面板或列表冒充。24共享交互通过组件/控制器复用，领域规则由对应C++模块决定。

1195字段组包含538子控件，不把两者相加为新手必填数。required为提交合法性，模板/项目/继承/设备能力可预填。advanced标志只控制该工具内展示，默认页面/任务和选中对象共同决定可见面。

## 2. 折叠、草稿和返回状态

高级区收起不发Core写命令、不恢复预设或删除未知分支；已用高级设置显示“已自定义/高级已用”。隐藏字段错误向外层汇总，可按document/object/component/field定位展开。恢复单字段、恢复预设、恢复模板分别有范围，不能静默全量覆盖。

简易行为卡和高级图共享同一工作流权威。无法在简易视图表示的分支保留并提示，不以切回简易重建图。修改预设需生成影响预览/正常提案，不添加自由代码节点。

布局/折叠/阅读锚点属于设备UI缓存；项目草稿属于独立DraftRecoveryRepository，标localOnly且绑定projectId/documentId/objectId/schema/baseRevision。草稿不是已提交文档，进度profile不保存草稿正文。恢复到变化后的项目必须核对/比较，不能自动覆盖；Core历史不假装包含未提交输入。

NavigationCoordinator保存来源、树展开/筛选、选区、视口、播放位置和焦点；输入框/IME撤销优先自身，项目撤销只作用正常Core历史。手机旋转/横屏/返回只改变布局/临时操作，不重发请求或提交半个拖动/连线。已打开权限/危险确认先由原控制器处理。

## 3. 对话按对象多轴投影

88状态是12个对象组的展示定义，不是一个88分支后端enum，也不是88页。分组到服务/事件见[映射](contracts/product-architecture-map.json)：

|组|状态拥有者/权威|关键独立性|
|---|---|---|
|session|AgentConversationStore/会话元信息|聊天分支/归档不回滚项目|
|input|Draft/ContextSnapshot|草稿、当前轮补充、下一轮排队分开|
|service|AgentHost/Model/Extension能力|本机启动与远程连接不同，不暗换模型/付费协议|
|turn|TurnCoordinator|公开计划、文字流、工具参数和等待原因分别可见|
|question|ClarificationStore|问题绑定项目/对象/基线，旧问题失效不套用新选区|
|tool|InvocationLedger/权限Broker|未执行/运行/成功/失败/结果未知分别查询|
|proposal|C++校验/事务与ProposalCoordinator|提案合法、采用、受理、提交中、durable不同|
|asset|资源任务/候选仓/Core入库|候选生成不自动入库/替换|
|recovery|各原任务账本及Core request.lookup|停止请求不等于已取消；查源任务，不统一假回滚|
|message|ConversationStore/虚拟列表|消息送达/回复完整/阅读位置不跟任务成功混用|
|billing|来源/供应商usage；平台计费后续R|本机不扣平台积分，缺usage不造账单|
|adaptive|表现层焦点/布局/生命周期|IME/四语/字体变化不重置项目或轮次|

ChatReadModel快照带project/session/branch/turn/message/invocation/proposal/job IDs及各来源epoch/seq/version，按源内顺序去重；不按墙钟排序跨源因果。新消息选择的上下文/模型/扩展/权限组成不可变轮次快照，配置变动只影响后续或明确支持的补充，不悄悄替换在途参数。

提案比较至少含base/current/proposed三方及原对象/版本；手改后旧提案重新校验/冲突，不自动覆盖。部分接受先校验依赖闭包，不能应用半条边或缺资源引用。完整图契约未实现时保留待处理/不支持，不能把伪图脚本提交M1。

流式文字结束只标textComplete；任一工具/问题/授权/候选/提案/提交仍未决就展示未结束项。停止按各子任务逐项取消/查询，保留已保存/已停止/结果待确认向量，不把整轮一个cancelled覆盖事实。

Core写用持久request.lookup，外部工具/生成任务用其invocation/provider job账本；Core查询不能证明远程扣费或外部效果未发生。不具幂等/查询的外部写在unknown时不能自动重放。聊天编辑重发为新轮/引用关系，不改已执行事务。

上翻/选文时保留消息ID+视口锚点，新内容给非阻断标记，不抢滚底；IME组词不触发发送。对话教学示例使用独立demo来源，不能进入真实模型完成/收费/采用统计。

## 4. 操作效果与撤销

ActionRegistry固定effect类别：query、ui_preference、project_proposal、project_commit、resource_job、external_call、build_artifact。查询、定位、隔离预览/调试不会产生项目事务或多余提交确认。设备设置、凭据、文件产物、外部调用各有独立恢复；Core undo只撤销已声明项目事务，不能撤回外部调用/退款或删练习。

所有手改/Agent/课程动作绑定原项目/对象/版本和request ID；新选区不改变旧任务目标。清通知不是删任务，候选预览不是采用，导出包生成不等于实际运行。

## 5. 保存与试玩栅栏

默认“保存当前合法修改并试玩”：SaveCoordinator捕获当前UI草稿/意图集合和基线，项目MutationBroker暂缓其后的新写入，先处理已受理任务，再校验/按原Core限额提交捕获意图。期间新编辑保留到下一批，不混入本次快照。读取/提示可继续，不能阻断取消和任务查询。

多批保存若后批失败，先前已durable的批次保持真实已保存，剩余草稿保留；不伪称全量原子，也不隐式undo回滚。只在全部本次目标修改确认durable后，取得对应revision的确切不可变快照，再释放栅栏并启动PreviewHost。试玩载明snapshotId/manifestHash/revision，后续编辑不改变正在玩的输入。

M1 commit返回的snapshot可在匹配目标revision时复用；project.flush不提交内存草稿，也不凭空创建任意快照。没有精确capture/Runtime能力时显示不支持，未来模块须另交SnapshotCapturePort/PreviewPort，不向M1塞新op。

用户可明确选择“试玩最近已保存版本”，持续显示不含草稿。保存失败/草稿非法/结果未知不能静默启动旧版。PreviewReady必须来自实际加载指定快照并启动运行的宿主事件；按钮点击或模拟ready不算进入试玩。结构化ready仍不证明像素/音视频正确。

## 6. 空间语义与领域边界

地图、物理、技能共享锁定的SpaceContract：逻辑平面位置、通行面/基准、垂直区间、单位及视觉偏移不同概念；屏幕Y/重叠不能推断逻辑高度/碰撞/命中。新UI只做显示/单位适配，不自创Z字段。

Core当前scene schema只有既定二维变换，缺地图/高度能力时明确UNSUPPORTED；未来地图/物理/技能包统一Schema和迁移/能力表，不让各面板单独加字段。改变地形/支撑面的多域影响由共享应用命令校验/提交，失败不保留半次变更。

## 7. localOnly出站

ContextPolicyGuard在Broker/模型/扩展/诊断出站点共同检查来源标签，localOnly沿缩略图、索引、报告、派生摘要、工具结果传播。默认阻止到远程模型、远程MCP、日志附件和云备份；普通勾选/工具授权不解除。学习进度/journal永不加入上下文、LAN或游戏产物。

远程可使用用户手输的通用文字或已获允许的非localOnly数据，不能自动补本地项目内容。无法在限制下完成时明确阻断/保留本机功能，不放宽策略。受管剪贴板/附件保留已知来源标签；不宣称能识别所有手输/外部粘贴敏感内容。

任意stdio工具/Skill不因“本机运行”就有权读localOnly根；可联网/隔离能力未确认的扩展不给该根或派生内容。未经实际OS隔离验证，不宣称隔离同用户恶意代码；缺相应保障时禁用该组合。真正密钥留本机凭据服务，不随项目、LAN或记录同步。

上述都是设计义务，当前未做隐私/沙箱/运行验证。R计费/平台运营继续后续，无新增云部署。
