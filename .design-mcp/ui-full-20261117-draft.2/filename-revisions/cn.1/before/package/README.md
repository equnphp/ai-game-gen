# GameGen 完整界面补充设计 · draft.2

版本：ui-full-20261117-draft.2。日期：2026-11-17。设计作者：Codex。产品/设计负责人审阅：pending，未代签。

直接打开 [离线图库](index.html)，选择默认操作面、完整属性、领域状态、对话、新手引导或共享组件。PNG 在 previews/；可编辑 SVG 在 screens/。图库只浏览设计资产。

本包接续产品经理 full-ui-details、chat-states、onboarding 三个详细包。原 draft.1 与产品源文件保留；根 UI-DESIGN.md 指向本版。技术交接以 editor-web-v1-draft.3 的 React/TypeScript 展示层、Tauri 宿主和 C++ 共享内核为准。此全产品设计包不改变 no-GUI M1 的实现范围。

## 交付数量

|内容|定义数量|实际画稿数量|
|---|---:|---:|
|操作面（23 页面、129 子视图、44 抽屉、17 对话框）|213|419 张默认布局|
|全部字段/字段组 + 显式子字段|1195 + 538|419 张完整属性长图|
|业务动作|485|全部落在完整属性稿；955 处平台布局|
|领域状态|522|1030 张平台状态布局|
|对话组合视图|28（27 当前、1 未来）|56|
|对话原子状态|88|176 张组件稿|
|新手引导|6 视图、6 步骤、12 共享状态及补充变体|60|
|共享组件|24|24 张契约画板|
|四语引导文案组件|4|4|
|合计|不作为独立页面数相加|2188 对 SVG/PNG|

不是 2188 个业务页面。同一操作面的桌面/手机、属性展开和状态各有独立文件。213 个操作面中本地 199、后续联网 13、未来索引 1；Windows 引擎转换和 Android 接收报告遵守各自平台范围。

## 主要文件

- index.html：支持离线筛选、搜索字段与切换状态；catalog.js 为数据快照。
- overview-desktop.png / overview-mobile.png / overview-chat.png：选页总览。
- DESIGN-SPEC.md / INTERACTIONS.md：视觉和交互交接。
- COVERAGE.json / COVERAGE.md：来源条目到画稿，包含 67 个 PSR 审阅项的待复核映射。
- source/field-placements.json / action-placements.json：每个控件/动作在完整属性稿上的标识与坐标。
- source/inputs/：本次产品与架构输入的只读快照；source/input-baselines.json 记录哈希。
- tokens.json / tokens.css / assets/：变量、独立图标和示例素材。
- manifests/：分组设计验收矩阵；HANDOFF.json：交接边界。
- ARTIFACTS.json：文件哈希与尺寸清单。

## 当前边界

所有画稿已生成；做过代表性设计预览查看及字段/按钮落图清点。未对全部画稿逐张做人工语义验收。产品经理 67 项缺口仍待其按图复核，不自动标关闭。完整界面当前为简体中文；中英日韩四语只补充了引导欢迎组件，完整其他三语界面未交付。浅色主题为本包范围。

未执行产品构建、自动测试、静态扫描、截图对比、原生运行或设备操作。设计导出日志不是测试通过证据。execution_status=not_run，quality_verified=false，release_permitted=false；实际人员批准、最终构建和逐页最终验收仍待完成。

## 即时设计 / Pixso / MasterGo / 墨刀设计导入包

[导入包说明](import-pack/README.md)包含2188张命名对象SVG、25份独立素材与75份1×/2×/3×透明PNG，以及各工具的导入步骤。[素材浏览页](import-pack/asset-preview.html)可直接查看素材。蓝湖不在范围。原生组件、自动布局和实际平台导入仍待完成；不将标准SVG改后缀伪装原生工程。

本次还接收了editor-web-v1-draft.3的本机引导架构，补充“进度未记住”“缺少Graph/Runtime”画稿。根M1产品/架构/流程清单继续原迭代，不由本包推进阶段。

[下载四平台SVG与素材ZIP](GameGen-四平台SVG与素材-draft.2.zip)：约8.5MiB，包摘要见IMPORT-PACKAGE.json。
