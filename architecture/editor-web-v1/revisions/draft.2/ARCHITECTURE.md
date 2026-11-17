# GameGen editor-web 架构补齐第二版

版本：editor-web-v1-draft.2；日期：2026-11-17。承接[第一版总体设计](../../ARCHITECTURE.md)，不改变React/TypeScript + Tauri 2 + Rust薄桥 + C++20共享核心路线。新增内容仅为开发接收所需的精确契约和规则，execution_status=not_run、quality_verified=false、release_permitted=false。

## 1. 本版交付与优先级

|开发问题|本版具体结论|权威文件|
|---|---|---|
|Windows跨工具链FFI|MSVC Rust x64宿主运行时加载LLVM-MinGW x64 Core DLL，仅C ABI；函数表/布局/CRT/驻留/异常边界固定|[ABI-INTEGRATION.md](ABI-INTEGRATION.md)|
|Android同源组件|同NDK arm64 Core SO，Rust为唯一领域入口，单份libc++_shared，JNI只必要系统端口|[ABI-INTEGRATION.md](ABI-INTEGRATION.md)|
|HostPort可编码定义|12方法、参数/结果/错误/代次/二进制/游标/关闭重连全部定义|[CONTRACT.md](CONTRACT.md)、[TS声明](contracts/editor-host.d.ts)、[Host Schema](contracts/host.schema.json)|
|异步测试宿主|14方法、JSON Lines异步关联、任务/结果槽/关闭/EOF/回环边界|[DRIVER-PROTOCOL.md](DRIVER-PROTOCOL.md)、[Driver Schema](contracts/driver.schema.json)|
|兼容组合及UI前置|固定C1/C2候选与T1独立工具候选；完整接收回架构判定；最小UI输入逐项列清|[COMPATIBILITY-INTAKE.md](COMPATIBILITY-INTAKE.md)、[候选清单](contracts/compatibility-candidates.json)|
|实施顺序和剩余项|EW-T01细分、旧工具缺口、UI和整版评审保持实际状态|[DEVELOPMENT-HANDOFF.md](DEVELOPMENT-HANDOFF.md)|

本版精确定义覆盖第一版对应的“EW-T01再决定”占位；第一版一般模块/安全/四目标/离线/迁移策略继续继承。特别纠正：M1事件环256条，单次读取只能1—100；不是单次256。本版Base64/缓存/帧预算比第一版抽象描述更具体。

## 2. 已有实现与新契约分开

当前native CMake/头文件/CLI/JNI仅做只读源级核对，摘要见[源码观察](inputs/source-observation.json)。没有实际构建、导出、DLL加载、类型编译、Schema validator或自测证据。

当前core-driver只是原Core JSON顺序阻塞工具，不实现本版握手和14方法；新文档不把它升级为完成品。当前libggcore_jni已有领域包装，也不代表新Tauri可重复调用该入口来建第二套Core。

M1 ABI1.0/消息1.0/DDL1和native/未修改；[本地核心索引](../../../../handoff/local-core-v1/CURRENT-HANDOFF.json)、root coding与root流程清单保留。游戏四目标/APK WebView+WASM、Cocos仅参考、云端暂缓、免费必要依赖/GPL方向不变。

## 3. 精确协议的证据边界

Schema/TS是架构声明，不是实现。两个Schema使用本地注册的$id，无需访问.invalid域；Base64解码、UTF8、语义状态、权限和跨字段预算仍需实际校验。TS字符串类型不替代u64范围校验，未运行TypeScript编译或Schema测试。

三种适配器必须同一有效调用契约，Mock明确标记，不进入生产降级。调用受理、Core任务终态、durable提交、真实UI/宿主/设备验证分别记录，不能以Schema存在或元数据peer满足认定功能通过。

## 4. 接收和未完成项

Windows加载/FFI路线、HostPort和异步驱动协议已由本版确定。C1/C2为有明确参数与接收规则的候选，不是完整已验证锁；实际MSVC/SDK/平台/WebView/传递依赖、产物证据和最小UI输入仍需开发/产品/UI交回。成品自动化T1独立收敛，不盲拼旧目录最新主版本。

本包ready_for_coding=false继续如实保留，不能代签产品/UI或全体技术基线批准。允许接续的资料接收与真正进入UI实现/运行验证分别管理；文档不授予安装/编译/测试权限。

## 5. 版本化

第一版13个基线文件原样保留；本版在revisions/draft.2独立交付，见[baseline.json](baseline.json)、[文档核对](documentation-check.json)。主架构入口与architecture/CURRENT.json指向本版，不改M1正在开发的root manifest。后续消费者应绑定本版文件摘要，不能只写“HostPort1.0”就忽略架构修订。
