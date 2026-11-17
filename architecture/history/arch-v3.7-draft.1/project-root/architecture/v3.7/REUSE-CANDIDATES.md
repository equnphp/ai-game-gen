# 无强制商业授权费的开源复用候选

版本：`arch-v3.7-draft.1`。核对日期：2026-11-14。目标：服务GameGen自研C++核心、Android/桌面编辑器及WASM四目标路线。以下是官方仓库与许可说明研究，尚未完成依赖全量审查、版本冻结、编译或真机集成；推荐级别是架构判断，不是兼容性测试结果。

## 1. 费用与许可筛选条件

用户新增约束：技术选型不能强制付费。按开发、构建、运行和分发所需的框架、SDK及必需插件，不要求购买商业授权、不收按席位/收入/安装量的必付软件许可费执行；官方云模型、媒体供应商、服务器资源及平台账号成本另列，不混同软件许可费。这个解释延续已确认的可选付费AI服务范围，没有将所有运营成本声明为零。

优先Apache-2.0、MIT、BSD-2-Clause、BSD-3-Clause。MIT-0、SQLite公有领域及Qt开源GPL/LGPL属于需明确标注的其他无强制许可费路径，不能误标成MIT/BSD。只看仓库根LICENSE不够：正式引入需列子目录、依赖、工具、示例素材、字体、模型权重及安装包条款。

免费代码的推荐不能依赖企业版专属功能、付费编辑器、商业SDK或只能在供应商云上运行的构建服务。能力欠缺时比较适配成本与替代项目，不能以未来购买许可证作为默认解决方案。

## 2. 第一批核心候选

