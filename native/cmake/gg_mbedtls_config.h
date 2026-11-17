/* 只启用SHA-256，避免将TLS/网络与证书功能带入本地核心。 */
#ifndef GG_MBEDTLS_CONFIG_H
#define GG_MBEDTLS_CONFIG_H
#define MBEDTLS_CONFIG_VERSION 0x03060700
#define MBEDTLS_SHA256_C
/* 游戏安全身份使用独立CTR_DRBG；不启用TLS、网络或游戏行为随机源。 */
#if defined(GG_GAME_IDENTITY)
#define MBEDTLS_AES_C
#define MBEDTLS_CTR_DRBG_C
#endif
/* MinGW所需的stdio平台兼容层；不启用TLS、网络或证书功能。 */
#if defined(_WIN32)
#define MBEDTLS_PLATFORM_C
#endif
#endif
