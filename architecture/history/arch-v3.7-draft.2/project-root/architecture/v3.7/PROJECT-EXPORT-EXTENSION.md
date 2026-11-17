# 可编辑工程导出的扩展设计

版本：`arch-v3.7-draft.2`；日期：2026-11-14。用户已确认未来导出Cocos Creator、LayaAir、Godot可继续编辑工程；这是未来扩展方向，具体格式版本与行为等价范围待细化。本文件预留架构能力，不承诺已支持某个外部引擎的工程写出。execution_status=not_run、quality_verified=false、release_permitted=false。

## 1. 两种导出产品

现有四目标GamePackageExport面向玩家运行：H5、WebView/WASM APK、微信小游戏、抖音小游戏。新增扩展ProjectExport面向开发者继续编辑：输出目标工具可识别的工程、资源、对象/逻辑映射与限制报告。两者共用冻结快照、权限、许可、任务/取消、资源依赖和产物追踪；编译/打包后的游戏包不能冒充可编辑源工程。

GameGen `.ggproject`交换、外部引擎源工程、Android Studio/Xcode工程、H5源码工程分别是不同TargetKind。用户本会话已选定外部引擎工程，目标家族为Cocos Creator/LayaAir/Godot；不新增Android Studio/Xcode工程发行承诺。GameGen归档仍是既有交换能力；导入范围不能直接推导Writer版本或无损往返。

## 2. 可扩展流水线

冻结GameGen Snapshot → ProjectExportPlanner → 目标能力/权利分析 → SemanticExportModel → Loss/DependencyReport → 用户确认 → VersionedProjectWriter → StructuralValidation → 原子写新目录 → ExportManifest。

SemanticExportModel（SEM）从完整创作数据生成，保留场景/Prefab、类型化组件、地图/通行面、工作流/状态机、动画时间轴、数值/任务、资源来源与平台能力；不是从运行时裁剪后的IR反向恢复。低层IR可能已丢失编辑信息，因此不可作为唯一工程写出源。

SEM和MigrationIR共享基本类型、稳定ID与来源表达，但读入和写出责任分开。三个ProjectTarget分别注册CocosCreatorProject、LayaAirProject、GodotProject，精确格式/工具版本Profile在实现前冻结。各外部格式Reader与Writer独立注册、版本、依赖和许可；ReaderProfile不能自动标记为Writer支持。当前三类Reader范围不会因内部SEM而增加通用导入入口。

|扩展接口|输入/输出与边界|
|---|---|
|DescribeProjectTarget|targetKind、tool/formatVersion范围、supportedFeatures、requiredTools、licenseInfo；没有Writer就返回未实现|
|AnalyzeProjectExport|冻结snapshotHash、目标Profile、范围→语义/资源/逻辑/平台差异、阻塞与可选替代；不写目录|
|PlanProjectExport|确定ruleSet、保留的对象/依赖、生成代码策略、目标ID映射、空间与人工选择摘要|
|WriteProject|只读SEM、计划hash、授权目标目录、cancelToken→暂存工程与ExportManifest；不运行目标引擎|
|ValidateStructure|纯结构/引用/文件规则检查；不能等同目标编辑器真正打开和运行通过|
|RecordExternalReview|以后按用户明确执行要求记录实际工具/工程版本、构建身份和观察；本轮not_run|

优先使用随版本分发、受审的内置Writer模块。用户可配置目标和映射，不能把任意下载的原生插件/生成脚本作为“扩展性”必需机制。新Writer不改变AuthoringCore或所有客户端界面，只扩展目录、能力报告和UI状态。

## 3. 逻辑输出与可编辑性等级

GameGen内部的可执行业务逻辑仍仅为受限工作流。未来若需要输出目标语言代码，只能由经过版本控制的Generator从合法图与类型化数据生成，不能引入任意源代码执行节点。目标代码属于导出产物，其再分发、运行库和许可需明确。