|项目与官方依据|许可|用于GameGen的部分|接入判断与边界|
|---|---|---|---|
|[Box2D](https://github.com/erincatto/box2d)，[LICENSE](https://github.com/erincatto/box2d/blob/main/LICENSE)|MIT|2D刚体、碰撞、传感器、关节与查询|优先验证；封装为PhysicsService与受限节点，保留自己的项目/单位/生命周期。native/WASM重放与版本迁移单测，不能推断任意跨平台锁步成立。|
|[EnTT](https://github.com/skypjack/entt)，[LICENSE](https://github.com/skypjack/entt/blob/main/LICENSE)|MIT|运行时实体/组件管理|优先候选；与持久化对象ID隔离，用index/generation句柄。它不提供完整场景、预制体、图VM或编辑器。|
|[bgfx](https://github.com/bkaradzic/bgfx)，[官方概览](https://bkaradzic.github.io/bgfx/overview.html)|BSD-2-Clause|跨图形API的渲染后端|优先与最小自有2D后端比较；需验证Qt视口、Android、WebGL/WASM、着色器工具与小游戏上下文，不因支持Web就认定小游戏能直接运行。|
|[miniaudio](https://github.com/mackron/miniaudio)，[LICENSE](https://github.com/mackron/miniaudio/blob/master/LICENSE)|MIT-0或Unlicense，建议明确选MIT-0|播放、混音、音频设备与底层音频服务|优先候选；官方列Android及Emscripten后端。小游戏音频桥单独实现/验证；不包含AI音效生成模型。|
|[nlohmann/json](https://github.com/nlohmann/json)，[LICENSE](https://github.com/nlohmann/json/blob/develop/LICENSE.MIT)|MIT|项目归档、配置、导入导出和诊断的JSON处理|适合工具层；不作为逐帧热路径唯一数据结构，不把自由JSON代替Schema/权限校验。|
|[FlatBuffers](https://github.com/google/flatbuffers)，[LICENSE](https://github.com/google/flatbuffers/blob/master/LICENSE)|Apache-2.0|经测量需要的运行包、IR或网络序列化|先作为候选；M1可用清楚的类型化文档，出现解析/内存瓶颈再引入二进制格式，避免过早维护两套权威模型。|
|[OpenCode](https://github.com/anomalyco/opencode)，[LICENSE](https://github.com/anomalyco/opencode/blob/dev/LICENSE)|MIT|本机会话、模型适配与工具调度|符合原产品方向；Android兼容、第三方依赖和权限旁路仍需SP-01。代码许可免费不代表官方Go/模型服务免费。|
|[apksig/apksigner](https://android.googlesource.com/platform/tools/apksig/)，[LICENSE](https://android.googlesource.com/platform/tools/apksig/+/refs/tags/android-14.0.0_r38/LICENSE)|Apache-2.0（核对所引版本）|APK签名与签名验证|优先研究库级接入，适配Android运行环境；不等于完整离线APK工具链。资源打包、对齐、工具依赖和SDK下载条款另核查。|

最初的基线组合建议为Box2D、EnTT、JSON工具、音频服务与OpenCode领域桥；渲染候选用SP-02/06对比后确定。FlatBuffers在明确收益后引入，不能为了凑清单增加依赖。

## 3. 工作流、地图、特效与UI

|项目与官方依据|许可|建议复用方式|需要补齐的部分|
|---|---|---|---|
|[QtNodes / nodeeditor](https://github.com/paceholder/nodeeditor)，[LICENSE](https://github.com/paceholder/nodeeditor/blob/master/LICENSE.rst)|BSD-3-Clause|Qt桌面节点画布的选中、连线、布局交互候选|依赖Qt；只作视图适配，不接管项目权威或图执行语义。手机画布仍需自己的交互。|
|[Blockly](https://github.com/RaspberryPiFoundation/blockly)，[LICENSE](https://github.com/RaspberryPiFoundation/blockly/blob/main/LICENSE)|Apache-2.0|积木编辑、新手“当/如果/那么”、类型与序列化交互参考；如嵌入Web UI可评估组件复用|映射到GameGen图/事务，禁止将其默认生成的JS作为绕过受限VM的游戏执行路径。当前维护仓库已在RaspberryPiFoundation下。|
|[LDtk](https://github.com/deepnight/ldtk)，[LICENSE](https://github.com/deepnight/ldtk/blob/master/LICENSE)|MIT|自动铺图、图层、实体字段、关卡编辑体验与导入格式|参考/格式接入优先；Haxe编辑器不直接塞入C++核心。多层通行面、桥梁、遮挡与关卡结算仍按本项目定义。|
|[Effekseer](https://github.com/effekseer/Effekseer)，[LICENSE](https://github.com/effekseer/Effekseer/blob/master/LICENSE)，[Web运行库](https://github.com/effekseer/EffekseerForWeb)|MIT|粒子/特效运行时及制作工具参考|按节点功能选子集；2D需求、渲染后端、素材许可、包体和两小游戏适配实测，不作为首个可玩样例的强制依赖。|
|[Dear ImGui](https://github.com/ocornut/imgui)，[LICENSE](https://github.com/ocornut/imgui/blob/master/LICENSE.txt)|MIT|引擎调试面板、性能统计、内部工具|适合研发工具候选；面向新手的正式主界面需额外投入中文输入、可访问性、触控和设计还原，不能仅因免费直接替代产品UI。|
|[Flutter](https://github.com/flutter/flutter)，[官方许可说明](https://docs.flutter.dev/resources/faq#is-flutter-open-source)|BSD-3-Clause|本版优先作为Android及未来iPhone/iPad/Android平板移动表现层候选，经C ABI/FFI接共享应用核心|新增Dart/系统桥、原生视口/输入/IME与可访问性成本；Qt桌面候选保留，Flutter全桌面另评。路线proposed，尚未集成或实测。|
|[Tauri](https://github.com/tauri-apps/tauri)，[架构与许可](https://github.com/tauri-apps/tauri/blob/dev/ARCHITECTURE.md)|MIT或Apache-2.0|若倾向复用Web原型，作为桌面外壳候选|需要Rust/C++边界、WebView、进程隔离和大画布测试；不会仅凭打包网页自动获得原生引擎、离线构建或安全边界。|

ozz-animation也采用MIT，但主要是3D骨骼采样/混合，不能直接等同2D蒙皮编辑器；不列为当前2D骨骼功能的默认依赖。[官方说明](https://github.com/guillaumeblanc/ozz-animation)。

## 4. Qt是否必须付费

Qt提供商业与开源许可路径，多数模块可在GPLv3/LGPLv3条件下使用。我们的桌面编辑器本身计划GPL开源，按选定模块的开源条款交付可以不购买Qt商业许可。不能把“有商业版”推导为“必须付费”。[Qt官方许可](https://doc.qt.io/qt-6/licensing.html)、[开源下载说明](https://www.qt.io/development/download-open-source)。

Qt仍需核查具体模块、工具、Marketplace插件与第三方依赖，商业专属功能和付费支持不进入必需链。Qt只在编辑器，不进入当前WebView/WASM游戏运行包；本项目运行时例外也不能替Qt代码改变许可。

本版决定：**保留Qt开源版作为桌面候选，必须证明完整构建/分发流程无强制商业授权费后才锁定。** 若未来要求所有UI依赖也只能使用Apache/MIT/BSD，则Qt不符合这条更窄的许可白名单，优先评估Flutter，其次比较Tauri/Web路线；用户当前尚未要求禁止GPL/LGPL依赖。

## 5. 大型引擎与无代码产品：优先参考已有能力

|项目|官方许可依据|值得借鉴|当前边界|
|---|---|---|---|
|[Godot](https://github.com/godotengine/godot)|[MIT及第三方说明](https://github.com/godotengine/godot/blob/master/COPYRIGHT.txt)|场景/资源、导入、2D渲染、动画、调试和导出组织|适合体系研究及有明确收益的局部复用；整体采用会改变自研核心的范围，需要单独产品决定。|
|[GDevelop](https://github.com/4ian/GDevelop)|[Core/GDJS/IDE/扩展为MIT](https://github.com/4ian/GDevelop/blob/master/LICENSE.md)|新手事件/条件/动作、对象选择、行为预设和无代码创作闭环|产品与事件语义参考价值高；不将其云构建、账户或付费服务设为本地导出的前置条件。|
|[Cocos engine](https://github.com/cocos/cocos-engine)|许可不构成本项目的采用授权|仅研究组件/Prefab、2D批处理、跨平台边界和导出组织的设计思路|用户明确限定仅参考。排除直接依赖、源码复制/移植、运行时/二进制、适配器、SDK、编辑器、导出模板与构建服务；不进入复用候选、SBOM或游戏包。|

这三个项目的参考应变成具体决定和最小验证，而非把引擎大段复制后再维护一套不清楚来源的分支。

## 6. 联网服务器候选

|项目|许可|可借助能力|费用和架构边界|
|---|---|---|---|
|[Nakama](https://github.com/heroiclabs/nakama)，[LICENSE](https://github.com/heroiclabs/nakama/blob/master/LICENSE)|Apache-2.0|账号、匹配、社交、排行和权威多人机制|社区版可自托管；官方将集群管理列为Enterprise功能，不能让它成为本项目免费的必需前提。C++服务端工作流如何接入需单独设计，不默认替换VM。[官方架构说明](https://heroiclabs.com/docs/nakama/getting-started/architecture/)|
|[Colyseus](https://github.com/colyseus/colyseus)，[LICENSE](https://github.com/colyseus/colyseus/blob/master/LICENSE)|MIT|房间生命周期、状态同步、断线恢复与客户端协议|可研究/自托管代码；Node服务增加一套运行宿主，若直接采用须说明与C++图VM的边界，托管云服务不作必需依赖。|

首期继续以小型权威房间验证为目标。两个候选不同时引入，也不为此改成微服务或预置大型集群。

## 7. 许可清单之外的免费组件与真实成本

SQLite原始核心为公有领域，可无软件许可费使用，保留其本机项目库候选身份；它不属于MIT/BSD，官方可选支持/权利担保也不作必买项。[SQLite版权说明](https://www.sqlite.org/copyright.html)。Recast是zlib许可，因此没有列进Apache/MIT/BSD主清单，且当前方格/等距导航不需要立即引入3D导航网格。

软件许可免费不表示运行云模型、租用服务器、购置Mac或所有平台发行成本为零。例如Mac官方Developer ID签名和公证涉及Apple Developer Program；这类发布成本应在发行路线中单列，不归因于Qt收费。[Apple Developer ID](https://developer.apple.com/developer-id/)。如果将来要求连平台账号/发行成本也为零，需要由产品另定各平台分发体验与范围。

## 8. 锁定依赖前的验收

每个候选记录source URL、冻结commit/tag、组件/依赖许可、版权/NOTICE、使用目录、是否进入游戏、所需工具、必需功能免费路径、替代项目、适配成本、native/WASM/各宿主验证结果和回退版本。Apache依赖的NOTICE/修改声明等义务及MIT/BSD通知按实际条款履行，不能把“无授权费”写成“无条件”。

当前已完成的是官方许可/能力资料核对与架构适用性判断；尚未冻结任一新增依赖，没有下载运行第三方工程，没有执行其脚本或进行目标环境集成测试。

本版跨目标选型优先满足[四目标详细设计](FOUR-TARGET-ARCHITECTURE.md)的显式宿主接口。bgfx/miniaudio等的Web后端支持不能代替微信/抖音兼容证据；需要选择可替换的后端，公共路径不依赖DOM、SIMD或线程。Cocos禁止集成适用于所有目标，不能在小游戏导出阶段间接带入。

V3.7新增Reader/Sync/未来Writer属于自有共享核心；不使用原引擎SDK解析或执行源工程。密码学/TLS/PAKE、文件格式解析与平台桥的具体免费依赖尚待版本/权利审查，禁止自行编写加密原语。Flutter跨平台能力依据[官方互操作文档](https://docs.flutter.dev/interop)，不等同GameGen已兼容Apple或平板。
