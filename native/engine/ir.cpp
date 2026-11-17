// IR不可信：先检查闭合结构和类型，再对每个入口的所有可达路径求定义交集。
#include "engine/ir.hpp"
#include "engine/catalog.hpp"
#include <algorithm>
#include <bitset>
#include <optional>
#include <set>

namespace gg::runtime {
namespace {
void typed_value_reference(const Json& value) {
    const auto type=text(value.at("type"));const auto& data=value.at("value");
    if(type=="document" || type=="asset" || type=="entity" || type=="subobject") {
        if(data.is_null())return;
        require(data.at("kind")==type,"IR_TYPE_MISMATCH");
        require((type=="entity" || type=="subobject")?data.at("scopeDocumentId").is_string():data.at("scopeDocumentId").is_null(),"IR_INVALID_REFERENCE");
    }
}
struct Instruction {
    std::vector<std::size_t> reads;
    std::optional<std::size_t> write;
};
Instruction instruction_types(const Json& instruction,const Json& program,const std::map<std::string,const Json*>& variables) {
    Instruction result;const auto op=text(instruction.at("op"));const auto& types=program.at("registerTypes");
    auto reg=[&](const char* field,const std::string& required,bool write=false) {
        const auto index=instruction.at(field).get<std::size_t>();require(index<types.size(),"IR_REGISTER_RANGE");
        if(!required.empty())require(types[index]==required,"IR_TYPE_MISMATCH");
        if(write)result.write=index;else result.reads.push_back(index);return text(types[index]);
    };
    if(op=="CONST") {
        const auto index=instruction.at("k").get<std::size_t>();require(index<program.at("constants").size(),"IR_CONSTANT_RANGE");
        reg("dst",text(program.at("constants")[index].at("type")),true);
    } else if(op=="COPY") {const auto type=reg("src","");reg("dst",type,true);}
    else if(op=="VAR_GET" || op=="VAR_SET") {
        const auto id=text(instruction.at("variableId"));require(variables.contains(id),"IR_UNKNOWN_VARIABLE");
        const auto& variable=*variables.at(id);
        if(op=="VAR_SET")require(variable.at("mutable").get<bool>(),"IMMUTABLE_VARIABLE");
        reg(op=="VAR_SET"?"src":"dst",text(variable.at("type")),op=="VAR_GET");
    } else if(op=="ADD") {
        const auto type=reg("a","");require(type=="i32" || type=="f64" || type=="vec2","IR_TYPE_MISMATCH");
        reg("b",type);reg("dst",type,true);
    } else if(op=="MUL_F64" || op=="LESS_F64") {
        reg("a","f64");reg("b","f64");reg("dst",op=="LESS_F64"?"bool":"f64",true);
    } else if(op=="SCALE_VEC2") {reg("a","vec2");reg("b","f64");reg("dst","vec2",true);}
    else if(op=="VEC2") {reg("x","f64");reg("y","f64");reg("dst","vec2",true);}
    else if(op=="AND_BOOL") {reg("a","bool");reg("b","bool");reg("dst","bool",true);}
    else if(op=="INPUT_VEC2" || op=="SELF" || op=="TICK")reg("dst",op=="SELF"?"entity":op=="TICK"?"i32":"vec2",true);
    else if(op=="POSITION") {reg("entity","entity");reg("dst","vec2",true);}
    else if(op=="TRANSLATE") {reg("entity","entity");reg("delta","vec2");}
    else if(op=="AUDIO_PLAY")reg("entity","entity");
    else if(op=="JUMP_IF_FALSE")reg("condition","bool");
    else require(op=="SIGNAL_EMIT" || op=="JUMP" || op=="RETURN","IR_UNSUPPORTED_OPCODE");
    if(op=="INPUT_VEC2")require(uuid(text(instruction.at("action"))),"IR_INVALID_INPUT");
    if(op=="SIGNAL_EMIT")require(!text(instruction.at("name")).empty(),"IR_INVALID_SIGNAL");
    return result;
}
}
void validate_typed_value(const Json& value) {
    static const Json schema={{"$defs",contracts::graph_ir().at("$defs")},{"$ref","#/$defs/value"}};
    schema_check(value,schema);typed_value_reference(value);
}
VerifiedProgram verify_ir(const Json& ir,const std::string& profile) {
    require(ir.dump().size()<=1048576,"IR_LIMIT_EXCEEDED");schema_check(ir,contracts::graph_ir());
    require(ir.at("runtimeProfile")==profile && ir.at("catalogHash")==contracts::graph_nodes_hash(),"IR_PROFILE_MISMATCH");
    std::map<std::string,const Json*> variables;
    for(const auto& constant:ir.at("constants"))validate_typed_value(constant);
    for(const auto& variable:ir.at("variables")) {
        require(variable.at("type")==variable.at("initial").at("type"),"IR_TYPE_MISMATCH");validate_typed_value(variable.at("initial"));
        require(variables.emplace(text(variable.at("id")),&variable).second,"IR_DUPLICATE_VARIABLE");
    }
    const auto& code=ir.at("code");const auto& source_map=ir.at("sourceMap");
    require(source_map.size()==code.size(),"IR_SOURCE_MAP");
    std::vector<Instruction> instructions;instructions.reserve(code.size());
    for(std::size_t pc=0;pc<code.size();++pc) {
        const auto& source=source_map[pc];require(source.at("pc")==pc && source.at("documentId")==ir.at("documentId"),"IR_SOURCE_MAP");
        const auto path=text(source.at("sourcePath")),prefix="/nodes/"+text(source.at("nodeId"));
        require(path==prefix || path.starts_with(prefix+"/"),"IR_SOURCE_MAP");
        instructions.push_back(instruction_types(code[pc],ir,variables));
    }
    VerifiedProgram program;program.ir_=ir;
    std::set<std::string> events;std::set<std::size_t> starts;
    for(std::size_t index=0;index<ir.at("entries").size();++index) {
        const auto& entry=ir.at("entries")[index];const auto event=text(entry.at("event"));const auto begin=entry.at("pc").get<std::size_t>();
        require(events.insert(event).second && starts.insert(begin).second && begin<code.size(),"IR_INVALID_ENTRY");
        const auto& action=entry.at("action");const auto& signal=entry.at("signal");
        if(event=="onInput")require(action.is_string() && uuid(text(action)) && signal.is_null(),"IR_INVALID_ENTRY");
        else if(event=="onSignal")require(signal.is_string() && !text(signal).empty() && action.is_null(),"IR_INVALID_ENTRY");
        else require(action.is_null() && signal.is_null(),"IR_INVALID_ENTRY");
        program.entries_.push_back({index,begin,0});
    }
    std::sort(program.entries_.begin(),program.entries_.end(),[](const auto& a,const auto& b){return a.begin<b.begin;});
    require(program.entries_.front().begin==0,"IR_INVALID_ENTRY");
    for(std::size_t index=0;index<program.entries_.size();++index) {
        auto& entry=program.entries_[index];entry.end=index+1<program.entries_.size()?program.entries_[index+1].begin:code.size();
        // 有限向前CFG按PC排序传播；合流处取交集，防止只在某个分支定义的寄存器泄露。
        std::vector<std::optional<std::bitset<4096>>> defined(entry.end-entry.begin);
        defined.front()=std::bitset<4096>{};bool returned=false;
        auto merge=[&](std::size_t target,const std::bitset<4096>& bits) {
            require(target>=entry.begin && target<entry.end,"IR_JUMP_RANGE");auto& destination=defined[target-entry.begin];
            if(destination)*destination&=bits;else destination=bits;
        };
        for(std::size_t pc=entry.begin;pc<entry.end;++pc) {
            const auto op=text(code[pc].at("op"));
            if(op=="JUMP" || op=="JUMP_IF_FALSE") {
                const auto target=code[pc].at("pc").get<std::size_t>();require(target>pc && target<entry.end,"IR_JUMP_RANGE");
            }
            if(!defined[pc-entry.begin])continue;
            auto bits=*defined[pc-entry.begin];
            for(const auto read:instructions[pc].reads)require(bits.test(read),"IR_UNDEFINED_REGISTER");
            if(instructions[pc].write)bits.set(*instructions[pc].write);
            if(op=="TICK")program.uses_i32_tick_=true;
            if(op=="RETURN") {returned=true;continue;}
            if(op=="JUMP" || op=="JUMP_IF_FALSE")merge(code[pc].at("pc").get<std::size_t>(),bits);
            if(op!="JUMP")merge(pc+1,bits);
        }
        require(returned,"IR_NON_TERMINATING");
    }
    return program;
}
}
