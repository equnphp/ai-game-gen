# EW-T01 原生库与FFI接入决定

版本：editor-web-v1-draft.2；2026-11-17。当前只有源级接入设计，没有DLL/SO实际构建、符号导出或运行结果。[源码观察](inputs/source-observation.json)记录读取路径与摘要，不是静态扫描报告。

## 1. Windows采用的路线

- ggcore生产端保持LLVM-MinGW UCRT 20261104 / Clang 23.1.5 / Windows x64；不更改native/CMakeLists.txt限制，不在Rust构建中偷偷用MSVC重编C++核心。
- Tauri/Rust宿主选择stable Rust的x86_64-pc-windows-msvc；候选为Rust1.100.0，见[兼容接收](COMPATIBILITY-INTAKE.md)。MSVC linker/Windows SDK用于Rust宿主，不消除原核心工具链。
- **运行时DLL加载**，不用LLVM-MinGW导入库给MSVC链接，不直接静态链接C++对象，不使用C++类/STL/异常或Rust原生ABI跨界。纯C ABI在相同Windows x64目标上的互操作是本设计约束，必须在授权后的真实贯通验证，不是已验证兼容。
- ggcore.dll放到Tauri resource_dir下native/windows-x86_64/ggcore.dll；开发环境从明确配置的构建产物清单映射到同一相对布局。禁止从当前目录、项目目录、PATH、前端输入或未知环境变量查找同名DLL。

由Tauri可信宿主解析resource_dir，规范化/检查最终路径及重解析点，核对产物清单的架构、文件摘要和来源。绝对路径传LoadLibraryExW，flags采用LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32。非系统依赖与ggcore.dll放同一受控目录；不假定此flags会查PATH。Win32加载API使用Windows system ABI，gg_*函数指针使用C ABI。不得用DONT_RESOLVE_DLL_REFERENCES或未校验目录回退“凑合加载”。

EW-T01接收DLL实际依赖清单：生产器的libc++/libunwind等若动态依赖必须来自同一固定LLVM-MinGW发布物；若被静态链接则记录实际链接事实，不凭工具链名称断言。Windows UCRT及Rust MSVC运行时按各自发布/平台方式接收；两侧分配器独立，不能跨free/delete。Rust宿主所需免费Build Tools/Community等路径的适用资格和SDK条款须由实际接收者记录；不预设任何组织都免费，也不以购商业许可作为默认补救。不满足免费约束时回架构处理候选。

## 2. 唯一函数表与布局

按名称GetProcAddress解析以下12个导出，缺一个即LIBRARY_INVALID，不留下半初始化Core：gg_abi_version、gg_core_create、gg_submit、gg_upload_write、gg_blob_read、gg_task_poll、gg_task_take_result、gg_task_cancel、gg_task_release、gg_read_events、gg_core_destroy、gg_buffer_release。当前只接受gg_abi_version()==0x00010000。

以[native实际头](../../../../native/sdk/include/gg_core_v1.h)及[M1设计头](../../../../handoff/local-core-v1/spec/gg_core_v1.h)为源，Rust手写/生成声明均需对应同一头摘要：
- gg_core/gg_task = u64；gg_status = i32；gg_abi_version返回u32。
- gg_*调用使用unsafe extern "C"函数指针；Windows GG_CALL为__cdecl，本包只有x64；不使用extern "Rust"或C-unwind替代。
- 结构使用repr(C)，不pack，不以usize/isize/bool/enum/STL或引用替换固定宽度/裸指针字段；gg_bytes_v1按值传递，其他参数严格按头文件，不能随意改成引用。

|结构|size/alignment|字段offset|
|---|---|---|
|gg_bytes_v1|16/8|data=0，len=8|
|gg_buffer_v1|24/8|data=0，len=8，token=16|
|gg_core_config_v1|32/8|struct_size=0，abi_version=4，authorized_root=8（data=8,len=16），flags=24，reserved=28|

以上布局是64位C契约推导值，尚未做编译探针。EW-T01源码接入应准备双方编译期size/align/offset断言；本轮没有编译断言或运行探针。config struct_size=32，abi_version=0x00010000，flags/reserved=0；所有out句柄/buffer先清零。

## 3. 生命周期、CRT与异常

加载器持有Arc/等价共享所有者，函数表、Core、在途FFI调用及原生buffer guard都持其引用。EW1采取**进程生命周期驻留DLL**：正常退出前完成会话关闭和资源释放，但不在运行中FreeLibrary/热替换；替换库要求重启宿主。故障清理不完整也不强行卸载。未来若实现显式卸载，必须证明无Core/task/调用/buffer/回调/线程残留后另立方案。