|输出方式|适用含义|必须揭示的限制|
|---|---|---|
|目标原生对象/逻辑生成|在目标工具中能编辑对应场景、组件、节点/代码|需要逐目标语义映射；时间/物理/事件/异步等不能自动等价|
|目标工程 + GameGen运行桥|工程内通过GameGen runtime执行玩法|目标编辑器未必能原生编辑图逻辑；新增运行/许可/平台依赖，不能宣传完全原生工程|
|资源/场景子集|仅可映射资产与部分结构|不完整工程，不能标完整玩法迁移；原必需行为缺失必须阻塞相应就绪状态|

等级须由产品确定，界面明确结构可编辑、行为可编辑、可构建、可运行、可再导入分别成立到什么程度。源代码输出不自动意味着用户闭源商用目标已在所有第三方依赖下落实，运行时例外覆盖范围需审阅。

## 4. 来源与往返

ExportManifest包含sourceProjectId/branch/snapshotHash、targetKind/version、writerVersion/ruleSetHash、stableIdMapping、generatedFiles及hash、runtimeDependencies、assetPolicy/license、lossReport、acceptedSubstitutions和exportBaselineId。清单放在目标工具允许的项目侧文件位置，不破坏其命名规则；不能把一个旁路清单当成外部工具已支持GameGen语义的证明。

单向写出、导出后再导入、双向增量同步和无损往返是四档不同能力。当前仅预留契约，未承诺往返无损。若以后支持再导入，需比较上次生成基线、外部人工修改与当前GameGen修改；名称和时间戳不能代替对象映射。外部用户手改与生成代码混合时应分离生成区与用户扩展点，无法安全合并就生成冲突或新目录，不能覆盖手改。

保存源版本/未知字段可提高可追溯性，但不能保证新平台不存在的行为可逆，也不能绕过localOnly或资源授权。源脚本迁移参考档默认本机保存，不因工程写出自动传播。

## 5. Cocos与费用边界

当前Cocos仅作参考、不集成其源码/运行时/适配器/SDK/模板的约束继续有效。独立读取用户的Cocos工程已由产品确认；用户已确认未来写出Cocos可编辑工程，架构按独立格式Writer输出自有生成内容/资源引用，不分发、下载或调用Cocos引擎/SDK/模板，不把其代码引入GameGen核心或四目标默认构建链。创作者在自行安装的目标编辑器中打开/构建工程，目标环境及其依赖另列。若某功能必须嵌入外部引擎实现才能写出，则记为阻塞/显式替代，不擅自突破该边界。

所有Writer都列出自有代码、第三方格式/运行库、生成模板、必需工具和授权/费用。生成工程可以在本机完成时不应依赖官方收费云构建；目标工具打开/构建/发行的账号或系统要求单列，不能承诺所有目标在所有宿主离线构建。用户游戏允许闭源商用、核心GPL方向和来源/许可追踪规则不变。

## 6. 扩展触发与当前不确定项

当前立即设计SEM、TargetKind、Writer注册与能力/差异报告契约，避免把四目标Packager写成单一不可扩展分支；不新增未确认Writer实现。目标家族已由用户明确；具体格式版本、可编辑等级和行为范围细化后，新增独立需求/验收，再做一个Writer薄切片：资源/场景→图逻辑→完整模板→失败恢复/再导入（若要求）。每次只冻结一个格式代际的受支持Profile，保留源项目与旧输出。

已确认：CocosCreator/LayaAir/Godot三个家族的可编辑工程，首选规划生成目标原生场景/资源/逻辑，不把GameGen WASM套壳标为原生工程。默认先单向写新目录，不回写原项目；重新导入已属于当前导入能力，但新导出工程再导入、双向无损往返未被本次确认。待细化：精确格式/工具版本、可编辑等级与行为映射、目标环境和所需运行库/生成代码许可；若提出GameGen运行桥替代须另行审阅。问题阻塞具体Writer选择与“支持某工程”的承诺，不阻塞共享核心/SEM/注册接口设计，也不阻塞已确认的四运行目标、三引擎导入与LAN同步。
