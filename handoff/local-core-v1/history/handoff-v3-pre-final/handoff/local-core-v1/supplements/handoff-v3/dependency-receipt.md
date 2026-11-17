# 固定依赖取得与校验记录

版本：local-core-v1-handoff.3；具体机器可读数据见dependencies.receipt.lock.json。本次没有改变SQLite 3.54.1、nlohmann/json 3.12.0、Mbed TLS 3.6.7或工具链版本；没有安装到native/、运行上游脚本或构建。

## 固定来源与实际接收

- SQLite：官方页面确认2026/sqlite-amalgamation-3540100.zip，公布SHA3-256。直接取包请求超时，未取得包字节，因此不编造本地SHA-256；接收者可以使用公布的SHA3-256校验原包，再记录实际字节SHA-256。不存在“没有SHA-256就随意换版本”的授权。
- nlohmann/json：官方v3.12.0发布json.hpp已实际取得，其SHA-256与官方release正文一致；只作接收证据，没有复制进native/。
- Mbed TLS：官方3.6.7 tar.bz2、checksum文件已实际取得；包SHA-256同时匹配官方checksum与release资产digest。最小C文件/配置要求见hash-subset.md。
- LLVM-MinGW：官方20261104 release API提供UCRT x86_64包名、大小和SHA-256。只取元数据，未下载191MB工具链、安装或执行。
- CMake：官方3.31.12 SHA-256文件已读取，固定Windows x86_64 ZIP；未取得/安装ZIP，不能把官方expected值写成observed。
- Android NDK：官方r27d确认27.3.13750724、Windows包、长度和SHA1。官方该发布记录未提供SHA-256，本次未下载781MB；按官方长度/SHA1及HTTPS来源接收后，再补本地SHA-256。SHA1来源限制明确记录，不捏造更强的发布者摘要。
- Ninja：官方v1.12.1 release确认Windows ZIP，release API未提供digest；本次下载连接失败，保留待接收。固定tag/来源不变，接收时记录真实字节SHA-256及批准的内部镜像/来源，不将TOFU本地摘要冒称独立官方签名或安全审计。

## expected与observed分开

expected_checksum表示发布者网页/校验文件/release API中的预期值；observed_checksum表示本次实际文件字节计算值。未下载时observed必须为空，但有明确算法、来源和失败原因；artifact_sha256仅在实际取得SHA-256字节记录时填写。SQLite可用SHA3-256作为发布者校验，不能将它塞进SHA-256字段。

源码接收不要求先运行编译/测试。版本、源码/工具包名称和校验方式已固定，下载/镜像可用性及真实字节登记属于LC-T01实施接收任务；不得漂移到系统库、其他tag或未核对的包。发现实际不符必须停对应接入、写回架构改版，不能悄悄换版本。

## 官方依据

[SQLite下载](https://www.sqlite.org/download.html)、[JSON v3.12.0](https://github.com/nlohmann/json/releases/tag/v3.12.0)、[Mbed TLS 3.6.7](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-3.6.7)、[LLVM-MinGW 20261104](https://github.com/mstorsjo/llvm-mingw/releases/tag/20261104)、[CMake校验文件](https://cmake.org/files/v3.31/cmake-3.31.12-SHA-256.txt)、[NDK r27d](https://github.com/android/ndk/releases/tag/r27d)、[Ninja v1.12.1](https://github.com/ninja-build/ninja/releases/tag/v1.12.1)。原始HTTP元数据的本地文件与哈希另存，网络失败不等于版本不存在。
