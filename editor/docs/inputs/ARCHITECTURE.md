# GameGen 架构与开发交接入口

更新日期：2026-11-17。编辑器当前架构版本为 **editor-web-v1-draft.4**，已接收产品经理最新七语言、英文默认与本机保存选择增量，并继承可跳过引导及完整交互。当前M1共享核心和后续完整编辑器分别按独立版本交接。

## 当前编辑器技术路线与最新语言范围

技术路线继续 **TypeScript + React共用表现层、Tauri 2薄宿主、C++20共享核心，以及不依赖识图的结构化自测接口**。Rust负责薄桥和本机UX编排，项目/领域/事务权威共用C++。

最新界面语言为 **English（首次默认）、简体中文、繁體中文、日本語、한국어、Español、Français**。有效已保存的本机选择优先于默认值；系统/项目/账号/LAN不自动覆盖。选择成功落盘后立即生效、无需重启；失败保留原有效语言，未知先核对。缺译逐键回退英文，简繁独立维护。

- [第四版架构总览](architecture/editor-web-v1/revisions/draft.4/ARCHITECTURE.md)
- [七语言启动、持久化、快速切换、资源与内容边界](architecture/editor-web-v1/revisions/draft.4/LOCALIZATION.md)
- [EditorUXPort1.1七方法与兼容规则](architecture/editor-web-v1/revisions/draft.4/UX-CONTRACTS.md)、[Schema](architecture/editor-web-v1/revisions/draft.4/contracts/editor-ux.schema.json)、[TS声明](architecture/editor-web-v1/revisions/draft.4/contracts/editor-ux.d.ts)
- [本轮开发交接与四个增量](architecture/editor-web-v1/revisions/draft.4/DEVELOPMENT-HANDOFF.md)、[LANG源验收映射](architecture/editor-web-v1/revisions/draft.4/contracts/requirement-map.json)、[语言政策](architecture/editor-web-v1/revisions/draft.4/contracts/locale-policy.json)
- [独立架构清单](architecture/editor-web-v1/revisions/draft.4/.architecture-mcp.json)、[文件基线](architecture/editor-web-v1/revisions/draft.4/baseline.json)、[文档完整性](architecture/editor-web-v1/revisions/draft.4/documentation-check.json)

七语增量适用全部213操作面、88对话原子状态/28组合、6个引导视图及基础课程的内置文字与布局，不新增同数量语言主页。语言偏好仅设备本机；已有聊天/项目/第三方原文、机器ID/枚举和游戏本地化配置保持。切换不重建任务/草稿/视口/引导，不自动调用模型、下载翻译或扣费。

[第三版引导](architecture/editor-web-v1/revisions/draft.3/ONBOARDING.md)、[编辑/对话状态](architecture/editor-web-v1/revisions/draft.3/EDITOR-STATE.md)、[完整源ID映射](architecture/editor-web-v1/revisions/draft.3/contracts/product-architecture-map.json)与[八个原新增开发增量](architecture/editor-web-v1/revisions/draft.3/DEVELOPMENT-HANDOFF.md)继续继承；其中“四语”段落由本轮七语规则取代。第三版28份产品输入和本轮6份语言产品输入均有各自冻结副本。原UX1.0保留6方法/原字段，新版1.1显式协商，不混用事件游标。

引导可随时跳过/结束，不撤销项目或取消业务任务。固定教学示例与真实AI结果分开，操作完成与学习进度落盘分开；语言则必须确认成功落盘才应用，不能套用教学进度的内存先行逻辑。课程和设备偏好不进项目/LAN/生成游戏。保存试玩默认先durable保存当前合法修改，再启动固定快照；缺Graph/Runtime能力真实blocked并可跳过。

详细产品交互输入已经提供；实际七语翻译资源、完整画稿、最终环境/人员接收、兼容锁与实现仍待办。历史冻结保留，不把文档提升当作已实现或已完成七语适配。

