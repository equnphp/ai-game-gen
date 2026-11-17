# GameGen 可跳过的新手引导增量包

版本：onboarding-20261117-draft.1；2026-11-17。真实用户要求：“加一个新手 引导，可以跳过”。

- [完整交互规格](ONBOARDING.md)：首次欢迎、六步基础实操、随时跳过、重开、选学课程、进度和四语/跨端细节。
- [结构化索引](onboarding.json)：六个界面组合、六步、十二类状态、四条需求/十二条产品验收定义。
- [UI与架构交接](UI-HANDOFF.md)：映射原操作面和后续需要真正补画的状态。
- [本次文档状态](DOCUMENT-STATUS.md)；[文档检查](DOCUMENT-CHECKS.json)；[输入基线](INPUT-BASELINES.json)。
- 上一完整基线：[全量UI细节](../full-ui-details-20261117-draft.1/README.md)，本包为其增量，不覆盖旧文档或根无GUI M1清单。

默认：欢迎可直接跳过，过程中可跳过本步或结束；帮助与学习可重开。基础教程内置离线资源，不要求模型Key/MCP/付费；高级与类型专属课程按用户需要打开。跳过不删除练习/草稿/已提交修改，不自动取消业务任务。学习进度只存本机，不上传或随项目同步。

交付是详细需求与交接文档，六种组合沿旧工作区展示，不新增六个顶层主页。**新增实际画板0，功能实现未交付，artboards_status=planned_not_drawn；execution_status=not_run，quality_verified=false，release_permitted=false。** 正式角色审批待登记，文档检查不能代替可用性验证或批准开发/发布。
