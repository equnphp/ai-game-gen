// FFI不让异常跨越Rust；结果槽在业务调用前预留，发布成功后不再改变已知结果。
#include "artifact/gg_artifact_v1.h"
#include "artifact/build.hpp"
#include "platform/platform.hpp"
#include "contracts.hpp"
#include <atomic>
#include <cstring>
#include <optional>
namespace {
const gg::Json& contract(){static const auto value=gg::parse(gg::artifact_bridge_schema,1048576);return value;}
void check(const gg::Json& value,const char* definition) {
    gg::Json schema={{"$ref",std::string("#/$defs/")+definition},{"$defs",contract().at("$defs")}};gg::schema_check(value,schema);
}
}
struct GgaContext {
    std::atomic_bool cancelled=false;
    gg::RootGrant root;
    std::unique_ptr<gg::ProjectLocation> location;
    std::shared_ptr<void> read_fence;
    gg::Store store;
    std::unique_ptr<gg::Transaction> transaction;
    std::unique_ptr<gg::SnapshotReadPort> source;
    std::string artifact_root,settings,result;
    std::optional<gg::artifact::BuildPlan> plan;
    struct Receipt {std::string digest,result;};
    std::map<std::string,Receipt> receipts;
    std::size_t cached_bytes=0;
    bool failed=false;
    explicit GgaContext(const gg::Json& config):root(gg::text(config.at("projectRootUtf8"))),artifact_root(gg::text(config.at("privateArtifactRootUtf8"))) {
        location=root.current_project_read_only();location->verify();
        // 锁先于SQLite连接取得、后于连接析构释放；独立SDK入口同样遵守维护栅栏。
        read_fence=location->maintenance_fence(false);
        store.open(location->database,false,true);store.verify_structure();
        transaction=std::make_unique<gg::Transaction>(store,gg::Transaction::Access::read);
        source=std::make_unique<gg::SnapshotReadPort>(store,config.at("snapshot"),gg::text(config.at("consumerId")),[this]{checkpoint();});
        settings=gg::text(store.scalar("SELECT settings_document_id FROM project WHERE singleton=1"));
        // 仅验证native宿主提供的私有根，不在open创建产物或用户目录。
        gg::RootGrant artifact_grant(artifact_root);
    }
    void checkpoint(){gg::require(!cancelled.load(std::memory_order_relaxed),"CANCELLED");location->verify();}
};
uint32_t gga_abi_version(){return 0x00010000;}
int32_t gga_open(const void* utf8,uint32_t size,GgaContext** output) {
    if(!output)return -1;*output=nullptr;if(!utf8 || size==0 || size>2097152)return -1;
    try {const auto config=gg::parse({static_cast<const char*>(utf8),size});check(config,"openConfig");
        *output=new GgaContext(config);return 0;
    }catch(const std::bad_alloc&){return -4;}
    catch(const gg::Error& error){return error.code=="UNSUPPORTED_SCHEMA"?-5:-3;}
    catch(const gg::Json::exception&){return -1;}
    catch(...){return -6;}
}
int32_t gga_submit(GgaContext* context,const void* utf8,uint32_t size) {
    if(!context || !utf8 || size==0 || size>2097152)return -1;
    if(context->failed)return -6;if(!context->result.empty())return -2;
    gg::Json request;bool accepted=false;std::string id;
    try {
        request=gg::parse({static_cast<const char*>(utf8),size});check(request,"request");id=gg::text(request.at("requestId"));
        const auto digest=gg::hash(request.dump());
        if(context->receipts.contains(id)) {
            gg::require(context->receipts.at(id).digest==digest,"REQUEST_ID_CONFLICT");context->result=context->receipts.at(id).result;return 0;
        }
        gg::require(context->receipts.size()<1024,"REQUEST_CACHE_FULL");
        // 登记与结果缓冲均在可能发布文件之前分配。发布后的回执复制不会再申请内存。
        auto [entry,inserted]=context->receipts.emplace(id,GgaContext::Receipt{digest,{}});
        accepted=true;context->checkpoint();
        gg::Json data;
        if(request.at("method")=="prepare") {
            auto next=gg::artifact::prepare(*context->source,context->settings,request.at("params"),[context]{context->checkpoint();});
            data={{"planId",next.id},{"planHash",next.hash},{"snapshot",context->source->reference()},{"options",next.options},{"diagnostics",next.diagnostics}};
            context->plan=std::move(next);
        } else {
            const auto& params=request.at("params");gg::require(context->plan && context->plan->id==gg::text(params.at("planId")) && context->plan->hash==gg::text(params.at("planHash")),"PLAN_MISMATCH");
            auto compiled=gg::artifact::compile(*context->source,context->settings,*context->plan,[context]{context->checkpoint();});
            const auto artifact=gg::random_uuid(),raw=compiled.manifest.dump(),hash=gg::hash(raw);
            std::uint64_t total=raw.size();for(const auto& [key,bytes]:compiled.blocks)total+=bytes.size();
            // ArtifactRef大小为manifest与资源块总字节数，ready控制文件不属于内容清单。
            data={{"artifact",{{"artifactId",artifact},{"contentHash",hash},{"manifestHash",hash},{"bytes",std::to_string(total)},{"kind","runtime_bundle"}}},{"diagnostics",gg::Json::array()}};
            auto reply=gg::Json{{"protocolVersion","1.0"},{"requestId",id},{"ok",true},{"data",data}}.dump();
            gg::require(reply.size()<=8388608-context->cached_bytes,"REQUEST_CACHE_FULL");
            entry->second.result.reserve(reply.size());context->result.reserve(reply.size());
            gg::ArtifactOutput output(context->artifact_root,artifact);
            for(const auto& [key,bytes]:compiled.blocks){context->checkpoint();output.block(key,bytes);}
            context->checkpoint();output.publish(raw);
            entry->second.result=reply;context->result=reply;context->cached_bytes+=reply.size();return 0;
        }
        auto reply=gg::Json{{"protocolVersion","1.0"},{"requestId",id},{"ok",true},{"data",data}}.dump();
        gg::require(reply.size()<=8388608-context->cached_bytes,"REQUEST_CACHE_FULL");entry->second.result=reply;context->cached_bytes+=reply.size();context->result=std::move(reply);return 0;
    }catch(const std::bad_alloc&){context->failed=true;return -4;}
    catch(const gg::Error& error) {
        try {
            if(id.empty())return -1;
            auto reply=gg::Json{{"protocolVersion","1.0"},{"requestId",id},{"ok",false},{"error",{{"code",error.code},{"messageKey","artifact."+error.code},
                {"outcome",accepted?"known_failure":"not_submitted"},{"retryable",false},{"diagnostics",gg::Json::array()}}}}.dump();
            if(accepted) {
                gg::require(reply.size()<=8388608-context->cached_bytes,"REQUEST_CACHE_FULL");
                context->receipts.at(id).result=reply;context->cached_bytes+=reply.size();
            }
            context->result=std::move(reply);return 0;
        }catch(...){context->failed=true;return -6;}
    }catch(const gg::Json::exception&){context->failed=true;return -1;}
    catch(...){context->failed=true;return -6;}
}
uint32_t gga_result_size(GgaContext* context){return context?static_cast<uint32_t>(context->result.size()):0;}
int32_t gga_result_copy(GgaContext* context,void* output,uint32_t capacity) {
    if(!context || !output || context->result.empty() || capacity<context->result.size())return -1;
    std::memcpy(output,context->result.data(),context->result.size());return static_cast<int32_t>(context->result.size());
}
void gga_result_release(GgaContext* context){if(context)context->result.clear();}
int32_t gga_cancel(GgaContext* context){if(!context)return -1;context->cancelled.store(true,std::memory_order_relaxed);return 0;}
void gga_close(GgaContext* context){delete context;}
