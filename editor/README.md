# GameGen 编辑器首个实现增量

本目录是独立的 React/TypeScript + Tauri/Rust 编辑器工程，继续调用 ../native 的 C++20 核心。它接收 editor-web-v1-draft.4、七语言产品需求和 ui-full-20261117-draft.2 的视觉/交互输入。当前状态为源码已写入、未安装依赖、未构建、未运行，不能作为可用应用或完整产品交付。

## 当前源码范围

- HostPort1.0：受控Windows DLL加载、12方法会话/任务/事件桥接、一个8MiB结果槽、关闭状态机、独立输出释放。
- UX1.1子集：describe、snapshot、locale.select、events.read四方法；独立本机文件、单写锁、最新意图、确认落盘后生效、失败/未知恢复。
- 项目创建/打开、默认场景、稳定ID对象增删、名称/坐标/旋转/缩放草稿、提案→校验→提交、短暂停止编辑后保存、撤销/重做、真实任务查询及结果恢复。
- 本地文件分块导入、finish/attach和当前会话资源显示。既有精灵引用保留；完整资产检索、续传/取消面板及分页另增量交接。
- 已交付浅色设计变量、语义DOM、稳定testId、桌面/窄屏样式，以及当前82键的七语文案草稿。

未实现：完整213操作面、完整聊天/Agent、学习课程与学习进度、UX1.0兼容投影、图/Runtime/真实渲染、LAN、Reader/Writer、四目标打包和Android宿主工程。场景中心是真实文档的模型投影，菱形只是对象标识，不是游戏试玩。欢迎卡的暂时跳过仅关闭当前会话卡片，不登记课程已完成或已持久化。生产适配器不会降级到mock或localStorage。

## 工程目录

web/ 是生产表现层，host-contract/ 原样接收Host1.0/UX1.1类型与Schema，hosts/tauri/ 是受限原生宿主，docs/ 保存交接、范围和未执行计划。宿主放在editor内便于独立交付/回退。根M1清单与native目录不因本次增量而切换。

## 固定候选与接收状态

Node24.22.3、npm11.19.1、Rust1.100.0 MSVC目标、Tauri2.12.5、React19.3.1、TS7.0.2、Vite8.3.8按架构C1声明。tauri-build2.7.4来自同一Tauri发布tag，其余直接依赖见package.json/Cargo.toml。完整传递锁尚未生成，不称兼容组合已选定或已验证。本机只读取到Node24.18.0/npm11.16.0，不能用它们冒充候选。没有安装全局工具链或执行npm/cargo项目脚本。

后续在真实会话明确授权范围内接收工具链、生成锁、构建和验证时，记录实际包摘要、许可证/NOTICE、平台原生包和传递依赖。当前没有package-lock.json/Cargo.lock，没有DLL/SO/EXE/APK，也没有实际buildId。

## Windows核心产物接入

原Core继续按native工程的LLVM-MinGW UCRT20261104构建，Rust宿主不重编它。将真实ggcore.dll、同发布物的非系统依赖及真实core-artifact.json放在hosts/tauri/resources/native/windows-x86_64/。格式见该目录说明，文件摘要/buildId只能来自实际制品。宿主从可信resource_dir定位，不从项目目录、PATH或前端参数寻找DLL。

启动器会验证清单、摘要、单级文件名、重解析点和ABI，使用LoadLibraryExW受限搜索，解析12个gg_*函数。模块进程驻留，替换需重启。缺制品时项目操作明确不可用，语言偏好可独立工作。库之间不传STL/异常，不跨CRT释放。

## 后续命令参考

以下命令当前均未执行。只有完成固定工具链/完整锁接收并获得所需实际操作授权后再运行：

~~~powershell
cd I:\code\GameGen\editor
npm ci --ignore-scripts
npm run build
cd hosts\tauri
cargo build --locked --target x86_64-pc-windows-msvc
~~~

首次锁文件生成、Tauri配置/平台依赖和打包仍属待接收事项；不能在没有锁时把上述命令记为已通过。生产不启动HTTP服务；普通浏览器缺真实宿主时显示不可用。本轮未实现测试回环代理或新版Driver14，原Core阻塞CLI不算它们完成。

基础计划见docs/basic-self-check.md，独立质量计划见docs/quality-plan.md，UI验收计划见docs/design-acceptance.md。所有execution_status=not_run、quality_verified=false、release_permitted=false；真实角色接收为空。
