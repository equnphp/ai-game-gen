// 摘要始终验证保存的原字节；索引投影比较与内容摘要校验是两道独立约束。
#include "core/storage/sqlite/repository.hpp"
#include <algorithm>
namespace gg {
Document read_document_version(Store& store,const std::string& id,const std::string& version) {
    const auto rows=store.query("SELECT kind,schema_version,body_json,content_hash FROM document_versions WHERE document_id=? AND version_id=?",{id,version});
    require(rows.size()==1,"DATABASE_CORRUPT");const auto& row=rows.front();const auto body=text(row[2]);
    require(hash(body)==text(row[3]),"DATABASE_CORRUPT");
    return {id,version,text(row[0]),text(row[3]),row[1].get<int>(),parse(body,1048576)};
}
AssetVersion read_asset_version(Store& store,const std::string& id,const std::string& version) {
    const auto rows=store.query("SELECT a.content_hash,a.media_type,a.metadata_json,a.source_json,a.license_json,b.expected_size "
        "FROM asset_versions a JOIN blob_objects b ON b.content_hash=a.content_hash AND b.state='READY' WHERE a.asset_id=? AND a.asset_version_id=?",{id,version});
    require(rows.size()==1,"NOT_FOUND");const auto& row=rows.front();
    return {version,text(row[0]),text(row[1]),parse(text(row[2]),262144),parse(text(row[3])),parse(text(row[4])),row[5].get<std::uint64_t>(),hash(text(row[2]))};
}
State read_repository_state(Store& store,int format,const std::string& project,const std::string& branch,const std::optional<std::string>& snap) {
    State state;state.format=format;std::vector<Row> docs;
    if(snap) {
        require(!store.query("SELECT snapshot_id FROM snapshots WHERE snapshot_id=?",{*snap}).empty(),"NOT_FOUND");
        docs=store.query("SELECT document_id,version_id FROM snapshot_documents WHERE snapshot_id=? ORDER BY document_id",{*snap});
        for(const auto& row:store.query("SELECT asset_id FROM snapshot_assets WHERE snapshot_id=? ORDER BY asset_id",{*snap}))state.assets.insert(text(row[0]));
    } else {
        docs=store.query("SELECT document_id,version_id FROM document_heads ORDER BY document_id");
        for(const auto& row:store.query("SELECT asset_id FROM asset_heads ORDER BY asset_id"))state.assets.insert(text(row[0]));
    }
    if(format==2) {
        const auto rows=snap?store.query("SELECT asset_id,asset_version_id FROM snapshot_assets WHERE snapshot_id=? ORDER BY asset_id",{*snap}):
            store.query("SELECT asset_id,asset_version_id FROM asset_heads ORDER BY asset_id");
        for(const auto& row:rows) {
            const auto id=text(row[0]);auto asset=read_asset_version(store,id,text(row[1]));
            state.asset_types[id]=text(asset.metadata.at("assetType"));state.asset_versions.emplace(id,std::move(asset));
        }
        if(snap)state.format=store.scalar("SELECT manifest_format FROM snapshots WHERE snapshot_id=?",{*snap}).get<int>();
    }
    require(docs.size()<=500,"LIMIT_EXCEEDED");
    for(const auto& row:docs){auto doc=read_document_version(store,text(row[0]),text(row[1]));state.documents.emplace(doc.id,std::move(doc));}
    if(snap) {
        const auto revision=store.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?",{*snap}).get<std::int64_t>();
        auto expected=manifest(state,project,branch,revision);
        if(state.format==1) {
            for(const auto& id:state.assets) {
                const auto asset_hash=format==2?state.asset_versions.at(id).content_hash:
                    text(store.scalar("SELECT a.content_hash FROM assets a JOIN blob_objects b ON b.content_hash=a.content_hash AND b.state='READY' WHERE a.asset_id=?",{id}));
                expected["assets"].push_back({{"id",id},{"hash",asset_hash}});
            }
            require(hash(expected.dump())==text(store.scalar("SELECT manifest_hash FROM snapshots WHERE snapshot_id=?",{*snap})),"DATABASE_CORRUPT");
        } else {
            const auto receipt=store.query("SELECT manifest_hash,schema_catalog_hash,manifest_json FROM snapshots WHERE snapshot_id=?",{*snap});
            require(receipt.size()==1 && receipt[0][1].is_string() && receipt[0][2].is_string(),"SNAPSHOT_CORRUPT");
            const auto original=text(receipt[0][2]);require(hash(original)==text(receipt[0][0]),"SNAPSHOT_CORRUPT");
            expected["schemaCatalogHash"]=receipt[0][1];require(parse(original,8388608)==expected,"SNAPSHOT_CORRUPT");
        }
    }
    return state;
}
SnapshotReadPort::SnapshotReadPort(Store& store,const Json& reference,const std::string& consumer,std::function<void()> checkpoint)
    :store_(store),reference_(reference),checkpoint_(std::move(checkpoint)) {
    checkpoint_();require(uuid(consumer),"SNAPSHOT_CONSUMER_INVALID");
    const auto project=store_.query("SELECT project_id,branch_id,format_version,initialized FROM project WHERE singleton=1");
    require(project.size()==1 && project[0][3]==1,"SNAPSHOT_CORRUPT");require(project[0][2]==2,"SNAPSHOT_FORMAT_UNSUPPORTED");
    require(project[0][0]==reference.at("projectId") && project[0][1]==reference.at("branchId"),"SNAPSHOT_IDENTITY_MISMATCH");
    const auto id=text(reference.at("snapshotId"));
    const auto lease=store_.query("SELECT snapshot_id,purpose FROM snapshot_consumers WHERE consumer_id=?",{consumer});
    require(lease.size()==1 && lease[0][0]==id && (lease[0][1]=="preview" || lease[0][1]=="game_export" || lease[0][1]=="project_writer"),"SNAPSHOT_CONSUMER_INVALID");
    const auto saved=store_.query("SELECT revision,manifest_hash,manifest_format,schema_catalog_hash,manifest_json FROM snapshots WHERE snapshot_id=?",{id});
    require(saved.size()==1,"SNAPSHOT_REFERENCE_MISSING");const auto& row=saved.front();
    require(row[2]==2,"SNAPSHOT_FORMAT_UNSUPPORTED");
    require(decimal(reference.at("headRevision"))==row[0].get<std::uint64_t>() && row[1]==reference.at("manifestHash") && row[3]==reference.at("schemaCatalogHash"),"SNAPSHOT_IDENTITY_MISMATCH");
    original_=text(row[4]);state_=read_repository_state(store_,2,text(project[0][0]),text(project[0][1]),id);
    for(const auto& [asset,version]:state_.asset_versions)allowed_blobs_.insert(version.content_hash);
    checkpoint_();
}
std::string SnapshotReadPort::document_bytes(const std::string& id) {
    checkpoint_();require(state_.documents.contains(id),"SNAPSHOT_REFERENCE_MISSING");const auto& doc=state_.documents.at(id);
    const auto raw=text(store_.scalar("SELECT body_json FROM document_versions WHERE document_id=? AND version_id=?",{id,doc.version}));
    require(hash(raw)==doc.content_hash,"HASH_MISMATCH");return raw;
}
std::string SnapshotReadPort::asset_metadata_bytes(const std::string& id) {
    checkpoint_();require(state_.asset_versions.contains(id),"SNAPSHOT_REFERENCE_MISSING");const auto& asset=state_.asset_versions.at(id);
    const auto raw=text(store_.scalar("SELECT metadata_json FROM asset_versions WHERE asset_id=? AND asset_version_id=?",{id,asset.version}));
    require(hash(raw)==asset.metadata_hash,"HASH_MISMATCH");return raw;
}
void SnapshotReadPort::verify_blob(const std::string& key) {
    require(allowed_blobs_.contains(key),"SNAPSHOT_REFERENCE_MISSING");if(verified_blobs_.contains(key))return;
    const auto object=store_.query("SELECT blob_id,expected_size,received_size FROM blob_objects WHERE content_hash=? AND state='READY'",{key});
    require(object.size()==1 && object[0][1]==object[0][2],"SNAPSHOT_CORRUPT");
    const auto size=object[0][1].get<std::uint64_t>();require(size<=2147483648ULL,"LIMIT_EXCEEDED");
    std::uint64_t offset=0;Hasher digest;
    while(offset<size) {
        checkpoint_();const auto rows=store_.query("SELECT data,chunk_hash FROM blob_chunks WHERE blob_id=? AND byte_offset=?",{object[0][0],offset});
        require(rows.size()==1,"SNAPSHOT_CORRUPT");const auto data=text(rows[0][0]);
        require(!data.empty() && data.size()<=1048576 && data.size()<=size-offset && hash(data)==text(rows[0][1]),"HASH_MISMATCH");
        digest.update(data);offset+=data.size();
    }
    require(digest.finish()==key,"HASH_MISMATCH");verified_blobs_.insert(key);
}
std::string SnapshotReadPort::read_blob(const std::string& key,std::uint64_t offset,std::uint32_t maximum) {
    checkpoint_();require(maximum>0 && maximum<=1048576,"LIMIT_EXCEEDED");verify_blob(key);
    const auto object=store_.query("SELECT blob_id,expected_size FROM blob_objects WHERE content_hash=? AND state='READY'",{key});
    require(object.size()==1,"SNAPSHOT_CORRUPT");const auto size=object[0][1].get<std::uint64_t>();require(offset<=size,"OFFSET_MISMATCH");
    const auto end=offset+std::min<std::uint64_t>(maximum,size-offset);std::string result;result.reserve(end-offset);
    const auto rows=store_.query("SELECT byte_offset,data FROM blob_chunks WHERE blob_id=? AND byte_offset<? AND byte_offset+length(data)>? ORDER BY byte_offset",{object[0][0],end,offset});
    for(const auto& row:rows) {
        checkpoint_();const auto begin=row[0].get<std::uint64_t>();const auto data=text(row[1]);const auto first=std::max(begin,offset),last=std::min<std::uint64_t>(begin+data.size(),end);
        require(first==offset+result.size() && last>=first,"SNAPSHOT_CORRUPT");result.append(data,first-begin,last-first);
    }
    require(result.size()==end-offset,"SNAPSHOT_CORRUPT");return result;
}
}
