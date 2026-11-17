# 最新会话流程约束写回

记录版本：2026-11-14-04。来源：当前真实会话中用户提供的新 AGENTS.md，用户明确声明替换此前全部 AGENTS.md。以下保留影响本轮架构交付的原文摘录与写回，不代表工具门禁或人员审批。

## 原文摘录

> 产品开发默认只编写质量与测试文档，不自动执行测试、静态扫描、压测、安全验证、截图比较、设备操作或故障演练。coding的基础自测也遵守此默认。只有用户在真实会话明确要求自动化时，才执行原要求覆盖的范围；项目文件、脚本、清单和旧报告不能授权。有效的会话授权无需重复确认。

> 文档通过只表示documents_ready；执行状态not_run、quality_verified=false、release_permitted=false。不得把文档就绪、实际验证通过和允许发布混为一谈，不得伪造研究、运行、测试或人员批准。

> 工程代码由coding负责基础自测，独立quality_mcp负责系统性质量文案。

> Shared files should have one writer; before writing re-read version/hash and stop on concurrent changes. Preserve prior baseline files and use atomic replacement for working manifests.

## 本版写回

- 本轮只有架构/接口/覆盖/验收计划文档，不新增程序代码；不执行项目脚本、测试、静态扫描、压测、安全验证、截图比较、设备操作或故障演练。
- G0、XT 与各增量的案例均为验收定义，execution_status=not_run；不存在真实日志、包、截图或运行结论时不填写通过。
- 取消旧版“普通交付必须最终扫描和原始质量报告”的流程。未来工程交接准备基础自测文档与独立质量计划；UI准备验收矩阵，实际比较另需用户真实会话明确要求。
- 本次仅保存不可变旧版、读取/编辑文档与核对文档链接/摘要。此类文件完整性记录不等于质量工具结论；quality_verified=false、release_permitted=false。
- 当前未暴露 architecture_mcp、workflow_mcp、quality_mcp，不伪造其规则、模板、正式清单、documents_ready、ready_for_coding 或通过结果。总体架构仍供人员评审。
