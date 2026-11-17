// 输入状态按player/source隔离；编辑器快捷键与游戏输入必须由宿主分别路由。
#pragma once
#include "core/schema/value.hpp"
#include "engine/math2d.hpp"
#include <map>
#include <string>
#include <vector>
#include <set>
#include <tuple>
namespace gg::runtime {
enum class InputFamily { button, axis, position, delta };
struct InputControl {
    InputFamily family;
    std::string channel;
    int component = -1;
};
InputControl describe_control(const std::string& device, const std::string& control);
void validate_input_map(const Json& body);
InputFamily action_family(const Json& action);
struct InputSample {Json values=Json::object();std::map<std::string,std::uint64_t> position_orders;};
struct InputSource {
    unsigned player = 0;
    std::string device, source_id, control;
    double value = 0;
    std::uint64_t sequence = 0;
    // 仅虚拟控件填写目标action，物理键和手柄按InputMap统一映射。
    std::string action;
    bool game_plane_position = false;
    // actor分配的全局接收序，仅用于position跨来源决胜；sequence仍负责源内去重。
    std::uint64_t receive_order=0;
};
class InputRouter {
    struct Key {
        unsigned player;
        std::string device, source, channel, action;
        auto operator<=>(const Key&) const = default;
    };
    struct Channel { double value; std::uint64_t sequence; bool position; InputFamily family;std::uint64_t receive_order; };
    std::map<Key, Channel> channels_;
public:
    void feed(const InputSource& source);
    void gamepad_stick(unsigned player, const std::string& source, unsigned stick, engine::Vec2 axes, std::uint64_t sequence);
    Json sample(unsigned player, const Json& input_map) const;
    // 未归一化轴值用于与独立RPC源合并，归一化只在所有来源相加后做一次。
    InputSample sample_sources(unsigned player,const Json& input_map)const;
    void release_source(unsigned player, const std::string& device, const std::string& source);
    void release_all();
    void finish_tick();
    std::set<std::tuple<unsigned,std::string,std::string>> sources()const;
};
}
