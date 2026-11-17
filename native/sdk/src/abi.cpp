// C边界捕获全部异常；租约与Core分离，禁止跨CRT释放或解引用伪造句柄。
#include "gg_core_v1.h"
#include "core/tasks/core.hpp"
#include <cstring>
#include <memory>
#include <unordered_map>
namespace {
using namespace gg;
std::mutex registry_mutex;
std::unordered_map<std::uint64_t,std::shared_ptr<Core>> cores;
struct Lease { std::string bytes; };
std::unordered_map<std::uint64_t,std::unique_ptr<Lease>> leases;
std::size_t leased_bytes=0;
static_assert(sizeof(gg_bytes_v1)==16 && sizeof(gg_buffer_v1)==24 && sizeof(gg_core_config_v1)==32);
bool empty(const gg_buffer_v1* b) {return b && !b->data && !b->len && !b->token;}
void output(gg_buffer_v1* out,const std::string& bytes) {
    require(empty(out),"INVALID_ARGUMENT");if(bytes.empty())return;
    auto lease=std::make_unique<Lease>();lease->bytes=bytes;const auto id=next_handle();
    std::lock_guard guard(registry_mutex);
    require(leased_bytes+bytes.size()<=8388608,"QUEUE_FULL");
    const auto* ptr=reinterpret_cast<const std::uint8_t*>(lease->bytes.data());
    leases.emplace(id,std::move(lease));leased_bytes+=bytes.size();*out={ptr,bytes.size(),id};
}
std::shared_ptr<Core> core(gg_core id) {
    std::lock_guard guard(registry_mutex);const auto i=cores.find(id);
    require(i!=cores.end(),"INVALID_HANDLE");return i->second;
}
std::string input(gg_bytes_v1 bytes,std::uint64_t maximum,bool allow_empty=false) {
    require(bytes.len<=maximum && (!bytes.len || bytes.data) && (bytes.len || allow_empty),"INVALID_ARGUMENT");
    return bytes.len?std::string(reinterpret_cast<const char*>(bytes.data),static_cast<std::size_t>(bytes.len)):std::string{};
}
gg_status status(const std::string& code) {
    if(code=="INVALID_HANDLE")return GG_E_HANDLE;
    if(code=="ABI_MISMATCH")return GG_E_ABI;
    if(code=="QUEUE_FULL")return GG_E_QUEUE_FULL;
    if(code=="TASK_NOT_READY")return GG_E_NOT_READY;
    if(code=="CANCEL_TOO_LATE" || code=="ALREADY_COMMITTED" || code=="PROJECT_BUSY")return GG_E_BUSY;
    if(code=="LIMIT_EXCEEDED")return GG_E_LIMIT;
    if(code=="INVALID_ARGUMENT" || code=="INVALID_MESSAGE" || code=="INVALID_PATH" || code=="PERMISSION_DENIED")
        return GG_E_ARGUMENT;
    return GG_E_INTERNAL;
}
template<class F> gg_status boundary(gg_buffer_v1* error,F&& f) noexcept {
    if(!empty(error))return GG_E_ARGUMENT;
    try{f();return GG_OK;}
    catch(const Error& e){try{output(error,error_json(e.code).dump());}catch(...){}return status(e.code);}
    catch(...){try{output(error,error_json("INTERNAL_ERROR").dump());}catch(...){}return GG_E_INTERNAL;}
}
void task_output(gg_task* out) {require(out && *out==0,"INVALID_ARGUMENT");}
}
extern "C" {
uint32_t GG_CALL gg_abi_version(void) {return 0x00010000;}
gg_status GG_CALL gg_core_create(const gg_core_config_v1* config,gg_core* out,gg_buffer_v1* error) {
    return boundary(error,[&]{
        require(config && out && *out==0,"INVALID_ARGUMENT");
        require(config->struct_size==sizeof(gg_core_config_v1) && config->abi_version==gg_abi_version(),"ABI_MISMATCH");
        require(config->flags==0 && config->reserved==0,"INVALID_ARGUMENT");
        const auto root=input(config->authorized_root,32768);require(root.find('\0')==std::string::npos,"INVALID_PATH");
        auto c=std::make_shared<Core>(root);const auto id=next_handle();
        std::lock_guard guard(registry_mutex);cores.emplace(id,std::move(c));*out=id;
    });
}
gg_status GG_CALL gg_submit(gg_core id,gg_bytes_v1 bytes,gg_task* out,gg_buffer_v1* error) {
    return boundary(error,[&]{
        task_output(out);auto c=core(id);auto t=std::make_shared<Task>();t->id=next_handle();
        t->input=input(bytes,2097152);t->reservation=3145728;c->enqueue(t);*out=t->id;
    });
}
gg_status GG_CALL gg_upload_write(gg_core id,gg_bytes_v1 upload,uint64_t offset,gg_bytes_v1 bytes,
                                 gg_task* out,gg_buffer_v1* error) {
    return boundary(error,[&]{
        task_output(out);auto c=core(id);auto t=std::make_shared<Task>();t->id=next_handle();t->work=Work::Upload;
        t->input=input(upload,36);require(uuid(t->input),"INVALID_MESSAGE");
        t->bytes=input(bytes,1048576);t->offset=offset;t->reservation=4096;c->enqueue(t);*out=t->id;
    });
}
gg_status GG_CALL gg_blob_read(gg_core id,gg_bytes_v1 content,uint64_t offset,uint32_t maximum,
                              gg_task* out,gg_buffer_v1* error) {
    return boundary(error,[&]{
        task_output(out);require(maximum>=1 && maximum<=1048576,"INVALID_ARGUMENT");
        auto c=core(id);auto t=std::make_shared<Task>();t->id=next_handle();t->work=Work::BlobRead;
        t->input=input(content,71);require(content_hash(t->input),"INVALID_MESSAGE");
        t->offset=offset;t->maximum=maximum;t->reservation=maximum+4096;c->enqueue(t);*out=t->id;
    });
}
gg_status GG_CALL gg_task_poll(gg_core id,gg_task task,gg_buffer_v1* state,gg_buffer_v1* error) {
    return boundary(error,[&]{require(empty(state) && state!=error,"INVALID_ARGUMENT");auto c=core(id);
        std::lock_guard guard(c->mutex);output(state,c->poll(c->task(task)).dump());});
}
gg_status GG_CALL gg_task_take_result(gg_core id,gg_task task,gg_buffer_v1* result,gg_buffer_v1* binary,
                                     gg_buffer_v1* error) {
    return boundary(error,[&]{
        require(empty(result) && empty(binary) && result!=binary && result!=error && binary!=error,"INVALID_ARGUMENT");
        auto c=core(id);std::lock_guard guard(c->mutex);auto t=c->task(task);require(t->terminal(),"TASK_NOT_READY");
        output(result,t->result);
        try {if(!t->binary_taken){output(binary,t->binary);t->binary_taken=true;t->binary.clear();}}
        catch(...){gg_buffer_release(result);throw;}
    });
}
gg_status GG_CALL gg_task_cancel(gg_core id,gg_task task,gg_buffer_v1* error) {
    return boundary(error,[&]{auto c=core(id);std::lock_guard guard(c->mutex);c->cancel(c->task(task));});
}
gg_status GG_CALL gg_task_release(gg_core id,gg_task task,gg_buffer_v1* error) {
    return boundary(error,[&]{auto c=core(id);std::lock_guard guard(c->mutex);c->release(c->task(task));});
}
gg_status GG_CALL gg_read_events(gg_core id,uint64_t after,uint32_t limit,gg_buffer_v1* events,gg_buffer_v1* error) {
    return boundary(error,[&]{require(empty(events) && events!=error,"INVALID_ARGUMENT");auto c=core(id);
        std::lock_guard guard(c->mutex);output(events,c->events(after,limit).dump());});
}
gg_status GG_CALL gg_core_destroy(gg_core id,gg_buffer_v1* error) {
    return boundary(error,[&]{
        auto c=core(id);
        {std::lock_guard guard(c->mutex);require(c->destroyable(),"PROJECT_BUSY");}
        {std::lock_guard guard(registry_mutex);require(cores.erase(id)==1,"INVALID_HANDLE");}
    });
}
gg_status GG_CALL gg_buffer_release(gg_buffer_v1* b) {
    if(!b)return GG_E_ARGUMENT;
    if(!b->token) {if(b->data || b->len)return GG_E_HANDLE;*b={};return GG_OK;}
    try {
        std::lock_guard guard(registry_mutex);const auto i=leases.find(b->token);
        if(i==leases.end() || b->data!=reinterpret_cast<const uint8_t*>(i->second->bytes.data()) ||
            b->len!=i->second->bytes.size())return GG_E_HANDLE;
        leased_bytes-=i->second->bytes.size();leases.erase(i);*b={};return GG_OK;
    }catch(...){return GG_E_INTERNAL;}
}
}
