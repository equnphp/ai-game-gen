/* Game ABI1.1：游戏Runtime独立传输与帧入口，不复用作者Core的指针或权限。 */
#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
uint32_t gg_game_abi_version(void); /* 固定 0x00010001。 */
void* gg_game_alloc(uint32_t bytes); /* 1..8388608；失败返回 0。 */
void gg_game_free(void* owned); /* 只接受本分配器存活指针；0 幂等。 */
int32_t gg_game_submit(const void* utf8, uint32_t bytes); /* 同步受理一个有界命令，非异步任务等待。 */
uint32_t gg_game_result_size(void);
int32_t gg_game_result_copy(void* out, uint32_t capacity);
void gg_game_result_release(void);
int32_t gg_game_complete(const void* utf8, uint32_t bytes); /* 入队宿主完成包；禁止重入执行 tick。 */
/* 唯一自定义 JS library import：复制数据后通知宿主，不把 WASM 指针留给异步回调。 */
void gg_host_bridge(const void* utf8, uint32_t bytes);
/* ABI1.1显式帧驱动；frame_hi/lo合成U64，时间为宿主单调毫秒。 */
int32_t gg_game_pump(uint32_t frame_lo,uint32_t frame_hi,double monotonic_ms,uint32_t max_steps);
uint32_t gg_game_pump_flags(void); /* 纯读最近pump状态，不推进World。 */
int32_t gg_game_lifecycle(uint32_t event,double monotonic_ms); /* 1后台、2前台、3输入复位。 */
#ifdef __cplusplus
}
#endif
