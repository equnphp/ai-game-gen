# GameGen 架构与开发交接入口

更新日期：2026-11-17。当前架构按“正在开发的本地共享核心”和“已采纳的后续编辑器表现层”分别管理，避免技术选型覆盖已有开发契约。

## 当前编辑器技术路线

用户已确认 **TypeScript + React 共用表现层、Tauri 2 薄宿主、现有C++20共享核心，以及不依赖识图的结构化自测接口**。版本为editor-web-v1-draft.2。

- [编辑器表现层与自测详细架构](architecture/editor-web-v1/revisions/draft.2/ARCHITECTURE.md)
- [技术决定、替代方案与许可](architecture/editor-web-v1/DECISIONS.md)
- [宿主桥接、命令/查询、任务/事件及可测性接口](architecture/editor-web-v1/revisions/draft.2/CONTRACT.md)
- [八个开发增量、依赖、接收及回退](architecture/editor-web-v1/revisions/draft.2/DEVELOPMENT-HANDOFF.md)
- [独立版本化架构清单](architecture/editor-web-v1/revisions/draft.2/.architecture-mcp.json)、[文件基线](architecture/editor-web-v1/revisions/draft.2/baseline.json)、[文档完整性记录](architecture/editor-web-v1/revisions/draft.2/documentation-check.json)

第二版补齐：[Windows/Android FFI](architecture/editor-web-v1/revisions/draft.2/ABI-INTEGRATION.md)、[异步驱动协议](architecture/editor-web-v1/revisions/draft.2/DRIVER-PROTOCOL.md)、[TS类型](architecture/editor-web-v1/revisions/draft.2/contracts/editor-host.d.ts)、[Host Schema](architecture/editor-web-v1/revisions/draft.2/contracts/host.schema.json)、[Driver Schema](architecture/editor-web-v1/revisions/draft.2/contracts/driver.schema.json)与[兼容候选/最小UI输入](architecture/editor-web-v1/revisions/draft.2/COMPATIBILITY-INTAKE.md)。旧core-driver仍为阻塞CLI，不作为新版驱动完成证明；候选不是完整兼容锁。

本决定替换旧V3.7中的Qt桌面/Flutter移动表现层候选。常规UI用DOM，工作流优先DOM+SVG，场景渲染保留引擎视口并提供真实状态投影。Rust只做薄桥接，领域/事务规则继续共用C++。浏览器、真实核心、打包宿主、设备和游戏产物的测试证据分别记录，模拟后端不能证明真实成品通过。

该包属于后续编辑器架构增量，UI详细页面/状态计划和兼容依赖组合仍需交接；未把新UI加入当前无GUI M1，也未实施代码迁移。

## 当前本地核心开发包

现有契约版本local-core-v1-draft.2；当前接续交接以[CURRENT-HANDOFF.json](handoff/local-core-v1/CURRENT-HANDOFF.json)为准，其指向local-core-v1-handoff.3及实际开发回执。

- [范围与验收](handoff/local-core-v1/requirements.md)、[核心详细架构](handoff/local-core-v1/architecture.md)
- [C ABI与消息](handoff/local-core-v1/api.md)、[存储](handoff/local-core-v1/storage.md)、[事务/恢复](handoff/local-core-v1/transactions.md)
- [平台端口](handoff/local-core-v1/platforms.md)、[核心任务](handoff/local-core-v1/work-items.md)

C ABI1.0、消息1.0、DDL/schema1和native/结构保持不变；根.product/.architecture/.workflow/.coding/.quality-plan清单继续服务当前M1迭代。已有源码和真实构建/验证状态以索引及开发记录为准，不由新UI文档推断。

## 完整产品继承与边界

[旧总体架构V3.7](architecture/v3.7/ARCHITECTURE.md)保留完整产品背景；其表现层选型由上述新包替换，云端部分继续暂缓，不作为当前实施任务。地图、关卡、动画、物理、数值、图VM、Agent、三Reader/LAN及未来三Writer等能力继续按各包推进，不能把M1或本次UI选型当成完整产品已交付。

[四目标运行与导出](architecture/v3.7/FOUR-TARGET-ARCHITECTURE.md)、[未来可编辑工程写出](architecture/v3.7/PROJECT-EXPORT-EXTENSION.md)、[完整功能责任](architecture/v3.7/FEATURE-COVERAGE.md)、[开源边界](architecture/v3.7/OPEN-SOURCE-BOUNDARY.md)继续继承其未被本次决定替换的设计。

游戏目标仍为H5、WebView+C++ WASM的APK、微信小游戏、抖音小游戏；Tauri只作创作编辑器宿主。未来Apple/平板扩展的是编辑器。Cocos engine仅参考。必要依赖无强制商业授权，GPL与独立游戏闭源商用方向保留，正式许可文本和逐项依赖接收仍需落实。

当前文档不提供运行或发布证明；本轮execution_status=not_run、quality_verified=false、release_permitted=false。
