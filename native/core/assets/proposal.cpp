// 资源采纳只是普通提案中的操作；READY上传不提前成为活跃资产。
#include "core/application/session.hpp"
#include "core/assets/logical_path.hpp"
#include "core/assets/metadata.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <cctype>
#include <set>

namespace gg {
namespace {
std::string logical_key(const std::string& value) {
    return logical_path(value).key;
}
void check_metadata(const Json& metadata,const AssetVersion& asset,const AssetVersion* previous,bool content_changed) {
    validate_asset_metadata(metadata);
    const auto& provenance=metadata.at("provenance");
    require(provenance.at("sourceHash")==asset.content_hash,"HASH_MISMATCH");
    require(provenance.at("sourceName")==asset.source.at("displayName") && provenance.at("licenseId")==asset.license.at("identifier"),"PROVENANCE_REVIEW_REQUIRED");
    if(asset.license.at("status")=="unknown")require(provenance.at("commercialUse")=="unknown","PROVENANCE_REVIEW_REQUIRED");
    if (previous) {
        const auto& old=previous->metadata.at("provenance");
        if (!content_changed) require(provenance==old,"PROVENANCE_REVIEW_REQUIRED");
        if (old.at("commercialUse")=="unknown") require(provenance.at("commercialUse")=="unknown","PROVENANCE_REVIEW_REQUIRED");
    }
}
}
void Session::apply_proposal(State& state,const Json& operations,const std::vector<std::string>& versions) {
    require(versions.size()==operations.size(),"INVALID_MESSAGE");
    for (std::size_t index=0;index<operations.size();++index) {
        const auto& operation=operations[index];const auto kind=text(operation.at("kind"));
        if (operation.contains("documentId")) {apply_operations(state,Json::array({operation}));continue;}
        require(format_==2,"FORMAT_UPGRADE_REQUIRED");
        std::string id;AssetVersion asset;const AssetVersion* old=nullptr;
        if (kind!="attach_asset") {
            id=text(operation.at("assetId"));require(state.asset_versions.contains(id),"NOT_FOUND");
            old=&state.asset_versions.at(id);
            require(old->version==text(operation.at("expectedVersionId")),"VERSION_MISMATCH");asset=*old;
        }
        if (kind=="delete_asset") {state.assets.erase(id);state.asset_types.erase(id);state.asset_versions.erase(id);continue;}
        const bool upload=kind=="attach_asset" || kind=="replace_asset_content";
        if (upload) {
            const auto rows=store_.query("SELECT u.asset_id,u.media_type,u.source_json,u.license_json,b.content_hash,b.expected_size "
                "FROM uploads u JOIN blob_objects b USING(blob_id) WHERE u.upload_id=? AND u.state='READY' AND b.state='READY'",
                {operation.at("uploadId")});
            require(rows.size()==1,"UPLOAD_INCOMPLETE");const auto& row=rows[0];
            if (kind=="attach_asset") {id=text(row[0]);require(!state.assets.contains(id),"INVALID_REFERENCE");}
            asset.content_hash=text(row[4]);asset.bytes=row[5].get<std::uint64_t>();asset.media_type=text(row[1]);
            asset.source=parse(text(row[2]));asset.license=parse(text(row[3]));
        } else require(kind=="set_asset_metadata","INVALID_MESSAGE");
        asset.version=versions[index];asset.metadata=operation.at("metadata");
        asset.metadata["logicalPath"]=logical_path(text(asset.metadata.at("logicalPath"))).normalized;
        asset.metadata_hash=hash(asset.metadata.dump());
        check_metadata(asset.metadata,asset,old,upload);
        state.assets.insert(id);state.asset_types[id]=text(asset.metadata.at("assetType"));state.asset_versions[id]=std::move(asset);
    }
    // 只在批次完整候选上查重，允许同一提案交换两个虚拟路径。
    std::set<std::string> paths;
    for (const auto& [id,asset]:state.asset_versions)
        require(paths.insert(logical_key(text(asset.metadata.at("logicalPath")))).second,"PATH_COLLISION");
}
void Session::adopt_uploads(const Json& operations) {
    std::set<std::string> consumed;
    for (const auto& operation:operations) if (operation.contains("uploadId") && !operation.contains("documentId")) {
        const auto upload=text(operation.at("uploadId"));require(consumed.insert(upload).second,"INVALID_REFERENCE");
        const auto target=operation.at("kind")=="attach_asset" ? store_.scalar("SELECT asset_id FROM uploads WHERE upload_id=?",{upload}) : operation.at("assetId");
        require(store_.scalar("SELECT state FROM uploads WHERE upload_id=?",{upload})=="READY","UPLOAD_INCOMPLETE");
        store_.run("UPDATE uploads SET state='ATTACHED',attachment_target_id=? WHERE upload_id=?",{target,upload});
        // 替换所用上传的候选身份永久保留，不能在之后误采纳为另一个资产。
        const auto candidate=text(store_.scalar("SELECT asset_id FROM uploads WHERE upload_id=?",{upload}));
        if (candidate!=text(target) && store_.query("SELECT stable_id FROM identities WHERE stable_id=?",{candidate}).empty())
            store_.run("INSERT INTO identities VALUES(?,'asset',?,'asset',?)",{candidate,project_,head()+1});
    }
}
}
