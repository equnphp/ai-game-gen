// 仅生成闭合IR指令；分支与sequence按实际到达顺序展开，不预执行有副作用节点。
#include "engine/graph.hpp"
#include "engine/ir.hpp"
#include <algorithm>

namespace gg::compiler {
namespace {
using Port=std::pair<std::string,std::string>;
class Builder {
    const GraphSource& graph_;
    const CompileOptions& options_;
    GraphAnalysis analysis_;
    Json code_=Json::array(),sources_=Json::array(),types_=Json::array(),constants_=Json::array();
    std::map<std::string,std::size_t> constant_indices_;
    std::string root_;

    const Json& node(const std::string& id)const{return graph_.body.at("nodes").at(id);}
    std::size_t emit(Json value,const std::string& id) {
        require(code_.size()<32768,"IR_LIMIT_EXCEEDED");const auto pc=code_.size();
        code_.push_back(std::move(value));sources_.push_back({{"pc",pc},{"documentId",graph_.document_id},
            {"nodeId",id},{"sourcePath","/nodes/"+id}});return pc;
    }
    std::size_t allocate(const std::string& type) {
        require(types_.size()<4096,"IR_LIMIT_EXCEEDED");const auto index=types_.size();types_.push_back(type);return index;
    }
    std::size_t constant(const Json& value) {
        const auto key=value.dump();const auto known=constant_indices_.find(key);
        if(known!=constant_indices_.end())return known->second;
        require(constants_.size()<65536,"IR_LIMIT_EXCEEDED");const auto index=constants_.size();
        constants_.push_back(value);constant_indices_.emplace(key,index);return index;
    }
    Connection input(const std::string& id,const std::string& port)const {
        const auto found=analysis_.data_inputs.find({id,port});require(found!=analysis_.data_inputs.end(),"MISSING_INPUT");return found->second;
    }
    std::string next(const std::string& id,const std::string& port)const {
        const auto found=analysis_.exec_outputs.find({id,port});return found==analysis_.exec_outputs.end()?"":found->second.node;
    }
    std::size_t data(const Connection& connection) {
        struct Work {Port port;bool expanded=false;};
        std::vector<Work> work{{{connection.node,connection.port},false}};
        std::map<Port,std::size_t> values;
        while(!work.empty()) {
            require(work.size()<=8192,"IR_LIMIT_EXCEEDED");auto& current=work.back();
            if(values.contains(current.port)){work.pop_back();continue;}
            const auto id=current.port.first,port=current.port.second;const auto& item=node(id);
            const auto type=text(item.at("type"));const auto& params=item.at("parameters");const auto& ports=analysis_.nodes.at(id);
            require(ports.effect=="pure" || ports.effect=="query" || ports.effect=="event","INVALID_DATA_SOURCE");
            if(ports.effect=="event")require(id==root_,"CROSS_ENTRY_DATA");
            if(!current.expanded) {
                current.expanded=true;
                for(auto field=ports.inputs.rbegin();field!=ports.inputs.rend();++field)if(field->second!="exec") {
                    const auto dependency=input(id,field->first);const Port key{dependency.node,dependency.port};
                    if(!values.contains(key))work.push_back({key,false});
                }
                continue;
            }
            auto read=[&](const std::string& key){const auto source=input(id,key);return values.at({source.node,source.port});};
            const auto dst=allocate(ports.outputs.at(port));Json instruction;
            if(type=="value.constant") instruction={{"op","CONST"},{"dst",dst},{"k",constant(params.at("value"))}};
            else if(type=="event.tick" && port=="dt")instruction={{"op","CONST"},{"dst",dst},
                {"k",constant(Json{{"type","f64"},{"value",1.0/options_.fixed_step_hz}})}};
            else if(type=="event.tick" && port=="tick")instruction={{"op","TICK"},{"dst",dst}};
            else if(type=="variable.read")instruction={{"op","VAR_GET"},{"dst",dst},{"variableId",params.at("variableId").at("value").at("id")}};
            else if(type=="math.add" || type=="math.multiply" || type=="compare.less" || type=="logic.and") {
                const auto op=type=="math.add"?"ADD":type=="math.multiply"?"MUL_F64":type=="compare.less"?"LESS_F64":"AND_BOOL";
                instruction={{"op",op},{"dst",dst},{"a",read("a")},{"b",read("b")}};
            } else if(type=="vector.scale")instruction={{"op","SCALE_VEC2"},{"dst",dst},{"a",read("vector")},{"b",read("scale")}};
            else if(type=="vector.compose")instruction={{"op","VEC2"},{"dst",dst},{"x",read("x")},{"y",read("y")}};
            else if(type=="input.read" || type=="event.input") {
                const auto action=text(params.at("action").at("value"));
                require(options_.input_actions.contains(action) && options_.input_actions.at(action)=="vec2","INPUT_ACTION_UNRESOLVED");
                instruction={{"op","INPUT_VEC2"},{"dst",dst},{"action",action}};
            } else if(type=="entity.self")instruction={{"op","SELF"},{"dst",dst}};
            else if(type=="entity.position")instruction={{"op","POSITION"},{"dst",dst},{"entity",read("entity")}};
            else throw Error("UNSUPPORTED_NODE");
            emit(std::move(instruction),id);values.emplace(current.port,dst);work.pop_back();
        }
        return values.at({connection.node,connection.port});
    }
    void executable(const std::string& first) {
        enum class Kind {node,after_true,patch};
        struct Work {Kind kind;std::string id;std::size_t pc=0;};
        std::vector<Work> work;
        if(!first.empty())work.push_back({Kind::node,first});
        while(!work.empty()) {
            require(work.size()<=32768,"IR_LIMIT_EXCEEDED");auto current=std::move(work.back());work.pop_back();
            if(current.kind==Kind::patch){code_[current.pc]["pc"]=code_.size();continue;}
            if(current.kind==Kind::after_true) {
                const auto jump=emit(Json{{"op","JUMP"},{"pc",0}},current.id);
                code_[current.pc]["pc"]=code_.size();work.push_back({Kind::patch,current.id,jump});
                const auto alternative=next(current.id,"whenFalse");if(!alternative.empty())work.push_back({Kind::node,alternative});continue;
            }
            const auto& item=node(current.id);const auto type=text(item.at("type"));const auto& params=item.at("parameters");
            if(type=="flow.branch") {
                const auto condition=data(input(current.id,"condition"));
                const auto jump=emit(Json{{"op","JUMP_IF_FALSE"},{"condition",condition},{"pc",0}},current.id);
                work.push_back({Kind::after_true,current.id,jump});
                const auto branch=next(current.id,"whenTrue");if(!branch.empty())work.push_back({Kind::node,branch});continue;
            }
            if(type=="flow.sequence") {
                // 显式空跳转给控制节点一个真实执行位置，断点不依赖UI模拟事件。
                const auto pc=code_.size();emit(Json{{"op","JUMP"},{"pc",pc+1}},current.id);
                for(const auto* port:{"second","first"}){const auto child=next(current.id,port);if(!child.empty())work.push_back({Kind::node,child});}
                continue;
            }
            Json instruction;
            if(type=="variable.write")instruction={{"op","VAR_SET"},{"variableId",params.at("variableId").at("value").at("id")},
                {"src",data(input(current.id,"value"))}};
            else if(type=="entity.translate")instruction={{"op","TRANSLATE"},{"entity",data(input(current.id,"entity"))},{"delta",data(input(current.id,"delta"))}};
            else if(type=="audio.play")instruction={{"op","AUDIO_PLAY"},{"entity",data(input(current.id,"entity"))},{"componentId",params.at("componentId").at("value").at("id")}};
            else if(type=="signal.emit")instruction={{"op","SIGNAL_EMIT"},{"name",params.at("name").at("value")}};
            else throw Error("UNSUPPORTED_NODE");
            emit(std::move(instruction),current.id);const auto child=next(current.id,"next");if(!child.empty())work.push_back({Kind::node,child});
        }
    }
public:
    Builder(const GraphSource& graph,const CompileOptions& options):graph_(graph),options_(options),analysis_(analyze_graph(graph,true)) {}
    Json build() {
        Json entries=Json::array(),variables=Json::array();
        for(const auto& [event,id]:analysis_.entries) {
            root_=id;const auto& params=node(id).at("parameters");
            entries.push_back({{"event",event},{"pc",code_.size()},{"intervalTicks",nullptr},
                {"action",event=="onInput"?params.at("action").at("value"):Json(nullptr)},
                {"signal",event=="onSignal"?params.at("name").at("value"):Json(nullptr)}});
            if(event=="onInput") {
                const auto action=text(params.at("action").at("value"));
                require(options_.input_actions.contains(action) && options_.input_actions.at(action)=="vec2","INPUT_ACTION_UNRESOLVED");
            }
            const auto pc=code_.size();emit(Json{{"op","JUMP"},{"pc",pc+1}},id);
            executable(next(id,"next"));emit(Json{{"op","RETURN"}},id);
        }
        for(auto variable=graph_.body.at("variables").begin();variable!=graph_.body.at("variables").end();++variable)
            variables.push_back({{"id",variable.key()},{"type",variable.value().at("value").at("type")},
                {"mutable",variable.value().at("mutable")},{"initial",variable.value().at("value")}});
        return {{"irVersion",1},{"irRevision",2},{"unitsVersion","gg-plane-down-degree-authoring-1"},
            {"compilerBuild",options_.compiler_build},{"catalogHash",node_catalog_hash()},{"runtimeProfile",options_.runtime_profile},
            {"documentId",graph_.document_id},{"sourceVersion",graph_.version},{"constants",constants_},{"variables",variables},
            {"registerTypes",types_},{"entries",entries},{"code",code_},{"sourceMap",sources_}};
    }
};
}
CompiledGraph compile_graph(const GraphSource& graph,const CompileOptions& options) {
    require(uuid(graph.document_id) && uuid(graph.version),"SNAPSHOT_REQUIRED");
    require(!options.runtime_profile.empty() && !options.compiler_build.empty() && options.fixed_step_hz>=1 && options.fixed_step_hz<=240,"INVALID_COMPILE_PROFILE");
    auto ir=Builder(graph,options).build();(void)runtime::verify_ir(ir,options.runtime_profile);
    // 语义源投影只排除画布position；显示名/扩展保守保留，避免暖缓存改变失效规则。
    Json semantic={{"kind","graph"},{"schemaVersion",graph.schema},{"body",graph.body}};
    for(auto& node:semantic.at("body").at("nodes"))node.erase("position");
    auto execution=ir;execution.erase("sourceVersion");execution.erase("sourceMap");
    return {ir,hash(ir.dump()),hash(semantic.dump()),hash(execution.dump())};
}
}
