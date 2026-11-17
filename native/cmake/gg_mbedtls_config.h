/* 只启用SHA-256，避免将TLS/网络与证书功能带入本地核心。 */
#ifndef GG_MBEDTLS_CONFIG_H
#define GG_MBEDTLS_CONFIG_H
#define MBEDTLS_CONFIG_VERSION 0x03060700
#define MBEDTLS_SHA256_C
/* MinGW所需的stdio平台兼容层；不启用TLS、网络或证书功能。 */
#if defined(_WIN32)
#define MBEDTLS_PLATFORM_C
#endif
#endif
