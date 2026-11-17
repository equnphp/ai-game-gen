// 作者会话与产物桥共用不可变版本读取；快照分支禁止回退到当前head。
#pragma once
#include "core/document/document.hpp"
#include "core/storage/sqlite/store.hpp"
#include <optional>
namespace gg {
Document read_document_version(Store& store,const std::string& id,const std::string& version);
AssetVersion read_asset_version(Store& store,const std::string& id,const std::string& version);
State read_repository_state(Store& store,int database_format,const std::string& project,const std::string& branch,
    const std::optional<std::string>& snapshot={});
class SnapshotReadPort {
    Store& store_;
    Json reference_;
    State state_;
    std::string original_;
    std::set<std::string> allowed_blobs_,verified_blobs_;
    std::function<void()> checkpoint_;
    void verify_blob(const std::string& hash);
public:
    // 调用方先建立只读事务并保持其生命周期；consumer与索引在同一数据库视图核验。
    SnapshotReadPort(Store&,const Json& reference,const std::string& consumer,std::function<void()> checkpoint);
    const std::string& manifest_raw()const{return original_;}
    const State& state()const{return state_;}
    const Json& reference()const{return reference_;}
    std::string document_bytes(const std::string& id);
    std::string asset_metadata_bytes(const std::string& id);
    std::string read_blob(const std::string& hash,std::uint64_t offset,std::uint32_t maximum);
};
}
