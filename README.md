# GameGen

本仓库保存 GameGen 源码、构建配置、依赖许可和运行资源。

| 位置 | 内容 |
|---|---|
| [editor/](editor/README.md) | 桌面编辑器前端与原生宿主 |
| [native/](native/README.md) | Windows/Android 共享 C++20 核心 |
| index.html、app.js 等根目录文件 | 早期浏览器交互原型 |

编辑器和原生核心的构建输入、资源接入说明见各目录 README。Windows 本地构建和原生窗口启动已完成一次，完整产品功能仍在开发；这不代表全面测试或发布验收通过。

原生构建现在还需要显式提供 Node（`-DGG_BUILD_NODE=<node.exe绝对路径>`），采用单配置 Ninja 并设置 `CMAKE_BUILD_TYPE`。构建会先按源码、工具包和实际参数生成内容标记，再编译依赖、生成编译器身份及与实际 DLL/SO 绑定的构建一致性收据。当前受管配置明确禁用默认 Clang 配置，未接入的响应文件、驱动配置和外部搜索参数会被拒绝。

Windows 原生目标与 WASM 运行时都构建完成后，可用 `node native/tools/compiler-identity/package.cjs native/out/windows native/out/wasm32 editor/hosts/tauri/resources/native/windows-x86_64` 装配本地组件，然后重新构建 Tauri 宿主。装配会新建不可变组件目录并切换私有选择记录。生成文件不提交 Git；构建一致性收据只用于确认文件与构建输入匹配。

Android 交叉构建还需设置 `-DGG_CATALOG_IDENTITY_TOOL=<同源码Windows构建的gg-catalog-identity.exe绝对路径>`；该工具只提供目录摘要，不运行 Android 代码。Android 原生库编译、目标设备运行和 APK 导出是不同步骤。

产品需求、UI 设计稿、架构设计、交接包和研发过程报告只在本机维护，不随源码提交。程序直接使用的头文件、接口类型、Schema、SQL 和素材来源说明保留在对应源码目录。
