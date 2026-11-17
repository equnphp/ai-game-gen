// 仅白名单字段可以编辑；extensions只保存语义值，永不执行。
#include "core/document/document.hpp"
#include <cmath>
#include <set>
#include <sstream>
namespace gg {
namespace {
bool keys(const Json& v, std::initializer_list<const char*> required) {
    if (!v.is_object() || v.size() != required.size()) return false;
    for (const char* k : required) if (!v.contains(k)) return false;
    return true;
}
void name(const Json& v) {
    require(v.is_string(), "TYPE_MISMATCH");
    const auto s = text(v);
    std::size_t size = 0;
    for (unsigned char c : s) if ((c & 0xc0) != 0x80) ++size;
    require(size >= 1 && size <= 80, "LIMIT_EXCEEDED");
}
bool known_entity(const Json& e) {
    return keys(e, {"name","parentId","transform","sprite","extensions"}) &&
        keys(e.at("transform"), {"x","y","rotation","scaleX","scaleY"}) &&
        (e.at("sprite").is_null() || keys(e.at("sprite"), {"assetId"}));
}
void validate_document(const Document& d) {
    require(uuid(d.id) && d.schema == 1 && known_document(d), "UNSUPPORTED_SCHEMA");
    require(d.body.dump().size() <= 1048576, "LIMIT_EXCEEDED");
    name(d.body.at("name"));
    require(d.body.at("extensions").is_object(), "TYPE_MISMATCH");
    if (d.kind == "project.settings") {
        require(uuid(text(d.body.at("defaultSceneId"))), "INVALID_REFERENCE");
        return;
    }
    const auto& entities = d.body.at("entities");
    require(entities.is_object() && entities.size() <= 10000, "LIMIT_EXCEEDED");
    for (auto it = entities.begin(); it != entities.end(); ++it) {
        require(uuid(it.key()), "TYPE_MISMATCH");
        const auto& e = it.value();
        require(known_entity(e), "UNSUPPORTED_SCHEMA");
        name(e.at("name")); require(e.at("extensions").is_object(), "TYPE_MISMATCH");
        for (const auto& n : e.at("transform")) require(n.is_number() && std::isfinite(n.get<double>()), "TYPE_MISMATCH");
        require(e.at("transform").at("scaleX") != 0 && e.at("transform").at("scaleY") != 0, "TYPE_MISMATCH");
        std::set<std::string> chain{it.key()};
        auto parent = e.at("parentId");
        while (!parent.is_null()) {
            const auto id = text(parent);
            require(uuid(id) && entities.contains(id) && chain.insert(id).second, "INVALID_REFERENCE");
            const auto& next = entities.at(id);
            require(next.is_object() && next.contains("parentId"), "TYPE_MISMATCH");
            parent = next.at("parentId");
        }
    }
}
std::vector<std::string> field_path(const Document& d, const std::string& p) {
    require(!p.empty() && p[0] == '/' && p.find('~') == std::string::npos, "INVALID_PATH");
    std::vector<std::string> parts;
    std::stringstream stream(p.substr(1)); std::string part;
    while (std::getline(stream, part, '/')) parts.push_back(part);
    require(!p.ends_with('/') && !parts.empty(), "INVALID_PATH");
    if (parts.size() == 1 && parts[0] == "name") return parts;
    if (d.kind == "project.settings") {
        require(parts.size() == 1 && parts[0] == "defaultSceneId", "INVALID_PATH"); return parts;
    }
    require(d.kind == "scene" && parts.size() >= 2 && parts[0] == "entities" && uuid(parts[1]), "INVALID_PATH");
    if (parts.size() == 2) return parts;
    if (parts.size() == 3) {
        require(parts[2] == "name" || parts[2] == "parentId" || parts[2] == "transform" || parts[2] == "sprite",
                "INVALID_PATH"); return parts;
    }
    require(parts.size() == 4 && parts[2] == "transform" &&
        (parts[3] == "x" || parts[3] == "y" || parts[3] == "rotation" || parts[3] == "scaleX" || parts[3] == "scaleY"),
        "INVALID_PATH");
    return parts;
}
}
bool known_document(const Document& d) {
    if (d.schema != 1 || !d.body.is_object()) return false;
    if (d.kind == "project.settings") return keys(d.body, {"name","defaultSceneId","extensions"});
    if (d.kind != "scene" || !keys(d.body, {"name","entities","extensions"}) || !d.body.at("entities").is_object()) return false;
    for (const auto& e : d.body.at("entities")) if (!known_entity(e)) return false;
    return true;
}
std::vector<Reference> references(const Document& d) {
    std::vector<Reference> refs;
    if (d.kind == "project.settings") refs.push_back({"/defaultSceneId", "document", text(d.body.at("defaultSceneId"))});
    else if (d.kind == "scene") for (auto it = d.body.at("entities").begin(); it != d.body.at("entities").end(); ++it) {
        const auto& e = it.value(); const auto prefix = "/entities/" + it.key();
        if (!e.at("parentId").is_null()) refs.push_back({prefix + "/parentId", "entity", text(e.at("parentId"))});
        if (!e.at("sprite").is_null()) refs.push_back({prefix + "/sprite/assetId", "asset", text(e.at("sprite").at("assetId"))});
    }
    return refs;
}
void validate_state(const State& s, const std::string& settings_id) {
    require(s.documents.size() <= 500 && s.documents.contains(settings_id), "LIMIT_EXCEEDED");
    require(s.documents.at(settings_id).kind == "project.settings", "INVALID_REFERENCE");
    std::set<std::string> identities = s.assets;
    for (const auto& [id,d] : s.documents) {
        require(identities.insert(id).second, "INVALID_REFERENCE"); validate_document(d);
        if (d.kind == "project.settings") require(id == settings_id, "INVALID_REFERENCE");
        else for (auto it = d.body.at("entities").begin(); it != d.body.at("entities").end(); ++it)
            require(identities.insert(it.key()).second, "INVALID_REFERENCE");
    }
    for (const auto& [id,d] : s.documents) for (const auto& ref : references(d)) {
        require(uuid(ref.target), "INVALID_REFERENCE");
        if (ref.kind == "document")
            require(s.documents.contains(ref.target) && s.documents.at(ref.target).kind == "scene", "INVALID_REFERENCE");
        else if (ref.kind == "asset") require(s.assets.contains(ref.target), "INVALID_REFERENCE");
        else require(d.body.at("entities").contains(ref.target), "INVALID_REFERENCE");
    }
}
void apply_operations(State& s, const Json& operations) {
    for (const auto& op : operations) {
        const auto id = text(op.at("documentId")); const auto kind = text(op.at("kind"));
        if (kind == "create_document") {
            require(!s.documents.contains(id), "INVALID_REFERENCE");
            s.documents.emplace(id, Document{id,"",text(op.at("documentKind")),"",op.at("schemaVersion").get<int>(),op.at("body")});
        } else {
            require(s.documents.contains(id), "NOT_FOUND");
            auto& d = s.documents.at(id); require(known_document(d), "UNSUPPORTED_SCHEMA");
            if (kind == "delete_document") { s.documents.erase(id); continue; }
            const auto parts = field_path(d, text(op.at("path")));
            Json* parent = &d.body;
            for (std::size_t i = 0; i + 1 < parts.size(); ++i) {
                require(parent->is_object() && parent->contains(parts[i]), "INVALID_PATH"); parent = &parent->at(parts[i]);
            }
            require(parent->is_object(), "INVALID_PATH");
            if (kind == "set_field") (*parent)[parts.back()] = op.at("value");
            else { require(parent->erase(parts.back()) == 1, "INVALID_PATH"); }
        }
    }
}
Json delta(const State& before, const State& after) {
    Json result = {{"documentHeads", Json::object()}, {"assetHeads", Json::object()}};
    for (const auto& [id,d] : before.documents) if (!after.documents.contains(id)) result["documentHeads"][id] = nullptr;
    for (const auto& [id,d] : after.documents)
        if (!before.documents.contains(id) || before.documents.at(id).version != d.version) result["documentHeads"][id] = d.version;
    for (const auto& id : before.assets) if (!after.assets.contains(id)) result["assetHeads"][id] = false;
    for (const auto& id : after.assets) if (!before.assets.contains(id)) result["assetHeads"][id] = true;
    return result;
}
Json manifest(const State& state, const std::string& project, const std::string& branch, std::int64_t revision) {
    Json m = {{"formatVersion",1},{"projectId",project},{"branchId",branch},{"revision",std::to_string(revision)},
              {"documents",Json::array()},{"assets",Json::array()}};
    for (const auto& [id,d] : state.documents) m["documents"].push_back({{"id",id},{"versionId",d.version},{"hash",d.content_hash}});
    return m;
}
}
