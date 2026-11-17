// 只有COMMIT成功后返回持久化收据；历史通过版本指针切换保留旧正文。
#include "core/application/session.hpp"
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
    require(decimal(r.at("expectedRevision")) == static_cast<std::uint64_t>(head()), "REVISION_CONFLICT");
}
void Session::expire_proposals() {
    const auto now = std::chrono::steady_clock::now();
    for (auto i = proposals_.begin(); i != proposals_.end();) {
        if (i->second.expires <= now || i->second.base != head()) i = proposals_.erase(i); else ++i;
    }
    for(auto& [id,cached]:volatile_requests_)if(!proposals_.contains(cached.proposal))cached.result.clear();
}
Document Session::load_version(const std::string& id, const std::string& version) {
    const auto rows = store_.query("SELECT kind,schema_version,body_json,content_hash FROM document_versions "
                                   "WHERE document_id=? AND version_id=?", {id,version});
    require(rows.size() == 1, "DATABASE_CORRUPT"); const auto& row = rows[0];
    const auto body = text(row[2]); require(hash(body) == row[3], "DATABASE_CORRUPT");
    return {id,version,text(row[0]),text(row[3]),row[1].get<int>(),parse(body,1048576)};
}
State Session::load_state(const std::optional<std::string>& snap) {
    State state; std::vector<Row> docs;
    if (snap) {
        require(!store_.query("SELECT snapshot_id FROM snapshots WHERE snapshot_id=?", {*snap}).empty(), "NOT_FOUND");
        docs = store_.query("SELECT document_id,version_id FROM snapshot_documents WHERE snapshot_id=? ORDER BY document_id", {*snap});
        for (const auto& r : store_.query("SELECT asset_id FROM snapshot_assets WHERE snapshot_id=? ORDER BY asset_id", {*snap}))
            state.assets.insert(text(r[0]));
    } else {
        docs = store_.query("SELECT document_id,version_id FROM document_heads ORDER BY document_id");
        for (const auto& r : store_.query("SELECT asset_id FROM asset_heads ORDER BY asset_id")) state.assets.insert(text(r[0]));
    }
    require(docs.size() <= 500, "LIMIT_EXCEEDED");
    for (const auto& row : docs) {
        auto d = load_version(text(row[0]),text(row[1])); state.documents.emplace(d.id,std::move(d));
    }
    if (snap) {
        const auto revision = store_.scalar("SELECT revision FROM snapshots WHERE snapshot_id=?", {*snap}).get<std::int64_t>();
        auto m = manifest(state,project_,branch_,revision);
        for (const auto& id : state.assets) m["assets"].push_back({{"id",id},{"hash",asset_metadata(id).at("hash")}});
        require(hash(m.dump()) == store_.scalar("SELECT manifest_hash FROM snapshots WHERE snapshot_id=?", {*snap}), "DATABASE_CORRUPT");
    }
    return state;
}
void Session::open_metadata() {
    const auto rows = store_.query("SELECT project_id,branch_id,settings_document_id,initialized,format_version FROM project WHERE singleton=1");
    require(rows.size() == 1 && rows[0][3] == 1 && rows[0][4] == 1, "DATABASE_CORRUPT");
    project_ = text(rows[0][0]); branch_ = text(rows[0][1]); settings_ = text(rows[0][2]);
    require(uuid(project_) && uuid(branch_) && uuid(settings_), "DATABASE_CORRUPT");
    auto state = load_state();
    bool known = true;
    for (const auto& [id,d] : state.documents) if (!known_document(d)) known = false;
    if (known) validate_state(state,settings_);
    else read_only_.push_back("UNSUPPORTED_SCHEMA");
}
void Session::insert_version(const Document& d, std::int64_t revision) {
    store_.run("INSERT INTO document_versions VALUES(?,?,?,?,?,?,?)",
        {d.version,d.id,d.kind,d.schema,d.body.dump(),d.content_hash,revision});
    for (const auto& ref : references(d))
        store_.run("INSERT INTO document_refs VALUES(?,?,?,?,1)", {d.version,ref.path,ref.kind,ref.target});
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
    }
    for (const auto& id : after.assets) identity(id,"asset",project_,"asset",before.assets.contains(id));
}
std::string Session::snapshot(const State& state, std::int64_t revision, const std::string& reason) {
    const auto id = random_uuid(); auto m = manifest(state,project_,branch_,revision);
    for (const auto& asset : state.assets) m["assets"].push_back({{"id",asset},{"hash",asset_metadata(asset).at("hash")}});
    store_.run("INSERT INTO snapshots VALUES(?,?,?,?,0,?)", {id,revision,reason,hash(m.dump()),now_ms()});
    for (const auto& [doc,d] : state.documents)
        store_.run("INSERT INTO snapshot_documents VALUES(?,?,?)", {id,doc,d.version});
    for (const auto& asset : state.assets) store_.run("INSERT INTO snapshot_assets VALUES(?,?)", {id,asset});
    store_.run("DELETE FROM snapshots WHERE locked=0 AND snapshot_id NOT IN "
               "(SELECT snapshot_id FROM snapshots WHERE locked=0 ORDER BY revision DESC LIMIT 20)");
    return id;
}
void Session::save_request(const Json& r, const std::string& digest, const std::string& result, const Json& revision) {
    store_.run("INSERT INTO requests VALUES(?,?,?,?,?,?)", {r.at("requestId"),r.at("op"),digest,result,revision,now_ms()});
}
std::string Session::commit(const Json& r, const std::string& digest, State next, const std::string& kind,
                            const Control& control, const std::string& source,
                            const std::function<void(std::int64_t)>& extra) {
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
    store_.run("INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?)",
        {revision,txid,old_head,r.at("requestId"),kind,source.empty()?Json(nullptr):Json(source),
         forward.dump(),inverse.dump(),now_ms()});
    record_identities(previous,next,revision,kind=="restore" || kind=="undo" || kind=="redo");
    if (extra) extra(revision);
    for (const auto& [id,d] : next.documents) {
        if (store_.query("SELECT version_id FROM document_versions WHERE version_id=?", {d.version}).empty())
            insert_version(d,revision);
    }
    store_.run("DELETE FROM document_heads");
    for (const auto& [id,d] : next.documents) store_.run("INSERT INTO document_heads VALUES(?,?)", {id,d.version});
    store_.run("DELETE FROM asset_heads");
    for (const auto& id : next.assets) store_.run("INSERT INTO asset_heads VALUES(?)", {id});
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
        const auto scene = text(p.at("defaultSceneId"));
        State state;
        state.documents.emplace(settings_,Document{settings_,random_uuid(),"project.settings","",1,
            {{"name",p.at("name")},{"defaultSceneId",scene},{"extensions",Json::object()}}});
        state.documents.emplace(scene,Document{scene,random_uuid(),"scene","",1,
            {{"name","Scene"},{"entities",Json::object()},{"extensions",Json::object()}}});
        validate_state(state,settings_); control.checkpoint(); control.commit_gate();
        Transaction tx(store_); store_.exec(ddl);
        const auto txid=random_uuid();
        store_.run("INSERT INTO transactions VALUES(0,?,NULL,?,'init',NULL,?,?,?)",
                   {txid,r.at("requestId"),Json::object().dump(),Json::object().dump(),now_ms()});
        store_.run("INSERT INTO project VALUES(1,?,?,1,?,?,?,0,'gg-json-v1',1)",
                   {project_,branch_,p.at("name"),settings_,scene});
        record_identities(State{},state,0,false);
        for (auto& [id,d] : state.documents) {
            d.content_hash=hash(d.body.dump()); insert_version(d,0);
            store_.run("INSERT INTO document_heads VALUES(?,?)", {id,d.version});
        }
        snapshot(state,0,"init");
        auto result=envelope(r,{{"projectId",project_},{"branchId",branch_},{"headRevision","0"},
                                      {"settingsId",settings_},{"defaultSceneId",scene}});
        save_request(r,digest,result,0); tx.commit(); return result;
    } catch (...) { store_.close(); location_.reset(); project_.clear(); throw; }
}
Json Session::query(const Json& r, const Control&) {
    const auto op=text(r.at("op")); const auto& p=r.at("params");
    if (op=="project.read")
        return {{"id",project_},{"name",store_.scalar("SELECT name FROM project")},{"formatVersion",1},
                {"headRevision",std::to_string(head())},{"rootDocuments",{{"settingsId",settings_},
                 {"defaultSceneId",store_.scalar("SELECT default_scene_id FROM project")}}},{"readOnlyReasons",read_only_}};
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
        require(!store_.query("SELECT asset_id FROM asset_heads WHERE asset_id=?", {id}).empty(),"NOT_FOUND");
        return asset_metadata(id);
    }
    throw Error("INVALID_MESSAGE");
}
std::string Session::operate(const Json& r, const std::string& digest, const Control& control) {
    const auto op=text(r.at("op")); const auto& p=r.at("params");
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
            auto state=load_state(); apply_operations(state,p.at("operations"));
            id=random_uuid(); const auto normalized=p.at("operations");
            Proposal prop{id,hash(normalized.dump()),"",head(),normalized,std::chrono::steady_clock::now()+std::chrono::minutes(10)};
            data={{"proposalId",id},{"baseRevision",std::to_string(prop.base)},{"proposalHash",prop.digest},
                  {"normalizedOperations",normalized},{"diagnostics",Json::array()}};
            proposals_.emplace(id,std::move(prop));
        } else {
            id=text(p.at("proposalId")); require(proposals_.contains(id),"PROPOSAL_EXPIRED");
            auto& prop=proposals_.at(id); require(prop.digest==p.at("proposalHash"),"PROPOSAL_EXPIRED");
            auto state=load_state(); const auto before=state; apply_operations(state,prop.operations); validate_state(state,settings_);
            record_identities(before,state,head(),false,true);
            prop.validated=hash(Json{{"proposalId",id},{"proposalHash",prop.digest},{"baseRevision",std::to_string(prop.base)}}.dump());
            Json assets=Json::array(); for (const auto& asset:state.assets) assets.push_back(asset);
            data={{"validatedHash",prop.validated},{"baseRevision",std::to_string(prop.base)},
                  {"diagnostics",Json::array()},{"requiredAssets",assets}};
        }
        auto result=envelope(r,data);
        std::size_t memory=result.size()+request_id.size()+digest.size()+id.size();
        for(const auto& [key,prop]:proposals_)memory+=prop.operations.dump().size()+prop.id.size()+prop.digest.size()+prop.validated.size();
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
        require(!prop.validated.empty() && prop.validated==p.at("validatedHash"),"PROPOSAL_EXPIRED");
        auto next=load_state(); apply_operations(next,prop.operations);
        auto result=commit(r,digest,std::move(next),"edit",control); proposals_.erase(id); return result;
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
        for (auto i=changes.at("assetHeads").begin();i!=changes.at("assetHeads").end();++i)
            if (i.value().get<bool>()) next.assets.insert(i.key()); else next.assets.erase(i.key());
        return commit(r,digest,std::move(next),redo?"redo":"undo",control,text(rows[0][0]));
    }
    if (op=="snapshot.restore") return commit(r,digest,load_state(text(p.at("snapshotId"))),"restore",control);
    if (op.starts_with("asset.upload_") || op=="asset.attach") return asset_command(r,digest,control);
    if (op.starts_with("maintenance.") || op=="snapshot.pin" || op=="project.flush")
        return maintenance(r,digest,control);
    if (op=="project.close") {
        const auto revision=head(); control.checkpoint();
        auto result=envelope(r,{{"closed",true},{"lastDurableRevision",std::to_string(revision)}});
        store_.close(); location_.reset(); project_.clear(); branch_.clear(); settings_.clear();
        proposals_.clear(); volatile_requests_.clear(); read_only_=Json::array(); recovery_required_=false; return result;
    }
    return envelope(r,query(r,control));
}
std::string Session::execute(const std::string& raw, const Control& control) {
    Json r=parse(raw); request_check(r); control.checkpoint(); const auto digest=hash(raw); const auto op=text(r.at("op"));
    try {
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
                return envelope(r,{{"projectId",project_},{"branchId",branch_},{"headRevision",std::to_string(head())},
                    {"recoverySummary",{{"strategy","sqlite_wal"},{"status","opened"}}},{"readOnlyReasons",read_only_}});
            } catch (...) {store_.close();location_.reset();read_only_=Json::array();throw;}
        }
        require(is_open(),"NOT_FOUND"); require(r.at("projectId")==project_,"PERMISSION_DENIED");
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