输入UTF8/二进制在FFI返回前保持活着，Core复制受理成功后可释放宿主输入。输出先复制到Rust所有的受限缓存，再通过同一加载模块的gg_buffer_release释放并清零；错误buffer亦然。Core销毁后独立buffer仍需原DLL可用，不能提前卸载。禁止Rust Vec::from_raw_parts、CString::from_raw、libc::free或MSVC delete接管Core内存。

桥接对每个Core使用单一actor/互斥调用序列，逐次完成FFI调用与必要复制；等待终态不能占住actor阻止cancel/status。destroy/release不能与同一对象使用并发。UI/IPC线程不做创建、磁盘I/O或轮询等待。

C++所有导出必须在原边界转异常为gg_status/error；Rust不能用catch_unwind捕获C++异常，也不能让panic跨C/JNI边界。Rust入口若采用panic=unwind，仅在Rust内部catch_unwind并转INTERNAL_ERROR/失败会话；panic=abort、OOM abort和外来异常不属于可恢复成功，按进程故障处理，写入结果未知先持久request.lookup。本协议不采用C-unwind跨运行时展开。

## 4. Android同源SO与JNI职责

- Core仍由NDK r27d 27.3.13750724构建arm64-v8a/API26+，产物为libggcore.so；Rust目标aarch64-linux-android，linker显式使用同一NDK的aarch64-linux-android26-clang。
- Rust宿主按C ABI动态链接libggcore.so（ELF DT_NEEDED）；打包到同一APK的jniLibs/arm64-v8a/。不在Rust build.rs中第二次编入Core源，也不改为跨C++ABI链接。
- libc++_shared.so只接收同一NDK版本的一份；Core、必要JNI及其他C++插件的运行时策略统一，不以pickFirst随意选择两个版本中的一个。构建接收时明确ANDROID_STL=c++_shared；当前CMake源未足以证明实际链接方式，本轮不修改。
- Rust宿主SO名称按Tauri生成工程的确定lib.name写入接收清单，不能猜文件名；libggcore.so与其引用路径、DT_NEEDED/ABI/16KiB页兼容性都需真实产物证据。现有Core linker参数不是所有SO都已兼容的证明。
- 每个编辑器宿主只有Rust SessionManager拥有Core/task/租约。现有libggcore_jni/NativeCore.create/submit属于旧薄JNI入口，Tauri默认不再用它另建Core或另走领域命令。Kotlin/JNI仅处理SAF、Activity/生命周期等必要系统端口，并将能力引用交同一Rust会话管理器。
- Activity旋转只重新绑定UI订阅，不销毁仍被平台宿主持有的Core；进程死亡使全部token失效，新进程按原幂等/恢复规则重开。系统能力撤销不能由前端boolean恢复。

## 5. 接收责任

架构固定本设计与ABI边界；开发接收实际工具链、导出、依赖/打包布局及生命周期实现，独立quality后续准备跨运行时/恢复/设备计划。源级文档接收、实际构建、基础自测、设备验证分别记状态，任何缺项不冒称通过。

依据：[Tauri Windows前置](https://tauri.app/start/prerequisites/)、[Rust external ABI](https://doc.rust-lang.org/stable/reference/items/external-blocks.html)、[Rust布局](https://doc.rust-lang.org/reference/type-layout.html)、[FFI与展开](https://doc.rust-lang.org/nomicon/ffi.html)、[LoadLibraryExW](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibraryexw)、[Android C++运行时](https://developer.android.com/ndk/guides/cpp-support)。这些支持设计依据，不证明本项目运行。

Android授权根补充：M1 Core只消费宿主已接收的本机授权目录。SAF content:// URI不能当普通文件路径传gg_core_create；Kotlin系统端口持URI授权并提供受限流，导入字节经同一Rust会话的asset分块接口进入Core，导出经受限系统流。项目私有根与外部文件选择权限是不同能力，不另开JNI领域会话。

加载器实现约束：若使用libloading等RAII封装，不能让Library按局部变量生命周期自动Drop/close；本版需要进程级驻留所有者，所有调用/租约引用它。原C ABI没有回调注册接口，不新增跨运行时回调或unwind桥。Rust捕获panic后将会话标FAILED并禁止新领域写，不能假定任意内部状态仍可安全继续。
