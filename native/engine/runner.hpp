// 固定步单写执行器；发布帧、入口候选和宿主外部输出分开，暂停不会重复执行指令。
#pragma once
#include "engine/input.hpp"
#include "engine/vm.hpp"
#include "engine/world.hpp"
#include <memory>
namespace gg::runtime {
enum class RunState {ready,running,paused,stopped,failed};
struct PausedLocation {std::string reason,entity,component,graph,node;std::size_t pc=0;};
struct TickReceipt {
    bool completed=false;
    std::uint64_t executed_tick=0,next_tick=0;
    std::vector<RuntimeCommand> outputs;
    Json diagnostics=Json::array();
    std::optional<PausedLocation> paused;
};
struct InputResetReceipt {std::size_t sources=0,future_updates=0;};
class WorldRunner {
    class Impl;
    std::unique_ptr<Impl> impl_;
public:
    WorldRunner(std::string world_id,const Json& bundle,const std::map<std::string,std::string>& ir_blocks,
        const std::string& profile,const std::string& profile_hash);
    ~WorldRunner();
    RunState state()const;
    std::uint64_t next_tick()const;
    void start();void pause();void resume();void stop();
    InputResetReceipt reset_input();
    void discard_candidate_tick();
    void physical_input(const InputSource& source);
    std::uint64_t inject(std::uint64_t at_tick,unsigned player,const Json& actions);
    TickReceipt fixed_step(const DebugControl& debug={});
    const SceneWorld& published_scene()const;
    Json variables(const std::string& entity,const std::string& component)const;
};
}
