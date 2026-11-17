// 首路径能力逐项链接；未实现的启用组件必须阻断，不能裁掉后声称可运行。
#include "artifact/build.hpp"
#include "core/document/model_v2.hpp"
#include "engine/catalog.hpp"
#include "engine/graph.hpp"
#include "engine/runner.hpp"
#include <numbers>
namespace gg::artifact {
namespace {
void diagnostic(Json& list,const std::string& code,const std::string& document,const std::string& path) {
    require(list.size()<4096,"LIMIT_EXCEEDED");list.push_back({{"code",code},{"severity","error"},{"documentId",document},
        {"path",path.empty()?Json(nullptr):Json(path)},{"sourceIds",Json::array()},{"messageKey","artifact."+code},{"args",Json::object()}});
}
const Document& select_document(const State& state,const std::string& id,const std::string& kind,int schema) {
    require(state.documents.contains(id),"SNAPSHOT_REFERENCE_MISSING");const auto& doc=state.documents.at(id);
    require(doc.kind==kind && doc.schema==schema,"UNSUPPORTED_SCHEMA");return doc;
}
std::map<std::string,std::string> actions_for(const State& state,const Json& entity) {
    std::map<std::string,std::string> actions;
    for(const auto& component:entity.at("components"))if(component.at("type")=="input.controller") {
        const auto& doc=select_document(state,text(component.at("data").at("map").at("id")),"input.map",1);
        for(auto item=doc.body.at("actions").begin();item!=doc.body.at("actions").end();++item)actions.emplace(item.key(),text(item.value().at("valueType")));
    }
    return actions;
}
}
BuildPlan prepare(SnapshotReadPort& source,const std::string& settings_id,const Json& options,const std::function<void()>& checkpoint) {
    checkpoint();const auto& state=source.state();
    require(source.reference().at("schemaCatalogHash")==model_catalog_hash(),"SNAPSHOT_CATALOG_UNSUPPORTED");
    require(options.at("catalogHash")==contracts::graph_nodes_hash(),"CATALOG_MISMATCH");
    require(options.at("compilerBuild")==compiler_build,"COMPILER_BUILD_MISMATCH");
    require((options.at("runtimeProfileId")=="gg-wasm32-scalar-js-eh-1" || options.at("runtimeProfileId")=="gg-wasm32-scalar-js-eh-2") &&
        content_hash(text(options.at("runtimeProfileHash"))),"RUNTIME_PROFILE_UNSUPPORTED");
    const auto& settings=select_document(state,settings_id,"project.settings",2);
    const auto& scene=select_document(state,text(options.at("entrySceneId")),"scene",2);
    BuildPlan result;result.id=random_uuid();result.options=options;
    try{validate_state(state,settings_id);}catch(const Error& error){diagnostic(result.diagnostics,error.code,scene.id,"");}
    if(!settings.body.at("entryGraphs").empty())diagnostic(result.diagnostics,"CAPABILITY_NOT_IMPLEMENTED",settings.id,"/entryGraphs");
    std::size_t main=0;
    for(auto entity=scene.body.at("entities").begin();entity!=scene.body.at("entities").end();++entity) {
        checkpoint();const auto base="/entities/"+entity.key()+"/components/";
        for(auto component=entity.value().at("components").begin();component!=entity.value().at("components").end();++component) {
            const auto& value=component.value();const auto type=text(value.at("type"));if(!value.at("enabled").get<bool>() && type!="input.controller")continue;
            const auto path=base+component.key();
            if(type=="camera2d" && value.at("enabled").get<bool>() && value.at("data").at("main").get<bool>())++main;
            if(type=="sprite2d" || type=="audio.source" || type=="physics.collider2d" ||
                (type=="physics.body2d" && value.at("data").at("mode")=="dynamic")) {
                diagnostic(result.diagnostics,"CAPABILITY_NOT_IMPLEMENTED",scene.id,path);continue;
            }
            if(type=="graph.behavior") {
                try {
                    const auto& graph=select_document(state,text(value.at("data").at("graph").at("id")),"graph",1);
                    (void)compiler::analyze_graph({graph.id,graph.version,graph.schema,graph.body},true);
                    const auto actions=actions_for(state,entity.value());
                    for(const auto& node:graph.body.at("nodes")) {
                        const auto node_type=text(node.at("type"));
                        if(node_type=="audio.play")throw Error("CAPABILITY_NOT_IMPLEMENTED");
                        if(node_type=="input.read" || node_type=="event.input") {
                            const auto action=text(node.at("parameters").at("action").at("value"));
                            require(actions.contains(action) && actions.at(action)=="vec2","INPUT_CONTEXT_MISSING");
                        }
                    }
                }catch(const Error& error){diagnostic(result.diagnostics,error.code,scene.id,path);}
            }
        }
    }
    if(main!=1)diagnostic(result.diagnostics,main==0?"CAMERA_MAIN_MISSING":"CAMERA_MAIN_AMBIGUOUS",scene.id,"/entities");
    result.hash=hash(Json{{"planVersion",1},{"planId",result.id},{"snapshot",source.reference()},{"options",options},{"diagnostics",result.diagnostics}}.dump());
    return result;
}
BundleOutput compile(SnapshotReadPort& source,const std::string& settings_id,const BuildPlan& plan,const std::function<void()>& checkpoint) {
    require(plan.diagnostics.empty(),"PLAN_HAS_ERRORS");checkpoint();const auto& state=source.state();
    const auto& settings=select_document(state,settings_id,"project.settings",2);
    const auto& scene=select_document(state,text(plan.options.at("entrySceneId")),"scene",2);
    BundleOutput output;auto& manifest=output.manifest;
    manifest={{"bundleFormat","gg-runtime-bundle-1"},{"capabilitySet","scene2-graph1-first-path-1"},{"unitsVersion","gg-plane-down-radian-runtime-1"},
        {"compilerBuild",compiler_build},{"catalogHash",contracts::graph_nodes_hash()},{"schemaCatalogHash",source.reference().at("schemaCatalogHash")},
        {"runtimeProfileId",plan.options.at("runtimeProfileId")},{"runtimeProfileHash",plan.options.at("runtimeProfileHash")},
        {"fixedStepHz",settings.body.at("fixedStepHz")},{"entrySceneId",scene.id},{"inputMaps",Json::object()},
        {"graphs",Json::array()},{"assets",Json::array()},{"blocks",Json::array()},
        {"scene",{{"documentId",scene.id},{"planes",scene.body.at("planes")},{"entities",Json::object()},{"activeCamera",nullptr}}}};
    std::map<std::string,compiler::CompiledGraph> compiled;
    std::uint32_t ordinal=0;std::size_t block_bytes=0;
    for(auto entity=scene.body.at("entities").begin();entity!=scene.body.at("entities").end();++entity) {
        checkpoint();const auto& value=entity.value();auto transform=value.at("transform");
        transform["rotationRadians"]=transform.at("rotation").get<double>()*(std::numbers::pi/180.0);transform.erase("rotation");
        Json runtime_entity={{"parentId",value.at("parentId")},{"scheduleOrdinal",ordinal++},{"transform",transform},
            {"spatial",value.at("spatial")},{"components",Json::object()}};
        std::string controller;
        for(auto component=value.at("components").begin();component!=value.at("components").end();++component)if(component.value().at("type")=="input.controller") {
            controller=component.key();const auto map_id=text(component.value().at("data").at("map").at("id"));
            const auto& map=select_document(state,map_id,"input.map",1);manifest["inputMaps"][map_id]={{"actions",map.body.at("actions")}};
        }
        for(auto component=value.at("components").begin();component!=value.at("components").end();++component) {
            const auto& author=component.value();const auto type=text(author.at("type"));
            // 禁用且无运行时激活API的组件不参与运行闭包；作者快照仍完整保留给Writer。
            if(!author.at("enabled").get<bool>() && type!="input.controller")continue;
            auto target=author;
            if(type=="camera2d" && author.at("data").at("main").get<bool>())manifest["scene"]["activeCamera"]={{"entityId",entity.key()},{"componentId",component.key()}};
            if(type=="graph.behavior") {
                const auto graph_id=text(author.at("data").at("graph").at("id"));const auto& graph=select_document(state,graph_id,"graph",1);
                compiler::CompileOptions options{text(plan.options.at("runtimeProfileId")),compiler_build,settings.body.at("fixedStepHz").get<unsigned>(),actions_for(state,value)};
                // 每个实例均用自身动作上下文编译校验，之后才允许按相同IR内容去重。
                auto program=compiler::compile_graph({graph.id,graph.version,graph.schema,graph.body},options);const auto raw=program.ir.dump();
                if(!output.blocks.contains(program.ir_hash)) {
                    require(raw.size()<=67108864-block_bytes,"BUILD_MEMORY_LIMIT");block_bytes+=raw.size();output.blocks.emplace(program.ir_hash,raw);
                    manifest["blocks"].push_back({{"hash",program.ir_hash},{"bytes",std::to_string(raw.size())},{"mediaType","application/vnd.gamegen.ir+json"},{"purpose","graph_ir"}});
                }
                if(!compiled.contains(graph_id)) {
                    manifest["graphs"].push_back({{"documentId",graph.id},{"sourceVersion",graph.version},{"graphIRHash",program.ir_hash},{"irExecutionHash",program.execution_hash}});
                    compiled.emplace(graph_id,program);
                } else require(compiled.at(graph_id).ir_hash==program.ir_hash,"INPUT_CONTEXT_MISMATCH");
                target["data"]={{"graphId",graph_id},{"graphIRHash",program.ir_hash},{"defaultEntry",author.at("data").at("entry")},
                    {"inputControllerId",controller.empty()?Json(nullptr):Json(controller)},{"initialVariables",author.at("data").at("initialVariables")}};
            }
            runtime_entity["components"][component.key()]=std::move(target);
        }
        manifest["scene"]["entities"][entity.key()]=std::move(runtime_entity);
    }
    checkpoint();schema_check(manifest,contracts::runtime_bundle());
    // 使用真实World装载边界做链接检查，只构造不启动，也不把它记录为运行测试。
    runtime::WorldRunner linked(random_uuid(),manifest,output.blocks,text(plan.options.at("runtimeProfileId")),text(plan.options.at("runtimeProfileHash")));
    require(manifest.dump().size()<=8388608,"LIMIT_EXCEEDED");return output;
}
}
