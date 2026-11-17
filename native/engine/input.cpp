// 控制名来自compatibility-input.1；不把任意字符串透传到系统API。
#include "engine/input.hpp"
#include <algorithm>
#include <cmath>
#include <set>

namespace gg::runtime {
namespace {
const std::set<std::string> keyboard_codes{
    "KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space",
    "Enter","Escape","ShiftLeft","ShiftRight","ControlLeft","ControlRight","AltLeft","AltRight",
    "Tab","Backspace","KeyE","KeyQ","KeyR","KeyF","Digit0","Digit1","Digit2","Digit3",
    "Digit4","Digit5","Digit6","Digit7","Digit8","Digit9"};
std::pair<std::string,int> axis_suffix(const std::string& control) {
    if (control.ends_with("/x")) return {control.substr(0,control.size()-2),0};
    if (control.ends_with("/y")) return {control.substr(0,control.size()-2),1};
    return {control,-1};
}
bool index_control(const std::string& value, const std::string& prefix, unsigned maximum) {
    if (!value.starts_with(prefix)) return false;
    const auto number = value.substr(prefix.size());
    if (number.empty() || number.size() > 2 || (number.size() > 1 && number.front() == '0')) return false;
    unsigned result = 0;
    for (char digit : number) { if (digit < '0' || digit > '9') return false; result=result*10+digit-'0'; }
    return result <= maximum;
}
}
InputControl describe_control(const std::string& device, const std::string& control) {
    const auto [base,axis] = axis_suffix(control);
    if (device == "keyboard") {
        require(base.starts_with("key/") && keyboard_codes.contains(base.substr(4)), "UNSUPPORTED_CAPABILITY");
        return {axis < 0 ? InputFamily::button : InputFamily::axis,base,axis};
    }
    if (device == "gamepad") {
        if (index_control(base,"axis/",3)) return {InputFamily::axis,base,axis};
        require(index_control(base,"button/",16), "UNSUPPORTED_CAPABILITY");
        return {axis < 0 ? InputFamily::button : InputFamily::axis,base,axis};
    }
    if (device == "pointer") {
        if (control == "button/0" || control == "button/1" || control == "button/2")
            return {InputFamily::button,control,-1};
        require(axis >= 0 && (base == "position" || base == "delta" || base == "wheel"), "UNSUPPORTED_CAPABILITY");
        return {base == "position" ? InputFamily::position : InputFamily::delta,control,axis};
    }
    if (device == "touch") {
        if (control == "primary/pressed" || control == "virtual/button/pressed") return {InputFamily::button,control,-1};
        require(axis >= 0 && (base == "primary/position" || base == "virtual/stick" || base == "virtual/dpad"), "UNSUPPORTED_CAPABILITY");
        return {base == "primary/position" ? InputFamily::position : InputFamily::axis,control,axis};
    }
    throw Error("UNSUPPORTED_CAPABILITY");
}
void validate_input_map(const Json& body) {
    std::set<std::string> names;
    for (auto entry=body.at("actions").begin();entry!=body.at("actions").end();++entry) {
        require(uuid(entry.key()),"INVALID_ACTION_ID");const auto& action=entry.value();
        if(action.contains("name"))require(names.insert(text(action.at("name"))).second, "INVALID_REFERENCE");
        const auto type = text(action.at("valueType"));
        std::optional<InputFamily> family;
        std::map<std::pair<std::string,std::string>,unsigned> position_axes;
        for (const auto& binding : action.at("bindings")) {
            const auto device = text(binding.at("device")), name = text(binding.at("control"));
            const auto control = describe_control(device,name);
            const auto scale = binding.at("scale").get<double>();
            require(std::isfinite(scale) && scale >= -10 && scale <= 10, "LIMIT_EXCEEDED");
            if (type == "bool") require(control.family == InputFamily::button && scale == 1, "TYPE_MISMATCH");
            else if (type == "vec2") require(control.component >= 0 && control.family != InputFamily::button, "TYPE_MISMATCH");
            else require(type == "f64" && control.component < 0 &&
                (control.family == InputFamily::button || control.family == InputFamily::axis), "TYPE_MISMATCH");
            if (family) require(*family == control.family, "TYPE_MISMATCH");
            family = control.family;
            if (control.family == InputFamily::position) {
                require(scale == 1, "TYPE_MISMATCH");
                position_axes[{device,axis_suffix(name).first}] |= 1u << control.component;
            }
        }
        for (const auto& [key,axes] : position_axes) require(axes == 3, "TYPE_MISMATCH");
    }
}
void InputRouter::feed(const InputSource& source) {
    require(source.player < 8 && !source.source_id.empty() && source.source_id.size() <= 128 &&
        (source.action.empty() || uuid(source.action)) && std::isfinite(source.value), "INVALID_MESSAGE");
    const auto control = describe_control(source.device,source.control);
    require(control.family != InputFamily::position || source.game_plane_position, "INVALID_REFERENCE");
    if (control.family == InputFamily::button) require(source.value >= 0 && source.value <= 1, "RANGE_ERROR");
    if (control.family == InputFamily::axis) require(source.value >= -1 && source.value <= 1, "RANGE_ERROR");
    // 后缀只决定输出分量，键盘/手柄保存的是同一物理通道，避免重复按下或重复deadzone。
    const Key key{source.player,source.device,source.source_id,control.channel,source.action};
    const auto existing = channels_.find(key);
    if (existing != channels_.end() && source.sequence <= existing->second.sequence) return;
    auto value = source.value;
    if (control.family == InputFamily::delta && existing != channels_.end()) value += existing->second.value;
    require(std::isfinite(value), "LIMIT_EXCEEDED");
    require(existing != channels_.end() || channels_.size() < 4096, "LIMIT_EXCEEDED");
    channels_[key] = {value,source.sequence,source.game_plane_position,control.family};
}
void InputRouter::gamepad_stick(unsigned player, const std::string& source, unsigned stick, engine::Vec2 axes, std::uint64_t sequence) {
    require(stick < 2 && engine::finite(axes) && std::abs(axes.x) <= 1 && std::abs(axes.y) <= 1, "RANGE_ERROR");
    const auto radius = engine::length(axes);
    if (radius <= 0.15) axes = {};
    else axes = axes * ((std::min(radius,1.0)-0.15)/(0.85*radius));
    feed({player,"gamepad",source,"axis/"+std::to_string(stick*2),axes.x,sequence});
    feed({player,"gamepad",source,"axis/"+std::to_string(stick*2+1),axes.y,sequence});
}
Json InputRouter::sample(unsigned player, const Json& input_map) const {
    require(player < 8, "RANGE_ERROR");
    validate_input_map(input_map);
    Json output = Json::object();
    for (auto entry=input_map.at("actions").begin();entry!=input_map.at("actions").end();++entry) {
        const auto name=entry.key();const auto& action=entry.value();const auto type = text(action.at("valueType"));
        engine::Vec2 vector{};
        double scalar = 0;
        bool pressed = false;
        std::optional<InputFamily> family;
        struct Position {engine::Vec2 value{};std::uint64_t sequence=0;unsigned axes=0;};
        std::map<std::pair<std::string,std::string>,Position> positions;
        for (const auto& binding : action.at("bindings")) {
            const auto device = text(binding.at("device"));
            const auto control = describe_control(device,text(binding.at("control")));
            const auto scale = binding.at("scale").get<double>();
            family = control.family;
            for (const auto& [key,channel] : channels_) {
                if (key.player != player || key.device != device || key.channel != control.channel ||
                    (!key.action.empty() && key.action != name)) continue;
                const auto value = channel.value * scale;
                if (control.family == InputFamily::position) {
                    auto& position = positions[{key.device,key.source}];
                    (control.component == 0 ? position.value.x : position.value.y) = value;
                    position.sequence = std::max(position.sequence,channel.sequence);
                    position.axes |= 1u << control.component;
                } else if (type == "bool") pressed = pressed || value > 0;
                else if (type == "f64") scalar += value;
                else (control.component == 0 ? vector.x : vector.y) += value;
            }
        }
        if (family == InputFamily::position) {
            const Position* selected = nullptr;
            // 有序map使同序输入按sourceId稳定决胜，不把两个触点的x/y拼在一起。
            for (const auto& [source,position] : positions)
                if (position.axes == 3 && (!selected || position.sequence > selected->sequence)) selected = &position;
            if (selected) vector = selected->value;
        }
        if (type == "bool") output[name] = pressed;
        else if (type == "f64") output[name] = std::clamp(scalar,-1.0,1.0);
        else {
            if (family == InputFamily::axis && engine::length(vector) > 1) vector = vector * (1 / engine::length(vector));
            require(engine::finite(vector), "LIMIT_EXCEEDED");
            output[name] = {{"x",vector.x},{"y",vector.y}};
        }
    }
    return output;
}
void InputRouter::release_source(unsigned player, const std::string& device, const std::string& source) {
    std::erase_if(channels_,[&](const auto& entry) { return entry.first.player == player && entry.first.device == device && entry.first.source == source; });
}
void InputRouter::release_all() { channels_.clear(); }
void InputRouter::finish_tick() {
    std::erase_if(channels_,[](const auto& entry) { return entry.second.family == InputFamily::delta; });
}
}
