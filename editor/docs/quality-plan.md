# 编辑器系统质量策略

版本editor-increment.1；依据独立quality_mcp模板编写，实际执行负责人待指派。execution_status=not_run，quality_verified=false，release_permitted=false。

## 范围与需求依据

范围为本次Windows宿主、项目/场景/资源主路径、任务恢复和七语本机选择，关联LC-REQ-01/02/03/04/07、LANG-REQ-01—03及原LC/LANG验收ID。产品完整操作面仍保留；本计划不把完整课程、聊天、模型、图编辑、Runtime、导出或其他平台算作完成。架构核对AR-INC-01—03写回属于源码修改记录，未实际复现或重测。

## 风险与优先级

最高优先级是数据丢失、写结果误判、跨分配器释放和偏好原件覆盖；其次是队列/单结果槽背压、关闭超时、迟到语言回执、焦点和长文布局。依赖候选未安装、完整锁及Core DLL未接收，所有编译、链接和兼容性风险仍开放。UI七语全稿和母语审校未到齐。

## 测试层次与适用性

八类分别登记：functional为项目/场景/资源/语言，排除未实现业务；integration为TS→IPC→Rust→C ABI→SQLite及独立UX文件；regression为旧格式、扩展字段、语言切换与原文保持；performance为有界桥接/任务预算，专项见load-plan.md；security为principal/grant/DLL/CSP/偏好出站，专项见security-plan.md；accessibility为语义控件、焦点、键盘、七语/大字；device以Windows真实WebView为当前目标，Android/iOS宿主不适用本增量，不能以窄窗替代真机；recovery为提交未知、结果丢包、关闭超时、偏好坏文件及进程重开核对。完整Driver/proxy、海量场景与多人协作尚未交付，不作通过声明。

架构维度：extensibility检查协商与领域唯一权威；availability只规划本地恢复，不承诺云HA；high_load遵循现有硬限额；concurrency检查actor、单槽、最后意图及背压；maintainability检查契约来源、锁和回退。技术阈值归架构，业务验收归产品。

## 用例与验收追溯

.quality-plan-mcp.json的Q-EW-01—08逐项登记需求/验收ID、前提、数据、步骤、预期、环境、所有者与not_run。coding的B-EW-01—17只覆盖改动单元和基础正反路径，不代替系统计划。验收分别接收业务、集成、UI、无障碍和设备记录；缺失覆盖不能合并成已通过。

## 环境数据与依赖

计划Windows11 x64、候选C1、1440×960和390×844、100%/200%文本、七locale、隔离新项目。实际OS补丁、WebView、字体、Core/Host/前端buildId和SHA、fixture、工具版本在执行时登记，当前均无。只用虚构测试数据和独立目录，不使用现有用户工程/凭据。候选锁与打包资源未接收时不得记环境已就绪。

## 进入退出标准

进入实际执行须用户在真实会话明确授权相应操作，并接收匹配制品、依赖锁、隔离数据及恢复负责人。文档检查只判记录就绪。实际退出须约定用例均有原始证据和实际结果、阻断缺陷关闭、未覆盖和风险由实际负责人接收；当前不满足，亦不据此自动发布。

## 缺陷与回归策略

缺陷记录关联case、环境/制品/输入、步骤、实际与预期、严重度、所有者和修复/重测状态。P0数据丢失/越权停止相应写入，P1主路径阻断优先修复，P2局部问题登记影响。修复后重跑受影响用例及相邻恢复路径，禁止用修改预期关闭问题。登记规则见defects-plan.md，当前没有运行缺陷或通过证据。

## 执行授权与结果模板

当前只编写方案，无测试/扫描/压测/攻击/截图/设备/演练授权。结果模板字段为run_id、真实user_request、authorized_operation、环境、source_revision、buildId/制品SHA、case_id、开始结束时间、实际/预期、evidence_paths、execution_status、缺陷和执行人；尚无执行时execution_status=not_run，不填虚构记录。
