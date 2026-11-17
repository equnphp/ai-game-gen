/* 独立产物桥；调用线程拥有context，cancel只设置原子标记，不释放上下文。 */
#pragma once
#include <stdint.h>
#if defined(_WIN32)
# if defined(GG_ARTIFACT_BUILD)
#  define GGA_API __declspec(dllexport)
# else
#  define GGA_API __declspec(dllimport)
# endif
#else
# define GGA_API __attribute__((visibility("default")))
#endif
#ifdef __cplusplus
extern "C" {
#endif
typedef struct GgaContext GgaContext;
GGA_API uint32_t gga_abi_version(void);
GGA_API int32_t gga_open(const void*,uint32_t,GgaContext**);
GGA_API int32_t gga_submit(GgaContext*,const void*,uint32_t);
GGA_API uint32_t gga_result_size(GgaContext*);
GGA_API int32_t gga_result_copy(GgaContext*,void*,uint32_t);
GGA_API void gga_result_release(GgaContext*);
GGA_API int32_t gga_cancel(GgaContext*);
GGA_API void gga_close(GgaContext*);
#ifdef __cplusplus
}
#endif
