# GameGen 本地一期共享核心

当前交付为 Windows/Android 同源 C++20 核心源码，源于 handoff/local-core-v1。本轮没有构建 DLL/SO，没有执行程序、测试、静态扫描或设备验证。实现覆盖范围、待确认事项及自测计划见 docs/basic-self-check.md；状态为 not_run、quality_verified=false、release_permitted=false。

宿主经 sdk/include/gg_core_v1.h 的 C ABI 1.0 发送 UTF-8 JSON 或分块字节。每个Core持有一个授权根、一个串行执行线程、一个项目会话。Qt、Dart、JNI对象不进入领域层；Android薄桥单独编译为 libggcore_jni.so。完整编辑器、图/游戏引擎、AI、三引擎导入、LAN同步及四目标游戏打包仍由后续交接包承接，capabilities不会把它们报告为已实现。

源码入口：

- core/schema：严格JSON、消息Schema、结构化错误、SHA-256。
- core/document：Settings/Scene字段白名单、实体父环/引用/身份检查。
- core/application：项目创建/打开、提案校验/事务、持久化请求摘要、撤销重做、自动/锁定快照。
- core/storage/sqlite：受控连接、内置DDL、结构校验、事务和SQLite backup API。
- core/assets：分块/流式完整hash、READY/attach、内容去重、快照保护根/GC。
- core/tasks 与 sdk/src：有界任务、提交临界点取消、事件环、句柄/输出缓冲区租约。
- platform：Windows句柄/LockFileEx/CSPRNG和Android目录fd/flock/系统随机数。
- tools/core-driver：逐行JSON无界面客户端；不会自行产生业务编辑。
- bindings/android：Kotlin字节接口与薄JNI，无独立业务规则。

构建输入固定为 CMake 3.31.12、Ninja 1.12.1、Windows LLVM-MinGW UCRT 20261104，Android NDK r27d 27.3.13750724/API26/arm64-v8a/libc++_shared。第三方运行依赖源码及原许可放在 third_party，接收摘要另记。CMake不自动联网，也不回退到宿主系统SQLite。当前工具链是否已安装、能否配置或编译均未验证。

以下是供后续明确授权时使用的构建命令，当前未执行。Windows先在PATH配置上述固定LLVM-MinGW、CMake和Ninja：

~~~powershell
cmake -S native -B native/out/windows -G Ninja -DGG_BUILD_DRIVER=ON -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++
cmake --build native/out/windows
~~~

Android在固定NDK目录下配置：

~~~powershell
cmake -S native -B native/out/android -G Ninja "-DCMAKE_TOOLCHAIN_FILE=<NDK-r27d>/build/cmake/android.toolchain.cmake" -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-26 -DANDROID_STL=c++_shared -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON
cmake --build native/out/android
~~~

预期产物 Windows ggcore.dll、可选gg-core-driver.exe；Android libggcore.so/libggcore_jni.so。这是预期路径，无现成制品。驱动参数为已存在的授权根目录，stdin每行一个协议消息。新建、修改等请求由调用者提供，示例契约见 ../handoff/local-core-v1/examples/sequence.json；其中capture/$变量须由宿主替换，不是SDK语法。

生命周期：后台线程create→submit/poll/take_result→释放输出与终态task；结束时先flush→project.close→释放task→destroy。每个输出先清零，buffer只能由gg_buffer_release释放，不能跨CRT free。JNI在复制输出后即释放native buffer，宿主负责接收任务终态和显式关闭。Android只传应用内部存储的绝对目录，SAF/content URI不能直接当数据库路径。

GC只清理不可达版本/资产/内容，不清理稳定ID墓碑与持久化成功请求摘要。dryRun先查看保留原因。未知格式或额外SQLite结构拒绝，未知领域必需Schema保留只读；没有任意自动迁移或修复覆盖功能。备份使用新名称，不覆盖已有文件；备份中断留下的未登记文件不能当成功备份使用。

所有真实角色评审与运行结果分别记录。文档检查通过、源码已写入、依赖摘要匹配均不意味着本地事务持久化目标、双端兼容或发布验收已经通过。
