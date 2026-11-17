// 摘要使用既有text校验后比较，不依赖JSON到std::string的隐式转换。
// 只有COMMIT成功后返回持久化收据；历史通过版本指针切换保留旧正文。
#include "core/application/session.hpp"
#include "core/document/model_v2.hpp"
#include "core/storage/sqlite/repository.hpp"
#include "core/assets/logical_path.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <limits>
namespace gg {
std::int64_t Session::head() { return store_.scalar("SELECT head_revision FROM project WHERE singleton=1").get<std::int64_t>(); }
void Session::writable() {
    require(read_only_.empty(), "READ_ONLY"); require(!recovery_required_, "IO_ERROR");
    location_->verify(); require(location_->available() >= 4194304, "STORAGE_FULL");
}
void Session::expected(const Json& r) {
    require(decimal(r.at("expectedRevision")) == static_cast<std::uint64_t>(head()),
        r.at("protocolVersion")=="1.1"?"VERSION_MISMATCH":"REVISION_CONFLICT");
}
void Session::expire_proposals() {
    const auto now = std::chrono::steady_clock::now();
    for (auto i = proposals_.begin(); i != proposals_.end();) {
        if (i->second.expires <= now || i->second.base != head()) i = proposals_.erase(i); else ++i;
    }
    for(auto& [id,cached]:volatile_requests_)if(!proposals_.contains(cached.proposal))cached.result.clear();
}
Document Session::load_version(const std::string& id,const std::string& version) {
    return read_document_version(store_,id,version);
}
State Session::load_state(const std::optional<std::string>& snapshot) {
    return read_repository_state(store_,format_,project_,branch_,snapshot);
}
void Session::open_metadata() {
    const auto rows = store_.query("SELECT project_id,branch_id,settings_document_id,initialized,format_version FROM project WHERE singleton=1");
    require(rows.size() == 1 && rows[0][3] == 1 && (rows[0][4] == 1 || rows[0][4] == 2), "DATABASE_CORRUPT");
    format_ = rows[0][4].get<int>();
    project_ = text(rows[0][0]); branch_ = text(rows[0][1]); settings_ = text(rows[0][2]);
    require(uuid(project_) && uuid(branch_) && uuid(settings_), "DATABASE_CORRUPT");
    auto state = load_state();
    bool known = true;
    for (const auto& [id,d] : state.documents) {
        if (!known_document(d)) known = false;
        else if (registered_model(d)) {
            // 未安装的组件/节点或未来闭合字段只读保留，不能通过打开工程抹掉原文。
            try {validate_model(d);}catch(const Error&){known=false;}
        }
    }
    if (known) validate_state(state,settings_);
    else read_only_.push_back("UNSUPPORTED_SCHEMA");
}
void Session::insert_version(const Document& d, std::int64_t revision) {
    store_.run("INSERT INTO document_versions VALUES(?,?,?,?,?,?,?)",
        {d.version,d.id,d.kind,d.schema,d.body.dump(),d.content_hash,revision});
    for (const auto& ref : references(d)) {
        if (format_ == 1) store_.run("INSERT INTO document_refs VALUES(?,?,?,?,1)", {d.version,ref.path,ref.kind,ref.target});
        else {
            const auto type = ref.expected_type.empty() ? (ref.kind == "document" ? "scene" : ref.kind == "asset" ? "image" : "entity") : ref.expected_type;
            const Json scope = ref.kind == "entity" || ref.kind == "subobject" ? Json(ref.scope_document.empty()?d.id:ref.scope_document) : Json(nullptr);
            store_.run("INSERT INTO document_refs VALUES(?,?,?,?,?,?,?)", {d.version,ref.path,ref.kind,ref.target,type,scope,ref.required});
        }
    }
}
void Session::record_identities(const State& before, const State& after, std::int64_t revision, bool restoring, bool dry_run) {
    auto identity = [&](const std::string& id, const std::string& kind, const std::string& scope,
                        const std::string& type, bool existed) {
        const auto rows = store_.query("SELECT identity_kind,scope_id,type_name FROM identities WHERE stable_id=?", {id});
        if (rows.empty()) {
            require(!restoring || existed, "INVALID_REFERENCE");
            if (!dry_run) store_.run("INSERT INTO identities VALUES(?,?,?,?,?)", {id,kind,scope,type,revision});
        } else {
            require(rows[0] == Row{kind,scope,type} && (existed || restoring), "INVALID_REFERENCE");
        }
    };
    for (const auto& [id,d] : after.documents) {
        identity(id,"document",project_,d.kind,before.documents.contains(id));
        if (d.kind == "scene") for (auto e = d.body.at("entities").begin(); e != d.body.at("entities").end(); ++e) {
            const bool existed = before.documents.contains(id) && before.documents.at(id).body.at("entities").contains(e.key());
            identity(e.key(),"entity",id,"entity",existed);
        }
        if (registered_model(d)) {
            std::set<std::string> prior;
            if (before.documents.contains(id) && registered_model(before.documents.at(id)))
                for (const auto& object : model_identities(before.documents.at(id))) prior.insert(object.id);
            for (const auto& object : model_identities(d)) {
                if (object.kind != "entity" || d.kind != "scene")
                    identity(object.id,object.kind,object.scope,object.type,prior.contains(object.id));
            }
        }
    }
    for (const auto& id : after.assets) identity(id,"asset",project_,"asset",before.assets.contains(id));
}
std::string Session::snapshot(const State& state, std::int64_t revision, const std::string& reason) {
    const auto id = random_uuid(); auto m = manifest(state,project_,branch_,revision);
    if (state.format == 1) for (const auto& asset : state.assets) m["assets"].push_back({{"id",asset},{"hash",asset_metadata(asset).at("hash")}});
    if (format_ == 1) store_.run("INSERT INTO snapshots VALUES(?,?,?,?,0,?)", {id,revision,reason,hash(m.dump()),now_ms()});
    else {
        const auto original=m.dump();
        store_.run("INSERT INTO snapshots VALUES(?,?,?,?,2,?,?,0,?)", {id,revision,reason,hash(original),model_catalog_hash(),original,now_ms()});
    }
    for (const auto& [doc,d] : state.documents)
        store_.run("INSERT INTO snapshot_documents VALUES(?,?,?)", {id,doc,d.version});
    for (const auto& asset : state.assets) {
        if (format_ == 1) store_.run("INSERT INTO snapshot_assets VALUES(?,?)", {id,asset});
        else store_.run("INSERT INTO snapshot_assets VALUES(?,?,?)", {id,asset,state.asset_versions.at(asset).version});
    }
    store_.run(format_ == 1 ? "DELETE FROM snapshots WHERE snapshot_id<>? AND locked=0 AND snapshot_id NOT IN "
        "(SELECT snapshot_id FROM snapshots WHERE locked=0 ORDER BY revision DESC LIMIT 20)" :
        "DELETE FROM snapshots WHERE snapshot_id<>? AND locked=0 AND snapshot_id NOT IN (SELECT snapshot_id FROM snapshot_consumers) AND snapshot_id NOT IN "
        "(SELECT snapshot_id FROM snapshots WHERE locked=0 ORDER BY revision DESC LIMIT 20)", {id});
    return id;
}
void Session::save_request(const Json& r, const std::string& digest, const std::string& result, const Json& revision) {
    store_.run("INSERT INTO requests VALUES(?,?,?,?,?,?)", {r.at("requestId"),r.at("op"),digest,result,revision,now_ms()});
}
std::string Session::commit(const Json& r, const std::string& digest, State next, const std::string& kind,
                            const Control& control, const std::string& source,
                            const std::function<void(std::int64_t)>& extra, const std::function<void()>& before_persist,
                            const std::function<void()>& final_check) {
    writable(); expected(r);
    auto previous = load_state(); validate_state(next,settings_);
    const auto old_head = head(); require(old_head < INT64_MAX, "LIMIT_EXCEEDED"); const auto revision = old_head + 1;
    const auto txid = random_uuid();
    for (auto& [id,d] : next.documents) {
        if (d.version.empty() || (previous.documents.contains(id) && d.version == previous.documents.at(id).version && d.body != previous.documents.at(id).body)) {
            d.version = random_uuid(); d.content_hash = hash(d.body.dump());
        }
    }
    const auto forward = delta(previous,next), inverse = delta(next,previous);
    control.checkpoint(); control.commit_gate();
    Transaction tx(store_);
    require(head() == old_head, "REVISION_CONFLICT");
    if (before_persist) before_persist();
    store_.run("INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?)",
        {revision,txid,old_head,r.at("requestId"),kind,source.empty()?Json(nullptr):Json(source),
         forward.dump(),inverse.dump(),now_ms()});
    record_identities(previous,next,revision,kind=="restore" || kind=="undo" || kind=="redo");
    if (extra) extra(revision);
    if (format_ == 2) for (const auto& [id,asset] : next.asset_versions) {
        if (store_.query("SELECT asset_id FROM assets WHERE asset_id=?", {id}).empty()) store_.run("INSERT INTO assets VALUES(?,?,?,?,?,1,?)",
            {id,asset.content_hash,asset.media_type,asset.source.dump(),asset.license.dump(),revision});
        if (store_.query("SELECT asset_version_id FROM asset_versions WHERE asset_version_id=?", {asset.version}).empty())
            store_.run("INSERT INTO asset_versions VALUES(?,?,?,?,?,?,?,?)", {asset.version,id,asset.content_hash,asset.media_type,
                asset.metadata.dump(),asset.source.dump(),asset.license.dump(),revision});
    }
    for (const auto& [id,d] : next.documents) {
        if (store_.query("SELECT version_id FROM document_versions WHERE version_id=?", {d.version}).empty())
            insert_version(d,revision);
    }
    store_.run("DELETE FROM document_heads");
    for (const auto& [id,d] : next.documents) store_.run("INSERT INTO document_heads VALUES(?,?)", {id,d.version});
    store_.run("DELETE FROM asset_heads");
    for (const auto& id : next.assets) {
        if (format_ == 1) store_.run("INSERT INTO asset_heads VALUES(?)", {id});
        else store_.run("INSERT INTO asset_heads VALUES(?,?)", {id,next.asset_versions.at(id).version});
    }
    const auto& settings = next.documents.at(settings_).body;
    store_.run("UPDATE project SET name=?,default_scene_id=?,head_revision=? WHERE singleton=1",
               {settings.at("name"),settings.at("defaultSceneId"),revision});
    if (kind=="undo" || kind=="redo")
        store_.run("UPDATE history_entries SET applied=? WHERE transaction_id=?", {kind=="redo",source});
    else {
        store_.run("DELETE FROM history_entries WHERE applied=0");
        store_.run("INSERT INTO history_entries VALUES((SELECT COALESCE(MAX(slot),0)+1 FROM history_entries),?,1)", {txid});
        store_.run("DELETE FROM history_entries WHERE slot NOT IN (SELECT slot FROM history_entries ORDER BY slot DESC LIMIT 200)");
    }
    const auto snap = snapshot(next,revision,kind);
    Json data = {{"transactionId",txid},{"revision",std::to_string(revision)},{"snapshotId",snap},{"durable",true}};
    if (kind=="undo") data["undoneTransactionId"]=source;
    if (kind=="redo") data["redoneTransactionId"]=source;
    if (r.at("op")=="project.upgrade.commit") {
        const auto migration=store_.query("SELECT migration_id,source_backup_hash FROM format_migrations WHERE from_version=1 AND to_version=2");
        require(migration.size()==1,"MIGRATION_BLOCKED");
        data.update(Json{{"projectId",project_},{"headRevision",std::to_string(revision)},{"formatVersion",2},
            {"backupHash",migration[0][1]},{"migrationId",migration[0][0]}});
    }
    if (kind=="attach") {
        const auto upload = r.at("params").at("uploadId");
        data["assetId"] = store_.scalar("SELECT asset_id FROM uploads WHERE upload_id=?", {upload});
        data["contentHash"] = asset_metadata(text(data["assetId"])).at("hash");
    }
    // 收据先编码并与数据同事务保存，COMMIT后不再为业务结果分配大对象。
    auto result = envelope(r,data); save_request(r,digest,result,revision);
    Json event = {{"type","project.committed"},{"revision",std::to_string(revision)},{"transactionId",txid},
                  {"requestId",r.at("requestId")},{"changedDocumentIds",Json::array()}};
    for (auto i=forward.at("documentHeads").begin();i!=forward.at("documentHeads").end();++i)
        event["changedDocumentIds"].push_back(i.key());
    if (final_check) final_check();
    tx.commit();
    try { control.publish(event); } catch (...) { /* 事件丢失由gap和request.lookup恢复，不能逆转已提交结果。 */ }
    return result;
}
std::string Session::create(const Json& r, const std::string& digest, const Control& control) {
    require(!is_open(), "PROJECT_BUSY"); const auto& p = r.at("params");
    bool fresh = true;
    try { location_ = root_.project(text(p.at("directory")),true,true); }
    catch (const Error& e) {
        if (e.code != "ALREADY_EXISTS") throw;
        fresh = false; location_ = root_.project(text(p.at("directory")),false,true);
    }
    try {
        store_.open(location_->database,fresh,false);
        if (!fresh) {
            open_metadata();
            const auto rows = store_.query("SELECT request_hash,result_json,op FROM requests WHERE request_id=?", {r.at("requestId")});
            require(rows.size()==1 && rows[0][0]==digest && rows[0][2]=="project.create", "ALREADY_EXISTS");
            return text(rows[0][1]);
        }
        project_=text(p.at("projectId")); branch_=random_uuid(); settings_=text(p.at("settingsId"));
        format_ = r.at("protocolVersion") == "1.1" ? 2 : 1;
        const auto scene = text(p.at("defaultSceneId"));
        State state;
        state.documents.emplace(settings_,Document{settings_,random_uuid(),"project.settings","",1,
            {{"name",p.at("name")},{"defaultSceneId",scene},{"extensions",Json::object()}}});
        state.documents.emplace(scene,Document{scene,random_uuid(),"scene","",1,
            {{"name","Scene"},{"entities",Json::object()},{"extensions",Json::object()}}});
        if (format_ == 2) {
            state.format = 2;
            auto& settings = state.documents.at(settings_);
            settings.schema = 2;
            settings.body.update(Json{{"unitsPerMeter",100},{"fixedStepHz",60},{"enabledModules",{"scene","render","input"}},
                {"entryGraphs",Json::array()}});
            auto& initial_scene = state.documents.at(scene);
            initial_scene.schema = 2;
            initial_scene.body["planes"] = {{random_uuid(),{{"name","Default"},{"baseHeight",0}}}};
        }
        validate_state(state,settings_); control.checkpoint(); control.commit_gate();
        Transaction tx(store_); store_.exec(format_ == 2 ? ddl_v2 : ddl);
        const auto txid=random_uuid();
        store_.run("INSERT INTO transactions VALUES(0,?,NULL,?,'init',NULL,?,?,?)",
                   {txid,r.at("requestId"),Json::object().dump(),Json::object().dump(),now_ms()});
        store_.run("INSERT INTO project VALUES(1,?,?,?,?,?,?,0,'gg-json-v1',1)",
                   {project_,branch_,format_,p.at("name"),settings_,scene});
        record_identities(State{},state,0,false);
        for (auto& [id,d] : state.documents) {
            d.content_hash=hash(d.body.dump()); insert_version(d,0);
            store_.run("INSERT INTO document_heads VALUES(?,?)", {id,d.version});
        }
        snapshot(state,0,"init");
        auto result=envelope(r,{{"projectId",project_},{"branchId",branch_},{"headRevision","0"},
                                      {"settingsId",settings_},{"defaultSceneId",scene},{"formatVersion",format_}});
        save_request(r,digest,result,0); tx.commit(); return result;
    } catch (...) { store_.close(); location_.reset(); project_.clear(); format_=1; throw; }
}
Json Session::query(const Json& r, const Control&) {
    const auto op=text(r.at("op")); const auto& p=r.at("params");
    if (op=="project.read")
        return {{"id",project_},{"name",store_.scalar("SELECT name FROM project")},{"formatVersion",format_},
                {"headRevision",std::to_string(head())},{"rootDocuments",{{"settingsId",settings_},
                 {"defaultSceneId",store_.scalar("SELECT default_scene_id FROM project")}}},{"readOnlyReasons",read_only_},
                {"schemaCatalogHash",model_catalog_hash()}};
    if (op=="document.list") {
        Json docs=Json::array(); const auto rows=store_.query(
            "SELECT h.document_id,d.kind,d.schema_version,d.version_id,d.content_hash FROM document_heads h "
            "JOIN document_versions d ON d.version_id=h.version_id WHERE h.document_id>? ORDER BY h.document_id LIMIT ?",
            {p.value("afterId",""),p.at("limit").get<int>()+1});
        for (std::size_t i=0;i<std::min(rows.size(),p.at("limit").get<std::size_t>());++i) {
            const auto& x=rows[i]; docs.push_back({{"id",x[0]},{"kind",x[1]},{"schemaVersion",x[2]},{"versionId",x[3]},{"contentHash",x[4]}});
        }
        return {{"documents",docs},{"nextAfterId",rows.size()>docs.size()?docs.back().at("id"):Json(nullptr)}};
    }
    if (op=="document.read") {
        const auto id=text(p.at("documentId")); std::string version; auto revision=head();
        if (p.contains("snapshotId")) {
            auto state=load_state(text(p.at("snapshotId"))); require(state.documents.contains(id),"NOT_FOUND");
            version=state.documents.at(id).version;
            revision=store_.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?", {p.at("snapshotId")}).get<std::int64_t>();
        } else version=text(store_.scalar("SELECT version_id FROM document_heads WHERE document_id=?", {id}));
        const auto d=load_version(id,version);
        return {{"documentId",id},{"body",d.body},{"kind",d.kind},{"schemaVersion",d.schema},
                {"versionId",version},{"contentHash",d.content_hash},{"revision",std::to_string(revision)}};
    }
    if (op=="history.read") {
        Json entries=Json::array();
        for (const auto& row:store_.query("SELECT revision,transaction_id,kind,source_transaction_id FROM transactions "
              "WHERE revision<? ORDER BY revision DESC LIMIT ?", {p.contains("beforeRevision")?Json(decimal(p.at("beforeRevision"))):Json(INT64_MAX),p.at("limit")}))
            entries.push_back({{"revision",std::to_string(row[0].get<std::int64_t>())},{"transactionId",row[1]},
                               {"kind",row[2]},{"sourceTransactionId",row[3]}});
        return {{"transactions",entries},{"undoCount",store_.scalar("SELECT COUNT(*) FROM history_entries WHERE applied=1")},
                {"redoCount",store_.scalar("SELECT COUNT(*) FROM history_entries WHERE applied=0")}};
    }
    if (op=="snapshot.list") {
        Json entries=Json::array(); const auto rows=store_.query("SELECT snapshot_id,revision,reason,locked,manifest_hash "
            "FROM snapshots WHERE snapshot_id>? ORDER BY snapshot_id LIMIT ?", {p.value("afterId",""),p.at("limit").get<int>()+1});
        for (std::size_t i=0;i<std::min(rows.size(),p.at("limit").get<std::size_t>());++i) {
            const auto& x=rows[i]; entries.push_back({{"snapshotId",x[0]},{"revision",std::to_string(x[1].get<std::int64_t>())},
                                                  {"reason",x[2]},{"locked",x[3]==1},{"manifestHash",x[4]}});
        }
        return {{"snapshots",entries},{"nextAfterId",rows.size()>entries.size()?entries.back().at("snapshotId"):Json(nullptr)}};
    }
    if (op=="request.lookup") {
        const auto rows=store_.query("SELECT op,result_json FROM requests WHERE request_id=?", {p.at("targetRequestId")});
        if (rows.empty()) return {{"status","not_found"}};
        return {{"status","SUCCEEDED"},{"op",rows[0][0]},{"result",parse(text(rows[0][1]))},{"error",nullptr}};
    }
    if (op=="asset.read") {
        const auto id=text(p.at("assetId"));
        if (format_ == 2 && p.contains("snapshotId")) {
            const auto state = load_state(text(p.at("snapshotId")));
            require(state.assets.contains(id), "NOT_FOUND");
            auto data = asset_metadata(id,state.asset_versions.at(id).version);
            data["headRevision"] = std::to_string(store_.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?", {p.at("snapshotId")}).get<std::int64_t>());
            return data;
        }
        require(!store_.query("SELECT asset_id FROM asset_heads WHERE asset_id=?", {id}).empty(),"NOT_FOUND");
        return asset_metadata(id);
    }
    if (op=="asset.list") {require(format_==2,"FORMAT_UPGRADE_REQUIRED");return list_assets(p);}
    if (op=="references.read")return read_references(p);
    throw Error("INVALID_MESSAGE");
}
std::string Session::operate(const Json& r, const std::string& digest, const Control& control) {
    const auto op=text(r.at("op")); const auto& p=r.at("params");
    if (op.starts_with("project.upgrade.")) return upgrade(r,digest,control);
    if (op == "snapshot.capture" || op == "snapshot.retain" || op == "snapshot.release") {
        require(format_ == 2, "FORMAT_UPGRADE_REQUIRED"); writable();
        if (op == "snapshot.capture" || op == "snapshot.retain") {
            if (op == "snapshot.capture") expected(r);
            auto state=op=="snapshot.capture"?load_state():load_state(text(p.at("snapshotId")));
            if (op == "snapshot.capture") validate_state(state,settings_);
            control.checkpoint(); control.commit_gate(); Transaction transaction(store_);
            const auto id=op=="snapshot.capture"?snapshot(state,head(),"edit"):text(p.at("snapshotId"));
            const auto consumer=random_uuid();
            store_.run("INSERT INTO snapshot_consumers VALUES(?,?,?,?,?)", {consumer,id,r.at("requestId"),p.at("purpose"),now_ms()});
            auto result=envelope(r,{{"snapshotId",id},{"consumerId",consumer},{"projectId",project_},{"branchId",branch_},
                {"manifestFormat",state.format},
                {"headRevision",std::to_string(store_.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?",{id}).get<std::int64_t>())},
                {"manifestHash",store_.scalar("SELECT manifest_hash FROM snapshots WHERE snapshot_id=?",{id})},
                {"schemaCatalogHash",store_.scalar("SELECT schema_catalog_hash FROM snapshots WHERE snapshot_id=?",{id})}});
            save_request(r,digest,result); transaction.commit(); return result;
        }
        const auto rows=store_.query("SELECT consumer_id FROM snapshot_consumers WHERE consumer_id=?",{p.at("consumerId")});
        auto result=envelope(r,{{"released",!rows.empty()}});
        control.checkpoint(); control.commit_gate(); Transaction transaction(store_);
        store_.run("DELETE FROM snapshot_consumers WHERE consumer_id=?",{p.at("consumerId")});
        save_request(r,digest,result);transaction.commit();return result;
    }
    if (op=="document.propose" || op=="document.validate") {
        writable(); expire_proposals();
        const auto request_id=text(r.at("requestId"));
        if (volatile_requests_.contains(request_id)) {
            const auto& cached=volatile_requests_.at(request_id);
            require(cached.digest==digest,"IDEMPOTENCY_CONFLICT");
            require(proposals_.contains(cached.proposal),"PROPOSAL_EXPIRED"); return cached.result;
        }
        Json data; std::string id;
        if (op=="document.propose") {
            expected(r); require(proposals_.size()<8,"LIMIT_EXCEEDED");
            std::size_t size=p.at("operations").dump().size();
            for (const auto& [key,prop]:proposals_) size+=prop.operations.dump().size();
            require(size<=8388608,"LIMIT_EXCEEDED");
            id=random_uuid(); auto normalized=p.at("operations");
            for (auto& operation:normalized) if(operation.contains("metadata"))
                operation["metadata"]["logicalPath"]=logical_path(text(operation.at("metadata").at("logicalPath"))).normalized;
            Proposal prop{id,hash(normalized.dump()),"",head(),normalized,std::chrono::steady_clock::now()+std::chrono::minutes(10)};
            prop.registry_hash=model_catalog_hash();
            for (std::size_t i=0;i<normalized.size();++i) prop.planned_versions.push_back(random_uuid());
            auto state=load_state(); apply_proposal(state,normalized,prop.planned_versions);
            data={{"proposalId",id},{"baseRevision",std::to_string(prop.base)},{"proposalHash",prop.digest},
                  {"normalizedOperations",normalized},{"diagnostics",Json::array()},{"registryHash",prop.registry_hash},
                  {"pathKeyVersion",path_key_version}};
            if (format_==2) {
                data["assetPlans"]=Json::array();
                for (const auto& [asset_id,asset]:state.asset_versions)
                    if (std::find(prop.planned_versions.begin(),prop.planned_versions.end(),asset.version)!=prop.planned_versions.end())
                        data["assetPlans"].push_back({{"proposedAssetId",asset_id},{"plannedVersionId",asset.version}});
            }
            proposals_.emplace(id,std::move(prop));
        } else {
            id=text(p.at("proposalId")); require(proposals_.contains(id),"PROPOSAL_EXPIRED");
            auto& prop=proposals_.at(id); require(prop.digest==text(p.at("proposalHash")),"PROPOSAL_EXPIRED");
            require(prop.registry_hash==model_catalog_hash(),"VERSION_MISMATCH");
            auto state=load_state(); const auto before=state; apply_proposal(state,prop.operations,prop.planned_versions); validate_state(state,settings_);
            record_identities(before,state,head(),false,true);
            prop.validated=hash(Json{{"proposalId",id},{"proposalHash",prop.digest},{"baseRevision",std::to_string(prop.base)},
                {"registryHash",prop.registry_hash}}.dump());
            Json assets=Json::array(); for (const auto& asset:state.assets) assets.push_back(asset);
            data={{"validatedHash",prop.validated},{"baseRevision",std::to_string(prop.base)},
                  {"diagnostics",Json::array()},{"requiredAssets",assets},{"registryHash",prop.registry_hash},
                  {"readSet",Json::array()},{"writeSet",Json::array()}};
            for (const auto& operation:prop.operations) {
                if (operation.contains("documentId")) data["writeSet"].push_back({{"documentId",operation.at("documentId")},
                    {"path",operation.value("path",std::string(""))}});
                else if (operation.contains("assetId")) data["writeSet"].push_back({{"assetId",operation.at("assetId")}});
            }
            for (const auto& [document_id,document]:before.documents) data["readSet"].push_back({{"documentId",document_id},{"versionId",document.version}});
        }
        auto result=envelope(r,data);
        std::size_t memory=result.size()+request_id.size()+digest.size()+id.size();
        for(const auto& [key,prop]:proposals_) {
            memory+=prop.operations.dump().size()+prop.id.size()+prop.digest.size()+prop.validated.size()+prop.registry_hash.size();
            for(const auto& version:prop.planned_versions)memory+=version.size();
        }
        for(const auto& [key,cached]:volatile_requests_)memory+=key.size()+cached.digest.size()+cached.proposal.size()+cached.result.size();
        if(memory>8388608 || result.size()>3145728) {
            if(op=="document.propose")proposals_.erase(id);
            throw Error("LIMIT_EXCEEDED");
        }
        volatile_requests_.emplace(request_id,Cached{digest,result,id}); return result;
    }
    if (op=="document.commit") {
        expire_proposals(); expected(r); const auto id=text(p.at("proposalId"));
        require(proposals_.contains(id),"PROPOSAL_EXPIRED"); const auto prop=proposals_.at(id);
        require(!prop.validated.empty() && prop.validated==text(p.at("validatedHash")),"PROPOSAL_EXPIRED");
        require(prop.registry_hash==model_catalog_hash(),"VERSION_MISMATCH");
        auto next=load_state(); apply_proposal(next,prop.operations,prop.planned_versions);
        auto result=commit(r,digest,std::move(next),"edit",control,"",[&](std::int64_t){adopt_uploads(prop.operations);});
        proposals_.erase(id); return result;
    }
    if (op=="history.undo" || op=="history.redo") {
        writable(); expected(r); const bool redo=op=="history.redo";
        const auto rows=store_.query(redo?
            "SELECT t.transaction_id,t.forward_json FROM history_entries h JOIN transactions t USING(transaction_id) "
            "WHERE h.applied=0 ORDER BY h.slot ASC LIMIT 1":
            "SELECT t.transaction_id,t.inverse_json FROM history_entries h JOIN transactions t USING(transaction_id) "
            "WHERE h.applied=1 ORDER BY h.slot DESC LIMIT 1");
        require(!rows.empty(),"HISTORY_EMPTY"); const auto changes=parse(text(rows[0][1]));
        auto next=load_state();
        for (auto i=changes.at("documentHeads").begin();i!=changes.at("documentHeads").end();++i) {
            if (i.value().is_null()) next.documents.erase(i.key());
            else next.documents[i.key()]=load_version(i.key(),text(i.value()));
        }
        for (auto i=changes.at("assetHeads").begin();i!=changes.at("assetHeads").end();++i) {
            if (format_ == 1) {
                if (i.value().get<bool>()) next.assets.insert(i.key()); else next.assets.erase(i.key());
            } else if (changes.value("dataVersion",1) == 2) {
                if (i.value().is_null()) {next.assets.erase(i.key());next.asset_versions.erase(i.key());next.asset_types.erase(i.key());}
                else {
                    auto asset = load_asset_version(i.key(),text(i.value()));
                    next.assets.insert(i.key());next.asset_types[i.key()]=text(asset.metadata.at("assetType"));
                    next.asset_versions[i.key()]=std::move(asset);
                }
            } else {
                if (!i.value().get<bool>()) {next.assets.erase(i.key());next.asset_versions.erase(i.key());next.asset_types.erase(i.key());}
                else {
                    const auto mapped = store_.query("SELECT generated_id FROM format_migration_maps WHERE map_kind='asset_initial_version' AND source_stable_id=?", {i.key()});
                    require(mapped.size()==1,"MIGRATION_MAP_MISSING");
                    auto asset=load_asset_version(i.key(),text(mapped[0][0]));
                    next.assets.insert(i.key());next.asset_types[i.key()]=text(asset.metadata.at("assetType"));next.asset_versions[i.key()]=std::move(asset);
                }
            }
        }
        if (format_==2) next=upgrade_legacy_state(std::move(next));
        return commit(r,digest,std::move(next),redo?"redo":"undo",control,text(rows[0][0]));
    }
    if (op=="snapshot.restore") return commit(r,digest,upgrade_legacy_state(load_state(text(p.at("snapshotId")))),"restore",control);
    if (op.starts_with("asset.upload_") || op=="asset.attach") return asset_command(r,digest,control);
    if (op.starts_with("maintenance.") || op=="snapshot.pin" || op=="project.flush")
        return maintenance(r,digest,control);
    if (op=="project.close") {
        const auto revision=head(); control.checkpoint();
        auto result=envelope(r,{{"closed",true},{"lastDurableRevision",std::to_string(revision)}});
        asset_reads_.clear();store_.close(); location_.reset(); project_.clear(); branch_.clear(); settings_.clear();
        proposals_.clear(); volatile_requests_.clear(); asset_reads_.clear();upgrade_plan_.reset();format_=1;
        read_only_=Json::array(); recovery_required_=false; return result;
    }
    return envelope(r,query(r,control));
}
std::string Session::execute(const std::string& raw, const Control& control) {
    Json r=parse(raw); request_check(r); control.checkpoint(); const auto digest=hash(raw); const auto op=text(r.at("op"));
    try {
        if(op=="schema.catalog.list")return envelope(r,list_models(r.at("params")));
        if(op=="schema.describe")return envelope(r,describe_model(text(r.at("params").at("kind")),r.at("params").at("schemaVersion").get<int>()));
        if (op=="core.capabilities") return envelope(r,{
            {"abiVersion",65536},{"protocolVersion","1.0"},{"formatVersion",1},{"hashVersion","gg-json-v1"},
            {"schemaVersions",{{"scene",1},{"project.settings",1}}},
            {"limits",{{"tasks",32},{"chunkBytes",1048576},{"documents",500},{"assetBytes",67108864}}},
            {"capabilities",{{"localCore",true},{"cloud",false},{"gui",false},{"engineImport",false},{"lanSync",false},{"gameExport",false}}}});
        if (op=="project.create") {
            if(is_open()) {
                const auto prior=store_.query("SELECT request_hash,result_json FROM requests WHERE request_id=? AND op='project.create'", {r.at("requestId")});
                require(!prior.empty(),"PROJECT_BUSY");require(prior[0][0]==digest,"IDEMPOTENCY_CONFLICT");return text(prior[0][1]);
            }
            return create(r,digest,control);
        }
        if (op=="project.open") {
            require(!is_open(),"PROJECT_BUSY"); const auto& p=r.at("params"); const bool ro=p.at("mode")=="read_only";
            location_=root_.project(text(p.at("directory")),false,!ro);
            try {
                store_.open(location_->database,false,ro); if(ro)read_only_.push_back("HOST_READ_ONLY"); open_metadata();
                require(format_ == 1 || r.at("protocolVersion") == "1.1", "FORMAT_UPGRADE_REQUIRED");
                return envelope(r,{{"projectId",project_},{"branchId",branch_},{"headRevision",std::to_string(head())},
                    {"recoverySummary",{{"strategy","sqlite_wal"},{"status","opened"}}},{"readOnlyReasons",read_only_}});
            } catch (...) {store_.close();location_.reset();read_only_=Json::array();throw;}
        }
        require(is_open(),"NOT_FOUND"); require(r.at("projectId")==project_,"PERMISSION_DENIED");
        require(format_ == 1 || r.at("protocolVersion") == "1.1", "FORMAT_UPGRADE_REQUIRED");
        const auto prior=store_.query("SELECT request_hash,result_json FROM requests WHERE request_id=?", {r.at("requestId")});
        if (!prior.empty()) {require(prior[0][0]==digest,"IDEMPOTENCY_CONFLICT");return text(prior[0][1]);}
        if (volatile_requests_.contains(text(r.at("requestId"))))
            require(volatile_requests_.at(text(r.at("requestId"))).digest==digest,"IDEMPOTENCY_CONFLICT");
        return operate(r,digest,control);
    } catch (const Error& e) {
        if (e.code=="IO_ERROR" || e.code=="STORAGE_FULL" || e.code=="DATABASE_CORRUPT") recovery_required_=true;
        throw;
    }
}
}
