/* ABI 1.0实现的公开契约；编译与运行尚未执行。意图：宿主与共享核心只交换稳定C类型。 */
#ifndef GG_CORE_V1_H
#define GG_CORE_V1_H
#include <stdint.h>
#if defined(_WIN32)
# if defined(GG_CORE_BUILD)
#  define GG_API __declspec(dllexport)
# else
#  define GG_API __declspec(dllimport)
# endif
# define GG_CALL __cdecl
#else
# define GG_API __attribute__((visibility("default")))
# define GG_CALL
#endif
#ifdef __cplusplus
extern "C" {
#endif

typedef uint64_t gg_core;
typedef uint64_t gg_task;
typedef int32_t gg_status;

/* 所有平台本包均64位；借用指针只在调用期间有效，len按字节，不含终止符。 */
typedef struct gg_bytes_v1 { const uint8_t *data; uint64_t len; } gg_bytes_v1;
/* data只读；token标识库分配的租约，禁止宿主free或复制后重复释放。 */
typedef struct gg_buffer_v1 { const uint8_t *data; uint64_t len; uint64_t token; } gg_buffer_v1;
typedef struct gg_core_config_v1 {
    uint32_t struct_size;
    uint32_t abi_version; /* 0x00010000，即major=1/minor=0。 */
    gg_bytes_v1 authorized_root;
    uint32_t flags; /* v1必须0；没有隐藏联网/SQL/调试权限。 */
    uint32_t reserved; /* 必须0，默认8字节对齐，不允许pack(1)。 */
} gg_core_config_v1;

enum {
    GG_OK=0, GG_E_ARGUMENT=1, GG_E_ABI=2, GG_E_HANDLE=3,
    GG_E_QUEUE_FULL=4, GG_E_NOT_READY=5, GG_E_BUSY=6,
    GG_E_LIMIT=7, GG_E_INTERNAL=8
};

GG_API uint32_t GG_CALL gg_abi_version(void);
/* out_*由调用方预置0；error为结构化JSON。每次错误独立，不用全局last_error。 */
GG_API gg_status GG_CALL gg_core_create(const gg_core_config_v1 *config,
                                      gg_core *out_core, gg_buffer_v1 *error);
/* 创建后不开放项目；参数必须复制完成后才能返回。只校验授权根，不执行项目修改。 */
GG_API gg_status GG_CALL gg_submit(gg_core core, gg_bytes_v1 request_json,
                                 gg_task *out_task, gg_buffer_v1 *error);
/* 二进制输入也复制入有界队列；结果与JSON命令使用相同任务状态机。 */
GG_API gg_status GG_CALL gg_upload_write(gg_core core, gg_bytes_v1 upload_id,
                                       uint64_t offset, gg_bytes_v1 bytes,
                                       gg_task *out_task, gg_buffer_v1 *error);
GG_API gg_status GG_CALL gg_blob_read(gg_core core, gg_bytes_v1 content_hash,
                                    uint64_t offset, uint32_t max_bytes,
                                    gg_task *out_task, gg_buffer_v1 *error);
GG_API gg_status GG_CALL gg_task_poll(gg_core core, gg_task task,
                                    gg_buffer_v1 *state_json, gg_buffer_v1 *error);
/* 仅终态可取；JSON与可选binary分开。取结果可重复，二进制只允许取一次。 */
GG_API gg_status GG_CALL gg_task_take_result(gg_core core, gg_task task,
                                           gg_buffer_v1 *result_json,
                                           gg_buffer_v1 *binary,
                                           gg_buffer_v1 *error);
GG_API gg_status GG_CALL gg_task_cancel(gg_core core, gg_task task,
                                      gg_buffer_v1 *error);
/* 仅终态允许释放任务；已有输出缓冲区租约独立存活。 */
GG_API gg_status GG_CALL gg_task_release(gg_core core, gg_task task,
                                       gg_buffer_v1 *error);
GG_API gg_status GG_CALL gg_read_events(gg_core core, uint64_t after_seq,
                                      uint32_t limit, gg_buffer_v1 *events_json,
                                      gg_buffer_v1 *error);
/* 无任务/会话后销毁；忙时GG_E_BUSY，不在调用线程隐式等待写入完成。 */
GG_API gg_status GG_CALL gg_core_destroy(gg_core core, gg_buffer_v1 *error);
/* 可在Core销毁后调用；核对token后释放并清0，空租约释放是成功。 */
GG_API gg_status GG_CALL gg_buffer_release(gg_buffer_v1 *buffer);

#ifdef __cplusplus
}
#endif
#endif
