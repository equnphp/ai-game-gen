# GameGen 本地一期开发交接包

版本：local-core-v1-draft.2；日期：2026-11-17。本包落实用户“先不搞云端”“那你补充清楚”，将上一版M1项目与事务核心细化为可评审的编码输入。只交付文档、接口与DDL设计稿；未实现、编译或执行测试。文档就绪、开发交接批准、实现验证和发布许可分别记录。

阅读顺序：

1. [本期需求与范围](requirements.md)：哪些属于本包、与完整产品的关系、验收编号。
2. [架构与决定](architecture.md)：模块、依赖、质量目标、变更与风险。
3. [API规范](api.md)和[C ABI定义稿](spec/gg_core_v1.h)：函数、消息、任务、错误、内存与线程。
4. [数据模型](storage.md)和[SQLite DDL](spec/project_v1.sql)：字段、约束、引用、历史、资源与快照。
5. [事务与恢复](transactions.md)：提交顺序、撤销重做、幂等、取消、损坏与迁移。
6. [环境与平台端口](platforms.md)：固定工具/依赖版本、Windows/Android职责与制品。
7. [研发任务与交付](work-items.md)：按顺序领取任务、提交物、验收与回退。
8. [基础自测文档](quality/basic-self-check.md)及[独立质量计划](quality/strategy.md)：仅计划，全部not_run。

完整产品背景继续以[上一版总架构](../../architecture/v3.7/ARCHITECTURE.md)和其需求输入为准。先做本期不表示删除完整地图/玩法、AI、局域网同步、三引擎导入或四目标导出。云端整个阶段暂缓；未来工程Writer和Apple编辑器仅保留边界。具体未就绪项和实际工具结果见本包documentation-check.json；不要把旧Qt约束增量的门禁当作本包结论。

交接角色：架构负责技术契约；coding负责实现和基础自测文档；独立quality负责系统性质量计划；产品/用户确认业务范围。真实接收/审批人未登记时保持未批准，不代签。所有程序代码仍归engineering，旧浏览器产品原型不计入本包实现范围。

## 接续开发交接（2026-11-17）

基础技术契约仍为local-core-v1-draft.2；最新交接补充为[local-core-v1-handoff.3](supplements/handoff-v3/README.md)，实际结论见[RESULT](supplements/handoff-v3/RESULT.md)和CURRENT-HANDOFF.json。补充包含已核对的开发指令、无GUI阶段、当前输入绑定和固定依赖接收；原冻结件不覆盖。依赖取得状态以补充记录为准。
