# 固定运行依赖接收

本目录只供应源码与原许可，不运行上游构建、安装或生成脚本。接收字节摘要见 acquisition.json。实际本地文件摘要将登记到 docs/source-inventory.json；摘要一致只说明所接收字节与记录对应，不证明程序安全、兼容或已通过测试。

- sqlite/：官方 sqlite-amalgamation-3540100.zip 中的 sqlite3.c / sqlite3.h / sqlite3ext.h，版本3.54.1。压缩包共2,990,966字节，SHA3-256与架构冻结值92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30一致。实际SHA-256为0a9c8e34352dad46006aa82836d5383bff9dc6bc9ce5a60553c05aa30e6ad1f9。源码原始Public Domain声明保留在文件开头。
- json/：从nlohmann/json官方v3.12.0源归档提取单头。json.hpp实际SHA-256为aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63，与架构发布校验值一致。LICENSE.MIT原样保留。
- mbedtls/：官方正式发布包mbedtls-3.6.7.tar.bz2的include与SHA-256所需library子集，原LICENSE保留，采用Apache-2.0选项。正式包实际SHA-256为a7e8bcbec0e6f761b4af24f25677626b35f762f68eef79c08677a363212d11f6，与架构师核对的发布者校验值一致。先前固定tag快照已由正式发布包的对应文件接收替换，不能混用制品摘要。构建只编译sha256.c、platform_util.c，不启用TLS、X509、网络、PSA或自测模块。

SQLite官方原包目前保留在本目录以便核对接收记录。json-upstream/为固定源码归档中原始单头/许可的提取位置，实际编译只使用json/。本轮没有替换为系统SQLite、默认分支JSON或其他密码学实现。

工具链安装和执行不属于这次接收：CMake 3.31.12、Ninja 1.12.1、Windows LLVM-MinGW UCRT20261104/Clang23.1.5、Android NDKr27d 27.3.13750724由架构固定，实际是否已安装和能否构建仍未验证。CMake配置拒绝缺失vendor文件和不符的目标/版本，不自动下载。
