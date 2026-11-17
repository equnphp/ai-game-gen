// SQLite摘要列显式读取为文本，保持严格类型边界，避免依赖JSON隐式比较。
// 暂存块、READY内容与资产身份分开；只有attach生成可引用的领域成员。
#include "core/application/session.hpp"
#include "core/storage/sqlite/repository.hpp"
#include <algorithm>
#include <filesystem>
namespace gg {
namespace {
void metadata_string(const Json& value, std::size_t maximum) {
    const auto s=text(value); require(!s.empty() && s.size()<=maximum,"LIMIT_EXCEEDED");
    require(s.find('/')==std::string::npos && s.find('\\')==std::string::npos &&
            s.find(':')==std::string::npos,"INVALID_PATH");
}
}
AssetVersion Session::load_asset_version(const std::string& id, const std::string& version) {
    return load_asset_version(store_,id,version);
}
AssetVersion Session::load_asset_version(Store& reader,const std::string& id,const std::string& version) {
    return read_asset_version(reader,id,version);
}
Json Session::asset_metadata(const std::string& id, const std::string& version,Store* reader) {
    auto& source=reader?*reader:store_;
    if (format_ == 2) {
        const auto selected = version.empty() ? text(source.scalar("SELECT asset_version_id FROM asset_heads WHERE asset_id=?", {id})) : version;
        const auto asset = load_asset_version(source,id,selected);
        return {{"assetId",id},{"versionId",selected},{"hash",asset.content_hash},{"contentHash",asset.content_hash},
            {"byteLength",std::to_string(asset.bytes)},{"mediaType",asset.media_type},{"metadata",asset.metadata},
            {"source",asset.source},{"license",asset.license},{"localOnly",true},
            {"headRevision",std::to_string(source.scalar("SELECT head_revision FROM project WHERE singleton=1").get<std::int64_t>())},
            {"decodedInfo",{{"kind","binary"},{"mediaType",asset.media_type},{"status","not_decoded"}}}};
    }
    const auto rows=store_.query("SELECT a.content_hash,b.expected_size,a.media_type,a.source_json,a.license_json "
        "FROM assets a JOIN blob_objects b ON b.content_hash=a.content_hash AND b.state='READY' WHERE a.asset_id=?", {id});
    require(rows.size()==1,"NOT_FOUND"); const auto& x=rows[0];
    return {{"assetId",id},{"hash",x[0]},{"byteLength",std::to_string(x[1].get<std::int64_t>())},
            {"mediaType",x[2]},{"source",parse(text(x[3]))},{"license",parse(text(x[4]))},{"localOnly",true}};
}
std::string Session::asset_command(const Json& r, const std::string& digest, const Control& control) {
    const auto op=text(r.at("op")); const auto& p=r.at("params");
    if (op=="asset.upload_begin") {
        writable(); const auto size=decimal(p.at("byteLength")); require(size<=67108864,"LIMIT_EXCEEDED");
        require(store_.scalar("SELECT COALESCE(SUM(expected_size),0) FROM blob_objects").get<std::uint64_t>()+size<=1073741824,
                "LIMIT_EXCEEDED");
        require(store_.query("SELECT stable_id FROM identities WHERE stable_id=?", {p.at("assetId")}).empty(),"INVALID_REFERENCE");
        require(store_.query("SELECT asset_id FROM uploads WHERE asset_id=? AND state!='CANCELLED'", {p.at("assetId")}).empty(),
                "INVALID_REFERENCE");
        metadata_string(p.at("source").at("kind"),80); metadata_string(p.at("source").at("displayName"),255);
        metadata_string(p.at("license").at("identifier"),128); metadata_string(p.at("license").at("status"),80);
        require(text(p.at("mediaType")).size()<=128,"LIMIT_EXCEEDED");
        const auto upload=random_uuid(),blob=random_uuid();
        auto result=envelope(r,{{"uploadId",upload},{"chunkBytes",1048576},{"nextOffset","0"}});
        control.checkpoint();control.commit_gate();Transaction tx(store_);
        store_.run("INSERT INTO blob_objects VALUES(?,NULL,?,0,'STAGING',?)", {blob,size,now_ms()});
        store_.run("INSERT INTO uploads(upload_id,blob_id,asset_id,media_type,source_json,license_json,expected_hash,state,created_at_ms) VALUES(?,?,?,?,?,?,?,'UPLOADING',?)",
                   {upload,blob,p.at("assetId"),p.at("mediaType"),p.at("source").dump(),p.at("license").dump(),
                    p.value("expectedHash",Json(nullptr)),now_ms()});
        save_request(r,digest,result);tx.commit();return result;
    }
    const auto upload=text(p.at("uploadId"));
    const auto rows=store_.query("SELECT u.blob_id,u.asset_id,u.state,u.expected_hash,b.expected_size,b.received_size,b.content_hash "
                               "FROM uploads u JOIN blob_objects b USING(blob_id) WHERE u.upload_id=?", {upload});
    require(rows.size()==1,"NOT_FOUND"); const auto x=rows[0]; const auto state=text(x[2]);
    if (op=="asset.upload_status") {
        Json data={{"state",state},{"receivedBytes",std::to_string(x[5].get<std::int64_t>())},
                   {"byteLength",std::to_string(x[4].get<std::int64_t>())}};
        if (!x[6].is_null()) data["contentHash"]=x[6];
        return envelope(r,data);
    }
    writable();require(state!="CANCELLED","CANCELLED");
    if (op=="asset.attach") {
        expected(r); require(state=="READY","UPLOAD_INCOMPLETE");
        if (format_==2) {
            const auto metadata=store_.query("SELECT source_json,license_json FROM uploads WHERE upload_id=?",{upload});
            const auto source=parse(text(metadata[0][0])),license=parse(text(metadata[0][1]));
            auto display=text(source.at("displayName"));
            std::size_t count=0,position=0;
            for (;position<display.size();++position) if ((static_cast<unsigned char>(display[position])&0xc0)!=0x80 && ++count>80) break;
            display.resize(position);if(display.empty())display="Imported";
            // 未完成受管解码前仅保留原始二进制，不根据扩展名宣告图片/音频可运行。
            Json info={{"name",display},{"logicalPath","/Imported/"+text(x[1])},{"tags",Json::array()},
                {"favorite",false},{"assetType","binary"},{"importSettings",{{"settingsKind","binary.default"},{"settingsVersion",1},{"values",Json::object()}}},
                {"provenance",{{"sourceKind","local_file"},{"sourceName",source.at("displayName")},{"sourceHash",x[6]},
                    {"licenseId",license.at("identifier")},{"attribution",""},{"commercialUse","unknown"},{"localOnly",true}}}};
            const Json operations=Json::array({{{"kind","attach_asset"},{"uploadId",upload},{"metadata",info}}});
            auto next=load_state();apply_proposal(next,operations,{random_uuid()});
            return commit(r,digest,std::move(next),"attach",control,"",[&](std::int64_t){adopt_uploads(operations);});
        }
        auto next=load_state();require(!next.assets.contains(text(x[1])),"INVALID_REFERENCE");next.assets.insert(text(x[1]));
        return commit(r,digest,std::move(next),"attach",control,"",[&](std::int64_t revision){
            store_.run("INSERT INTO assets SELECT asset_id,b.content_hash,media_type,source_json,license_json,1,? "
                       "FROM uploads u JOIN blob_objects b USING(blob_id) WHERE u.upload_id=?", {revision,upload});
            store_.run("UPDATE uploads SET state='ATTACHED' WHERE upload_id=?", {upload});
        });
    }
    if (op=="asset.upload_cancel") {
        require(state!="ATTACHED","ALREADY_COMMITTED");auto result=envelope(r,{{"cancelled",true}});
        control.checkpoint();control.commit_gate();Transaction tx(store_);
        store_.run("UPDATE uploads SET state='CANCELLED' WHERE upload_id=?", {upload});save_request(r,digest,result);
        tx.commit();return result;
    }
    require(op=="asset.upload_finish","INVALID_MESSAGE");
    if (state=="ATTACHED") throw Error("ALREADY_COMMITTED");
    std::string content;
    if (state=="READY") content=text(x[6]);
    else {
        require(x[4]==x[5],"UPLOAD_INCOMPLETE");Hasher h;std::uint64_t offset=0;
        // 每次只取一个块，finish不会把整个资源复制到内存。
        while (offset<x[4].get<std::uint64_t>()) {
            control.checkpoint();const auto block=store_.query("SELECT data,chunk_hash FROM blob_chunks WHERE blob_id=? AND byte_offset=?",
                                                             {x[0],offset});
            require(block.size()==1,"UPLOAD_INCOMPLETE");const auto bytes=text(block[0][0]);
            require(hash(bytes)==text(block[0][1]),"HASH_MISMATCH");h.update(bytes);offset+=bytes.size();
        }
        require(offset==x[4].get<std::uint64_t>(),"UPLOAD_INCOMPLETE");content=h.finish();
        if(!x[3].is_null())require(content==text(x[3]),"HASH_MISMATCH");
    }
    auto result=envelope(r,{{"contentHash",content},{"byteLength",std::to_string(x[4].get<std::int64_t>())},{"state","READY"}});
    control.checkpoint();control.commit_gate();Transaction tx(store_);
    const auto existing=store_.query("SELECT blob_id FROM blob_objects WHERE content_hash=? AND state='READY'", {content});
    if (!existing.empty()) store_.run("UPDATE uploads SET blob_id=?,state='READY' WHERE upload_id=?", {existing[0][0],upload});
    else {
        store_.run("UPDATE blob_objects SET content_hash=?,state='READY' WHERE blob_id=?", {content,x[0]});
        store_.run("UPDATE uploads SET state='READY' WHERE upload_id=?", {upload});
    }
    save_request(r,digest,result);tx.commit();return result;
}
std::string Session::upload_write(const std::string& upload, std::uint64_t offset, std::string_view bytes,
                                 const Control& control) {
    require(is_open(),"NOT_FOUND");writable();require(uuid(upload),"INVALID_MESSAGE");
    const auto rows=store_.query("SELECT u.blob_id,u.state,b.received_size,b.expected_size FROM uploads u "
                                "JOIN blob_objects b USING(blob_id) WHERE u.upload_id=?", {upload});
    require(rows.size()==1,"NOT_FOUND");const auto& x=rows[0];
    require(x[1]=="UPLOADING" || x[1]=="READY","CANCELLED");
    const auto received=x[2].get<std::uint64_t>(),size=x[3].get<std::uint64_t>();
    const auto old=store_.query("SELECT data FROM blob_chunks WHERE blob_id=? AND byte_offset=?", {x[0],offset});
    Json r={{"op","asset.upload_write"},{"requestId",""}};
    if(!old.empty()) {
        require(text(old[0][0])==bytes,"CHUNK_CONFLICT");
        return envelope(r,{{"nextOffset",std::to_string(offset+bytes.size())}});
    }
    require(x[1]=="UPLOADING" && offset==received && bytes.size()<=size-offset,"RANGE_ERROR");
    require(!bytes.empty() && bytes.size()<=1048576 && (bytes.size()==1048576 || offset+bytes.size()==size),"RANGE_ERROR");
    auto result=envelope(r,{{"nextOffset",std::to_string(offset+bytes.size())}});
    control.checkpoint();control.commit_gate();Transaction tx(store_);
    Statement insert(store_.handle(),"INSERT INTO blob_chunks VALUES(?,?,?,?)", {x[0],offset,nullptr,hash(bytes)});
    insert.blob(3,bytes);insert.next();
    store_.run("UPDATE blob_objects SET received_size=? WHERE blob_id=?", {offset+bytes.size(),x[0]});
    tx.commit();return result;
}
std::pair<std::string,std::string> Session::blob_read(const std::string& content, std::uint64_t offset,
                                                    std::uint32_t maximum,const Control& control) {
    require(is_open(),"NOT_FOUND");require(content_hash(content),"INVALID_MESSAGE");
    require(maximum>=1 && maximum<=1048576,"RANGE_ERROR");
    const char* legacy_query="SELECT blob_id,expected_size FROM blob_objects b WHERE content_hash=? AND state='READY' AND EXISTS "
        "(SELECT 1 FROM assets a WHERE a.content_hash=b.content_hash AND (EXISTS(SELECT 1 FROM asset_heads h WHERE h.asset_id=a.asset_id) "
        "OR EXISTS(SELECT 1 FROM snapshot_assets s WHERE s.asset_id=a.asset_id) OR EXISTS "
        "(SELECT 1 FROM history_entries he JOIN transactions t USING(transaction_id),json_each(json_extract(t.forward_json,'$.assetHeads')) j "
        "WHERE j.key=a.asset_id) OR EXISTS(SELECT 1 FROM history_entries he JOIN transactions t USING(transaction_id),"
        "json_each(json_extract(t.inverse_json,'$.assetHeads')) j WHERE j.key=a.asset_id)))";
    const char* version_query="SELECT blob_id,expected_size FROM blob_objects b WHERE content_hash=? AND state='READY' AND EXISTS "
        "(SELECT 1 FROM asset_versions a WHERE a.content_hash=b.content_hash)";
    auto* source=&store_;auto rows=source->query(format_==1?legacy_query:version_query,{content});
    if(rows.empty() && format_==2) {
        idle();
        for(auto& [id,view]:asset_reads_) {
            auto retained=view.reader->query(version_query,{content});
            if(!retained.empty()){source=view.reader.get();rows=std::move(retained);break;}
        }
    }
    require(rows.size()==1,"NOT_FOUND");const auto size=rows[0][1].get<std::uint64_t>();
    require(offset<=size,"RANGE_ERROR");std::string bytes; const auto end=std::min(size,offset+maximum);
    while (offset+bytes.size()<end) {
        control.checkpoint();const auto position=offset+bytes.size();const auto chunk_offset=(position/1048576)*1048576;
        const auto rows2=source->query("SELECT data,chunk_hash FROM blob_chunks WHERE blob_id=? AND byte_offset=?", {rows[0][0],chunk_offset});
        require(rows2.size()==1,"DATABASE_CORRUPT");const auto block=text(rows2[0][0]);
        require(hash(block)==text(rows2[0][1]),"DATABASE_CORRUPT");const auto start=position-chunk_offset;
        require(start<block.size(),"DATABASE_CORRUPT");bytes.append(block,start,std::min<std::uint64_t>(block.size()-start,end-position));
    }
    Json r={{"op","asset.blob_read"},{"requestId",""}};
    return {envelope(r,{{"offset",std::to_string(offset)},{"byteLength",std::to_string(bytes.size())},
                       {"contentHash",content},{"eof",end==size}}),std::move(bytes)};
}
std::string Session::maintenance(const Json& r, const std::string& digest, const Control& control) {
    const auto op=text(r.at("op"));const auto& p=r.at("params");
    if(op=="project.flush") {
        if(read_only_.empty() && !recovery_required_)store_.exec("PRAGMA wal_checkpoint(PASSIVE)");
        return envelope(r,{{"durableRevision",std::to_string(head())}});
    }
    writable();
    if(op=="snapshot.pin") {
        const auto prior=store_.query("SELECT locked FROM snapshots WHERE snapshot_id=?", {p.at("snapshotId")});
        require(prior.size()==1,"NOT_FOUND");
        require(!p.at("locked").get<bool>() || prior[0][0]==1 ||
                store_.scalar("SELECT COUNT(*) FROM snapshots WHERE locked=1").get<int>()<128,"SNAPSHOT_LIMIT");
        auto result=envelope(r,{{"snapshotId",p.at("snapshotId")},{"locked",p.at("locked")}});
        control.checkpoint();control.commit_gate();Transaction tx(store_);
        store_.run("UPDATE snapshots SET locked=? WHERE snapshot_id=?", {p.at("locked"),p.at("snapshotId")});
        store_.run(format_ == 1 ? "DELETE FROM snapshots WHERE locked=0 AND snapshot_id NOT IN "
            "(SELECT snapshot_id FROM snapshots WHERE locked=0 ORDER BY revision DESC LIMIT 20)" :
            "DELETE FROM snapshots WHERE locked=0 AND snapshot_id NOT IN (SELECT snapshot_id FROM snapshot_consumers) AND snapshot_id NOT IN "
            "(SELECT snapshot_id FROM snapshots WHERE locked=0 ORDER BY revision DESC LIMIT 20)");
        save_request(r,digest,result);tx.commit();return result;
    }
    if(op=="maintenance.backup") {
        control.checkpoint();const auto file=root_.new_backup(text(p.at("backupName")));
        // 失败留下的新文件不作为已验证备份返回，也不覆盖任何已有备份。
        store_.backup(file.path,control.checkpoint);
        const auto checksum=file_hash(file.path,control.checkpoint);
        auto result=envelope(r,{{"backupId",random_uuid()},{"revision",std::to_string(head())},
                                      {"checksum",checksum},{"relativePath",file.relative}});
        control.checkpoint();control.commit_gate();Transaction tx(store_);save_request(r,digest,result);tx.commit();return result;
    }
    require(op=="maintenance.gc","INVALID_MESSAGE");expire_proposals();idle();
    // 即使通过裸Core SDK调用，也不能越过另一个进程的快照读取。
    const auto maintenance=location_->maintenance_fence(true);
    if(format_==2) {
        // 每个保留快照都按仓储同源规则核对原manifest与索引，不能只相信FK存在。
        const auto snapshots=store_.query("SELECT snapshot_id FROM snapshots ORDER BY snapshot_id");
        require(snapshots.size()<=10000,"GC_RETENTION_UNRESOLVED");
        for(const auto& row:snapshots){
            control.checkpoint();
            try{(void)read_repository_state(store_,format_,project_,branch_,text(row[0]));}
            catch(...){throw Error("GC_RETENTION_UNRESOLVED");}
        }
    }
    const auto active=store_.scalar("SELECT COUNT(*) FROM uploads WHERE state IN('UPLOADING','READY')").get<int>();
    if(!p.at("dryRun").get<bool>())require(proposals_.empty() && active==0 && control.sole_task(),"PROJECT_BUSY");
    if(!asset_reads_.empty()) {
        // 目录租约仍可请求旧版本的blob；暂不能完整覆盖其后续读集时保守延迟回收。
        require(p.at("dryRun").get<bool>(),"BUSY");
        Json reasons={"ACTIVE_READ_LEASES"};if(active)reasons.push_back("ACTIVE_UPLOADS");if(!proposals_.empty())reasons.push_back("ACTIVE_PROPOSALS");
        return envelope(r,{{"dryRun",true},{"documentVersions",0},{"assets",0},{"documentBytes","0"},{"blobObjects",0},{"blobBytes","0"},{"reclaimableBytes","0"},{"retainedReasons",reasons}});
    }
    if(format_==2)for(const auto& row:store_.query("SELECT t.forward_json,t.inverse_json FROM history_entries h JOIN transactions t USING(transaction_id)")) {
        control.checkpoint();
        for(const auto& raw:row) {
            Json projection;
            try{projection=parse(text(raw));}catch(...){throw Error("GC_RETENTION_UNRESOLVED");}
            require(projection.is_object() && projection.contains("documentHeads") && projection.at("documentHeads").is_object() &&
                projection.contains("assetHeads") && projection.at("assetHeads").is_object(),"GC_RETENTION_UNRESOLVED");
            const auto version=projection.value("dataVersion",Json(1));
            require(version.is_number_integer() && (version==1 || version==2),"GC_RETENTION_UNRESOLVED");
            for(auto head=projection.at("documentHeads").begin();head!=projection.at("documentHeads").end();++head) {
                require(uuid(head.key()),"GC_RETENTION_UNRESOLVED");if(head.value().is_null())continue;
                require(head.value().is_string() && uuid(text(head.value())) && store_.query("SELECT version_id FROM document_versions WHERE document_id=? AND version_id=?",{head.key(),head.value()}).size()==1,"GC_RETENTION_UNRESOLVED");
            }
            for(auto head=projection.at("assetHeads").begin();head!=projection.at("assetHeads").end();++head) {
                require(uuid(head.key()),"GC_RETENTION_UNRESOLVED");
                if(version==1) {
                    require(head.value().is_boolean(),"GC_RETENTION_UNRESOLVED");if(head.value()==false)continue;
                    const auto mapping=store_.query("SELECT generated_id FROM format_migration_maps WHERE map_kind='asset_initial_version' AND source_stable_id=?",{head.key()});
                    require(mapping.size()==1 && store_.query("SELECT asset_version_id FROM asset_versions WHERE asset_id=? AND asset_version_id=?",{head.key(),mapping[0][0]}).size()==1,"GC_RETENTION_UNRESOLVED");
                }else if(!head.value().is_null())require(head.value().is_string() && uuid(text(head.value())) &&
                    store_.query("SELECT asset_version_id FROM asset_versions WHERE asset_id=? AND asset_version_id=?",{head.key(),head.value()}).size()==1,"GC_RETENTION_UNRESOLVED");
            }
        }
    }
    const char* unreachable_docs =
        "SELECT version_id,length(CAST(body_json AS BLOB)) FROM document_versions WHERE version_id NOT IN "
        "(SELECT version_id FROM document_heads UNION SELECT version_id FROM snapshot_documents UNION "
        "SELECT j.value FROM history_entries h JOIN transactions t USING(transaction_id),"
        "json_each(json_extract(t.forward_json,'$.documentHeads')) j WHERE j.value IS NOT NULL UNION "
        "SELECT j.value FROM history_entries h JOIN transactions t USING(transaction_id),"
        "json_each(json_extract(t.inverse_json,'$.documentHeads')) j WHERE j.value IS NOT NULL)";
    const char* unreachable_assets =
        "SELECT asset_id FROM assets WHERE asset_id NOT IN (SELECT asset_id FROM asset_heads UNION SELECT asset_id FROM snapshot_assets UNION "
        "SELECT j.key FROM history_entries h JOIN transactions t USING(transaction_id),json_each(json_extract(t.forward_json,'$.assetHeads')) j UNION "
        "SELECT j.key FROM history_entries h JOIN transactions t USING(transaction_id),json_each(json_extract(t.inverse_json,'$.assetHeads')) j)";
    const auto docs=store_.query(unreachable_docs);auto assets=store_.query(unreachable_assets);
    std::vector<Row> asset_versions;
    if(format_==2) {
        // 版本才是format2的内容权威；当前头、固定快照和Undo/Redo分别持有精确版本。
        // 升级前历史仍可能使用bool，必须通过持久迁移映射保留其初始版本。
        asset_versions=store_.query(
            "SELECT asset_version_id,asset_id FROM asset_versions WHERE asset_version_id NOT IN ("
            "SELECT asset_version_id FROM asset_heads UNION SELECT asset_version_id FROM snapshot_assets UNION "
            "SELECT j.value FROM history_entries h JOIN transactions t USING(transaction_id),"
            "json_each(json_extract(t.forward_json,'$.assetHeads')) j WHERE j.type='text' UNION "
            "SELECT j.value FROM history_entries h JOIN transactions t USING(transaction_id),"
            "json_each(json_extract(t.inverse_json,'$.assetHeads')) j WHERE j.type='text' UNION "
            "SELECT m.generated_id FROM format_migration_maps m WHERE m.map_kind='asset_initial_version' AND m.source_stable_id IN ("
            "SELECT j.key FROM history_entries h JOIN transactions t USING(transaction_id),"
            "json_each(json_extract(t.forward_json,'$.assetHeads')) j WHERE j.type='true' UNION "
            "SELECT j.key FROM history_entries h JOIN transactions t USING(transaction_id),"
            "json_each(json_extract(t.inverse_json,'$.assetHeads')) j WHERE j.type='true'))" );
    }
    std::uint64_t bytes=0;for(const auto& row:docs)bytes+=row[1].get<std::uint64_t>();
    std::set<std::string> deleting_assets;for(const auto& row:assets)deleting_assets.insert(text(row[0]));
    std::set<std::string> deleting_versions;for(const auto& row:asset_versions)deleting_versions.insert(text(row[0]));
    if(format_==2) {
        std::set<std::string> deleting_documents;for(const auto& row:docs)deleting_documents.insert(text(row[0]));
        // 删除前重算所有保留版本的引用；未知Extractor或旧索引不完整时不猜测读集。
        std::size_t checked=0;
        for(const auto& row:store_.query("SELECT document_id,version_id FROM document_versions ORDER BY version_id"))if(!deleting_documents.contains(text(row[1]))) {
            control.checkpoint();require(++checked<=10000,"GC_RETENTION_UNRESOLVED");
            try {
                const auto document=read_document_version(store_,text(row[0]),text(row[1]));
                require(known_document(document),"GC_RETENTION_UNRESOLVED");validate_document(document);
                std::vector<Row> expected;
                for(const auto& ref:references(document)) {
                    const auto type=ref.expected_type.empty()?(ref.kind=="document"?"scene":ref.kind=="asset"?"image":"entity"):ref.expected_type;
                    const Json scope=ref.kind=="entity"||ref.kind=="subobject"?Json(ref.scope_document.empty()?document.id:ref.scope_document):Json(nullptr);
                    expected.push_back({ref.path,ref.kind,ref.target,type,scope,ref.required?1:0});
                }
                std::sort(expected.begin(),expected.end(),[](const auto& a,const auto& b){return text(a[0])<text(b[0]);});
                require(expected==store_.query("SELECT field_path,target_kind,target_id,expected_type,scope_document_id,required FROM document_refs WHERE version_id=? ORDER BY field_path",{document.version}),"GC_RETENTION_UNRESOLVED");
            }catch(...){throw Error("GC_RETENTION_UNRESOLVED");}
        }
        for(const auto& row:store_.query("SELECT asset_id,asset_version_id FROM asset_versions"))if(!deleting_versions.contains(text(row[1]))) {
            control.checkpoint();
            try {
                const auto version=read_asset_version(store_,text(row[0]),text(row[1]));
                require(store_.scalar("SELECT COALESCE(SUM(length(c.data)),0) FROM blob_chunks c JOIN blob_objects b USING(blob_id) WHERE b.content_hash=?",{version.content_hash})==version.bytes,"GC_RETENTION_UNRESOLVED");
            }catch(...){throw Error("GC_RETENTION_UNRESOLVED");}
        }
        for(const auto& ref:store_.query("SELECT version_id,target_id FROM document_refs WHERE target_kind='asset'"))if(!deleting_documents.contains(text(ref[0]))) {
            control.checkpoint();const auto versions=store_.query("SELECT asset_version_id FROM asset_versions WHERE asset_id=?",{ref[1]});
            // 无法从当前/快照/历史确定仍活跃版本时拒绝整个GC，不凭逻辑ID猜默认内容。
            require(!versions.empty() && std::any_of(versions.begin(),versions.end(),[&](const auto& version){return !deleting_versions.contains(text(version[0]));}),"GC_RETENTION_UNRESOLVED");
            deleting_assets.erase(text(ref[1]));
        }
        // 即使索引出现未来兼容保留来源，也不在父记录仍被版本FK引用时删逻辑资产。
        for(const auto& row:store_.query("SELECT asset_id,asset_version_id FROM asset_versions"))
            if(!deleting_versions.contains(text(row[1])))deleting_assets.erase(text(row[0]));
        std::erase_if(assets,[&](const auto& row){return !deleting_assets.contains(text(row[0]));});
    }
    std::vector<Row> blobs;std::uint64_t blob_bytes=0;
    for(const auto& row:store_.query("SELECT blob_id,content_hash,expected_size FROM blob_objects")) {
        control.checkpoint();
        if(!store_.query("SELECT upload_id FROM uploads WHERE blob_id=? AND state IN('UPLOADING','READY')", {row[0]}).empty())continue;
        bool kept=false;
        if(!row[1].is_null())for(const auto& asset:store_.query("SELECT asset_id FROM assets WHERE content_hash=?", {row[1]}))
            if(!deleting_assets.contains(text(asset[0])))kept=true;
        if(format_==2 && !row[1].is_null())for(const auto& version:store_.query("SELECT asset_version_id FROM asset_versions WHERE content_hash=?", {row[1]}))
            if(!deleting_versions.contains(text(version[0])))kept=true;
        if(!kept){blobs.push_back(row);blob_bytes+=row[2].get<std::uint64_t>();}
    }
    Json reasons=Json::array();if(active)reasons.push_back("ACTIVE_UPLOADS");if(!proposals_.empty())reasons.push_back("ACTIVE_PROPOSALS");
    // dryRun使用同一回收候选规则；不删除审计摘要或身份墓碑。
    Json data={{"dryRun",p.at("dryRun")},{"documentVersions",docs.size()},{"assets",assets.size()},
               {"documentBytes",std::to_string(bytes)},{"blobObjects",blobs.size()},{"blobBytes",std::to_string(blob_bytes)},
               {"reclaimableBytes",std::to_string(bytes+blob_bytes)},{"retainedReasons",reasons}};
    if(p.at("dryRun").get<bool>())return envelope(r,data);
    control.checkpoint();control.commit_gate();Transaction tx(store_);
    store_.run("DELETE FROM uploads WHERE state IN('CANCELLED','ATTACHED')");
    for(const auto& row:docs)store_.run("DELETE FROM document_versions WHERE version_id=?", {row[0]});
    // 子版本先于assets/blob删除；assets初始内容的FK仍独立参与上面的blob保留判断。
    for(const auto& row:asset_versions)store_.run("DELETE FROM asset_versions WHERE asset_version_id=?", {row[0]});
    for(const auto& row:assets)store_.run("DELETE FROM assets WHERE asset_id=?", {row[0]});
    for(const auto& row:blobs)store_.run("DELETE FROM blob_objects WHERE blob_id=?", {row[0]});
    auto result=envelope(r,data);save_request(r,digest,result);tx.commit();return result;
}
}
