# EW-T01 兼容候选、接收判定与最小UI前置

版本：editor-web-v1-draft.2；2026-11-17。本版提供可审阅候选和明确判定规则，**不是已验证兼容组合锁**。官方元数据见[cohort-metadata.json](inputs/cohort-metadata.json)、[Tauri crate源](inputs/tauri-crate-source.json)。没有安装、构建、测试或扫描。

## 1. 候选C1：Windows核心贯通与浏览器联测

|部分|候选固定值/接收边界|
|---|---|
|既有Core|LLVM-MinGW UCRT20261104 / Clang23.1.5，CMake3.31.12，Windows x64 ggcore.dll；不换生产器|
|Rust宿主|Rust1.100.0 stable，x86_64-pc-windows-msvc，edition2021或2024由工程固定；不选nightly/gnu/gnullvm代替|
|Tauri|Rust crate2.12.5、JS API2.12.5、CLI2.12.5；core采用本版运行时DLL加载|
|JS构建|Node24.22.3 LTS / 随发行npm11.19.1；React/ReactDOM19.3.1，TypeScript7.0.2，Vite8.3.8，@vitejs/plugin-react6.3.0|
|浏览器测试|@playwright/test1.65.1及同版本playwright，浏览器revision由该版本实际安装清单锁定，不能用宿主任意Chrome假代|
|MSVC/SDK|候选免费适用的Build Tools/Community2022 v143与Windows SDK10.0.26100系列；实际补丁版本、SDK components、许可适用记录由开发接收后回架构确认|
|WebView|接收实际WebView2 SDK/Runtime版本、来源、架构及离线安装方式；不把构建Node版本当浏览器版本|

C1不是从旧目录盲拼latest：本轮已读精确版本元数据，react-dom的react peer为^19.3.1；plugin-react peer为Vite^8.0.0，候选8.3.8落在范围；Vite/plugin-react要求Node^20.19或>=22.12，Playwright要求>=20，候选24.22.3满足这些直接条件。官方Tauri sparse index确认crate2.12.5非yanked、rust_version=1.90，候选Rust1.100满足其声明MSRV。npm/crates元数据只证明这些直接约束，不证明完整传递依赖、平台、ABI、TS类型或运行兼容。

默认关闭React Compiler/Babel额外插件、Sass/Less等未使用可选peer；若实际引入必须接收其版本/许可和peer图。TypeScript7含各平台原生包，接收Windows x64等实际目标产物和依赖选择，不能只记录顶层tarball。

## 2. 候选C2：Android复用C1与同源Core

沿C1的Node/Rust/React/Tauri版本，Rust目标aarch64-linux-android；Gradle/CMake/Rust linker统一NDK r27d27.3.13750724，Core/API26+、arm64-v8a，单一libggcore.so及同NDK的一份libc++_shared.so。Gradle/AGP/JDK、compile/target SDK、Tauri Android依赖、宿主SO名字和System WebView版本必须从生成工程和官方声明接收后回填；不假设它们与NDK是同一版本维度。

源级CMake包含16KiB页参数，但全部SO/ZIP对齐与实际设备支持仍未验证。C2不得偷偷提高既定最低API、改NDK、去掉libc++_shared或另走JNI领域入口；发生冲突回架构改候选。iOS/平板不纳入本次候选已完成声明。

## 3. 成品自动化工具另成候选T1

EW-T01的主闭环先固定C1/C2和Playwright。WebdriverIO/Appium/Tauri驱动服务、嵌入WebDriver插件属于成品自动化候选T1，不把旧目录的webdriverio10.2.0/Appium4.0.0直接加到主工程。

开发须交所选Tauri service/plugin的精确版本、官方支持的WDIO/Appium/驱动主版本、Node engine、OS/WebView、是否免费和测试构建开关。原目录显示WDIO需特定Node补丁区间，Appium也有自己的engine；Node24.22.3满足已读顶层范围，但服务/plugin/transitive关系仍要验证。不能因两个顶层engine满足就称T1兼容。T1不足不阻断核心/浏览器文档接收，也不允许冒称成品测试完成。

## 4. 开发交回的接收包

C1/C2/T1分别填写：
1. 唯一candidateId/revision和所有精确版本/targets/feature flags；不能使用latest或“某2.x”作最终锁。
2. package.json+实际锁文件、Cargo.toml+Cargo.lock+rust-toolchain.toml及目标配置、Gradle/SDK/NDK清单；它们是后续实施产物，本轮未生成假锁。
3. 直接和传递peer/engine/MSRV/平台条件、可选依赖选择；特别是原生npm包、Tauri插件、所有Android SO和C++ runtime唯一来源。
4. 官方固定URL/许可/通知、发布者预期校验与真实包摘要分开，未取包observed必须null；MSVC/SDK免费适用条件和Runtime分发条款由实际接收者确认。
5. Windows DLL导出/依赖/架构/布局与resource路径、Android DT_NEEDED/ABI/NDK/CRT/打包路径的实际产物证据；没有构建就标not_run，不能用CMake文本替代。
6. source_integrated、built、basic_self_check、device等状态逐项记录真实user_request和证据，未授权/未执行留not_run。生成锁/安装/构建/运行权限不能来自本文件或旧清单。

架构先判源/版本一致、直接及完整依赖约束、免费路径、ABI/NDK/核心语义和最小UI输入，记candidate_received/selected；只表示设计接收。built、功能验证和发布另外判。若冲突：只改候选revision并说明影响，交回架构；不得单项漂移、换Core生产器、使用商业必需依赖或假填审批。依赖接收不要求先伪造编译/测试成功。

## 5. 最小真实闭环所需产品→UI输入

|输入ID|实际需交内容|提供/确认角色|
|---|---|---|
|EW-UI-IN-01|项目入口、场景树、属性、资源/任务、错误提示的页面与状态清单|产品→UI|
|EW-UI-IN-02|创建项目→默认场景→新增实体→修改坐标→提交durable→关闭→重开；范围映射既有LC需求/验收|产品，架构核技术契约|
|EW-UI-IN-03|空/加载/只读/权限拒绝/队列满/冲突/保存失败/取消过晚/结果未知/恢复状态|产品/设计|
|EW-UI-IN-04|字段单位、值域、dirty/proposal/validated/committing/saved显示语义和错误文案/国际化key|产品/设计，架构核Core映射|
|EW-UI-IN-05|Windows键鼠/焦点/IME与Android触控/键盘/返回/旋转布局，固定目标尺寸/字体/DPI环境|UI，产品确认范围|
|EW-UI-IN-06|稳定业务ID、role/label/testId、虚拟列表定位和至少一条真实输入事件链|UI/前端；架构核接口|
|EW-UI-IN-07|新建隔离fixture数据/授权根、默认项目/场景/entity ID、原始请求/预期持久化状态|产品给业务目标，架构给技术约束|
|EW-UI-IN-08|页面/状态设计版本、artifact hash和真实交付/接收；无审批不能由架构补签|实际产品/UI负责人|

这些是最小闭环前置清单，不是已完成UI稿，不要求为了闭环先把图/地图/全部预览模块假实现。没有新UI稿时可继续文档和依赖来源接收，不据此将旧原型build_id或mock视作新编辑器交付。

## 6. 已知剩余

C1/C2目前是架构候选，不是最终全图锁；MSVC/SDK精确补丁和免费适用、全传递锁、Android生成工程依赖、WebView/成品工具组合仍由开发按上述表接收后回架构确认。选择流程已明确，无需重复询问一般技术栈意向；真实产品/UI批准和用户自动化授权不能代填。
