# 编码任务与接收清单

版本：local-core-v1-draft.2。当前只交付设计与计划，下面的实现产物尚不存在。前后端/宿主技术问题归架构，不允许用临时直写SQL、自由脚本、云兜底或付费Qt绕开契约。

## 实施基线与增量

工程根为I:/code/GameGen，原浏览器原型仍为参考，不纳入本包生产实现。建议新增目录如下，避免与原型JS/设计素材混合：

```text
native/CMakeLists.txt
native/cmake/                     固定工具链与离线vendor位置
native/core/{schema,document,application,tasks,assets}/
native/core/storage/sqlite/{schema_v1.sql,migrations}/
native/sdk/include/gg_core_v1.h
native/sdk/src/                   C边界/句柄/缓冲区
native/platform/{windows,android}/
native/bindings/android/          仅薄JNI，不承载领域规则
native/tools/core-driver/         无界面接入与示例驱动
native/tests/{unit,fixtures}/
native/third_party/               冻结源码与原许可通知
```

创建上述工程前，coding须inspect_project/get_project_rules/find_reuse_candidates；先看是否已有实现。本次没有创建这些空目录或生产代码。Windows/Android库只共享C ABI，不交换STL对象。后续接入UI/AI/同步必须使用SDK，不打开数据库。

## 前后端交付与接口

|任务|依赖/范围|必须提交的产物|验收与失败边界|回退|
|---|---|---|---|---|
|LC-T01 环境与SDK边界|无；不依赖GUI/云|冻结依赖源/哈希/许可记录、CMake配置、C头、句柄/buffer/task接口|LC-AC-14；ABI版本错误拒绝，跨CRT不free，未下载/验证明确记录|独立新增native路径；保留旧原型和旧锁定清单|
|LC-T02 存储与项目会话|T01|DDL落地、单写连接、RootGrant/独占锁、创建/打开/关闭和初始状态|AC01/02/13；较新格式、半初始化、第二写者不覆盖原库|只用新项目fixture；失败不迁移用户项目|
|LC-T03 文档/提案/事务|T02|Scene/Settings验证、稳定ID/引用、提案/提交、幂等requests、事件|AC03/04/10/11；校验后head变化必须冲突，非法批次不推进revision|每改动一条命令可回退；保持旧schema fixture可读|
|LC-T04 历史与快照|T03|正逆指针增量、Undo/Redo、200窗口、20自动点/锁定/restore|AC05/08/09；不重写旧revision，恢复也生成新事务|只追加新事务；不可用功能关闭入口，旧快照不删除|
|LC-T05 资源与引用|T03/T04|分块/完整hash、READY、attach、去重/元信息、blob读取|AC06/07/10；缺块/坏hash/取消不产生引用；一批多个对象原子|保留未引用READY作为可回收数据，不删保护根|
|LC-T06 故障恢复与维护|T04/T05|只读诊断、backup API、GC dryRun/执行、格式拒绝/迁移注册框架|AC08/12/13；不删WAL，不覆盖损坏库，未知提交lookup|保留原库/备份与脱敏报告；迁移功能未注册则明确拒绝|
|LC-T07 双宿主绑定|T01—06|Windows库+头/说明，Android SO+薄JNI说明，同一操作示例fixture|AC01—14对应边界；锁屏/句柄失效/取消/16KiB页均有计划；实际证据另待授权|绑定可替换，领域数据/核心契约不分叉|
|LC-T08 交接与差异关闭|T07|源码/依赖清单、文档版本、基础自测记录、独立quality计划接收、已知缺口|未执行保持not_run；实际构建不存在则build_id为空；不能把文档检查算运行通过|保留前一成功版本和未解决项，不发布未授权产物|

这里AC简写均指LC-AC编号。角色owner为待指派的coding/architecture/independent_quality，没有伪造姓名或工期。每名实现者WIP=1，最多2个待集成变更；共享头/Schema/DDL指定单写者，写前重读版本/hash，冲突先回架构。实际编译、测试、设备验证仍受用户真实会话授权范围限制，任务中的验收步骤不是执行授权。

## 需求设计测试追溯

LC-REQ-01→API项目/DDL project→AC01/02→Q-LC-01/02；REQ02→事务/Schema→AC03/04→Q03/04/05；REQ03→history→AC05→Q06/07；REQ04→blob/asset→AC06/07→Q08—11；REQ05→snapshot/recovery→AC08/09→Q12—15；REQ06→平台/未知字段→AC10/11→Q16—19；REQ07→任务/维护→AC12—14→Q20—28。完整case字段见quality/cases.json，coding基础范围单独列出，不能拿基础计划替代系统性质量计划。

## 质量与安全验证

当前execution_status=not_run、quality_verified=false。基础自测由coding领取；质量八类由独立quality编制，见quality/strategy.md。没有运行、截图、原始扫描或性能数据，不要求以虚构执行记录换取文档就绪。实际执行必须得到后续用户明确要求，按真实环境记录build_id、工具版本、输入、输出与失败覆盖。

## 最终构建与UI复验

本包无GUI，不做页面/截图比较。最终核心库应在Windows x64和Android arm64分别产生可追溯制品，给出ABI/格式/依赖/SHA-256；生产包尚未构建。后续完整编辑器仍需UI规格、交互/可访问性/真机和目标包验收，不能以本包has_ui=false豁免未来UI。

## 部署监控与恢复

本包无云部署。库随本地宿主安装，明确安装/升级/回退版本；只在支持的私有目录开可写项目。诊断本地限额轮转、默认不上传。升级先检查formatVersion，不能降级强写；坏库保留并按transactions失败矩阵处理。没有自动安装设备、迁移、发布或故障演练授权。

## 已知限制与移交

M1不等于全产品：完整UI/图VM/引擎、Reader/LAN、四目标导出等由后续包承接。当前技术选择已给定；下载源校验和真实人员任务认领仍需记录。凡实现无法满足ABI/DDL/预算，提交具体冲突与替代/数据影响给架构改版，不在代码中单方面改变。正式接收批准另记；审批记录不能为空时保持未批准，不能把用户“补充清楚”当作全文已审。