## 继承的精确宿主与核心契约

[第二版总览](architecture/editor-web-v1/revisions/draft.2/ARCHITECTURE.md)及其[Windows/Android FFI](architecture/editor-web-v1/revisions/draft.2/ABI-INTEGRATION.md)、[HostPort契约](architecture/editor-web-v1/revisions/draft.2/CONTRACT.md)、[异步Driver协议](architecture/editor-web-v1/revisions/draft.2/DRIVER-PROTOCOL.md)保留不变。

[Host Schema](architecture/editor-web-v1/revisions/draft.2/contracts/host.schema.json)12方法、[Driver Schema](architecture/editor-web-v1/revisions/draft.2/contracts/driver.schema.json)14方法、[Core Host TS类型](architecture/editor-web-v1/revisions/draft.2/contracts/editor-host.d.ts)不扩入UX字段。旧core-driver仍是阻塞CLI，不是新版驱动完成证明；[兼容候选/接收要求](architecture/editor-web-v1/revisions/draft.2/COMPATIBILITY-INTAKE.md)不是完整兼容锁。[技术决定、替代方案与许可](architecture/editor-web-v1/DECISIONS.md)继续继承。

常规UI用DOM、工作流优先DOM+SVG，场景渲染保留引擎视口并提供真实状态投影。此路线替换旧V3.7的Qt桌面/Flutter移动候选。浏览器、真实核心、打包宿主、设备与游戏产物分别记录证据；mock不能证明真实成品通过。新UX能力单独协商，测试可选proxy1.1增加/ux-rpc，生产不启动测试HTTP服务。

## 当前本地核心开发包

现有契约版本local-core-v1-draft.2；接续交接以[CURRENT-HANDOFF.json](handoff/local-core-v1/CURRENT-HANDOFF.json)指向的local-core-v1-handoff.3及实际开发回执为准。

- [范围与验收](handoff/local-core-v1/requirements.md)、[核心详细架构](handoff/local-core-v1/architecture.md)
- [C ABI与消息](handoff/local-core-v1/api.md)、[存储](handoff/local-core-v1/storage.md)、[事务/恢复](handoff/local-core-v1/transactions.md)
- [平台端口](handoff/local-core-v1/platforms.md)、[核心任务](handoff/local-core-v1/work-items.md)

ABI1.0、消息1.0、DDL/schema1及native结构不因本版文档而改变。根.product/.architecture/.workflow/.coding/.quality-plan清单继续服务无GUI M1，本轮不启动新编辑器开发迭代、不修改实现代码。实际源码、构建与验证状态以原索引/记录为准。

## 完整产品继承与边界

[总体架构V3.7](architecture/v3.7/ARCHITECTURE.md)保留产品背景；地图、关卡、动画、物理、数值、图VM、Agent、三Reader/LAN和未来三Writer等继续按各能力包推进。M1与本轮架构文档均不等于完整产品实现。

[四目标运行/导出](architecture/v3.7/FOUR-TARGET-ARCHITECTURE.md)、[可编辑工程写出](architecture/v3.7/PROJECT-EXPORT-EXTENSION.md)、[完整功能责任](architecture/v3.7/FEATURE-COVERAGE.md)、[开源边界](architecture/v3.7/OPEN-SOURCE-BOUNDARY.md)继承未被替换的决定。

游戏目标仍H5、WebView+C++ WASM APK、微信小游戏、抖音小游戏；Tauri是创作编辑器宿主，未来Apple/平板扩展编辑器。Cocos仅参考；必要依赖无强制商业授权。GPL及独立游戏闭源商用方向保留，正式许可文本和逐项依赖接收待落实。云端继续暂缓，R/F不变成当前云实施任务。

本轮没有安装、构建、测试、Schema/TS验证器、静态扫描、截图或设备操作。execution_status=not_run、quality_verified=false、release_permitted=false；文档/接口设计不构成实际可用性、人员批准或发布证明。
