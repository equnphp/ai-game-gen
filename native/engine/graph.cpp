// 数据边严格类型化，exec与data分别禁止自由环；未连完的作者草稿不冒充可编译产物。
#include "engine/graph.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <deque>

namespace gg::compiler {
const Json& node_catalog() {static const auto value=parse(graph_node_catalog,1048576);return value;}
std::string node_catalog_hash() {static const auto value=hash(node_catalog().dump());return value;}
namespace {
const Json& description(const std::string& type) {
    for (const auto& node:node_catalog().at("nodes")) if(node.at("id")==type)return node;
    throw Error("UNSUPPORTED_NODE");
}
std::string parameter_type(const Json& value) {
    static const std::set<std::string> types{"bool","i32","f64","string","vec2","entity","asset","document","subobject"};
    require(value.is_object() && value.size()==2 && value.contains("type") && value.contains("value"),"TYPE_MISMATCH");
    const auto type=text(value.at("type"));require(types.contains(type),"TYPE_MISMATCH");return type;
}
std::string node_generic(const GraphSource& graph,const Json& node) {
    const auto type=text(node.at("type"));const auto& parameters=node.at("parameters");
    if (type=="value.constant") return parameter_type(parameters.at("value"));
    if (type=="math.add") {
        const auto& value=parameters.at("valueType");require(parameter_type(value)=="string","TYPE_MISMATCH");
        const auto concrete=text(value.at("value"));require(concrete=="i32" || concrete=="f64" || concrete=="vec2","TYPE_MISMATCH");return concrete;
    }
    if(type=="variable.read" || type=="variable.write") {
        const auto& parameter=parameters.at("variableId");require(parameter_type(parameter)=="subobject" && !parameter.at("value").is_null(),"TYPE_MISMATCH");
        const auto& reference=parameter.at("value");
        require(reference.at("kind")=="subobject" && reference.at("type")=="graph.variable" && reference.at("scopeDocumentId")==graph.document_id,"INVALID_REFERENCE");
        const auto id=text(reference.at("id"));require(graph.body.at("variables").contains(id),"INVALID_REFERENCE");
        const auto& variable=graph.body.at("variables").at(id);
        if(type=="variable.write") require(variable.at("mutable").get<bool>(),"IMMUTABLE_VARIABLE");
        return parameter_type(variable.at("value"));
    }
    return "";
}
void check_parameters(const GraphSource& graph,const Json& node,const Json& definition) {
    const auto& parameters=node.at("parameters");const auto& expected=definition.at("parameters");
    require(parameters.size()==expected.size(),"INVALID_PARAMETER");
    for(auto item=expected.begin();item!=expected.end();++item) {
        require(parameters.contains(item.key()),"INVALID_PARAMETER");
        const auto type=parameter_type(parameters.at(item.key()));const auto rule=text(item.value());
        if(rule=="T" || rule.starts_with("enum(")) continue;
        if(rule.starts_with("subobject/")) {
            require(type=="subobject","TYPE_MISMATCH");const auto& reference=parameters.at(item.key()).at("value");
            require(reference.is_object() && reference.at("kind")=="subobject" && reference.at("type")==rule.substr(10),"INVALID_REFERENCE");
        } else if(rule.starts_with("i32[")) {
            require(type=="i32","TYPE_MISMATCH");const auto ticks=parameters.at(item.key()).at("value").get<std::int64_t>();
            require(ticks>=1 && ticks<=3600000,"LIMIT_EXCEEDED");
        } else require(type==rule,"TYPE_MISMATCH");
        if(item.key()=="action" || item.key()=="name") {
            const auto value=text(parameters.at(item.key()).at("value"));require(!value.empty() && value.size()<=320,"LIMIT_EXCEEDED");
        }
    }
    (void)node_generic(graph,node);
}
void acyclic(const std::map<std::string,NodePorts>& nodes,const std::map<std::string,std::vector<std::string>>& adjacent) {
    std::map<std::string,std::size_t> incoming;
    for(const auto& [id,node]:nodes) incoming[id]=0;
    for(const auto& [id,targets]:adjacent) for(const auto& target:targets) ++incoming.at(target);
    std::deque<std::string> queue;
    for(const auto& [id,count]:incoming) if(count==0)queue.push_back(id);
    std::size_t visited=0;
    while(!queue.empty()) {
        const auto id=queue.front();queue.pop_front();++visited;
        if(adjacent.contains(id))for(const auto& target:adjacent.at(id))if(--incoming.at(target)==0)queue.push_back(target);
    }
    require(visited==nodes.size(),"DEPENDENCY_CYCLE");
}
}
GraphAnalysis analyze_graph(const GraphSource& graph,bool complete) {
    require(graph.schema==1,"UNSUPPORTED_GRAPH_SCHEMA");
    static const auto schemas=parse(document_schema_v2,1048576);
    schema_check(Json{{"kind","graph"},{"schemaVersion",graph.schema},{"body",graph.body}},schemas);
    GraphAnalysis result;
    for(auto node=graph.body.at("nodes").begin();node!=graph.body.at("nodes").end();++node) {
        const auto& definition=description(text(node.value().at("type")));
        require(node.value().at("typeVersion")==definition.at("version"),"UNSUPPORTED_NODE_VERSION");
        const auto& supported=definition.at("supportedGraphSchemas");
        require(std::find(supported.begin(),supported.end(),Json(graph.schema))!=supported.end(),"UNSUPPORTED_GRAPH_SCHEMA");
        check_parameters(graph,node.value(),definition);
        const auto generic=node_generic(graph,node.value());NodePorts ports;ports.effect=text(definition.at("effect"));
        if(graph.body.at("graphType")=="formula")require(ports.effect=="pure","UNSUPPORTED_CAPABILITY");
        for(const auto* direction:{"inputs","outputs"}) {
            auto& output=std::string_view(direction)=="inputs"?ports.inputs:ports.outputs;
            for(auto port=definition.at(direction).begin();port!=definition.at(direction).end();++port)
                output[port.key()]=port.value()=="T"?generic:text(port.value());
        }
        result.nodes.emplace(node.key(),std::move(ports));
    }
    std::map<std::string,std::vector<std::string>> data,exec;
    for(const auto& edge:graph.body.at("edges")) {
        const auto from=text(edge.at("from").at("node")),to=text(edge.at("to").at("node"));
        const auto from_port=text(edge.at("from").at("port")),to_port=text(edge.at("to").at("port"));
        require(result.nodes.contains(from) && result.nodes.contains(to),"INVALID_REFERENCE");
        const auto& producer=result.nodes.at(from);const auto& consumer=result.nodes.at(to);
        require(producer.outputs.contains(from_port) && consumer.inputs.contains(to_port),"INVALID_PORT");
        const auto type=producer.outputs.at(from_port);require(type==consumer.inputs.at(to_port),"TYPE_MISMATCH");
        const auto executable=edge.at("kind")=="exec";require(executable==(type=="exec"),"TYPE_MISMATCH");
        if(executable) {
            require(result.exec_outputs.emplace(std::pair{from,from_port},Connection{to,to_port}).second,"DUPLICATE_CONNECTION");
            exec[from].push_back(to);
        } else {
            require(result.data_inputs.emplace(std::pair{to,to_port},Connection{from,from_port}).second,"DUPLICATE_CONNECTION");
            data[from].push_back(to);
        }
    }
    acyclic(result.nodes,data);acyclic(result.nodes,exec);
    static const std::map<std::string,std::string> entry_types{{"onStart","event.start"},{"onTick","event.tick"},{"onInput","event.input"},{"onSignal","event.signal"}};
    std::set<std::string> roots;
    for(auto entry=graph.body.at("entries").begin();entry!=graph.body.at("entries").end();++entry) if(!entry.value().is_null()) {
        const auto id=text(entry.value());require(result.nodes.contains(id) && entry_types.contains(entry.key()),"INVALID_REFERENCE");
        require(graph.body.at("nodes").at(id).at("type")==entry_types.at(entry.key()) && roots.insert(id).second,"INVALID_ENTRY");
        result.entries[entry.key()]=id;
    }
    if(complete) {
        require(graph.body.at("graphType")=="behavior" && !result.entries.empty(),"UNSUPPORTED_CAPABILITY");
        for(const auto& [id,node]:result.nodes) for(const auto& [port,type]:node.inputs)
            if(type!="exec")require(result.data_inputs.contains({id,port}),"MISSING_INPUT");
        std::set<std::string> reachable=roots;std::deque<std::string> queue(roots.begin(),roots.end());
        while(!queue.empty()) {
            const auto id=queue.front();queue.pop_front();
            for(const auto& [key,target]:result.exec_outputs) if(key.first==id && reachable.insert(target.node).second)queue.push_back(target.node);
            for(const auto& [key,source]:result.data_inputs) if(key.first==id && reachable.insert(source.node).second)queue.push_back(source.node);
        }
        require(reachable.size()==result.nodes.size(),"UNREACHABLE_NODE");
        for(const auto& [id,node]:result.nodes)if(node.effect=="event")require(roots.contains(id),"INVALID_ENTRY");
    }
    return result;
}
}
