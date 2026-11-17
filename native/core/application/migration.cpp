// 格式升级复用普通作者事务；只执行编译进Core的DDL，失败保留旧库与独立备份。
#include "core/application/session.hpp"
#include "core/document/model_v2.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <array>
#include <set>
#include <tuple>

namespace gg {
namespace {
constexpr const char* migration_algorithm="format1-to-2.1-degree-preserving-final2";
std::string fingerprint(Store& store) {
    Hasher digest;
    // 排除查询回执和暂存上传；它们不改变作者基线，但保留历史/引用变化会使计划失效。
    for (const auto* sql : {
        "SELECT * FROM project ORDER BY singleton",
        "SELECT document_id,version_id,kind,schema_version,content_hash FROM document_versions ORDER BY document_id,version_id",
        "SELECT * FROM document_heads ORDER BY document_id",
        "SELECT * FROM document_refs ORDER BY version_id,field_path",
        "SELECT * FROM assets ORDER BY asset_id",
        "SELECT * FROM asset_heads ORDER BY asset_id",
        "SELECT * FROM snapshots ORDER BY snapshot_id",
        "SELECT * FROM snapshot_documents ORDER BY snapshot_id,document_id",
        "SELECT * FROM snapshot_assets ORDER BY snapshot_id,asset_id",
        "SELECT * FROM history_entries ORDER BY slot"}) {
        digest.update(sql);
        for (const auto& row : store.query(sql)) {const auto data=Json(row).dump();digest.update(std::to_string(data.size()));digest.update(data);}
    }
    return digest.finish();
}
std::string map_id(const Json& maps,const std::string& kind,const std::string& document,const std::string& stable) {
    for (const auto& entry : maps) if (entry.at("mapKind")==kind && entry.at("sourceDocumentId")==document && entry.at("sourceStableId")==stable)
        return text(entry.at("generatedId"));
    throw Error("MIGRATION_MAP_MISSING");
}
std::string short_name(const Json& source) {
    auto value=text(source.at("displayName"));std::size_t characters=0,index=0;
    for (;index<value.size();++index) if ((static_cast<unsigned char>(value[index])&0xc0)!=0x80 && ++characters>80) break;
    value.resize(index);return value.empty()?"Imported":value;
}
std::string classify_asset(const std::string& media,const std::string& bytes) {
    auto begins=[&](std::string_view prefix){return bytes.size()>=prefix.size() && std::string_view(bytes).starts_with(prefix);};
    if ((media=="image/png" && begins(std::string_view("\x89PNG\r\n\x1a\n",8))) ||
        (media=="image/jpeg" && begins(std::string_view("\xff\xd8\xff",3))) ||
        (media=="image/gif" && (begins("GIF87a") || begins("GIF89a"))) ||
        (media=="image/webp" && begins("RIFF") && bytes.size()>=12 && bytes.substr(8,4)=="WEBP")) return "image";
    if ((media=="font/ttf" && begins(std::string_view("\0\1\0\0",4))) || (media=="font/otf" && begins("OTTO"))) return "font";
    if (media.starts_with("audio/") && (begins("OggS") || begins("ID3") || begins("RIFF"))) return "audio";
    return "binary";
}
void rebuild_tables(Store& store) {
    Store target;target.open(":memory:",true,false);target.exec(ddl_v2);
    const std::array<const char*,7> changed{"project","identities","document_refs","uploads","asset_heads","snapshots","snapshot_assets"};
    for (const auto* name : changed) {
        const auto save="CREATE TEMP TABLE gg_migration_"+std::string(name)+" AS SELECT * FROM main."+name;
        store.exec(save.c_str());
    }
    for (const auto* name : changed) store.exec(("DROP TABLE main."+std::string(name)).c_str());
    // SQL仅来自在内存中展开的受信任DDL；没有读取源项目sqlite_schema.sql作为代码执行。
    for (const auto& row : target.query("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
        if (store.query("SELECT name FROM sqlite_schema WHERE name=?",{row[0]}).empty()) store.exec(text(row[1]).c_str());
    }
    store.exec("INSERT INTO project SELECT singleton,project_id,branch_id,2,name,settings_document_id,default_scene_id,head_revision,hash_version,initialized FROM temp.gg_migration_project");
    store.exec("INSERT INTO identities SELECT * FROM temp.gg_migration_identities");
    store.exec("INSERT INTO uploads SELECT upload_id,blob_id,asset_id,media_type,source_json,license_json,expected_hash,state,CASE WHEN state='ATTACHED' THEN asset_id ELSE NULL END,created_at_ms FROM temp.gg_migration_uploads");
    store.exec("INSERT INTO snapshots SELECT snapshot_id,revision,reason,manifest_hash,1,NULL,NULL,locked,created_at_ms FROM temp.gg_migration_snapshots");
    for (const auto& row : target.query("SELECT name,sql FROM sqlite_schema WHERE type IN('index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name"))
        if (store.query("SELECT name FROM sqlite_schema WHERE name=?",{row[0]}).empty()) store.exec(text(row[1]).c_str());
    store.exec("PRAGMA user_version=2");
}
}
std::string Session::migration_source_hash() {return fingerprint(store_);}
State Session::upgrade_state(State state,const Json& maps) {
    state.format=2;
    for (auto& [id,doc] : state.documents) {
        if (doc.schema!=1 || (doc.kind!="scene" && doc.kind!="project.settings")) continue;
        validate_document(doc);
        if (doc.kind=="project.settings") {
            doc.body.update(Json{{"unitsPerMeter",100},{"fixedStepHz",60},{"enabledModules",{"scene","render","input"}},{"entryGraphs",Json::array()}});
        } else {
            const auto plane=map_id(maps,"scene_plane",id,id);
            doc.body["planes"]={{plane,{{"name","Default"},{"baseHeight",0}}}};
            for (auto entity=doc.body.at("entities").begin();entity!=doc.body.at("entities").end();++entity) {
                auto& value=entity.value();Json components=Json::object();
                if (!value.at("sprite").is_null()) {
                    const auto component=map_id(maps,"scene_sprite_component",id,entity.key());
                    components[component]={{"id",component},{"type","sprite2d"},{"schemaVersion",1},{"enabled",true},
                        {"data",{{"asset",{{"kind","asset"},{"id",value.at("sprite").at("assetId")},{"type","image"},{"scopeDocumentId",nullptr}}},
                            {"tint","#ffffffff"},{"anchor",{{"x",0.5},{"y",0.5}}},{"layer",0},{"order",0},{"flipX",false},{"flipY",false}}}};
                }
                value.erase("sprite");value["components"]=std::move(components);
                value["spatial"]={{"planeId",plane},{"heightOffset",0},{"vertical",{{"min",0},{"max",0}}},{"visualOffset",{{"x",0},{"y",0}}}};
            }
        }
        doc.schema=2;doc.version.clear();doc.content_hash=hash(doc.body.dump());
    }
    return state;
}
State Session::upgrade_legacy_state(State state) {
    if (format_!=2) return state;
    Json maps=Json::array();
    for (const auto& row : store_.query("SELECT map_kind,source_document_id,source_stable_id,generated_id,detail_json FROM format_migration_maps ORDER BY map_kind,source_document_id,source_stable_id"))
        maps.push_back({{"mapKind",row[0]},{"sourceDocumentId",row[1]},{"sourceStableId",row[2]},{"generatedId",row[3]},{"detail",parse(text(row[4]))}});
    return upgrade_state(std::move(state),maps);
}
std::string Session::upgrade(const Json& request,const std::string& digest,const Control& control) {
    require(request.at("protocolVersion")=="1.1" && format_==1,"UNSUPPORTED_FORMAT");writable();
    const auto& params=request.at("params");
    if (request.at("op")=="project.upgrade.plan") {
        require(proposals_.empty(),"PROJECT_BUSY");
        if(upgrade_plan_ && upgrade_plan_->request_id==text(request.at("requestId"))) {
            require(upgrade_plan_->request_hash==digest,"IDEMPOTENCY_CONFLICT");
            require(std::chrono::steady_clock::now()<upgrade_plan_->expires,"MIGRATION_PLAN_EXPIRED");
            return upgrade_plan_->result;
        }
        UpgradePlan plan;plan.id=random_uuid();plan.migration_id=random_uuid();plan.revision=head();plan.maps=Json::array();
        plan.request_id=text(request.at("requestId"));plan.request_hash=digest;
        plan.expires=std::chrono::steady_clock::now()+std::chrono::minutes(10);
        plan.source_hash=migration_source_hash();
        const auto pages=store_.scalar("PRAGMA page_count").get<std::uint64_t>(),size=store_.scalar("PRAGMA page_size").get<std::uint64_t>();
        require(pages<INT64_MAX/size/3,"LIMIT_EXCEEDED");plan.required_bytes=pages*size*3+4194304;
        std::set<std::string> occupied;
        for (const auto* sql : {"SELECT stable_id FROM identities","SELECT version_id FROM document_versions","SELECT snapshot_id FROM snapshots",
            "SELECT asset_id FROM uploads","SELECT upload_id FROM uploads","SELECT blob_id FROM blob_objects","SELECT transaction_id FROM transactions","SELECT request_id FROM requests"})
            for (const auto& row : store_.query(sql)) occupied.insert(text(row[0]));
        occupied.insert(project_);occupied.insert(branch_);occupied.insert(plan.id);occupied.insert(plan.migration_id);
        auto generated=[&] {for(unsigned attempt=0;attempt<16;++attempt){auto id=random_uuid();if(occupied.insert(id).second)return id;}throw Error("RNG_UNAVAILABLE");};
        std::set<std::tuple<std::string,std::string,std::string>> mapped;
        auto mapping=[&](const std::string& kind,const std::string& doc,const std::string& stable) {
            if (mapped.emplace(kind,doc,stable).second) plan.maps.push_back({{"mapKind",kind},{"sourceDocumentId",doc},{"sourceStableId",stable},
                {"generatedId",generated()},{"detail",{{"sourceFormat",1},{"algorithm",migration_algorithm}}}});
        };
        for (const auto& row : store_.query("SELECT document_id,version_id FROM document_versions ORDER BY document_id,version_id")) {
            control.checkpoint();const auto doc=load_version(text(row[0]),text(row[1]));
            require(doc.schema==1 && (doc.kind=="scene" || doc.kind=="project.settings"),"MIGRATION_BLOCKED");validate_document(doc);
            Json stored_refs=Json::array(),derived_refs=Json::array();
            for (const auto& ref : references(doc)) derived_refs.push_back({ref.path,ref.kind,ref.target,1});
            std::sort(derived_refs.begin(),derived_refs.end());
            for (const auto& ref : store_.query("SELECT field_path,target_kind,target_id,required FROM document_refs WHERE version_id=? ORDER BY field_path",{doc.version})) stored_refs.push_back(ref);
            require(derived_refs==stored_refs,"MIGRATION_BLOCKED");
            if (doc.kind=="scene") {
                mapping("scene_plane",doc.id,doc.id);
                for (auto entity=doc.body.at("entities").begin();entity!=doc.body.at("entities").end();++entity)
                    if (!entity.value().at("sprite").is_null()) mapping("scene_sprite_component",doc.id,entity.key());
            }
        }
        for (const auto& row : store_.query("SELECT a.asset_id,a.created_revision,b.blob_id FROM assets a JOIN blob_objects b ON b.content_hash=a.content_hash ORDER BY a.asset_id")) {
            control.checkpoint();const auto id=text(row[0]);mapping("asset_initial_version","",id);
            const auto old=asset_metadata(id);AssetVersion asset;
            asset.version=map_id(plan.maps,"asset_initial_version","",id);asset.content_hash=text(old.at("hash"));
            asset.media_type=text(old.at("mediaType"));asset.bytes=decimal(old.at("byteLength"));asset.source=old.at("source");asset.license=old.at("license");
            const auto first=store_.query("SELECT data FROM blob_chunks WHERE blob_id=? AND byte_offset=0",{row[2]});
            const auto type=classify_asset(asset.media_type,first.empty()?"":text(first[0][0]));
            asset.metadata={{"name",short_name(asset.source)},{"logicalPath","/Imported/"+id},{"tags",Json::array()},
                {"favorite",false},{"assetType",type},{"importSettings",{{"settingsKind",type+".default"},{"settingsVersion",1},{"values",Json::object()}}},
                {"provenance",{{"sourceKind","local_file"},{"sourceName",asset.source.at("displayName")},{"sourceHash",asset.content_hash},
                    {"licenseId",asset.license.at("identifier")},{"attribution",""},{"commercialUse","unknown"},{"localOnly",true}}}};
            asset.metadata_hash=hash(asset.metadata.dump());plan.assets.emplace(id,std::move(asset));
        }
        // 旧快照先用原投影验证，不能在升级时给坏历史重新计算一个看似有效的hash。
        for (const auto& row : store_.query("SELECT snapshot_id FROM snapshots ORDER BY snapshot_id")) {control.checkpoint();(void)load_state(text(row[0]));}
        auto candidate=load_state();for(const auto& id:candidate.assets){candidate.asset_versions[id]=plan.assets.at(id);candidate.asset_types[id]=text(plan.assets.at(id).metadata.at("assetType"));}
        candidate=upgrade_state(std::move(candidate),plan.maps);validate_state(candidate,settings_);
        require(plan.maps.dump().size()<=6291456,"LIMIT_EXCEEDED");
        Json result={{"planId",plan.id},{"sourceHead",std::to_string(plan.revision)},{"sourceFormat",1},{"targetFormat",2},
            {"sourceHash",plan.source_hash},{"requiredFreeBytes",std::to_string(plan.required_bytes)},{"idMap",plan.maps},
            {"migrationChecksum",hash(std::string(ddl_v2)+migration_algorithm)},{"blockingDiagnostics",Json::array()}};
        if (location_->available()<plan.required_bytes) result["blockingDiagnostics"].push_back({{"code","STORAGE_FULL"},{"severity","error"}});
        plan.hash=hash(result.dump());result["planHash"]=plan.hash;plan.result=envelope(request,result);
        auto response=plan.result;upgrade_plan_=std::move(plan);return response;
    }
    require(request.at("op")=="project.upgrade.commit" && upgrade_plan_.has_value(),"MIGRATION_PLAN_EXPIRED");
    const auto plan=*upgrade_plan_;expected(request);
    require(std::chrono::steady_clock::now()<plan.expires && params.at("planId")==plan.id && params.at("planHash")==plan.hash,
        "MIGRATION_PLAN_EXPIRED");
    require(head()==plan.revision && migration_source_hash()==plan.source_hash,"VERSION_MISMATCH");
    require(location_->available()>=plan.required_bytes && proposals_.empty(),"MIGRATION_BLOCKED");
    for (const auto& entry:plan.maps) {
        const auto generated=entry.at("generatedId");
        for (const auto* sql:{"SELECT stable_id FROM identities WHERE stable_id=?","SELECT version_id FROM document_versions WHERE version_id=?",
            "SELECT asset_id FROM uploads WHERE asset_id=?","SELECT upload_id FROM uploads WHERE upload_id=?","SELECT snapshot_id FROM snapshots WHERE snapshot_id=?"})
            require(store_.query(sql,{generated}).empty(),"MIGRATION_BLOCKED");
    }
    const auto receipts=store_.query("SELECT result_json FROM requests WHERE op='maintenance.backup' AND json_extract(result_json,'$.data.backupId')=?",{params.at("backupGrant")});
    require(receipts.size()==1,"BACKUP_REQUIRED");const auto backup=parse(text(receipts[0][0])).at("data");
    require(decimal(backup.at("revision"))==static_cast<std::uint64_t>(head()),"BACKUP_REQUIRED");
    const auto file=root_.existing_backup(text(backup.at("relativePath")));
    require(file_hash(file.path,control.checkpoint)==text(backup.at("checksum")),"HASH_MISMATCH");
    Store verify;verify.open(file.path,false,true);require(fingerprint(verify)==plan.source_hash,"BACKUP_REQUIRED");verify.close();
    auto candidate=load_state();for(const auto& id:candidate.assets){candidate.asset_versions[id]=plan.assets.at(id);candidate.asset_types[id]=text(plan.assets.at(id).metadata.at("assetType"));}
    candidate=upgrade_state(std::move(candidate),plan.maps);
    // FK开关只在事务外改变；会话单写actor持有工程独占锁，没有其他作者并发进入。
    store_.exec("PRAGMA foreign_keys=OFF");
    try {
        auto result=commit(request,digest,std::move(candidate),"edit",control,"",[&](std::int64_t revision) {
            store_.run("INSERT INTO format_migrations VALUES(1,2,?,?,?)",{plan.migration_id,backup.at("checksum"),now_ms()});
            for(const auto& entry:plan.maps) store_.run("INSERT INTO format_migration_maps VALUES(?,?,?,?,?,?)",
                {plan.migration_id,entry.at("mapKind"),entry.at("sourceDocumentId"),entry.at("sourceStableId"),entry.at("generatedId"),entry.at("detail").dump()});
            for(const auto& [id,asset]:plan.assets) store_.run("INSERT INTO asset_versions VALUES(?,?,?,?,?,?,?,?)",
                {asset.version,id,asset.content_hash,asset.media_type,asset.metadata.dump(),asset.source.dump(),asset.license.dump(),
                    store_.scalar("SELECT created_revision FROM assets WHERE asset_id=?",{id})});
            store_.exec("INSERT INTO asset_heads SELECT h.asset_id,m.generated_id FROM temp.gg_migration_asset_heads h JOIN format_migration_maps m ON m.map_kind='asset_initial_version' AND m.source_stable_id=h.asset_id");
            store_.exec("INSERT INTO snapshot_assets SELECT s.snapshot_id,s.asset_id,m.generated_id FROM temp.gg_migration_snapshot_assets s JOIN format_migration_maps m ON m.map_kind='asset_initial_version' AND m.source_stable_id=s.asset_id");
            for(const auto& row:store_.query("SELECT document_id,version_id FROM document_versions ORDER BY document_id,version_id")) {
                const auto doc=load_version(text(row[0]),text(row[1]));
                for(const auto& ref:references(doc)) store_.run("INSERT INTO document_refs VALUES(?,?,?,?,?,?,1)",
                    {doc.version,ref.path,ref.kind,ref.target,ref.kind=="document"?"scene":ref.kind=="asset"?"image":"entity",ref.kind=="entity"?Json(doc.id):Json(nullptr)});
            }
            for(const auto& entry:plan.maps) if(entry.at("mapKind")!="asset_initial_version") {
                const auto id=entry.at("generatedId");
                if(store_.query("SELECT stable_id FROM identities WHERE stable_id=?",{id}).empty()) store_.run("INSERT INTO identities VALUES(?,'subobject',?,?,?)",
                    {id,entry.at("sourceDocumentId"),entry.at("mapKind")=="scene_plane"?"scene.plane":"sprite2d",revision});
            }
        },[&]{rebuild_tables(store_);format_=2;},[&]{
            require(store_.query("PRAGMA foreign_key_check").empty(),"MIGRATION_BLOCKED");store_.verify_structure();
            validate_state(load_state(),settings_);
        });
        // COMMIT之后清理失败只阻止后续写入，不能将已记录的升级成功改报为失败。
        try {
            store_.exec("PRAGMA foreign_keys=ON");
            for (const auto* name:{"project","identities","document_refs","uploads","asset_heads","snapshots","snapshot_assets"})
                store_.exec(("DROP TABLE temp.gg_migration_"+std::string(name)).c_str());
        } catch (...) {recovery_required_=true;}
        upgrade_plan_.reset();asset_reads_.clear();return result;
    } catch (...) {
        format_=1;
        try {store_.exec("PRAGMA foreign_keys=ON");}catch(...){recovery_required_=true;}
        throw;
    }
}
}
