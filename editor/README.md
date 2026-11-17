# GameGen 编辑器

本目录包含 React/TypeScript 前端与 Tauri/Rust 宿主，调用 ../native 的 C++ 核心。

| 位置 | 内容 |
|---|---|
| web/ | 界面、样式、七语资源和运行图标 |
| host-contract/ | 程序使用的接口类型、Schema 和传输适配器 |
| hosts/tauri/ | 原生宿主、权限和打包配置 |

依赖版本见 package.json、.node-version、hosts/tauri/Cargo.toml 和 rust-toolchain.toml。当前尚未安装并接收完整候选依赖，npm/Cargo 锁文件尚未生成，源码未编译或运行验证。

构建前须接收匹配的工具链、完整依赖锁，以及原生核心 DLL 和运行库。Windows 原生资源目录及清单格式见 [资源接入说明](hosts/tauri/resources/native/windows-x86_64/README.md)。缺少真实核心制品时项目操作不可用，普通浏览器不会自动替换为模拟数据。

本轮源码包含项目/场景草稿、保存与历史、分块资源导入、任务查询及本机语言选择；完整产品功能、其他平台宿主和运行时预览仍未完成。当前七语文字为增量草稿，尚未人工审校。

运行时图标使用 [界面图标集.svg](web/public/assets/界面图标集.svg)，素材来源说明随该资源保留。产品需求、UI 稿、架构及研发过程文档在本机维护，不随源码提交。
