# GameGen 共享核心

本目录为 Windows/Android 同源 C++20 核心源码。Windows 的 ggcore.dll 和 gg-core-driver.exe 已完成一次本地构建，原生编辑器已加载本地 DLL。Android arm64 SO/JNI 薄桥也已本地构建；开发中的 Core1.1、format2、资产版本、输入和Graph校验尚在集成，未完成运行验收。

- C ABI：[sdk/include/gg_core_v1.h](sdk/include/gg_core_v1.h)
- 消息定义：[core/schema/messages.schema.json](core/schema/messages.schema.json)
- SQLite 结构：[core/storage/sqlite/schema_v1.sql](core/storage/sqlite/schema_v1.sql)
- 固定依赖与许可：[third_party/](third_party/)
- Android 薄桥：[bindings/android/](bindings/android/)

构建输入为 CMake 3.31.12、Ninja 1.12.1；Windows 使用 LLVM-MinGW UCRT 20261104 / Clang 23.1.5，Android 使用 NDK r27d 27.3.13750724、API26、arm64-v8a。具体约束由 CMakeLists.txt 和 cmake/Dependencies.cmake 声明，不自动下载依赖。

在仓库根目录、固定工具链已配置后，Windows 构建命令为：

~~~powershell
cmake -S native -B native/out/windows -G Ninja -DGG_BUILD_DRIVER=ON -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++
cmake --build native/out/windows
~~~

预期产物为 ggcore.dll 和可选的 gg-core-driver.exe；Android 为 libggcore.so 和 libggcore_jni.so。以上为构建参考。本次已执行 Windows/Android Core 构建和 Windows 原生窗口启动，未执行完整回归、压测、安全扫描或设备测试。

宿主须在后台管理会话和任务；原生输出只能由 gg_buffer_release 释放。关闭前完成任务清理、项目关闭及会话销毁，跨 DLL 不传 STL 对象或直接释放另一分配器的内存。
