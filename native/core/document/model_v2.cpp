// Schema决定结构，领域规则另外校验；extensions不参与引用扫描或可执行语义。
#include "core/document/model_v2.hpp"
#include "engine/math2d.hpp"
#include "engine/input.hpp"
#include "engine/graph.hpp"
#include "core/assets/logical_path.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <set>
#include <sstream>

namespace gg {
const Json& model_schema() { static const auto value = parse(document_schema_v2, 1048576); return value; }
std::string model_catalog_hash() {
    static const auto value=hash(Json{{"documents",model_schema()},{"nodeCatalogHash",compiler::node_catalog_hash()},
        {"pathKeyVersion",path_key_version},{"semanticRulesVersion","core-model.1"}}.dump());
    return value;
}
namespace {
const Json* descriptor(const Document& doc) {
    for (const auto& schema : model_schema().at("oneOf")) {
        const auto& properties = schema.at("properties");
        if (properties.at("kind").at("const") == doc.kind && properties.at("schemaVersion").at("const") == doc.schema)
            return &schema;
    }
    return nullptr;
}
const Json& resolve(const Json& schema) {
    if (!schema.contains("$ref")) return schema;
    const auto ref = text(schema.at("$ref"));
    require(ref.starts_with("#/"), "UNSUPPORTED_SCHEMA");
    return model_schema().at(Json::json_pointer(ref.substr(1)));
}
void typed_references(const Json& value, const std::string& path, std::vector<Reference>& output) {
    if (value.is_object() && value.contains("kind") && value.contains("scopeDocumentId") &&
        value.contains("id") && value.contains("type") && value.size() == 4) {
        const auto kind = text(value.at("kind"));
        const auto scope = value.at("scopeDocumentId");
        require((kind == "entity" || kind == "subobject") ? scope.is_string() : scope.is_null(), "INVALID_REFERENCE");
        output.push_back({path,kind,text(value.at("id")),text(value.at("type")),scope.is_null()?"":text(scope)});
        return;
    }
    if (value.is_object()) for (auto it = value.begin(); it != value.end(); ++it) {
        if (it.key() != "extensions") typed_references(it.value(), path + "/" + it.key(), output);
    }
    else if (value.is_array()) for (std::size_t i = 0; i < value.size(); ++i)
        typed_references(value[i], path + "/" + std::to_string(i), output);
}
void reference_type(const Json& value, const char* kind, const char* type) {
    if (value.is_null()) return;
    require(value.at("kind") == kind && value.at("type") == type, "INVALID_REFERENCE");
}
void scene_rules(const Document& doc) {
    const auto& body = doc.body;
    const auto& entities = body.at("entities");
    require(!body.at("planes").empty(), "INVALID_REFERENCE");
    unsigned main_cameras = 0;
    for (auto entity = entities.begin(); entity != entities.end(); ++entity) {
        const auto& value = entity.value();
        const auto& transform = value.at("transform");
        require(transform.at("scaleX").get<double>() != 0 && transform.at("scaleY").get<double>() != 0, "TYPE_MISMATCH");
        const auto& spatial = value.at("spatial");
        require(body.at("planes").contains(text(spatial.at("planeId"))) &&
            spatial.at("vertical").at("min").get<double>() <= spatial.at("vertical").at("max").get<double>(), "INVALID_REFERENCE");
        // 父链只在本场景内解析，不能借跨文档引用绕开树约束。
        std::set<std::string> chain{entity.key()};
        auto parent = value.at("parentId");
        while (!parent.is_null()) {
            const auto id = text(parent);
            require(entities.contains(id) && chain.insert(id).second, "DEPENDENCY_CYCLE");
            parent = entities.at(id).at("parentId");
        }
        std::set<std::string> singleton_types;
        for (auto component = value.at("components").begin(); component != value.at("components").end(); ++component) {
            const auto& c = component.value();
            require(c.at("id") == component.key(), "INVALID_REFERENCE");
            const auto type = text(c.at("type"));
            const auto& data = c.at("data");
            if (type != "graph.behavior" && type != "audio.source" && type != "physics.collider2d")
                require(singleton_types.insert(type).second, "INVALID_REFERENCE");
            if (type == "sprite2d") reference_type(data.at("asset"), "asset", "image");
            if (type == "camera2d") {
                reference_type(data.at("followEntity"), "entity", "entity");
                if (data.at("main").get<bool>()) ++main_cameras;
            }
            if (type == "graph.behavior") reference_type(data.at("graph"), "document", "graph");
            if (type == "input.controller") reference_type(data.at("map"), "document", "input.map");
            if (type == "audio.source") reference_type(data.at("clip"), "document", "audio.clip");
            if (type == "physics.collider2d") {
                reference_type(data.at("material"), "document", "physics.material");
                if (data.at("shape") == "box") require(data.at("size").at("x").get<double>() > 0 &&
                    data.at("size").at("y").get<double>() > 0, "TYPE_MISMATCH");
                if (data.at("shape") == "circle") require(data.at("radius").get<double>() > 0, "TYPE_MISMATCH");
                if (data.at("shape") == "polygon") {
                    std::vector<engine::Vec2> vertices;
                    for (const auto& point : data.at("vertices")) vertices.push_back({point.at("x"),point.at("y")});
                    require(engine::simple_polygon(vertices) && engine::convex_polygon(vertices), "TYPE_MISMATCH");
                }
            }
        }
    }
    require(main_cameras <= 1, "INVALID_REFERENCE");
    if (doc.kind == "prefab") {
        const auto root = text(body.at("rootEntityId"));
        require(entities.contains(root) && entities.at(root).at("parentId").is_null(), "INVALID_REFERENCE");
        for (auto it = entities.begin(); it != entities.end(); ++it) {
            auto ancestor = it.key();
            while (!entities.at(ancestor).at("parentId").is_null()) ancestor = text(entities.at(ancestor).at("parentId"));
            require(ancestor == root, "INVALID_REFERENCE");
        }
    }
}
}
bool registered_model(const Document& doc) { return descriptor(doc) != nullptr; }
void validate_model(const Document& doc) {
    require(uuid(doc.id) && registered_model(doc), "UNSUPPORTED_SCHEMA");
    require(doc.body.dump().size() <= 1048576, "LIMIT_EXCEEDED");
    schema_check(Json{{"kind",doc.kind},{"schemaVersion",doc.schema},{"body",doc.body}}, model_schema());
    if (doc.kind == "scene" || doc.kind == "prefab") scene_rules(doc);
    if (doc.kind == "input.map") {
        runtime::validate_input_map(doc.body);
    }
    if (doc.kind == "graph") (void)compiler::analyze_graph({doc.id,doc.version,doc.schema,doc.body});
    // 结构中所有引用都要经过同一个解析器，包括TypedValue里的引用。
    (void)model_references(doc);
}
std::vector<ObjectIdentity> model_identities(const Document& doc) {
    std::vector<ObjectIdentity> output;
    auto collect = [&](const Json& map, const std::string& kind, const std::string& type) {
        for (auto it = map.begin(); it != map.end(); ++it) output.push_back({it.key(),kind,type,doc.id});
    };
    if (doc.kind == "scene" || doc.kind == "prefab") {
        collect(doc.body.at("planes"), "subobject", "scene.plane");
        collect(doc.body.at("entities"), "entity", "entity");
        for (const auto& entity : doc.body.at("entities"))
            for (auto c = entity.at("components").begin(); c != entity.at("components").end(); ++c)
                output.push_back({c.key(),"subobject",text(c.value().at("type")),doc.id});
    }
    if (doc.kind == "graph") {
        collect(doc.body.at("variables"), "subobject", "graph.variable");
        collect(doc.body.at("nodes"), "subobject", "graph.node");
        collect(doc.body.at("edges"), "subobject", "graph.edge");
    }
    if (doc.kind == "input.map") collect(doc.body.at("actions"), "subobject", "input.action");
    return output;
}
std::vector<Reference> model_references(const Document& doc) {
    std::vector<Reference> output;
    typed_references(doc.body, "", output);
    if (doc.kind == "project.settings") output.push_back({"/defaultSceneId","document",text(doc.body.at("defaultSceneId")),"scene",""});
    if (doc.kind == "scene" || doc.kind == "prefab") {
        for (auto entity = doc.body.at("entities").begin(); entity != doc.body.at("entities").end(); ++entity) {
            const auto path = "/entities/" + entity.key();
            if (!entity.value().at("parentId").is_null()) output.push_back({path+"/parentId","entity",text(entity.value().at("parentId")),"entity",doc.id});
            output.push_back({path+"/spatial/planeId","subobject",text(entity.value().at("spatial").at("planeId")),"scene.plane",doc.id});
        }
        if (doc.kind == "prefab") output.push_back({"/rootEntityId","entity",text(doc.body.at("rootEntityId")),"entity",doc.id});
    }
    if (doc.kind == "graph") {
        for (auto edge = doc.body.at("edges").begin(); edge != doc.body.at("edges").end(); ++edge)
            for (const char* end : {"from","to"}) output.push_back({"/edges/"+edge.key()+"/"+end+"/node","subobject",text(edge.value().at(end).at("node")),"graph.node",doc.id});
        for (auto entry = doc.body.at("entries").begin(); entry != doc.body.at("entries").end(); ++entry)
            if (!entry.value().is_null()) output.push_back({"/entries/"+entry.key(),"subobject",text(entry.value()),"graph.node",doc.id});
    }
    return output;
}
std::vector<std::string> model_field_path(const Document& doc, const std::string& path) {
    require(!path.empty() && path.front() == '/' && !path.ends_with('/') && path.find('~') == std::string::npos, "INVALID_PATH");
    const auto* schema = descriptor(doc);
    require(schema, "UNSUPPORTED_SCHEMA");
    const Json* current = &schema->at("properties").at("body");
    std::vector<std::string> parts;
    std::stringstream stream(path.substr(1));
    std::string part;
    while (std::getline(stream, part, '/')) {
        require(!part.empty() && part != "extensions", "INVALID_PATH");
        current = &resolve(*current);
        // 数组只整体替换；联合值和引用也作为原子值替换，避免一半类型一半数据。
        require(!current->contains("anyOf") && !current->contains("oneOf") && current->value("type", "") != "array", "INVALID_PATH");
        if (current->contains("properties") && current->at("properties").contains(part))
            current = &current->at("properties").at(part);
        else {
            require(current->contains("additionalProperties") && current->at("additionalProperties").is_object(), "INVALID_PATH");
            if (current->contains("propertyNames")) schema_check(Json(part), current->at("propertyNames"));
            current = &current->at("additionalProperties");
        }
        parts.push_back(part);
    }
    require(!parts.empty(), "INVALID_PATH");
    return parts;
}
}
