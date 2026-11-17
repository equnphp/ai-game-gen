# 编辑器基础自测计划

版本editor-increment.1，归属coding。全部用例not_run；没有构建或执行证据。

## 本次改动与边界

改动为独立editor生产前端、Tauri/Rust Host1.0桥接、UX1.1四方法与当前82键七语资源。原C++M1不改；未实现完整UI、课程/模型/Graph/Runtime、Android宿主和Driver14。测试前必须实际接收候选环境、完整锁、Core DLL/运行库、制品摘要和版本；只在后续用户明确授权的隔离fixture执行。

## 基础自测用例

|ID|类别|步骤与数据|预期|来源|
|---|---|---|---|---|
|B-EW-01|changed_unit|伪造token/跨session任务、非法Base64/长度/U64、未知字段、错误ABI|受理前拒绝，Core状态不改|Host1.0 / LC-AC-02|
|B-EW-02|main_path|新建→新增对象→输入名称/坐标→停顿保存→关闭→重开|稳定ID/字段保留，实际durable后才显示保存|LC-AC-01/03|
|B-EW-03|failure_path|输入未完成负号/空值/非法数值，切换语言，再修正；旧revision提交|草稿不丢；不自动重放冲突写；无效值不反复提交|LC-AC-04 / LANG-AC-04|
|B-EW-04|changed_unit|批次保存→Undo→Redo；有草稿时分别保存/丢弃/取消离开|新revision、原子恢复；丢弃不撤销已提交数据|LC-AC-05|
|B-EW-05|main_path|三块本地文件finish→attach→引用；双源相同内容|真实Core资源和hash，无半资源引用|LC-AC-06|
|B-EW-06|failure_path|任务已终态但result传输失败；后续查询原task；release回包丢失|未拿到结果不释放；已知业务收据不改报失败|LC-AC-12/13|
|B-EW-07|main_path|空设置启动→七项选择→重开；系统/项目语言与已存不同|首次英文；本机有效选择优先；不改项目和聊天|LANG-AC-01/02/06/08|
|B-EW-08|failure_path|A accepted响应迟到于A committed快照；同ticket旧revision/旧saving快照|保持已确认状态与有效语言，不回退|LANG-AC-05|
|B-EW-09|failure_path|A保存中选B再选A；两窗口乱序；失败/未知后snapshot|按seq/ticket处理最新意图；失败保留旧有效；未知先核对|LANG-AC-04/05|
|B-EW-10|failure_path|未来schema/坏文件/读取失败/替换失败/外部文件版本变化|保留原件，安全英文不自动落盘，未来版本只读|LANG-AC-03/05|
|B-EW-11|changed_unit|切换七语时保持输入法组合、草稿、选区、待完成Core任务|不重建会话、不重发请求；下一轮再取新回复默认语言|LANG-AC-04/08/09|
|B-EW-12|failure_path|缺DLL、篡改摘要、未列出的依赖DLL、重解析点、缺符号|不从PATH/项目找库；Core能力null/拒绝|LC-AC-14 / EW-T03|
|B-EW-13|main_path|保留task结果槽→第二task取结果→释放→再取；有任务关闭drain/cancel|单槽背压；释放原buffer；deadline未完成不报CLOSED|Host1.0 / LC-AC-12|
|B-EW-14|changed_unit|首页/欢迎/设置共用语言面板，项目名/旧聊天/机器枚举含不同语言|只刷新内置文字、根lang/可访问名；原文保持|LANG-AC-07/08/09|

|B-EW-15|failure_path|关闭态/队列满/非法请求/假token后提交；模拟原生成功但回执损坏|受理前not_submitted；受理后submitted_unknown；读取失败不声称领域写状态|AR-INC-01 / LC-AC-13|
|B-EW-16|failure_path|afterSeq超出真实事件尾，再取得snapshot并读取后续新增事件|gap=true；nextSeq回到实际尾，可继续推进|AR-INC-02 / LANG-AC-05|
|B-EW-17|main_path|选择新语言/同语言；accepted、真实committed、unchanged、迟到旧意图及重启历史收据|只对当前最新真实成功显示一次新语言提示；4.5秒后消失|AR-INC-03 / LANG-REQ-03 / LANG-AC-07|

## 正常与失败路径

正常主路径必须经过真实生产UI→Tauri→原C ABI→C++数据库和同一LocalUX文件端口。浏览器无宿主不自动mock；Mock组件与真实Core结果独立。错误覆盖合法/非法字段、原始字节重试、队列/任务/关闭、存储和迟到响应；只定义步骤，不实际注入故障。

## 预期结果与恢复

Core保存、语言保存、任务受理、业务终态各有自己的事实。未知提交查询原task/request.lookup；不换ID盲重放。语言accepted不能设为effective；已提交/失败状态不能被同ticket旧响应覆盖。停写/只读保留原件，不删除WAL、坏库或未来偏好文件。

## 执行状态与限制

所有17项execution_status=not_run，buildId空，quality_verified=false，release_permitted=false。当前无安装/编译/运行/类型验证/截图/设备结果；源码文本修正与依赖元数据均不证明行为通过。完整八类系统计划另见docs/quality-plan.md。
