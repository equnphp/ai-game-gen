// 每次入口使用新寄存器；暂停保留原Frame，恢复不重复发送已执行的命令。
#include "engine/vm.hpp"
#include <cmath>
#include <limits>

namespace gg::runtime {
namespace {
engine::Vec2 vector(const Json& value) {return {value.at("x").get<double>(),value.at("y").get<double>()};}
Json vector_value(engine::Vec2 value) {require(engine::finite(value),"RUNTIME_NON_FINITE");return {{"x",value.x},{"y",value.y}};}
double finite_number(double value) {require(std::isfinite(value),"RUNTIME_NON_FINITE");return value;}
}
Json VMInstance::bind_value(const Json& typed,const VMHost& host) const {
    validate_typed_value(typed);const auto type=text(typed.at("type"));const auto& value=typed.at("value");
    if((type=="entity" || type=="asset" || type=="document" || type=="subobject") && !value.is_null()) {
        auto bound=host.bind_reference(value);validate_typed_value(Json{{"type",type},{"value",bound}});return bound;
    }
    return value;
}
VMInstance::VMInstance(std::shared_ptr<const VerifiedProgram> program,const Json& overrides,std::shared_ptr<VMHost> host):program_(std::move(program)),host_(std::move(host)) {
    require(program_!=nullptr && host_!=nullptr && overrides.is_object() && overrides.size()<=256,"INVALID_INSTANCE_CONFIG");
    const auto& binding=*host_;
    const auto& ir=program_->ir();
    for(const auto& value:ir.at("constants"))constants_.push_back(bind_value(value,binding));
    for(const auto& variable:ir.at("variables")) {
        const auto id=text(variable.at("id"));descriptions_[id]=&variable;variables_[id]=bind_value(variable.at("initial"),binding);
    }
    for(auto value=overrides.begin();value!=overrides.end();++value) {
        validate_typed_value(value.value());
        require(descriptions_.contains(value.key()) && value.value().at("type")==descriptions_.at(value.key())->at("type"),"INVALID_INSTANCE_CONFIG");
        variables_[value.key()]=bind_value(value.value(),binding);
    }
    for(const auto& instruction:ir.at("code")) {
        if(instruction.at("op")=="INPUT_VEC2")require(binding.supports_input(text(instruction.at("action")),"vec2"),"INPUT_ACTION_UNRESOLVED");
        if(instruction.at("op")=="AUDIO_PLAY")require(binding.supports_audio(text(instruction.at("componentId"))),"AUDIO_SOURCE_UNRESOLVED");
    }
}
VMResult VMInstance::execute(std::size_t entry,const FrameContext& context,InstructionBudget& budget,const DebugControl& debug) {
    VMResult result{VMStatus::failed};
    if(failed_){result.error="INSTANCE_STOPPED";return result;}
    try {
        require(entry<program_->entries().size(),"INVALID_ENTRY");
        if(program_->uses_i32_tick())require(context.tick<=static_cast<std::uint64_t>(INT32_MAX),"TICK_I32_OVERFLOW");
        const auto& range=program_->entries()[entry];const auto& ir=program_->ir();const auto& code=ir.at("code");
        if(!frame_){host_->begin_entry();frame_=Frame{entry,range.begin,context,std::vector<Json>(ir.at("registerTypes").size()),variables_,{},"",false};}
        auto& frame=*frame_;require(frame.entry==entry && frame.context.tick==context.tick,"FRAME_CONTEXT_MISMATCH");
        while(frame.pc<range.end) {
            const auto pc=frame.pc;result.pc=pc;const auto& instruction=code[pc];const auto op=text(instruction.at("op"));
            const auto node=text(ir.at("sourceMap")[pc].at("nodeId"));
            if(!frame.resume_breakpoint && node!=frame.last_node && debug.breakpoints.contains(node)) {
                frame.resume_breakpoint=true;result.status=VMStatus::paused;result.pause_reason="breakpoint";return result;
            }
            frame.resume_breakpoint=false;frame.last_node=node;
            require(budget.instance>0 && budget.world>0,"RUNTIME_INSTRUCTION_LIMIT");--budget.instance;--budget.world;++result.instructions;
            auto read=[&](const char* key)->const Json&{return frame.registers.at(instruction.at(key).get<std::size_t>());};
            auto write=[&](Json value){frame.registers.at(instruction.at("dst").get<std::size_t>())=std::move(value);};
            auto target=pc+1;
            if(op=="CONST")write(constants_.at(instruction.at("k").get<std::size_t>()));
            else if(op=="COPY")write(read("src"));
            else if(op=="VAR_GET")write(frame.variables.at(text(instruction.at("variableId"))));
            else if(op=="VAR_SET") {
                const auto id=text(instruction.at("variableId"));require(descriptions_.at(id)->at("mutable").get<bool>(),"IMMUTABLE_VARIABLE");
                frame.variables[id]=read("src");
            } else if(op=="ADD") {
                const auto type=text(ir.at("registerTypes")[instruction.at("dst").get<std::size_t>()]);
                if(type=="i32") {
                    const auto sum=read("a").get<std::int64_t>()+read("b").get<std::int64_t>();
                    require(sum>=INT32_MIN && sum<=INT32_MAX,"RUNTIME_I32_OVERFLOW");write(sum);
                } else if(type=="vec2")write(vector_value(vector(read("a"))+vector(read("b"))));
                else write(finite_number(read("a").get<double>()+read("b").get<double>()));
            } else if(op=="MUL_F64")write(finite_number(read("a").get<double>()*read("b").get<double>()));
            else if(op=="SCALE_VEC2")write(vector_value(vector(read("a"))*read("b").get<double>()));
            else if(op=="VEC2")write(vector_value({read("x").get<double>(),read("y").get<double>()}));
            else if(op=="LESS_F64")write(read("a").get<double>()<read("b").get<double>());
            else if(op=="AND_BOOL")write(read("a").get<bool>() && read("b").get<bool>());
            else if(op=="TICK")write(static_cast<std::int32_t>(frame.context.tick));
            else if(op=="SELF")write(frame.context.self);
            else if(op=="INPUT_VEC2") {
                const auto action=text(instruction.at("action"));require(frame.context.actions.contains(action),"INPUT_ACTION_UNRESOLVED");
                write(vector_value(frame.context.actions.at(action)));
            } else if(op=="POSITION")write(vector_value(host_->position(read("entity"))));
            else if(op=="TRANSLATE") {
                const auto delta=vector(read("delta"));host_->translate(read("entity"),delta);
                frame.commands.push_back({CommandKind::translate,read("entity"),delta,"",""});
            }
            else if(op=="AUDIO_PLAY")frame.commands.push_back({CommandKind::audio_play,read("entity"),{},text(instruction.at("componentId")),""});
            else if(op=="SIGNAL_EMIT")frame.commands.push_back({CommandKind::signal_emit,nullptr,{},"",text(instruction.at("name"))});
            else if(op=="JUMP")target=instruction.at("pc").get<std::size_t>();
            else if(op=="JUMP_IF_FALSE") {if(!read("condition").get<bool>())target=instruction.at("pc").get<std::size_t>();}
            else if(op=="RETURN") {
                host_->commit_entry(frame.commands);
                variables_=std::move(frame.variables);result.commands=std::move(frame.commands);frame_.reset();result.status=VMStatus::completed;return result;
            } else throw Error("IR_UNSUPPORTED_OPCODE");
            frame.pc=target;
            if(debug.single_instruction){result.status=VMStatus::paused;result.pc=frame.pc;result.pause_reason="single_step";return result;}
        }
        throw Error("IR_JUMP_RANGE");
    } catch(const Error& error) {result.error=error.code;}
    catch(const Json::exception&){result.error="RUNTIME_TYPE_MISMATCH";}
    catch(...){host_->rollback_entry();failed_=true;frame_.reset();throw;}
    host_->rollback_entry();failed_=true;frame_.reset();return result;
}
Json VMInstance::variables() const {
    Json result=Json::object();const auto& state=frame_?frame_->variables:variables_;
    for(const auto& [id,value]:state)result[id]={{"type",descriptions_.at(id)->at("type")},{"value",value}};
    return result;
}
void VMInstance::discard_frame() {host_->rollback_entry();frame_.reset();}
VMCheckpoint VMInstance::checkpoint()const {
    require(!frame_,"FRAME_SUSPENDED");VMCheckpoint saved;
    saved.program_=program_;saved.variables_=variables_;saved.failed_=failed_;return saved;
}
void VMInstance::restore(VMCheckpoint saved) {
    require(saved.program_==program_,"CHECKPOINT_PROGRAM_MISMATCH");discard_frame();
    variables_.swap(saved.variables_);failed_=saved.failed_;
}
void VMInstance::set_variable(const std::string& id,const Json& value) {
    validate_typed_value(value);
    require(descriptions_.contains(id) && descriptions_.at(id)->at("mutable").get<bool>(),"IMMUTABLE_VARIABLE");
    require(value.at("type")==descriptions_.at(id)->at("type"),"TYPE_MISMATCH");
    auto bound=bind_value(value,*host_);
    if(frame_)frame_->variables[id]=std::move(bound);else variables_[id]=std::move(bound);
}
}
