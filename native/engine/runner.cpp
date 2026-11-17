// 固定订阅集合按作者ordinal排序；入口失败只撤销入口，全局失败交换回上一发布帧。
#include "engine/runner.hpp"
#include "engine/catalog.hpp"
#include <algorithm>
#include <cmath>
#include <tuple>

namespace gg::runtime {
class WorldRunner::Impl {
    friend class WorldRunner;
    struct ActionUpdate {Json value;std::uint64_t sequence;InputFamily family;};
    using PlayerActions=std::map<unsigned,std::map<std::string,ActionUpdate>>;
    struct Binding;
    struct Behavior {
        std::string entity,component,controller;
        std::uint32_t ordinal=0;
        std::shared_ptr<const VerifiedProgram> program;
        std::shared_ptr<Binding> binding;
        std::unique_ptr<VMInstance> vm;
        std::map<std::string,std::size_t> entries;
        std::map<std::string,engine::Vec2> previous_actions;
        bool started=false;
    };
    struct Signal {std::uint64_t sequence,emit_tick;std::string name;};
    struct Invocation {std::size_t behavior,entry;std::string action;};
    struct Work {
        std::unique_ptr<SceneWorld> previous;
        std::vector<VMCheckpoint> checkpoints;
        std::vector<FrameContext> contexts;
        std::vector<std::size_t> budgets;
        std::vector<Invocation> input_calls;
        std::optional<Invocation> active;
        std::vector<Signal> emitted;
        std::vector<RuntimeCommand> outputs;
        Json diagnostics=Json::array();
        std::size_t world_budget=200000,phase=0,cursor=0,signal_cursor=0,subscriber_cursor=0,deliveries=0;
        std::uint64_t signal_sequence=0;
        bool rollback_failed=false;
        PlayerActions rpc_actions;
    };
    struct Binding final:VMHost {
        Impl& owner;std::size_t index;
        bool active=false;
        std::map<std::string,RuntimeTransform> undo;
        Binding(Impl& value,std::size_t behavior):owner(value),index(behavior){}
        Json bind_reference(const Json& ref)const override {
            const auto kind=text(ref.at("kind")),id=text(ref.at("id")),type=text(ref.at("type"));
            if(kind=="entity")return owner.scene->bind_entity(ref);
            if(kind=="asset")require(owner.assets.contains(id) && owner.assets.at(id)==type,"RUNTIME_INVALID_REFERENCE");
            else if(kind=="document")require(owner.documents.contains(id) && owner.documents.at(id)==type,"RUNTIME_INVALID_REFERENCE");
            else throw Error("CAPABILITY_NOT_IMPLEMENTED");
            return ref;
        }
        engine::Vec2 position(const Json& ref)const override{return owner.scene->position(ref);}
        bool supports_input(const std::string& action,const std::string& type)const override {
            const auto& behavior=owner.behaviors[index];if(behavior.controller.empty())return false;
            const auto& control=owner.components.at(behavior.controller).at("data");
            const auto map=text(control.at("map").at("id"));const auto& actions=owner.bundle.at("inputMaps").at(map).at("actions");
            return actions.contains(action) && actions.at(action).at("valueType")==type;
        }
        bool supports_audio(const std::string&)const override{return false;}
        void begin_entry()override{require(!active && owner.work!=nullptr,"ENTRY_STATE_INVALID");undo.clear();active=true;}
        void translate(const Json& ref,engine::Vec2 delta)override {
            require(active,"ENTRY_STATE_INVALID");(void)owner.scene->position(ref);const auto id=text(ref.at("id"));
            undo.try_emplace(id,owner.scene->entity(id).transform);owner.scene->translate({{id,delta}});
        }
        void commit_entry(const std::vector<RuntimeCommand>& commands)override {
            require(active && owner.work!=nullptr,"ENTRY_STATE_INVALID");auto& current=*owner.work;
            std::size_t emits=0;
            for(const auto& command:commands) {
                if(command.kind==CommandKind::signal_emit)++emits;
                if(command.kind==CommandKind::audio_play)throw Error("CAPABILITY_NOT_IMPLEMENTED");
            }
            require(current.emitted.size()+emits<=1024 && current.emitted.size()+emits<=4096,"SIGNAL_BUDGET_EXCEEDED");
            require(current.signal_sequence<=UINT64_MAX-emits,"SIGNAL_SEQUENCE_EXHAUSTED");
            // 预留完成后才改变计数；分配失败由整个tick的事务边界处理。
            current.emitted.reserve(current.emitted.size()+emits);
            for(const auto& command:commands) {
                if(command.kind==CommandKind::signal_emit)current.emitted.push_back({++current.signal_sequence,owner.tick,command.name});
            }
            undo.clear();active=false;
        }
        void rollback_entry()noexcept override {
            if(!active)return;
            try{if(!undo.empty())owner.scene->set_local_transforms(undo);}catch(...){if(owner.work)owner.work->rollback_failed=true;}
            undo.clear();active=false;
        }
    };
public:
    Json bundle;
    std::shared_ptr<SceneWorld> scene;
    std::map<std::string,Json> components;
    std::map<std::string,std::string> assets,documents;
    std::vector<Behavior> behaviors;
    InputRouter input;
    std::optional<InputRouter> paused_physical;
    PlayerActions rpc_actions;
    std::map<std::uint64_t,PlayerActions> injected;
    std::uint64_t receive_sequence=0;
    std::vector<Signal> pending;
    std::unique_ptr<Work> work;
    RunState state=RunState::ready;
    std::uint64_t tick=0,signal_sequence=0;
    Impl(std::string world,const Json& data,const std::map<std::string,std::string>& blocks,const std::string& profile,const std::string& profile_hash):bundle(data) {
        require(bundle.dump().size()<=8388608,"BUNDLE_LIMIT_EXCEEDED");schema_check(bundle,contracts::runtime_bundle());
        require(bundle.at("runtimeProfileId")==profile && bundle.at("runtimeProfileHash")==profile_hash && content_hash(profile_hash) &&
            bundle.at("catalogHash")==contracts::graph_nodes_hash(),"BUNDLE_PROFILE_MISMATCH");
        const auto scene_id=text(bundle.at("scene").at("documentId"));require(bundle.at("entrySceneId")==scene_id,"BUNDLE_SCENE_MISMATCH");
        std::set<std::string> identities{scene_id};
        documents[scene_id]="scene";
        std::map<std::string,Json> block_index;
        for(const auto& block:bundle.at("blocks"))require(block_index.emplace(text(block.at("hash")),block).second,"BUNDLE_DUPLICATE_BLOCK");
        for(const auto& asset:bundle.at("assets")) {
            require(identities.insert(text(asset.at("assetId"))).second,"BUNDLE_DUPLICATE_IDENTITY");
            const auto hash=text(asset.at("blockHash")),media=text(asset.at("mediaType"));
            require(block_index.contains(hash) && block_index.at(hash).at("purpose")=="asset" &&
                block_index.at(hash).at("bytes")==asset.at("bytes"),"BUNDLE_ASSET_MISSING");
            const auto type=media.starts_with("image/")?"image":media.starts_with("audio/")?"audio":media.starts_with("font/")?"font":"binary";
            require(assets.emplace(text(asset.at("assetId")),type).second,"BUNDLE_DUPLICATE_ASSET");
        }
        std::map<std::string,std::shared_ptr<const VerifiedProgram>> programs;
        for(const auto& graph:bundle.at("graphs")) {
            require(identities.insert(text(graph.at("documentId"))).second,"BUNDLE_DUPLICATE_IDENTITY");
            const auto key=text(graph.at("graphIRHash"));require(block_index.contains(key) && block_index.at(key).at("purpose")=="graph_ir" && blocks.contains(key),"BUNDLE_IR_MISSING");
            const auto& raw=blocks.at(key);require(hash(raw)==key && decimal(block_index.at(key).at("bytes"))==raw.size(),"HASH_MISMATCH");auto ir=parse(raw,1048576);
            require(ir.at("documentId")==graph.at("documentId") && ir.at("sourceVersion")==graph.at("sourceVersion"),"BUNDLE_IR_MISMATCH");
            auto execution=ir;execution.erase("sourceVersion");execution.erase("sourceMap");require(hash(execution.dump())==text(graph.at("irExecutionHash")),"HASH_MISMATCH");
            auto verified=std::make_shared<const VerifiedProgram>(verify_ir(ir,profile));
            std::set<std::string> node_ids;for(const auto& source:ir.at("sourceMap"))node_ids.insert(text(source.at("nodeId")));
            for(const auto& node:node_ids)require(identities.insert(node).second,"BUNDLE_DUPLICATE_IDENTITY");
            for(const auto& variable:ir.at("variables"))require(identities.insert(text(variable.at("id"))).second,"BUNDLE_DUPLICATE_IDENTITY");
            require(programs.emplace(key,std::move(verified)).second,"BUNDLE_DUPLICATE_GRAPH");documents[text(graph.at("documentId"))]="graph";
        }
        for(auto map=bundle.at("inputMaps").begin();map!=bundle.at("inputMaps").end();++map){
            require(identities.insert(map.key()).second,"BUNDLE_DUPLICATE_IDENTITY");validate_input_map(map.value());documents[map.key()]="input.map";
            for(auto action=map.value().at("actions").begin();action!=map.value().at("actions").end();++action)require(identities.insert(action.key()).second,"BUNDLE_DUPLICATE_IDENTITY");
        }
        for(auto plane=bundle.at("scene").at("planes").begin();plane!=bundle.at("scene").at("planes").end();++plane)require(identities.insert(plane.key()).second,"BUNDLE_DUPLICATE_IDENTITY");
        std::vector<EntityDefinition> entities;std::uint32_t ordinal=0;std::size_t main_cameras=0;
        const auto& active_camera=bundle.at("scene").at("activeCamera");
        for(auto entry=bundle.at("scene").at("entities").begin();entry!=bundle.at("scene").at("entities").end();++entry) {
            require(identities.insert(entry.key()).second,"BUNDLE_DUPLICATE_IDENTITY");
            const auto& source=entry.value();require(source.at("scheduleOrdinal")==ordinal++,"BUNDLE_SCHEDULE_INVALID");
            const auto& transform=source.at("transform");const auto& spatial=source.at("spatial");
            const auto plane=text(spatial.at("planeId"));require(bundle.at("scene").at("planes").contains(plane),"BUNDLE_PLANE_MISSING");
            EntityDefinition entity;entity.id=entry.key();entity.author_id=entry.key();entity.author_document=scene_id;
            entity.parent_id=source.at("parentId").is_null()?"":text(source.at("parentId"));
            entity.transform={{transform.at("x"),transform.at("y")},transform.at("rotationRadians"),{transform.at("scaleX"),transform.at("scaleY")}};
            entity.plane_height=bundle.at("scene").at("planes").at(plane).at("baseHeight");entity.height_offset=spatial.at("heightOffset");
            require(std::isfinite(entity.plane_height+entity.height_offset),"RUNTIME_NON_FINITE");
            entity.vertical_min=spatial.at("vertical").at("min");entity.vertical_max=spatial.at("vertical").at("max");
            entity.visual_offset={spatial.at("visualOffset").at("x"),spatial.at("visualOffset").at("y")};
            std::string controller;std::set<std::string> singleton;
            for(auto component=source.at("components").begin();component!=source.at("components").end();++component) {
                const auto& value=component.value();require(value.at("id")==component.key() && components.emplace(component.key(),value).second,"BUNDLE_COMPONENT_ID");
                require(identities.insert(component.key()).second,"BUNDLE_DUPLICATE_IDENTITY");
                const auto type=text(value.at("type"));if(type!="graph.behavior" && type!="audio.source" && type!="physics.collider2d")require(singleton.insert(type).second,"BUNDLE_DUPLICATE_COMPONENT");
                if(type=="input.controller") {
                    require(value.at("data").at("map").at("kind")=="document" && value.at("data").at("map").at("type")=="input.map" &&
                        value.at("data").at("map").at("scopeDocumentId").is_null(),"INPUT_CONTEXT_MISSING");
                    controller=component.key();require(bundle.at("inputMaps").contains(text(value.at("data").at("map").at("id"))),"INPUT_CONTEXT_MISSING");
                }
                if(!value.at("enabled").get<bool>())continue;
                if(type=="camera2d" && !value.at("data").at("followEntity").is_null()) {
                    const auto& follow=value.at("data").at("followEntity");
                    require(follow.at("kind")=="entity" && follow.at("type")=="entity" && follow.at("scopeDocumentId")==scene_id &&
                        bundle.at("scene").at("entities").contains(text(follow.at("id"))),"CAMERA_FOLLOW_MISSING");
                }
                if(type=="sprite2d") {
                    const auto& asset=value.at("data").at("asset");
                    require(asset.at("kind")=="asset" && asset.at("type")=="image" && asset.at("scopeDocumentId").is_null() &&
                        assets.contains(text(asset.at("id"))) && assets.at(text(asset.at("id")))=="image","BUNDLE_ASSET_MISSING");
                    require(value.at("data").at("frame").is_null(),"CAPABILITY_NOT_IMPLEMENTED");
                }
                if(type=="audio.source" || type=="physics.collider2d")throw Error("CAPABILITY_NOT_IMPLEMENTED");
                if(type=="physics.body2d") {
                    const auto mode=text(value.at("data").at("mode"));require(mode!="dynamic","CAPABILITY_NOT_IMPLEMENTED");
                    entity.body=mode=="static"?BodyMode::static_body:BodyMode::kinematic;
                }
                if(type=="camera2d" && value.at("data").at("main").get<bool>()) {
                    ++main_cameras;require(active_camera.at("entityId")==entry.key() && active_camera.at("componentId")==component.key(),"CAMERA_MAIN_AMBIGUOUS");
                }
            }
            for(auto component=source.at("components").begin();component!=source.at("components").end();++component)
                if(component.value().at("type")=="graph.behavior" && component.value().at("enabled").get<bool>()) {
                    const auto& behavior_data=component.value().at("data");const auto ir=text(behavior_data.at("graphIRHash"));
                    require(programs.contains(ir) && programs.at(ir)->ir().at("documentId")==behavior_data.at("graphId"),"BUNDLE_IR_MISSING");
                    const auto bound=behavior_data.at("inputControllerId");
                    require(bound.is_null() || (bound.is_string() && text(bound)==controller),"INPUT_CONTEXT_MISSING");
                    Behavior behavior;behavior.entity=entry.key();behavior.component=component.key();behavior.controller=bound.is_null()?"":text(bound);
                    behavior.ordinal=source.at("scheduleOrdinal");behavior.program=programs.at(ir);
                    for(std::size_t i=0;i<behavior.program->entries().size();++i) {
                        const auto& range=behavior.program->entries()[i];const auto& root=behavior.program->ir().at("entries")[range.entry];
                        behavior.entries.emplace(text(root.at("event")),i);
                    }
                    if(behavior.entries.contains("onInput"))require(!behavior.controller.empty(),"INPUT_CONTEXT_MISSING");
                    for(const auto& instruction:behavior.program->ir().at("code")) {
                        if(instruction.at("op")=="INPUT_VEC2")require(!behavior.controller.empty(),"INPUT_CONTEXT_MISSING");
                        if(instruction.at("op")=="AUDIO_PLAY")throw Error("CAPABILITY_NOT_IMPLEMENTED");
                    }
                    behaviors.push_back(std::move(behavior));
                }
            entities.push_back(std::move(entity));
        }
        require(main_cameras==1,"CAMERA_MAIN_MISSING");scene=std::make_shared<SceneWorld>(std::move(world),std::move(entities));
        std::sort(behaviors.begin(),behaviors.end(),[](const auto& a,const auto& b){return std::tie(a.ordinal,a.component)<std::tie(b.ordinal,b.component);});
        for(std::size_t i=0;i<behaviors.size();++i) {
            auto& behavior=behaviors[i];behavior.binding=std::make_shared<Binding>(*this,i);
            if(behavior.entries.contains("onInput")) {
                const auto& root=behavior.program->ir().at("entries")[behavior.program->entries()[behavior.entries.at("onInput")].entry];
                require(behavior.binding->supports_input(text(root.at("action")),"vec2"),"INPUT_CONTEXT_MISSING");
            }
            const auto& data=components.at(behavior.component).at("data");behavior.vm=std::make_unique<VMInstance>(behavior.program,data.at("initialVariables"),behavior.binding);
        }
    }
    ~Impl(){for(auto& behavior:behaviors)if(behavior.vm)behavior.vm->discard_frame();}
    void begin() {
        require(tick<UINT64_MAX,"TICK_U64_OVERFLOW");auto current=std::make_unique<Work>();
        current->previous=std::make_unique<SceneWorld>(*scene);current->signal_sequence=signal_sequence;
        current->rpc_actions=rpc_actions;
        if(injected.contains(tick))for(const auto& [player,actions]:injected.at(tick))for(const auto& [id,update]:actions) {
            if(update.family==InputFamily::delta)continue;
            const auto& value=update.value;
            const bool neutral=update.family!=InputFamily::position && ((value.is_boolean() && !value.get<bool>()) ||
                (value.is_number() && value.get<double>()==0) || (value.is_object() && value.at("x")==0 && value.at("y")==0));
            if(neutral)current->rpc_actions[player].erase(id);else current->rpc_actions[player].insert_or_assign(id,update);
        }
        for(auto& behavior:behaviors) {
            current->checkpoints.push_back(behavior.vm->checkpoint());current->budgets.push_back(10000);
            FrameContext context;context.tick=tick;context.self=scene->entity_reference(behavior.entity);
            if(!behavior.controller.empty()) {
                const auto& control=components.at(behavior.controller);const auto& info=control.at("data");const auto player=info.at("player").get<unsigned>();
                const auto& map=bundle.at("inputMaps").at(text(info.at("map").at("id")));
                auto sampled=(state==RunState::paused && paused_physical?*paused_physical:input).sample_sources(player,map);auto& values=sampled.values;
                for(auto action=map.at("actions").begin();action!=map.at("actions").end();++action) {
                    const auto family=action_family(action.value());const auto type=text(action.value().at("valueType"));const ActionUpdate* rpc=nullptr;
                    if(family==InputFamily::delta) {
                        if(injected.contains(tick) && injected.at(tick).contains(player) && injected.at(tick).at(player).contains(action.key()))rpc=&injected.at(tick).at(player).at(action.key());
                    } else if(current->rpc_actions.contains(player) && current->rpc_actions.at(player).contains(action.key()))rpc=&current->rpc_actions.at(player).at(action.key());
                    auto& value=values[action.key()];
                    if(type=="bool") {if(rpc)value=value.get<bool>() || rpc->value.get<bool>();}
                    else if(type=="f64") {
                        double scalar=value.get<double>();if(rpc)scalar=family==InputFamily::button?std::max(scalar,rpc->value.get<double>()):scalar+rpc->value.get<double>();
                        require(std::isfinite(scalar),"RUNTIME_NON_FINITE");value=family==InputFamily::delta?scalar:std::clamp(scalar,family==InputFamily::button?0.0:-1.0,1.0);
                    } else {
                        engine::Vec2 vector{value.at("x"),value.at("y")};
                        if(rpc) {
                            const engine::Vec2 extra{rpc->value.at("x"),rpc->value.at("y")};
                            if(family==InputFamily::position){if(!sampled.position_orders.contains(action.key()) || rpc->sequence>sampled.position_orders.at(action.key()))vector=extra;}
                            else vector=vector+extra;
                        }
                        require(engine::finite(vector),"RUNTIME_NON_FINITE");const auto length=engine::length(vector);
                        if(family==InputFamily::axis && length>1)vector=vector*(1/length);value={{"x",vector.x},{"y",vector.y}};
                    }
                }
                for(auto action=map.at("actions").begin();action!=map.at("actions").end();++action)if(action.value().at("valueType")=="vec2") {
                    const auto& value=values.at(action.key());context.actions[action.key()]=control.at("enabled").get<bool>()?engine::Vec2{value.at("x"),value.at("y")}:engine::Vec2{};
                }
            }
            current->contexts.push_back(std::move(context));
        }
        for(std::size_t index=0;index<behaviors.size();++index) {
            auto& behavior=behaviors[index];if(!behavior.entries.contains("onInput"))continue;
            const auto range=behavior.entries.at("onInput");const auto& entry=behavior.program->ir().at("entries")[behavior.program->entries()[range].entry];
            const auto action=text(entry.at("action"));require(current->contexts[index].actions.contains(action),"INPUT_CONTEXT_MISSING");
            const auto value=current->contexts[index].actions.at(action);const auto previous=behavior.previous_actions.contains(action)?behavior.previous_actions.at(action):engine::Vec2{};
            if(value.x!=previous.x || value.y!=previous.y)current->input_calls.push_back({index,range,action});
        }
        std::sort(current->input_calls.begin(),current->input_calls.end(),[&](const auto& a,const auto& b){return std::tie(a.action,behaviors[a.behavior].ordinal,behaviors[a.behavior].component)<std::tie(b.action,behaviors[b.behavior].ordinal,behaviors[b.behavior].component);});
        scene->begin_fixed_step();work=std::move(current);
    }
    std::optional<Invocation> next() {
        auto& current=*work;
        for(;;) {
            if(current.phase==0 || current.phase==3) {
                const auto event=current.phase==0?"onStart":"onTick";
                while(current.cursor<behaviors.size()) {
                    const auto index=current.cursor++;const auto& behavior=behaviors[index];
                    if(behavior.vm->failed() || (current.phase==0 && behavior.started) || !behavior.entries.contains(event))continue;
                    return Invocation{index,behavior.entries.at(event),""};
                }
                ++current.phase;current.cursor=0;continue;
            }
            if(current.phase==1) {
                while(current.cursor<current.input_calls.size()){auto call=current.input_calls[current.cursor++];if(!behaviors[call.behavior].vm->failed())return call;}
                ++current.phase;continue;
            }
            if(current.phase==2) {
                while(current.signal_cursor<pending.size()) {
                    const auto& signal=pending[current.signal_cursor];
                    while(current.subscriber_cursor<behaviors.size()) {
                        const auto index=current.subscriber_cursor++;const auto& behavior=behaviors[index];
                        if(behavior.vm->failed() || !behavior.entries.contains("onSignal"))continue;
                        const auto range=behavior.entries.at("onSignal");const auto& entry=behavior.program->ir().at("entries")[behavior.program->entries()[range].entry];
                        if(entry.at("signal")!=signal.name)continue;
                        require(++current.deliveries<=4096,"SIGNAL_BUDGET_EXCEEDED");return Invocation{index,range,""};
                    }
                    ++current.signal_cursor;current.subscriber_cursor=0;
                }
                ++current.phase;current.cursor=0;continue;
            }
            return std::nullopt;
        }
    }
    void rollback()noexcept {
        if(!work)return;
        for(auto& behavior:behaviors)behavior.vm->discard_frame();
        scene->swap(*work->previous);
        for(std::size_t i=0;i<behaviors.size();++i)try{behaviors[i].vm->restore(std::move(work->checkpoints[i]));}catch(...){}
        work.reset();
    }
};
WorldRunner::WorldRunner(std::string id,const Json& bundle,const std::map<std::string,std::string>& blocks,const std::string& profile,const std::string& profile_hash)
    :impl_(std::make_unique<Impl>(std::move(id),bundle,blocks,profile,profile_hash)){}
WorldRunner::~WorldRunner()=default;
RunState WorldRunner::state()const{return impl_->state;}
std::uint64_t WorldRunner::next_tick()const{return impl_->tick;}
void WorldRunner::start(){require(impl_->state==RunState::ready,"RUNTIME_STATE_INVALID");impl_->state=RunState::running;}
void WorldRunner::pause(){require(impl_->state==RunState::running,"RUNTIME_STATE_INVALID");auto frozen=impl_->input;frozen.finish_tick();impl_->paused_physical=std::move(frozen);impl_->state=RunState::paused;}
void WorldRunner::resume(){require(impl_->state==RunState::paused,"RUNTIME_STATE_INVALID");impl_->paused_physical.reset();impl_->state=RunState::running;}
InputResetReceipt WorldRunner::reset_input(){
    require(!impl_->work,"RUNTIME_TICK_PENDING");auto sources=impl_->input.sources();
    if(impl_->paused_physical){auto locked=impl_->paused_physical->sources();sources.insert(locked.begin(),locked.end());}
    InputResetReceipt receipt;receipt.sources=sources.size();
    for(const auto& [player,actions]:impl_->rpc_actions)receipt.sources+=actions.size();
    for(const auto& [tick,players]:impl_->injected)for(const auto& [player,actions]:players)receipt.future_updates+=actions.size();
    impl_->input.release_all();impl_->paused_physical.reset();impl_->rpc_actions.clear();impl_->injected.clear();return receipt;
}
void WorldRunner::discard_candidate_tick(){impl_->rollback();}
void WorldRunner::stop(){
    impl_->rollback();impl_->state=RunState::stopped;reset_input();
    impl_->behaviors.clear();impl_->components.clear();impl_->pending.clear();impl_->scene.reset();impl_->bundle=nullptr;
}
void WorldRunner::physical_input(const InputSource& source){
    require(impl_->state==RunState::running || impl_->state==RunState::paused,"RUNTIME_STATE_INVALID");
    if(impl_->state==RunState::paused && describe_control(source.device,source.control).family==InputFamily::delta)return;
    require(impl_->receive_sequence<UINT64_MAX,"INPUT_SEQUENCE_EXHAUSTED");auto value=source;value.receive_order=++impl_->receive_sequence;impl_->input.feed(value);
}
std::uint64_t WorldRunner::inject(std::uint64_t at,unsigned player,const Json& actions) {
    require(impl_->state==RunState::running && player<8 && actions.is_object(),"RUNTIME_STATE_INVALID");
    require(at>=impl_->tick && at-impl_->tick<=120,"INPUT_TICK_RANGE");
    require(impl_->receive_sequence<UINT64_MAX,"INPUT_SEQUENCE_EXHAUSTED");const auto sequence=impl_->receive_sequence+1;
    auto changes=impl_->injected.contains(at) && impl_->injected.at(at).contains(player)?impl_->injected.at(at).at(player):std::map<std::string,Impl::ActionUpdate>{};
    for(auto action=actions.begin();action!=actions.end();++action) {
        require(uuid(action.key()),"INVALID_ACTION_ID");std::string type;auto family=InputFamily::axis;
        for(const auto& [id,control]:impl_->components)if(control.at("type")=="input.controller" && control.at("data").at("player")==player) {
            const auto map=text(control.at("data").at("map").at("id"));const auto& entries=impl_->bundle.at("inputMaps").at(map).at("actions");
            if(entries.contains(action.key())) {
                const auto& definition=entries.at(action.key());const auto found=text(definition.at("valueType"));
                require(type.empty() || type==found,"INPUT_ACTION_AMBIGUOUS");type=found;
                family=action_family(definition);
            }
        }
        require(!type.empty(),"INPUT_ACTION_UNRESOLVED");validate_typed_value(Json{{"type",type},{"value",action.value()}});
        if(type=="vec2" && family==InputFamily::axis)require(engine::length({action.value().at("x"),action.value().at("y")})<=1+1e-9,"INPUT_RANGE");
        if(type=="f64" && family!=InputFamily::delta)require(action.value().get<double>()>=(family==InputFamily::button?0:-1) && action.value().get<double>()<=1,"INPUT_RANGE");
        changes.insert_or_assign(action.key(),Impl::ActionUpdate{action.value(),sequence,family});
    }
    impl_->injected[at][player]=std::move(changes);
    impl_->receive_sequence=sequence;return sequence;
}
TickReceipt WorldRunner::fixed_step(const DebugControl& debug) {
    require(impl_->state==RunState::running || impl_->state==RunState::paused,"RUNTIME_STATE_INVALID");TickReceipt receipt;
    receipt.executed_tick=impl_->tick;receipt.next_tick=impl_->tick;
    try {
        if(!impl_->work)impl_->begin();auto& work=*impl_->work;
        for(;;) {
            if(!work.active)work.active=impl_->next();if(!work.active)break;
            const auto call=*work.active;auto& behavior=impl_->behaviors[call.behavior];
            require(work.world_budget>0,"WORLD_INSTRUCTION_BUDGET");InstructionBudget budget{work.budgets[call.behavior],work.world_budget};
            auto result=behavior.vm->execute(call.entry,work.contexts[call.behavior],budget,debug);
            work.budgets[call.behavior]=budget.instance;work.world_budget=budget.world;
            require(!work.rollback_failed,"WORLD_ROLLBACK_FAILED");
            if(result.status==VMStatus::paused) {
                if(impl_->state==RunState::running){auto frozen=impl_->input;frozen.finish_tick();impl_->paused_physical=std::move(frozen);}
                const auto& ir=behavior.program->ir();
                receipt.paused=PausedLocation{result.pause_reason,behavior.entity,behavior.component,text(ir.at("documentId")),
                    text(ir.at("sourceMap").at(result.pc).at("nodeId")),result.pc};
                impl_->state=RunState::paused;return receipt;
            }
            if(result.status==VMStatus::failed) {
                if(result.error=="RUNTIME_INSTRUCTION_LIMIT" && budget.world==0)throw Error("WORLD_INSTRUCTION_BUDGET");
                work.diagnostics.push_back({{"code",result.error},{"entityId",behavior.entity},{"componentId",behavior.component},{"pc",result.pc}});
            }
            work.active.reset();
        }
        for(std::size_t i=0;i<impl_->behaviors.size();++i){impl_->behaviors[i].started=true;impl_->behaviors[i].previous_actions=std::move(work.contexts[i].actions);}
        impl_->pending=std::move(work.emitted);impl_->signal_sequence=work.signal_sequence;
        impl_->rpc_actions=std::move(work.rpc_actions);
        receipt.outputs=std::move(work.outputs);receipt.diagnostics=std::move(work.diagnostics);receipt.completed=true;
        impl_->input.finish_tick();impl_->injected.erase(impl_->tick);receipt.next_tick=++impl_->tick;impl_->work.reset();return receipt;
    } catch(const Error& error) {impl_->rollback();impl_->state=RunState::failed;receipt.diagnostics.push_back({{"code",error.code},{"scope","world"}});return receipt;}
    catch(...){impl_->rollback();impl_->state=RunState::failed;throw;}
}
const SceneWorld& WorldRunner::published_scene()const {require(impl_->scene!=nullptr,"RUNTIME_STOPPED");return impl_->work?*impl_->work->previous:*impl_->scene;}
Json WorldRunner::variables(const std::string& entity,const std::string& component)const {
    for(const auto& behavior:impl_->behaviors)if(behavior.entity==entity && behavior.component==component)return behavior.vm->variables();
    throw Error("RUNTIME_COMPONENT_MISSING");
}
}
