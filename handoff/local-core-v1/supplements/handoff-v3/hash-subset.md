# Mbed TLS 3.6.7的SHA-256最小编译边界

版本：local-core-v1-handoff.3。已读取官方固定tag的sha256.c、platform_util.c、common.h和build_info.h；来源/字节摘要见evidence/source-metadata.json。以下是根据配置条件与源码阅读得出的编译输入约束，未运行预处理、编译、链接、自测或扫描，不能声称已经可构建。

## 源码与头文件

只编译library/sha256.c和library/platform_util.c；前者实现SHA-256，后者提供mbedtls_platform_zeroize/相关清理。保留同一版本完整include/和所需library头目录，包括common.h、alignment.h以及build_info/config_adjust/check_config等配置链。不能只复制sha256.h，不能把新版本头文件与旧C文件混合。

原固定包为mbedtls-3.6.7.tar.bz2，已实际取得并与官方checksum文件及release API digest一致；它是官方发布包。GitHub自动生成source.zip/tar.gz不是本包默认接收物，不因tag相同就代替带完整内容的正式包。

## 配置边界

MBEDTLS_CONFIG_FILE必须指向自有gg_mbedtls_config.h，唯一必需功能开关为MBEDTLS_SHA256_C。MBEDTLS_CONFIG_VERSION可明确设置为0x03060700以便版本核对。保持SELF_TEST、SHA224、PLATFORM_C、THREADING_C、PSA_CRYPTO_C/CLIENT/CONFIG、TLS、X509、RSA/ECC、SHA256_ALT/PROCESS_ALT和硬件加速选择关闭；不以默认完整mbedtls_config.h代替最小配置。

此配置下platform.h提供标准分配别名，platform_util.c的时间/线程分支不启用，因此不额外编译platform.c、threading.c、ssl/tls、x509、PSA或网络模块。保留上游Apache-2.0许可路径及通知，不重写hash原语。全部mbedtls类型停留在核心内部，不穿过GameGen C ABI。

## 给开发会话的明确接入事项

已读的native/cmake/Dependencies.cmake采用上述两个C文件，方向与本说明一致。但MBEDTLS_CONFIG_FILE当前作为PUBLIC编译定义传播，而自有配置所在cmake目录仅PRIVATE可见；凡包含mbedtls公共头的消费者也必须看见同一配置头。请由代码单写者将配置头目录以匹配的PUBLIC/INTERFACE可见性传播，或在每个实际消费者显式加入同一路径，不能让消费者回落到另一套默认配置。本架构会话不修改该实现文件。

流式调用约定为init→starts(ctx,0)→多次update→finish→free；不要将旧版*_ret名称或SHA224模式搬入此配置。未来编译/链接和已知向量验证按真实会话授权另记；本说明没有用编译成功作为文档接收前置条件。
