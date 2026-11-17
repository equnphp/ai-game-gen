# C1附加直接依赖的元数据接收

版本：editor-increment-source-review-20261117-draft.1；日期2026-11-17。只读官方tag、crates.io与npm注册表；不安装、不执行cargo/npm/构建/审计/扫描。完整观测保存在[dependency-metadata.json](inputs/dependency-metadata.json)。

## 1. Tauri构建包配对

官方tauri-v2.12.5 tag中，tauri包version为2.12.5，tauri-build包version为2.7.4；workspace也明确把两者列为这些版本，workspace Rust最低版本为1.90。因此现有Cargo直接精确声明tauri=2.12.5、tauri-build=2.7.4可作为同tag候选配对。[tauri Cargo](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.5/crates/tauri/Cargo.toml)、[tauri-build Cargo](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.5/crates/tauri-build/Cargo.toml)、[workspace Cargo](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.5/Cargo.toml)。

这不表示同tag中所有crate必须同版本，也不是本项目完整图已成功解析。Cargo中的features=[]不等于default-features=false；当前默认feature集合仍需作为实际接收输入，不能声称已关闭全部默认功能。

## 2. Rust直接包

|声明|注册表license|直接rust_version|yanked|接收结论|
|---|---|---|---|---|
|serde1.0.228 + derive|MIT OR Apache-2.0|1.56|false|直接版本/feature元数据存在，候选|
|serde_json1.0.145|MIT OR Apache-2.0|1.61|false|与serde直接主版本未见声明冲突，完整图待解析|
|base640.22.1|MIT OR Apache-2.0|1.48.0|false|规范Base64用途候选|
|uuid1.18.1 + v4|Apache-2.0 OR MIT|1.63.0|false|v4→rng/getrandom链需纳入完整锁/平台接收|
|sha20.10.9|MIT OR Apache-2.0|null|false|注册表未声明MSRV，不能把null当无要求|
|fs20.4.3|MIT/Apache-2.0（原值）|null|false|注册表未声明MSRV；版本维护与平台锁行为待接收|
|tauri-build2.7.4|Apache-2.0 OR MIT|1.90|false|上节同tag候选|

每项官方元数据URL和crate checksum见记录；checksum是注册表报告值，没有下载制品并计算本地观测摘要。sha2包README另写最低Rust1.41，fs2包README写稳定Rust1.8或更高，不能由此推断其全传递依赖在本项目组合可编译。[sha2发布页](https://docs.rs/crate/sha2/0.10.9)、[fs2发布页](https://docs.rs/crate/fs2/0.4.3)。

按这些直接包的公开许可声明，可继续作为免费开源路线候选；实际制品LICENSE/NOTICE、传递依赖和功能集仍要接收。没有新增商业许可的接收证明、漏洞审计或全供应链结论。

## 3. 实际源码中同时出现的npm直接声明

package.json的@tauri-apps/api2.12.5、@tauri-apps/cli2.12.5、@types/react19.2.2和@types/react-dom19.2.2的精确元数据已读取。前两者声明Apache-2.0 OR MIT；后两者MIT。@types/react-dom的直接peer要求@types/react ^19.2.0，当前19.2.2落在该声明范围；这不证明React19.3.1全部新API类型覆盖或tsc通过。

@types/react还引入csstype ^3.0.2；Tauri CLI有按平台选择的分发包，Rust derive/getrandom等也有传递链。精确直接版本声明不等于完整锁。前版Node24.22.3/npm11.19.1/Rust1.100.0及React/TS/Vite候选不变，程序员报告的本机旧版本不得写为已接收的C1实测环境。

## 4. 当前接收状态

metadata_recorded=true；complete_graph_lock=false；artifacts_downloaded_and_verified=false；selected=false；verified=false。下一步仍是实现/文档闭合后，在真实会话授权覆盖的范围进行依赖解析/构建等操作，并记录实际环境/锁/制品和失败项。本补充不授予这些执行权限。
