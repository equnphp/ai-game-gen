/* 只启用SHA-256，避免将TLS/网络与证书功能带入本地核心。 */
#ifndef GG_MBEDTLS_CONFIG_H
#define GG_MBEDTLS_CONFIG_H
#define MBEDTLS_CONFIG_VERSION 0x03060700
#define MBEDTLS_SHA256_C
#endif
