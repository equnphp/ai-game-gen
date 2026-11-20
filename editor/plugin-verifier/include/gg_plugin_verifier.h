/* 调用方持有回调、上下文和输出缓冲；插件自身不能提供宿主 reader。 */
#ifndef GG_PLUGIN_VERIFIER_H
#define GG_PLUGIN_VERIFIER_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef int32_t (*ggpv_read_v1)(void *ctx, uint8_t *dst, uint32_t cap, uint32_t *written);
uint32_t ggpv_abi_version(void);
int32_t ggpv_verify_stream_v1(ggpv_read_v1 read, void *ctx, uint8_t *out, uint32_t out_cap, uint32_t *out_len);
int32_t ggpv_canonicalize_v1(const uint8_t *in, uint32_t in_len, uint8_t *out, uint32_t out_cap, uint32_t *out_len);
#ifdef __cplusplus
}
#endif
#endif
