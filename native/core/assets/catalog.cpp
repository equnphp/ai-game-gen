// 资源翻页绑定冻结的版本与引用计数；作者继续编辑不会把后一页换成新head。
#include "core/application/session.hpp"
#include "core/assets/logical_path.hpp"
#include <algorithm>

namespace gg {
namespace {
std::string search_key(std::string value) {
    return unicode_search_key(value);
}
bool matches_asset(const Json& metadata,const Json& params) {
    if (!params.at("assetType").is_null() && metadata.at("assetType")!=params.at("assetType")) return false;
    const auto path=text(metadata.at("logicalPath")),prefix=text(params.at("pathPrefix"));
    if (!prefix.empty() && !search_key(path).starts_with(search_key(prefix))) return false;
    const auto query=search_key(text(params.at("query")));
    if (query.empty()) return true;
    if (search_key(text(metadata.at("name"))).find(query)!=std::string::npos || search_key(path).find(query)!=std::string::npos) return true;
    for (const auto& tag:metadata.at("tags")) if (search_key(text(tag)).find(query)!=std::string::npos) return true;
    return false;
}
}
Json Session::list_assets(const Json& params) {
    const auto now=std::chrono::steady_clock::now();
    std::erase_if(asset_reads_,[&](const auto& entry){return entry.second.expires<=now;});
    const auto filter=hash(Json{{"assetType",params.at("assetType")},{"pathPrefix",params.at("pathPrefix")},{"query",params.at("query")}}.dump());
    std::string id;
    if (!params.at("snapshotId").is_null() && asset_reads_.contains(text(params.at("snapshotId")))) id=text(params.at("snapshotId"));
    else {
        require(params.at("afterId").is_null(),"CURSOR_EXPIRED");
        require(asset_reads_.size()<2,"LIMIT_EXCEEDED");
        AssetReadView view;view.revision=head();view.filter_hash=filter;view.expires=now+std::chrono::seconds(60);
        if(!params.at("snapshotId").is_null())(void)load_state(text(params.at("snapshotId")));
        view.reader=std::make_shared<Store>();location_->verify();view.reader->open(location_->database,false,true);
        view.lease=std::make_unique<Transaction>(*view.reader,Transaction::Access::read);
        auto& source=*view.reader;
        view.revision=source.scalar("SELECT head_revision FROM project WHERE singleton=1").get<std::int64_t>();
        std::vector<Row> versions;
        std::vector<Row> uses;
        if (!params.at("snapshotId").is_null()) {
            const auto snapshot=text(params.at("snapshotId"));
            require(!source.query("SELECT snapshot_id FROM snapshots WHERE snapshot_id=?",{snapshot}).empty(),"CURSOR_EXPIRED");
            view.revision=source.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?",{snapshot}).get<std::int64_t>();
            versions=source.query("SELECT asset_id,asset_version_id FROM snapshot_assets WHERE snapshot_id=? ORDER BY asset_id",{snapshot});
            uses=source.query("SELECT r.target_id,COUNT(*) FROM document_refs r JOIN snapshot_documents s ON s.version_id=r.version_id "
                "WHERE s.snapshot_id=? AND r.target_kind='asset' GROUP BY r.target_id",{snapshot});
        } else {
            versions=source.query("SELECT asset_id,asset_version_id FROM asset_heads ORDER BY asset_id");
            uses=source.query("SELECT r.target_id,COUNT(*) FROM document_refs r JOIN document_heads h ON h.version_id=r.version_id "
                "WHERE r.target_kind='asset' GROUP BY r.target_id");
        }
        for (const auto& row:versions) view.versions.emplace_back(text(row[0]),text(row[1]));
        for (const auto& row:uses) view.uses.emplace(text(row[0]),row[1].get<std::size_t>());
        id=random_uuid();asset_reads_.emplace(id,std::move(view));
    }
    const auto& view=asset_reads_.at(id);require(view.filter_hash==filter,"CURSOR_EXPIRED");
    const auto after=params.at("afterId").is_null()?"":text(params.at("afterId"));
    if (!after.empty()) require(std::any_of(view.versions.begin(),view.versions.end(),[&](const auto& item){return item.first==after;}),"CURSOR_EXPIRED");
    Json items=Json::array();bool more=false;std::size_t encoded_bytes=1024;
    for (const auto& [asset,version]:view.versions) {
        if (asset<=after) continue;
        auto data=asset_metadata(asset,version,view.reader.get());
        if (!matches_asset(data.at("metadata"),params)) continue;
        if (items.size()==params.at("limit").get<std::size_t>()) {more=true;break;}
        data["usedByCount"]=view.uses.contains(asset)?view.uses.at(asset):0;
        data["headRevision"]=std::to_string(view.revision);
        const auto item_bytes=data.dump().size()+1;
        if(!items.empty() && encoded_bytes+item_bytes>2621440){more=true;break;}
        encoded_bytes+=item_bytes;
        items.push_back(std::move(data));
    }
    return {{"readSnapshotId",id},{"headRevision",std::to_string(view.revision)},{"items",items},
        {"nextAfterId",more?items.back().at("assetId"):Json(nullptr)}};
}
}
