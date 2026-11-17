// Runtime资源只按ArtifactRef中的hash读取；没有路径、作者数据库或编辑器权限。
#pragma once
#include "engine/runner.hpp"
#include <functional>
namespace gg::runtime {
std::uint64_t runtime_u64(const Json& value);
std::string decode_base64(std::string_view value,std::size_t expected_bytes);
class BundleLoader {
    struct Resource {
        std::string hash,purpose,bytes;
        std::uint64_t size=0,offset=0;
        bool known_size=false,done=false;
        std::unique_ptr<Hasher> digest=std::make_unique<Hasher>();
    };
    struct Pending {std::size_t resource;std::uint64_t offset;std::uint32_t maximum;};
    Json artifact_,bundle_;
    std::string epoch_,runtime_,profile_,profile_hash_;
    std::function<std::string()> new_id_;
    std::function<void(const Json&)> send_;
    std::vector<Resource> resources_;
    std::map<std::string,Pending> pending_;
    std::map<std::string,std::string> ir_blocks_;
    std::uint64_t verified_bytes_=0;
    bool cancelled_=false,ready_=false,failed_=false;
    void finish_manifest();
public:
    BundleLoader(Json artifact,std::string epoch,std::string runtime,std::string profile,std::string profile_hash,
        std::function<std::string()> new_id,std::function<void(const Json&)> send);
    void pump();
    // 外层先排队completion，在单写调度片中调用；无效旧包不会触发任何World回调。
    void complete(const Json& result);
    bool accepts(const Json& result)const;
    void cancel();
    bool ready()const{return ready_;}
    bool failed()const{return failed_;}
    const Json& bundle()const;
    const std::map<std::string,std::string>& ir_blocks()const;
};
}
