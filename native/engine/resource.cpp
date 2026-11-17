// 资源逐块验签并限制在途数量；资产只流式摘要，IR在完整校验后才交给Verifier。
#include "engine/resource.hpp"
#include "engine/catalog.hpp"
#include <algorithm>
namespace gg::runtime {
std::uint64_t runtime_u64(const Json& value) {
    const auto source=text(value);require(!source.empty() && source.size()<=20 && (source=="0" || source[0]!='0'),"INVALID_U64");
    std::uint64_t number=0;
    for(char character:source) {
        require(character>='0' && character<='9',"INVALID_U64");const auto digit=static_cast<unsigned>(character-'0');
        require(number<=(UINT64_MAX-digit)/10,"INVALID_U64");number=number*10+digit;
    }
    return number;
}
std::string decode_base64(std::string_view source,std::size_t expected) {
    require(expected<=1048576 && source.size()==((expected+2)/3)*4,"RESOURCE_ENCODING_INVALID");
    auto digit=[](char c)->unsigned {if(c>='A' && c<='Z')return c-'A';if(c>='a' && c<='z')return c-'a'+26;
        if(c>='0' && c<='9')return c-'0'+52;if(c=='+')return 62;if(c=='/')return 63;throw Error("RESOURCE_ENCODING_INVALID");};
    std::string output;output.reserve(expected);
    for(std::size_t offset=0;offset<source.size();offset+=4) {
        const auto a=digit(source[offset]),b=digit(source[offset+1]);const bool last=offset+4==source.size();
        const bool pad2=source[offset+2]=='=',pad3=source[offset+3]=='=';
        require((!pad2 || (pad3 && last)) && (!pad3 || last),"RESOURCE_ENCODING_INVALID");
        const auto c=pad2?0:digit(source[offset+2]),d=pad3?0:digit(source[offset+3]);
        require((!pad2 || (b&15)==0) && (!pad3 || pad2 || (c&3)==0),"RESOURCE_ENCODING_INVALID");
        output.push_back(static_cast<char>((a<<2)|(b>>4)));if(!pad2)output.push_back(static_cast<char>((b<<4)|(c>>2)));if(!pad3)output.push_back(static_cast<char>((c<<6)|d));
    }
    require(output.size()==expected,"RESOURCE_ENCODING_INVALID");return output;
}
namespace {
void resource_schema(const Json& value,const char* type) {
    const auto& schema=contracts::runtime_resources();
    schema_check(value,Json{{"$ref",std::string("#/$defs/")+type},{"$defs",schema.at("$defs")}});
}
}
BundleLoader::BundleLoader(Json artifact,std::string epoch,std::string runtime,std::string profile,std::string profile_hash,
    std::function<std::string()> new_id,std::function<void(const Json&)> send)
    :artifact_(std::move(artifact)),epoch_(std::move(epoch)),runtime_(std::move(runtime)),profile_(std::move(profile)),profile_hash_(std::move(profile_hash)),
    new_id_(std::move(new_id)),send_(std::move(send)) {
    require(uuid(epoch_) && uuid(runtime_) && uuid(text(artifact_.at("artifactId"))) && content_hash(profile_hash_),"INVALID_RUNTIME_IDENTITY");
    require(artifact_.at("kind")=="runtime_bundle" && artifact_.at("contentHash")==artifact_.at("manifestHash") && content_hash(text(artifact_.at("manifestHash"))),"ARTIFACT_KIND_UNSUPPORTED");
    (void)runtime_u64(artifact_.at("bytes"));Resource manifest;manifest.hash=text(artifact_.at("manifestHash"));manifest.purpose="manifest";resources_.push_back(std::move(manifest));
}
void BundleLoader::finish_manifest() {
    bundle_=parse(resources_[0].bytes,8388608);schema_check(bundle_,contracts::runtime_bundle());
    require(bundle_.at("runtimeProfileId")==profile_ && bundle_.at("runtimeProfileHash")==profile_hash_ && bundle_.at("catalogHash")==contracts::graph_nodes_hash(),"BUNDLE_PROFILE_MISMATCH");
    std::set<std::string> hashes;std::uint64_t total=resources_[0].size,ir_total=0;
    for(const auto& block:bundle_.at("blocks")) {
        Resource resource;resource.hash=text(block.at("hash"));resource.purpose=text(block.at("purpose"));resource.known_size=true;resource.size=runtime_u64(block.at("bytes"));
        require(resource.size<=2147483648ULL && hashes.insert(resource.hash).second && resource.size<=UINT64_MAX-total,"BUNDLE_BLOCK_INVALID");
        if(resource.purpose=="graph_ir") {require(resource.size<=1048576 && resource.size<=67108864-ir_total,"IR_LIMIT_EXCEEDED");ir_total+=resource.size;}
        total+=resource.size;resources_.push_back(std::move(resource));
    }
    require(total==runtime_u64(artifact_.at("bytes")),"ARTIFACT_SIZE_MISMATCH");
}
void BundleLoader::pump() {
    require(!cancelled_ && !failed_,"RESOURCE_LOADER_INACTIVE");if(ready_)return;
    for(std::size_t i=0;i<resources_.size() && pending_.size()<4;++i) {
        auto& resource=resources_[i];if(resource.done || (i>0 && !resources_[0].done))continue;
        if(std::any_of(pending_.begin(),pending_.end(),[i](const auto& item){return item.second.resource==i;}))continue;
        const auto id=new_id_();require(uuid(id) && !pending_.contains(id),"RNG_UNAVAILABLE");
        const auto maximum=resource.known_size?static_cast<std::uint32_t>(std::max<std::uint64_t>(1,std::min<std::uint64_t>(1048576,resource.size-resource.offset))):1048576U;
        Json request={{"protocolVersion","1.0"},{"epoch",epoch_},{"runtimeId",runtime_},{"requestId",id},{"method","resource.read"},
            {"params",{{"artifactId",artifact_.at("artifactId")},{"resourceKind",i==0?"manifest":"block"},{"hash",resource.hash},{"offset",std::to_string(resource.offset)},{"maxBytes",maximum}}}};
        resource_schema(request,"request");pending_.emplace(id,Pending{i,resource.offset,maximum});
        try{send_(request);}catch(...){pending_.erase(id);failed_=true;throw;}
    }
    ready_=std::all_of(resources_.begin(),resources_.end(),[](const auto& item){return item.done;});
}
void BundleLoader::complete(const Json& reply) {
    require(!cancelled_ && !failed_,"RESOURCE_LOADER_INACTIVE");resource_schema(reply,"result");
    require(reply.at("epoch")==epoch_ && reply.at("runtimeId")==runtime_,"RESOURCE_EPOCH_MISMATCH");
    const auto id=text(reply.at("requestId"));require(pending_.contains(id),"RESOURCE_REQUEST_UNKNOWN");const auto pending=pending_.at(id);
    // 身份检查失败不消耗当前合法请求；已匹配请求的内容损坏则使本次加载失败。
    try {
        require(reply.at("ok").get<bool>(),"RESOURCE_IO_FAILED");auto& resource=resources_.at(pending.resource);const auto& data=reply.at("data");
        require(runtime_u64(data.at("offset"))==pending.offset && resource.offset==pending.offset,"OFFSET_MISMATCH");
        const auto count=data.at("decodedBytes").get<std::size_t>();require(count<=pending.maximum,"RESOURCE_LENGTH_MISMATCH");
        const auto bytes=decode_base64(text(data.at("base64")),count);const bool eof=data.at("eof").get<bool>();
        require(eof || count>0,"RESOURCE_NO_PROGRESS");
        if(resource.known_size)require(count<=resource.size-resource.offset && eof==(resource.offset+count==resource.size),"RESOURCE_LENGTH_MISMATCH");
        else require(resource.offset+count<=8388608,"BUNDLE_LIMIT_EXCEEDED");
        resource.digest->update(bytes);resource.offset+=count;
        if(resource.purpose=="manifest" || resource.purpose=="graph_ir")resource.bytes.append(bytes);
        if(eof) {
            require(resource.digest->finish()==resource.hash,"HASH_MISMATCH");resource.size=resource.offset;resource.done=true;verified_bytes_+=resource.size;
            if(pending.resource==0)finish_manifest();else if(resource.purpose=="graph_ir")ir_blocks_.emplace(resource.hash,std::move(resource.bytes));
        }
        pending_.erase(id);
    }catch(...){failed_=true;pending_.clear();throw;}
}
bool BundleLoader::accepts(const Json& result)const {
    if(cancelled_ || failed_ || ready_)return false;
    return result.is_object() && result.value("epoch","")==epoch_ && result.value("runtimeId","")==runtime_ &&
        result.contains("requestId") && result.at("requestId").is_string() && pending_.contains(text(result.at("requestId")));
}
void BundleLoader::cancel(){cancelled_=true;pending_.clear();resources_.clear();ir_blocks_.clear();bundle_=nullptr;}
const Json& BundleLoader::bundle()const{require(ready_,"RESOURCE_NOT_READY");return bundle_;}
const std::map<std::string,std::string>& BundleLoader::ir_blocks()const{require(ready_,"RESOURCE_NOT_READY");return ir_blocks_;}
}
