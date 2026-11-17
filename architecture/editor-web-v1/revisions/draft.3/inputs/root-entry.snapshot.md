# GameGen 架构与开发交接入口

更新日期：2026-11-17。编辑器当前架构版本为 **editor-web-v1-draft.3**，已接收产品经理新增的可跳过引导、对话完整状态与详细操作面。当前M1共享核心和后续完整编辑器分别按独立版本交接。

## 当前编辑器技术路线与新需求

用户确认的路线继续为 **TypeScript + React共用表现层、Tauri 2薄宿主、C++20共享核心，以及不依赖识图的结构化自测接口**。Rust负责薄桥和本机UX编排，项目/领域/事务权威继续共用C++。

- [第三版架构总览](architecture/editor-web-v1/revisions/draft.3/ARCHITECTURE.md)
- [可跳过引导、真实完成证据、本机偏好与恢复](architecture/editor-web-v1/revisions/draft.3/ONBOARDING.md)
- [对话多轴状态、完整操作面、保存试玩与隐私](architecture/editor-web-v1/revisions/draft.3/EDITOR-STATE.md)
- [独立EditorUXPort六方法](architecture/editor-web-v1/revisions/draft.3/UX-CONTRACTS.md)、[UX Schema](architecture/editor-web-v1/revisions/draft.3/contracts/editor-ux.schema.json)、[TS声明](architecture/editor-web-v1/revisions/draft.3/contracts/editor-ux.d.ts)
- [产品到架构映射](architecture/editor-web-v1/revisions/draft.3/contracts/product-architecture-map.json)、[开发交接与八个新增增量](architecture/editor-web-v1/revisions/draft.3/DEVELOPMENT-HANDOFF.md)
- [独立架构清单](architecture/editor-web-v1/revisions/draft.3/.architecture-mcp.json)、[文件基线](architecture/editor-web-v1/revisions/draft.3/baseline.json)、[文档完整性记录](architecture/editor-web-v1/revisions/draft.3/documentation-check.json)

产品实际输入已提供：213操作面（199 L/13 R/1 F）、12组88个对话原子状态、28个组合、G01—06与12个引导验收；28份源文件按字节冻结于本版inputs/product，源ID/范围保持。它们不是213个顶层页面，也不是已实现或已画好的同数量画板。实际新画稿、最终环境/人员接收与完整兼容依赖锁仍待办，不能继续笼统写“产品未定义详情”。

引导可随时跳过/结束，不撤销项目或取消业务任务；固定教学示例与真实AI结果分开，操作完成与学习记录落盘分开。课程/设备偏好不进入项目、LAN或生成游戏。保存试玩默认先将当前合法草稿durable保存，再启动对应固定快照；缺Graph/Runtime等能力真实标blocked并可跳过，不能用模拟器伪造完成。

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
