// VM实例独立持有变量；输出是类型化命令，不能直接写作者数据库或调用平台API。
#pragma once
#include "engine/ir.hpp"
#include "engine/math2d.hpp"
#include <memory>
#include <optional>
#include <set>
namespace gg::runtime {
enum class CommandKind {translate,audio_play,signal_emit};
struct RuntimeCommand {
    CommandKind kind;
    Json entity;
    engine::Vec2 delta{};
    std::string component_id,name;
};
class VMHost {
public:
    virtual ~VMHost()=default;
    // 绑定失败/歧义必须报错，不按名称或任意第一个实例猜测引用。
    virtual Json bind_reference(const Json& author_reference) const=0;
    virtual engine::Vec2 position(const Json& runtime_reference) const=0;
    virtual bool supports_input(const std::string& action,const std::string& type) const=0;
    virtual bool supports_audio(const std::string& component) const=0;
    // 变换立即作用于World候选；POSITION可见，外部IO仍在整个tick成功后提交。
    virtual void begin_entry()=0;
    virtual void translate(const Json& entity,engine::Vec2 delta)=0;
    virtual void commit_entry(const std::vector<RuntimeCommand>& commands)=0;
    virtual void rollback_entry() noexcept=0;
};
struct FrameContext {
    std::uint64_t tick=0;
    Json self;
    std::map<std::string,engine::Vec2> actions;
};
struct InstructionBudget {std::size_t instance=10000,world=200000;};
struct DebugControl {std::set<std::string> breakpoints;bool single_instruction=false;};
enum class VMStatus {completed,paused,failed};
struct VMResult {
    VMStatus status;
    std::size_t instructions=0,pc=0;
    std::string error;
    std::string pause_reason;
    std::vector<RuntimeCommand> commands;
};
class VMCheckpoint {
    friend class VMInstance;
    std::shared_ptr<const VerifiedProgram> program_;
    std::map<std::string,Json> variables_;
    bool failed_=false;
    VMCheckpoint()=default;
public:
    VMCheckpoint(const VMCheckpoint&)=default;
    VMCheckpoint(VMCheckpoint&&)=default;
    VMCheckpoint& operator=(VMCheckpoint&&)=default;
};
class VMInstance {
    struct Frame {
        std::size_t entry,pc;
        FrameContext context;
        std::vector<Json> registers;
        std::map<std::string,Json> variables;
        std::vector<RuntimeCommand> commands;
        std::string last_node;
        bool resume_breakpoint=false;
    };
    std::shared_ptr<const VerifiedProgram> program_;
    std::shared_ptr<VMHost> host_;
    std::map<std::string,Json> variables_;
    std::map<std::string,const Json*> descriptions_;
    std::vector<Json> constants_;
    std::optional<Frame> frame_;
    bool failed_=false;
    Json bind_value(const Json& typed,const VMHost& host) const;
public:
    VMInstance(std::shared_ptr<const VerifiedProgram> program,const Json& initial_overrides,std::shared_ptr<VMHost> host);
    VMResult execute(std::size_t entry,const FrameContext& context,InstructionBudget& budget,const DebugControl& debug={});
    Json variables() const;
    bool has_suspended_frame() const {return frame_.has_value();}
    bool failed()const{return failed_;}
    VMCheckpoint checkpoint()const;
    void restore(VMCheckpoint checkpoint);
    void discard_frame();
    void set_variable(const std::string& id,const Json& value);
};
}
