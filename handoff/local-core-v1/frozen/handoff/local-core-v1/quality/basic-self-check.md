# coding基础自测文档

版本：local-core-v1-draft.1；owner=coding；implementation_status=not_started。只覆盖改动单元、正常主路径、失败路径；全部execution_status=not_run。不执行编译/测试/扫描，也不认证实现正确。详细记录在根.coding-mcp.json。

## 本次改动与边界

本次仅交付本地核心设计；将来coding按LC-T01—08实现SDK、文档、事务、历史、资源、快照和薄宿主。没有GUI/云端实现，不运行原型或第三方脚本。下列用例是对应单元的预定基础自测，不是系统性质量结论。

## 基础自测用例

|ID|类别|前置与数据|步骤|预期|追溯|
|---|---|---|---|---|---|
|B-LC-01|changed_unit|ABI1.0、空/错误size配置|创建/释放句柄、借用/输出buffer和无效token|合法所有权可释放；无效输入明确拒绝，不跨CRT free|LC-REQ-07/LC-AC-14|
|B-LC-02|changed_unit|初始Settings+Scene，重复ID/非法变换fixture|逐字段验证合法/非法候选|合法保留extensions，非法不提交|REQ02/AC04|
|B-LC-03|changed_unit|项目库v1，旧head及请求记录|插入候选事务/提交，再用同ID同字节/异字节调用|只一次revision，冲突拒绝|REQ02/AC03|
|B-LC-04|main_path|授权空目录、两端同一fixture|创建→编辑→提交→撤销→重做→关闭→重开|领域值/稳定ID/持久化正确|REQ01/AC01|
|B-LC-05|main_path|2MiB+17字节同内容资源两份元信息|分块→finish→attach→引用→快照恢复|字节核验、去重与独立来源保留|REQ04/AC06|
|B-LC-06|failure_path|旧revision/错误引用/坏validatedHash|尝试commit再读head|错误可定位，旧head不变|REQ02/AC04|
|B-LC-07|failure_path|上传断流、坏hash和取消任务|finish/attach/取消，重开查状态|无半资源/虚假取消或已保存|REQ04/AC07|
|B-LC-08|failure_path|空间不足/I/O错误/较新格式fixture|提交/打开，按lookup和恢复规则处理|原件保留，明确停写/只读/拒绝|REQ07/AC13|
|B-LC-09|changed_unit|三次编辑和200项窗口边界|Undo/Redo/清redo分支|批次整体恢复，head单调|REQ03/AC05|
|B-LC-10|main_path|旧快照含资源与extensions|restore→Undo restore→重开|新事务恢复领域状态，旧点保留|REQ05/AC09|
|B-LC-11|main_path|双端相同SDK数据/操作|分别调用并比较领域结果/拒绝原因|同源语义一致，不把本地时间/审计UUID当业务差异|REQ06/AC10|

## 正常与失败路径

正常路径覆盖新建/提交/历史/资源/快照/双宿主；失败路径覆盖非法输入、旧head、坏hash、取消和I/O不确定结果。changed_unit聚焦当前单元边界，不替代quality的完整安全/压力/故障矩阵。

## 预期结果与恢复

成功以持久化收据与重开状态为准；失败不推进head、不产生半引用；未知提交先lookup。每例的预期见表，回退使用原库/备份和上一实现，不能删WAL或覆盖坏库。

## 执行状态与限制

环境计划：platforms.md中的固定Windows/Android核心环境，具体设备/构建/执行者留给真实执行记录。表内REQ/AC省略LC前缀处均指本包。不得填“通过”或复用旧浏览器原型证据；更广的集成/回归/容量/安全/设备/恢复交独立quality。
