# 技术决定、替代方案与许可

版本：editor-web-v1-draft.1；2026-11-17。当前用户指令“可以，写到架构设计文档”确认技术路线；不是已运行结果或全体角色对最终文件摘要的批准。

## ADR-EW-01：共用Web表现层

决定：采用TypeScript + React，常规界面语义DOM、工作流DOM + SVG；由EditorHostPort接共享C++核心。
原因：用户强调Codex功能自测不用识图；DOM/无障碍树可提供控件名称、状态和稳定定位。React不是唯一能达成目标的框架，Vue 3也可；选择React统一后续组件/测试约定。
备选：Qt/QML有开源测试路径并非必须付费，但跨浏览器的DOM工具不能直接复用；Flutter有Widget/integration_test，但需额外Dart测试和系统UI适配；全部自绘需自行暴露对象语义。现有Qt/Flutter均是候选而非已交付生产前端。
成本：WebView兼容性、IME/触控、复杂视口/大图性能需适配；DOM存在不等于画面正确。
替换：[V3.7总体第3节](../v3.7/ARCHITECTURE.md)和[共享核心文档](../v3.7/SHARED-CORE-AND-CLIENTS.md)的Qt/Flutter表现层候选，其余领域/端口分层保留。

## ADR-EW-02：Tauri 2薄宿主

决定：采用Tauri 2为后续编辑器首选宿主；Rust仅桥接C ABI、权限和生命周期，必要系统能力用Kotlin/Swift插件。业务核心不迁到Rust。
备选：Electron适合桌面且有Playwright路径，但移动端仍需另一宿主；自研WebView2/WKWebView壳可行但增加窗口/权限/打包维护成本；Qt WebEngine壳继续增加Qt依赖。
成本：Rust/插件/移动SDK接入及系统WebView差异。首个Windows/Android贯通增量必须给真实集成证据，不能由官方支持列表推断本项目已运行。
边界：Tauri不进入游戏成品，APK游戏仍WebView+C++ WASM；浏览器不直接加载原生核心。
依据：[官方架构](https://github.com/tauri-apps/tauri)、[移动插件](https://v2.tauri.app/develop/plugins/develop-mobile/)。

## ADR-EW-03：结构化自测

决定：C++测试宿主、浏览器Playwright、成品宿主WebDriver/移动驱动分别出证据；需要探索时使用Playwright MCP结构化无障碍树。稳定testId补充语义，投影来自真实模型。
备选：纯截图点击、只测内部API、只用模拟后端都不足以覆盖真实界面事件/桥接/持久化。
成本：维护语义/投影/同步契约；图形和设备质量仍需独立验收。不得把结构化状态当GPU输出证明。
依据：[定位器](https://playwright.dev/docs/locators)、[MCP机制](https://github.com/microsoft/playwright-mcp)、[报告](https://playwright.dev/docs/test-reporters)。

## ADR-EW-04：免费自测工具链

决定：优先免费开源实现。桌面选择Tauri官方列出的开源WebdriverIO/WebDriver路径，移动按平台接驱动；不把商业provider的付费API Key设为必要条件。嵌入式测试驱动只启用在测试构建。
限制：Playwright浏览器结果不等同Tauri成品；移动适配有额外接入成本。[Tauri测试](https://tauri.app/develop/tests/webdriver/)与[手动/移动接入限制](https://tauri.app/develop/tests/webdriver/manual-setup/)是工具能力依据，非本项目证明。

## ADR-EW-05：隔离迭代与许可边界

决定：新UI包独立版本化，root清单/M1无GUI契约和旧冻结件不改；根ARCHITECTURE.md更新导航/生效关系。新包未进入开发阶段，UI计划和依赖兼容组合仍需交接。
GPL与独立游戏闭源商用方向不变；编辑器工具、宿主桥、C++核心及导出运行时边界按原开源方案，正式例外文本不由UI选型替代。框架原许可/NOTICE分别保留，不把MIT/Apache依赖改标自有GPL。

## 依赖接收策略

下表是2026-11-17从官方npm注册表读取的源元数据。当前没有下载包字节、安装或兼容测试；这些版本不是已验证的组合。EW-T01需选择兼容组合，固定Node/Rust/平台SDK、Tauri Rust crate、API/CLI、驱动/插件、浏览器版本，并保存锁文件、来源、许可、传递依赖及实际摘要。官方dist integrity不是本机已下载SHA-256。
不得用npm/npx/cargo浮动latest构建；不将旧原型node_modules作为已接收依赖。WebdriverIO/Appium主版本与Tauri插件需要匹配，不能机械采用各自最新版本。源元数据文件：[目录](inputs/dependency-source-catalogue.json)。

许可原件：[React](https://github.com/react/react/blob/main/LICENSE)、[Tauri](https://github.com/tauri-apps/tauri)、[Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE)、[Vite](https://github.com/vitejs/vite/blob/main/LICENSE)、[WebdriverIO](https://github.com/webdriverio/webdriverio/blob/main/LICENSE)、[Appium](https://github.com/appium/appium/blob/master/LICENSE)。主包许可不能替代传递依赖/SDK/平台发行费用清单。

## 官方元数据目录（未锁定/未验证兼容）

|包|读取版本|声明许可|
|---|---|---|
|react|19.3.1|MIT|
|react-dom|19.3.1|MIT|
|typescript|7.0.2|Apache-2.0|
|vite|8.3.8|MIT|
|@tauri-apps/api|2.12.5|Apache-2.0 OR MIT|
|@tauri-apps/cli|2.12.5|Apache-2.0 OR MIT|
|@playwright/test|1.65.1|Apache-2.0|
|webdriverio|10.2.0|MIT|
|appium|4.0.0|Apache-2.0|
