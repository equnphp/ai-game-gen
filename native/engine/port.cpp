// 回执、只读帧和事件分别保留；读取不会推进模拟，所有修改只在actor调用栈发生。
#include "engine/port.hpp"
#include "engine/catalog.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <deque>
#include <list>
namespace gg::runtime {
namespace {
using Clock=std::chrono::steady_clock;
const Json& protocol(const std::string& version){return contracts::runtime_port(version);}
void check_method(const Json& value,const std::string& version,const std::string& direction,const std::string& method) {
    require(protocol(version).at("$defs").at(direction).contains(method),"METHOD_NOT_SUPPORTED");
    schema_check_definition(value,protocol(version),"/$defs/"+direction+"/"+method);
}
Json diagnostic(const std::string& code) {
    return {{"code",code},{"severity","error"},{"documentId",nullptr},{"path",nullptr},{"sourceIds",Json::array()},
        {"messageKey","runtime."+code},{"args",Json::object()}};
}
}
class RuntimePort::Impl {
public:
    struct Operation {std::string id,request;unsigned requested=0,completed=0;};
    struct Frame {std::string id,version;std::uint64_t tick=0;Json entities=Json::array();Clock::time_point expires;};
    struct Instance {
        std::string id,state="CREATED",pause_reason="none";
        Json artifact,diagnostics=Json::array();
        std::unique_ptr<BundleLoader> loader;
        std::unique_ptr<WorldRunner> world;
        std::deque<Json> events;
        std::optional<Operation> operation;
        std::optional<Frame> frame;
        std::uint64_t seq=0,receive_seq=0,tick=0;
        double debt=0;
        bool reset_clock=true;
        unsigned hz=60;
    };
    struct Cached {std::string digest,method,result;Json completion=nullptr,lookup_summary=nullptr;std::list<std::string>::iterator order;};
    PortConfig config;
    std::map<std::string,Instance> instances;
    std::map<std::string,Cached> receipts;
    std::list<std::string> lru;
    std::size_t receipt_bytes=0;
    explicit Impl(PortConfig next):config(std::move(next)) {
        require(uuid(config.epoch) && content_hash(config.profile_hash) && config.new_id && config.host_request,"INVALID_PORT_CONFIG");
    }
    void event(Instance& instance,const std::string& kind,const Json& data) {
        require(instance.seq<UINT64_MAX,"EVENT_SEQUENCE_EXHAUSTED");
        Json item={{"seq",std::to_string(instance.seq+1)},{"runtimeId",instance.id},{"bundleHash",instance.artifact.at("manifestHash")},
            {"tick",std::to_string(instance.tick)},{"kind",kind},{"data",data}};
        schema_check_definition(item,protocol("1.1"),"/$defs/event");
        instance.events.push_back(std::move(item));++instance.seq;if(instance.events.size()>256)instance.events.pop_front();
    }
    void state(Instance& instance,const std::string& target,const std::string& reason) {
        if(instance.state==target)return;event(instance,"state_changed",{{"from",instance.state},{"to",target},{"reasonCode",reason}});instance.state=target;
    }
    void fail(Instance& instance,const std::string& code) {
        if(instance.loader)instance.loader->cancel();
        if(instance.diagnostics.size()==256)instance.diagnostics.erase(instance.diagnostics.begin());
        auto value=diagnostic(code);instance.diagnostics.push_back(value);event(instance,"diagnostic",value);finish_operation(instance,"failed");state(instance,"FAILED",code);
    }
    void finish_operation(Instance& instance,const std::string& reason) {
        if(!instance.operation)return;const auto& operation=*instance.operation;
        Json completion={{"kind","step"},{"operationId",operation.id},{"completedTicks",operation.completed},{"reason",reason}};
        if(receipts.contains(operation.request))receipts.at(operation.request).completion=completion;
        event(instance,"step_completed",{{"operationId",operation.id},{"requestedTicks",operation.requested},
            {"completedTicks",operation.completed},{"reason",reason},{"location",nullptr}});
        instance.operation.reset();instance.pause_reason="step_complete";
    }
    void stop(Instance& instance) {
        if(instance.state=="STOPPED")return;finish_operation(instance,"stopped");
        if(instance.loader){instance.loader->cancel();instance.loader.reset();}
        InputResetReceipt reset;
        if(instance.world){instance.world->discard_candidate_tick();reset=instance.world->reset_input();instance.world->stop();instance.world.reset();}
        event(instance,"input_reset",{{"reason","stop"},{"clearedSources",reset.sources},{"cancelledFutureInputs",reset.future_updates}});
        instance.frame.reset();instance.debt=0;instance.pause_reason="none";state(instance,"STOPPED","STOP_REQUESTED");
    }
    Json pending(const Instance& instance)const {
        if(!instance.operation)return nullptr;const auto& operation=*instance.operation;
        return {{"operationId",operation.id},{"kind","step"},{"requestedTicks",operation.requested},{"completedTicks",operation.completed}};
    }
    Json read(Instance& instance,const Json& params,const std::string& version) {
        const auto now=Clock::now();const bool first=params.at("afterEntityId").is_null() && params.at("readSnapshotTick").is_null();
        if(first) {
            if(version=="1.1")require(params.at("readFrameId").is_null(),"CURSOR_EXPIRED");
            if(version=="1.1" || !instance.frame || instance.frame->version!=version || instance.frame->tick!=instance.tick || instance.frame->expires<=now) {
                Frame frame;frame.id=config.new_id();frame.version=version;frame.tick=instance.tick;frame.expires=now+std::chrono::seconds(2);
                if(instance.world && instance.state!="STOPPED") {
                    const auto& scene=instance.world->published_scene();
                    for(const auto& [id,entity]:scene.entities()) {
                        auto value=scene.author_projection(id);
                        if(version=="1.1"){value["worldPosition"]={{"x",entity.world.tx},{"y",entity.world.ty}};value["height"]=entity.definition.plane_height+entity.definition.height_offset;}
                        frame.entities.push_back(std::move(value));
                    }
                }
                instance.frame=std::move(frame);
            }
        } else {
            require(!params.at("afterEntityId").is_null() && !params.at("readSnapshotTick").is_null(),"CURSOR_EXPIRED");
            require(instance.frame && instance.frame->version==version && instance.frame->expires>now && runtime_u64(params.at("readSnapshotTick"))==instance.frame->tick,"CURSOR_EXPIRED");
            if(version=="1.1")require(params.at("readFrameId")==instance.frame->id,"CURSOR_EXPIRED");
        }
        const auto& frame=*instance.frame;const auto after=first?"":text(params.at("afterEntityId"));Json values=Json::array();bool more=false,found=after.empty();
        for(const auto& entity:frame.entities) {
            const auto id=text(entity.at("id"));if(id==after)found=true;if(id<=after)continue;
            if(values.size()==params.at("limit").get<std::size_t>()){more=true;break;}values.push_back(entity);
        }
        require(found,"CURSOR_EXPIRED");
        Json result={{"runtimeId",instance.id},{"state",instance.state},{"tick",std::to_string(instance.tick)},{"bundleHash",instance.artifact.at("manifestHash")},
            {"profileId",config.profile_id},{"readSnapshotTick",std::to_string(frame.tick)},{"entities",values},
            {"nextAfter",more?values.back().at("id"):Json(nullptr)},{"diagnostics",instance.diagnostics}};
        if(version=="1.1") {result["epoch"]=config.epoch;result["readFrameId"]=frame.id;result["nextTick"]=std::to_string(instance.tick);
            result["pauseReason"]=instance.pause_reason;result["pendingOperation"]=pending(instance);}
        return result;
    }
    Json invoke(const Json& request) {
        const auto version=text(request.at("protocolVersion")),method=text(request.at("method"));const auto& params=request.at("params");
        if(method=="runtime.describe") {
            Json methods={"runtime.describe","runtime.create","runtime.start","runtime.pause","runtime.resume","runtime.stop","runtime.dispose",
                "runtime.input","runtime.read","runtime.events.read","runtime.request.lookup"};if(config.development)methods.push_back("runtime.step");
            return {{"apiVersion",version},{"epoch",config.epoch},{"adapterKind",config.adapter},{"runtimeBuild",config.build},
                {"profiles",Json::array({{{"id",config.profile_id},{"hash",config.profile_hash},{"irRevisions",{"1.2"}},
                    {"capabilities",{"scene2-graph1-first-path-1"}}}})}, {"methods",methods},{"debugCapabilities",Json::array()},
                {"limits",{{"inputBytes",2097152},{"outputBytes",8388608},{"eventRing",256},{"eventPage",100},{"entityPage",100},{"requestReceipts",1024},{"maxRuntimes",1}}}};
        }
        if(method=="runtime.request.lookup") {
            const auto id=text(params.at("lookupRequestId"));const bool found=receipts.contains(id) && !receipts.at(id).result.empty();
            require(id!=text(request.at("requestId")),"LOOKUP_SELF_REFERENCE");Json receipt=nullptr;
            if(found) {
                const auto& cached=receipts.at(id);
                if(version=="1.0") {require(cached.method!="runtime.request.lookup","LOOKUP_RECEIPT_UNSUPPORTED");receipt=parse(cached.result,8388608);}
                else if(cached.method=="runtime.request.lookup")receipt={{"kind","lookup"},{"summary",cached.lookup_summary}};
                else receipt={{"kind","operation"},{"requestId",id},{"method",cached.method},{"reply",parse(cached.result,8388608)}};
            }
            Json data={{"lookupRequestId",id},{"status",found?"found":"not_found"},{"receipt",receipt}};
            if(version=="1.1")data["completion"]=found?receipts.at(id).completion:Json(nullptr);return data;
        }
        if(method=="runtime.create") {
            require(instances.empty(),"RUNTIME_LIMIT_EXCEEDED");require(params.at("profileId")==config.profile_id,"RUNTIME_PROFILE_UNSUPPORTED");
            (void)runtime_u64(params.at("seed"));const auto& artifact=params.at("bundle");const auto id=config.new_id();require(uuid(id) && !instances.contains(id),"RNG_UNAVAILABLE");
            Instance instance;instance.id=id;instance.artifact=artifact;
            instance.loader=std::make_unique<BundleLoader>(artifact,config.epoch,id,config.profile_id,config.profile_hash,config.new_id,config.host_request);
            event(instance,"state_changed",{{"from",nullptr},{"to","CREATED"},{"reasonCode","CREATE_ACCEPTED"}});instances.emplace(id,std::move(instance));
            return {{"runtimeId",id},{"state","CREATED"},{"bundleHash",artifact.at("manifestHash")},{"profileId",config.profile_id}};
        }
        const auto id=text(params.at("runtimeId"));require(instances.contains(id),"NOT_FOUND");auto& instance=instances.at(id);
        if(method=="runtime.dispose"){stop(instance);instances.erase(id);return {{"runtimeId",id},{"disposed",true}};}
        if(method=="runtime.stop"){stop(instance);return {{"runtimeId",id},{"state","STOPPED"},{"tick",std::to_string(instance.tick)}};}
        if(method=="runtime.read")return read(instance,params,version);
        if(method=="runtime.events.read") {
            const auto after=runtime_u64(params.at("afterSeq"));Json events=Json::array();std::uint64_t next=after;
            for(const auto& event:instance.events)if(runtime_u64(event.at("seq"))>after && events.size()<params.at("limit").get<std::size_t>()){
                auto value=event;if(version=="1.0" && value.at("kind")=="input_reset"){value["kind"]="diagnostic";value["data"]=diagnostic("INPUT_RESET");}
                events.push_back(std::move(value));next=runtime_u64(event.at("seq"));
            }
            const auto oldest=instance.events.empty()?0:runtime_u64(instance.events.front().at("seq"));
            return {{"runtimeId",id},{"events",events},{"nextSeq",std::to_string(next)},{"gap",after!=0 && oldest>0 && after<oldest-1},
                {"oldestSeq",std::to_string(oldest)},{"latestSeq",std::to_string(instance.seq)}};
        }
        if(method=="runtime.start" || method=="runtime.pause" || method=="runtime.resume") {
            const auto expected=method=="runtime.start"?"READY":method=="runtime.pause"?"RUNNING":"PAUSED";
            require(instance.state==expected && !instance.operation,"RUNTIME_STATE_INVALID");
            if(method=="runtime.start")instance.world->start();else if(method=="runtime.pause")instance.world->pause();else instance.world->resume();
            const auto target=method=="runtime.pause"?"PAUSED":"RUNNING";instance.pause_reason=method=="runtime.pause"?"user":"none";
            instance.reset_clock=true;instance.debt=0;
            state(instance,target,"USER_REQUESTED");return {{"runtimeId",id},{"state",target},{"tick",std::to_string(instance.tick)}};
        }
        if(method=="runtime.input") {
            require(instance.state=="RUNNING","RUNTIME_STATE_INVALID");require(instance.receive_seq<UINT64_MAX,"INPUT_SEQUENCE_EXHAUSTED");
            instance.receive_seq=instance.world->inject(runtime_u64(params.at("atTick")),params.at("player").get<unsigned>(),params.at("actions"));Json actions=Json::array();
            for(auto action=params.at("actions").begin();action!=params.at("actions").end();++action)actions.push_back(action.key());
            return {{"runtimeId",id},{"atTick",params.at("atTick")},{"acceptedActions",actions},{"receiveSeq",std::to_string(instance.receive_seq)}};
        }
        if(method=="runtime.step") {
            require(config.development,"DEV_ONLY");require(instance.state=="PAUSED" && !instance.operation,"RUNTIME_STATE_INVALID");
            Operation operation{config.new_id(),text(request.at("requestId")),params.at("ticks").get<unsigned>(),0};
            auto data=Json{{"runtimeId",id},{"operationId",operation.id},{"requestedTicks",operation.requested},{"acceptedAtTick",std::to_string(instance.tick)}};
            instance.operation=std::move(operation);return data;
        }
        if(method=="runtime.writeback.plan")throw Error(config.development?"WRITEBACK_UNAVAILABLE":"DEV_ONLY");
        throw Error(config.development?"CAPABILITY_NOT_IMPLEMENTED":"DEV_ONLY");
    }
    void trim(std::size_t bytes) {
        require(bytes<=8388608,"LIMIT_EXCEEDED");
        while(!lru.empty() && (receipts.size()>=1024 || receipt_bytes+bytes>16777216)) {
            auto found=receipts.find(lru.front());receipt_bytes-=found->second.result.size();receipts.erase(found);lru.pop_front();
        }
    }
};
RuntimePort::RuntimePort(PortConfig config):impl_(std::make_unique<Impl>(std::move(config))){}
RuntimePort::~RuntimePort()=default;
std::string RuntimePort::submit(std::string_view raw) {
    auto request=parse(raw);require(request.is_object() && request.contains("requestId") && uuid(text(request.at("requestId"))),"INVALID_MESSAGE");
    const auto id=text(request.at("requestId")),version=text(request.at("protocolVersion")),method=text(request.at("method"));
    auto rejected=[&](const std::string& code){return Json{{"protocolVersion",version},{"requestId",id},{"ok",false},
        {"error",{{"code",code},{"messageKey","runtime."+code},{"outcome","not_submitted"},{"retryable",false}}}}.dump();};
    try{check_method(request,version,"requests",method);}catch(const Error& error){return rejected(error.code);}
    const auto digest=hash(request.dump());
    if(impl_->receipts.contains(id)) {
        auto& cached=impl_->receipts.at(id);if(cached.digest!=digest)return rejected("REQUEST_ID_CONFLICT");impl_->lru.splice(impl_->lru.end(),impl_->lru,cached.order);return cached.result;
    }
    Json reply;
    try{reply={{"protocolVersion",version},{"requestId",id},{"ok",true},{"data",impl_->invoke(request)}};}
    catch(const Error& error){reply={{"protocolVersion",version},{"requestId",id},{"ok",false},{"error",{{"code",error.code},{"messageKey","runtime."+error.code},{"outcome","known_failure"},{"retryable",false}}}};}
    try{check_method(reply,version,"replies",method);}catch(...){throw std::logic_error("RUNTIME_REPLY_SCHEMA_INVALID");}
    auto result=reply.dump();impl_->trim(result.size());impl_->lru.push_back(id);
    Json summary=nullptr;
    if(method=="runtime.request.lookup") {
        const bool success=reply.at("ok").get<bool>();const auto target=text(request.at("params").at("lookupRequestId"));
        Json receipt_target=nullptr,completion_id=nullptr;
        if(success && reply.at("data").at("status")=="found") {
            receipt_target=target;
            if(reply.at("data").contains("completion") && !reply.at("data").at("completion").is_null())completion_id=reply.at("data").at("completion").at("operationId");
        }
        summary={{"requestId",id},{"protocolVersion",version},{"method",method},{"requestHash",digest},{"replyHash",hash(result)},{"targetRequestId",target},
            {"outcome",success?"ok":"error"},{"status",success?reply.at("data").at("status"):Json(nullptr)},
            {"errorCode",success?Json(nullptr):reply.at("error").at("code")},{"receiptTargetRequestId",receipt_target},{"completionOperationId",completion_id}};
    }
    try{impl_->receipts.emplace(id,Impl::Cached{digest,method,result,nullptr,summary,std::prev(impl_->lru.end())});}
    catch(...){impl_->lru.pop_back();throw;}impl_->receipt_bytes+=result.size();return result;
}
void RuntimePort::resource_complete(const Json& result) {
    const auto id=text(result.at("runtimeId"));require(impl_->instances.contains(id),"RESOURCE_EPOCH_MISMATCH");auto& instance=impl_->instances.at(id);
    require(instance.state=="LOADING" && instance.loader,"RESOURCE_LOADER_INACTIVE");
    try{instance.loader->complete(result);}catch(const Error& error){if(instance.loader->failed())impl_->fail(instance,error.code);else throw;}
}
bool RuntimePort::accepts_completion(const Json& result)const {
    if(!result.is_object() || !result.contains("runtimeId") || !result.at("runtimeId").is_string())return false;
    const auto id=text(result.at("runtimeId"));const auto found=impl_->instances.find(id);
    return found!=impl_->instances.end() && found->second.state=="LOADING" && found->second.loader && found->second.loader->accepts(result);
}
unsigned RuntimePort::advance(double elapsed,unsigned maximum) {
    require(std::isfinite(elapsed) && elapsed>=0 && maximum<=5,"INVALID_FRAME_TIME");unsigned total=0;
    for(auto& [id,instance]:impl_->instances) {
        try {
            if(instance.state=="CREATED")impl_->state(instance,"LOADING","RESOURCE_LOADING");
            if(instance.state=="LOADING") {
                instance.loader->pump();if(instance.loader->ready()) {
                    instance.hz=instance.loader->bundle().at("fixedStepHz");
                    instance.world=std::make_unique<WorldRunner>(impl_->config.new_id(),instance.loader->bundle(),instance.loader->ir_blocks(),impl_->config.profile_id,impl_->config.profile_hash);
                    instance.loader.reset();impl_->state(instance,"READY","RESOURCE_READY");
                }
            }
            if(instance.state!="RUNNING" && !instance.operation)continue;
            if(instance.state=="RUNNING") {
                if(instance.reset_clock){instance.reset_clock=false;instance.debt=0;}
                else instance.debt+=elapsed;
                require(std::isfinite(instance.debt),"RUNTIME_LAG");
                if(instance.debt>250) {
                    impl_->event(instance,"slow_frame",{{"debtMs",instance.debt},{"catchupTicks",0}});
                    auto value=diagnostic("RUNTIME_LAG");if(instance.diagnostics.size()==256)instance.diagnostics.erase(instance.diagnostics.begin());
                    instance.diagnostics.push_back(value);impl_->event(instance,"diagnostic",value);instance.world->pause();
                    instance.debt=0;instance.reset_clock=true;instance.pause_reason="runtime_lag";impl_->state(instance,"PAUSED","RUNTIME_LAG");continue;
                }
            }
            const double step=1000.0/instance.hz;unsigned completed=0;
            while(completed<maximum && (instance.operation || (instance.state=="RUNNING" && instance.debt>=step))) {
                auto receipt=instance.world->fixed_step();
                for(const auto& issue:receipt.diagnostics) {
                    auto value=diagnostic(text(issue.at("code")));if(instance.diagnostics.size()==256)instance.diagnostics.erase(instance.diagnostics.begin());
                    instance.diagnostics.push_back(value);impl_->event(instance,"diagnostic",value);
                }
                if(instance.world->state()==RunState::failed){impl_->fail(instance,"WORLD_FAILED");break;}
                require(receipt.completed,"RUNTIME_STATE_INVALID");instance.tick=receipt.next_tick;++completed;
                if(instance.operation){if(++instance.operation->completed==instance.operation->requested){impl_->finish_operation(instance,"completed");break;}}
                else instance.debt-=step;
            }
            total+=completed;if(completed)impl_->event(instance,"tick_completed",{{"completedTicks",std::to_string(completed)},{"nextTick",std::to_string(instance.tick)}});
            if(instance.state=="RUNNING" && instance.debt>=step)impl_->event(instance,"slow_frame",{{"debtMs",instance.debt},{"catchupTicks",completed}});
        }catch(const Error& error){impl_->fail(instance,error.code);}
    }
    return total;
}
unsigned RuntimePort::pending_flags()const {
    unsigned result=0;for(const auto& [id,instance]:impl_->instances) {
        if(instance.state=="CREATED" || instance.state=="LOADING")result|=1;
        if(instance.state=="RUNNING" || instance.operation)result|=2;
    }
    return result;
}
void RuntimePort::lifecycle(unsigned event) {
    require(event>=1 && event<=3,"INVALID_LIFECYCLE_EVENT");
    for(auto& [id,instance]:impl_->instances) {
        instance.reset_clock=true;instance.debt=0;
        if(event==2)continue;
        InputResetReceipt reset;if(instance.world) {instance.world->discard_candidate_tick();reset=instance.world->reset_input();}
        if(event==1) {
            impl_->finish_operation(instance,"cancelled");
            if(instance.state=="RUNNING") {instance.world->pause();instance.pause_reason="host_background";impl_->state(instance,"PAUSED","HOST_BACKGROUND");}
        }
        // Schema的事件增量与ABI1.1一起登记；没有输入内容或平台对象进入事件。
        impl_->event(instance,"input_reset",{{"reason",event==1?"host_background":"focus_lost"},{"clearedSources",reset.sources},{"cancelledFutureInputs",reset.future_updates}});
    }
}
}
