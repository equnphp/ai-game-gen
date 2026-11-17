// WASM Module单actor、单结果槽；pump不覆盖RPC回复，完成回调只排队且禁止重入。
#include "game/game_runtime_v1_1.h"
#include "game/identity.hpp"
#include "engine/port.hpp"
#include "engine/catalog.hpp"
#include "game-build.hpp"
#include <cstdlib>
#include <cstring>
#include <deque>
#include <cmath>
#include <set>
namespace {
using gg::Json;
struct Packet {std::string id,bytes;};
struct State {
    bool busy=false,failed=false,sent=false;
    std::map<void*,std::uint32_t> owned;
    std::size_t owned_bytes=0,queued_bytes=0;
    std::deque<Packet> completed;
    std::set<std::string> queued;
    std::string result;
    std::unique_ptr<gg::runtime::RuntimePort> runtime;
    bool has_frame=false,has_time=false;
    std::uint64_t last_frame=0;
    double last_frame_time=0,last_observed_time=0;
    double last_lifecycle_time=-1;
    std::uint32_t last_maximum=0,flags=0,last_lifecycle=0;
    std::int32_t last_result=0;
};
State& state(){static State value;return value;}
struct Guard {State& state;explicit Guard(State& value):state(value){state.busy=true;}~Guard(){state.busy=false;}};
bool allocation(State& value,const void* pointer,std::uint32_t bytes) {
    const auto found=value.owned.find(const_cast<void*>(pointer));return pointer && found!=value.owned.end() && bytes<=found->second;
}
void fail(State& value)noexcept {
    value.failed=true;value.flags|=4;value.runtime.reset();value.completed.clear();value.queued.clear();value.queued_bytes=0;
}
gg::runtime::RuntimePort& runtime(State& value) {
    if(!value.runtime) {
        gg::runtime::PortConfig config{gg::game::identity_uuid(),gg::game::profile_id,gg::game::profile_hash,gg::game::runtime_build,"wasm",gg::game::development,
            gg::game::identity_uuid,[&value](const Json& request){const auto bytes=request.dump();gg::require(bytes.size()<=2097152,"LIMIT_EXCEEDED");value.sent=true;gg_host_bridge(bytes.data(),static_cast<uint32_t>(bytes.size()));}};
        value.runtime=std::make_unique<gg::runtime::RuntimePort>(std::move(config));
    }
    return *value.runtime;
}
}
uint32_t gg_game_abi_version(){return 0x00010001;}
void* gg_game_alloc(uint32_t bytes) {
    auto& value=state();if(value.busy || value.failed || bytes==0 || bytes>8388608 || value.owned.size()>=128 || bytes>33554432-value.owned_bytes)return nullptr;
    void* buffer=std::malloc(bytes);if(!buffer)return nullptr;
    try{value.owned.emplace(buffer,bytes);value.owned_bytes+=bytes;return buffer;}catch(...){std::free(buffer);return nullptr;}
}
void gg_game_free(void* pointer) {
    if(!pointer)return;auto& value=state();if(value.busy)return;const auto found=value.owned.find(pointer);
    if(found==value.owned.end()){fail(value);return;}value.owned_bytes-=found->second;value.owned.erase(found);std::free(pointer);
}
int32_t gg_game_submit(const void* bytes,uint32_t size) {
    auto& value=state();if(value.busy)return -9;if(value.failed)return -3;
    if(size==0 || size>2097152 || !allocation(value,bytes,size))return -1;if(!value.result.empty())return -2;Guard guard(value);
    try {
        // 在业务动作之前预留最大槽，后续赋值不会因8MiB回复再申请内存。
        value.result.reserve(8388608);auto result=runtime(value).submit({static_cast<const char*>(bytes),size});
        gg::require(result.size()<=8388608,"LIMIT_EXCEEDED");value.result=std::move(result);return 0;
    }catch(const std::bad_alloc&){fail(value);return -4;}
    catch(const gg::Error&){return -1;}
    catch(const Json::exception&){return -1;}
    catch(...){fail(value);return -3;}
}
uint32_t gg_game_result_size(){const auto& value=state();return value.busy?0:static_cast<uint32_t>(value.result.size());}
int32_t gg_game_result_copy(void* output,uint32_t capacity) {
    auto& value=state();if(value.busy)return -9;
    if(value.result.empty() || capacity<value.result.size() || !allocation(value,output,capacity))return -1;
    std::memcpy(output,value.result.data(),value.result.size());return static_cast<int32_t>(value.result.size());
}
void gg_game_result_release(){auto& value=state();if(!value.busy)value.result.clear();}
int32_t gg_game_complete(const void* utf8,uint32_t size) {
    auto& value=state();if(value.busy)return -9;if(value.failed)return -3;
    if(!allocation(value,utf8,size) || size==0 || size>2097152)return -1;
    if(value.completed.size()>=256 || size>8388608-value.queued_bytes)return -5;Guard guard(value);
    try {
        const std::string bytes(static_cast<const char*>(utf8),size);const auto packet=gg::parse(bytes);
        gg::schema_check_definition(packet,gg::contracts::runtime_resources(),"/$defs/result");
        if(!value.runtime || !value.runtime->accepts_completion(packet))return -1;
        const auto id=gg::text(packet.at("requestId"));if(value.queued.contains(id))return -1;
        value.queued.insert(id);try{value.completed.push_back({id,bytes});}catch(...){value.queued.erase(id);throw;}
        value.queued_bytes+=size;return 0;
    }catch(const std::bad_alloc&){fail(value);return -4;}
    catch(...){return -1;}
}
int32_t gg_game_pump(uint32_t low,uint32_t high,double now,uint32_t maximum) {
    auto& value=state();if(value.busy)return -9;if(value.failed)return -3;
    if(!std::isfinite(now) || now<0 || maximum>5)return -1;
    const auto frame=(static_cast<std::uint64_t>(high)<<32)|low;
    if(value.has_frame && frame==value.last_frame)return now==value.last_frame_time && maximum==value.last_maximum?value.last_result:-6;
    if(value.has_frame && frame<value.last_frame)return -7;if(value.has_time && now<value.last_observed_time)return -8;
    Guard guard(value);
    try {
        auto& port=runtime(value);const auto elapsed=value.has_time?now-value.last_observed_time:0;value.sent=false;
        std::size_t packets=0,bytes=0;
        while(!value.completed.empty() && packets<64 && value.completed.front().bytes.size()<=4194304-bytes) {
            auto packet=std::move(value.completed.front());value.completed.pop_front();value.queued.erase(packet.id);value.queued_bytes-=packet.bytes.size();
            bytes+=packet.bytes.size();++packets;auto parsed=gg::parse(packet.bytes);
            if(port.accepts_completion(parsed))port.resource_complete(parsed);
        }
        const auto result=port.advance(elapsed,maximum);gg::require(result<=maximum,"WORLD_INSTRUCTION_BUDGET");
        value.has_frame=true;value.has_time=true;value.last_frame=frame;value.last_frame_time=now;value.last_observed_time=now;value.last_maximum=maximum;value.last_result=result;
        value.flags=port.pending_flags() | (!value.completed.empty()?1U:0U) | (value.sent?8U:0U);return static_cast<int32_t>(result);
    }catch(const std::bad_alloc&){fail(value);return -4;}
    catch(const gg::Error&){fail(value);return -10;}
    catch(...){fail(value);return -3;}
}
uint32_t gg_game_pump_flags(){const auto& value=state();return value.flags | (value.failed?4U:0U);}
int32_t gg_game_lifecycle(uint32_t event,double now) {
    auto& value=state();if(value.busy)return -9;if(value.failed)return -3;
    if(event<1 || event>3 || !std::isfinite(now) || now<0)return -1;if(value.has_time && now<value.last_observed_time)return -8;
    Guard guard(value);
    try {
        if(event!=value.last_lifecycle || now!=value.last_lifecycle_time){if(value.runtime)value.runtime->lifecycle(event);value.last_lifecycle=event;value.last_lifecycle_time=now;}
        value.has_time=true;value.last_observed_time=now;return 0;
    }catch(const std::bad_alloc&){fail(value);return -4;}
    catch(...){fail(value);return -3;}
}
