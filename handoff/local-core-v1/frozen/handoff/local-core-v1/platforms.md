# 环境、依赖与平台端口

版本：local-core-v1-draft.1；日期：2026-11-17。下列是本包固定的开发输入，不是已安装/编译/测试的结果。没有下载或执行第三方项目。

## 固定环境

|部分|本包选择|边界|
|---|---|---|
|语言|C++20；对外C ABI 1.0|异常只在库内部捕获，STL/异常/分配器不越界|
|Windows|Windows 10 22H2 x64及Windows 11 x64；NTFS应用本地目录；LLVM-MinGW 20261104 UCRT x86_64，LLVM 23.1.5|无商业Qt或Visual Studio IDE依赖；只向宿主提供C ABI，不承诺MinGW C++ ABI与MSVC对象兼容；OS兼容目标不是安全支持承诺|
|Android|API26及以上、arm64-v8a；NDK r27d 27.3.13750724；libc++_shared；16KiB页兼容构建|核心CMake设置ANDROID_PLATFORM=26、ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON；只在应用内部存储开可写项目；SAF/外部文件先由未来宿主复制导入，不把content URI当SQLite路径|
|构建|CMake 3.31.12、Ninja 1.12.1|版本固定；不自动下载、运行FetchContent或安装SDK；第三方源码由受控vendor目录供应|
|SQLite|3.54.1，sqlite-amalgamation-3540100|编译入核心并隐藏符号，不用Android系统SQLite；THREADSAFE=1、OMIT_LOAD_EXTENSION、DQS=0；WAL/FULL/foreign_keys由连接初始化设置|
|JSON|nlohmann/json 3.12.0|MIT；固定单头实现。进入库先严格验证UTF-8/重复键/深度/大小；不假定默认解析器会自动拒绝重复键|
|SHA-256|Mbed TLS 3.6.7，仅所需hash/平台基础模块|选择Apache-2.0许可路径，包含相应通知；M1不启用TLS/RSA/X509，不自行写加密原语；LAN配对库后包另定|
|Qt/Flutter/渲染/物理/音频|本包不链接|后续各自冻结免费版本/模块和视口方案；本包不靠付费Qt补功能|

原生制品：Windows ggcore.dll + C头文件；Android libggcore.so + C头文件/薄JNI接口说明；两端相同SDK/格式Schema版本与capabilities。每个库只有一个C++运行时策略，符号导出仅gg_*；宿主自己管理运行时，禁止跨CRT free。JNI/Dart绑定只做字节复制、线程调度和生命周期，不自己解析业务以决定合法性。

## 平台端口的精确责任

核心内置platform/windows和platform/android，不在C ABI暴露任意文件操作回调。core_create的authorized_root是宿主已获权限的绝对本机目录，UTF-8；核心规范化后打开目录句柄并拒绝越界。宿主本身须可信，授权不是拿字符串即可获得新OS权限。

|端口|Windows|Android|失败规则|
|---|---|---|---|
|RootGrant|UTF-8转UTF-16；目录句柄与最终路径/volume+fileId核对；拒绝重解析点逃逸|realpath/目录fd；openat+O_NOFOLLOW逐级打开并检查身份|PERMISSION_DENIED/INVALID_PATH；不得创建目标外文件|
|ExclusiveProjectLock|持有.gglock文件句柄并LockFileEx独占，进程内注册最终文件身份|持有.gglock独立fd并flock(LOCK_EX|LOCK_NB)，进程内同样注册|PROJECT_BUSY；不根据PID文件或过期时间强抢|
|Clock|单调时钟算deadline；墙钟只作显示/保留记录|CLOCK_MONOTONIC及墙钟|时钟回拨不改变revision/幂等/安全判断|
|RNG|系统CSPRNG|系统getrandom/等效系统设施|RNG_UNAVAILABLE；不能降级成时间戳/伪随机ID|
|Space|查询项目卷剩余空间|应用内部文件系统剩余空间|查询失败或不足明确拒绝；预检查不能替代处理SQLITE_FULL|
|Durability|由SQLite标准win32 VFS及FULL同步处理数据库/WAL|由SQLite标准unix VFS处理|不自行替换成弱VFS；I/O错误后停写/重开核对|

默认Core每实例1个执行线程、一个可写项目、任务队列32，二进制块最大1MiB、最多4个待处理块（≤4MiB），完成结果总量≤8MiB。入队前拷贝，预算不足返回QUEUE_FULL，不丢旧任务。宿主后台/锁屏先停止新提交并检查点/关闭；系统直接回收时以持久化结果为准，不承诺无限后台执行。

## 依赖冻结与维护

精确tag/版本见spec/dependencies.lock.json。哈希只填官方已公布且已核对值；其余artifact_sha256=null、acquisition_status=not_downloaded，接收源码时补齐真实字节摘要再进入构建。null不允许被实现者当作“已验证”或从默认分支漂移下载。版本选择已经固定，缺少下载校验记录是供应链接收步骤，不需要程序员重新选框架；发现版本实际不可用/许可冲突须回架构改版。

来源：[SQLite发布](https://www.sqlite.org/changes.html)、[SQLite下载](https://www.sqlite.org/download.html)、[LLVM-MinGW发布](https://github.com/mstorsjo/llvm-mingw/releases/tag/20261104)、[NDK r27d](https://github.com/android/ndk/releases/tag/r27d)、[16KiB说明](https://github.com/android/ndk/wiki/Changelog-r27)、[CMake](https://cmake.org/download/)、[Ninja](https://github.com/ninja-build/ninja/releases/tag/v1.12.1)、[JSON 3.12.0](https://github.com/nlohmann/json/releases/tag/v3.12.0)、[Mbed TLS 3.6.7](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-3.6.7)。这些官方资料用于确认版本/能力，不代表本项目完成兼容或安全验证；发布前依赖维护状态另行复核。
