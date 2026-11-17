# GameGen架构与开发交接入口

当前本地一期版本：local-core-v1-draft.1；2026-11-17。用户明确云端暂缓，本包补齐共享核心M1的可评审编码输入；没有实现、编译或自动验证。

- [本地一期交接包](handoff/local-core-v1/README.md)
- [本期范围与验收](handoff/local-core-v1/requirements.md)、[详细架构](handoff/local-core-v1/architecture.md)
- [C ABI与消息](handoff/local-core-v1/api.md)、[存储DDL](handoff/local-core-v1/storage.md)、[事务与恢复](handoff/local-core-v1/transactions.md)
- [固定环境与平台端口](handoff/local-core-v1/platforms.md)、[研发任务](handoff/local-core-v1/work-items.md)
- [coding基础计划](handoff/local-core-v1/quality/basic-self-check.md)、[独立质量计划](handoff/local-core-v1/quality/strategy.md)
- [当前证据基线](handoff/local-core-v1/baseline.json)、[文档核对/实际门禁结果](handoff/local-core-v1/documentation-check.json)

完整产品背景保留：[arch-v3.7-draft.2总架构](architecture/v3.7/ARCHITECTURE.md)，旧完整版本与根清单归档于[历史入口](architecture/history/arch-v3.7-draft.2/project-root/ARCHITECTURE.md)。本期仅部分覆盖父REQ-017/040，完整42条/80项需求仍继承，不把完整GUI/图VM/引擎、三Reader/LAN和四目标打包标为本包完成。未来三Writer/Apple/平板仅保留扩展边界。

本期领域/资源权威同SQLite事务，Qt不进入核心或游戏运行包；商业Qt部分不用，必要差距按需自研。所有执行not_run、quality_verified=false、release_permitted=false；正式人员审批与开发接收另记，文档不授予发布许可。
