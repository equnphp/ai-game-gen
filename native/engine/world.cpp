// 层级矩阵按拓扑顺序生成；所有候选矩阵有限后才整体切换，视觉高度不影响逻辑位置。
#include "engine/world.hpp"
#include <algorithm>
#include <cmath>
#include <numbers>

namespace gg::runtime {
namespace {
void finite_transform(const RuntimeTransform& value) {
    require(engine::finite(value.position) && engine::finite(value.scale) && std::isfinite(value.rotation_radians) &&
        value.scale.x!=0 && value.scale.y!=0,"RUNTIME_INVALID_TRANSFORM");
}
engine::Affine2D affine(const RuntimeTransform& value) {
    finite_transform(value);const auto cosine=std::cos(value.rotation_radians),sine=std::sin(value.rotation_radians);
    return {cosine*value.scale.x,sine*value.scale.x,-sine*value.scale.y,cosine*value.scale.y,value.position.x,value.position.y};
}
void finite_matrix(const engine::Affine2D& value) {
    require(engine::finite({value.a,value.b}) && engine::finite({value.c,value.d}) && engine::finite({value.tx,value.ty}),"RUNTIME_INVALID_TRANSFORM");
}
}
SceneWorld::SceneWorld(std::string world,std::vector<EntityDefinition> definitions):world_id_(std::move(world)) {
    require(uuid(world_id_) && definitions.size()<=10000,"RUNTIME_LIMIT_EXCEEDED");
    std::map<std::string,std::vector<std::string>> children;std::set<std::string> ready;
    for(auto& definition:definitions) {
        require(uuid(definition.id) && (definition.author_id.empty() || (uuid(definition.author_id) && uuid(definition.author_document))),"RUNTIME_INVALID_ID");
        finite_transform(definition.transform);
        const auto height=definition.plane_height+definition.height_offset;
        require(std::isfinite(height) && std::isfinite(height+definition.vertical_min) && std::isfinite(height+definition.vertical_max) &&
            definition.vertical_min<=definition.vertical_max && engine::finite(definition.visual_offset),"RUNTIME_INVALID_HEIGHT");
        EntityState state;state.definition=definition;state.transform=definition.transform;state.previous_transform=definition.transform;
        require(entities_.emplace(definition.id,std::move(state)).second,"RUNTIME_DUPLICATE_ID");
        if(!definition.author_id.empty())authors_[{definition.author_document,definition.author_id}].push_back(definition.id);
    }
    for(const auto& [id,state]:entities_) {
        const auto& parent=state.definition.parent_id;
        if(parent.empty())ready.insert(id);
        else {require(entities_.contains(parent),"RUNTIME_INVALID_PARENT");children[parent].push_back(id);}
    }
    while(!ready.empty()) {
        const auto id=*ready.begin();ready.erase(ready.begin());order_indices_[id]=order_.size();order_.push_back(id);
        if(children.contains(id))for(const auto& child:children.at(id))ready.insert(child);
    }
    require(order_.size()==entities_.size(),"DEPENDENCY_CYCLE");commit_transforms({});begin_fixed_step();
}
const EntityState& SceneWorld::entity(const std::string& id)const {
    require(entities_.contains(id),"RUNTIME_ENTITY_MISSING");return entities_.at(id);
}
std::vector<engine::Affine2D> SceneWorld::matrices(const std::map<std::string,RuntimeTransform>& changes) const {
    std::vector<engine::Affine2D> result;result.reserve(order_.size());
    for(const auto& id:order_) {
        const auto& state=entities_.at(id);const auto& transform=changes.contains(id)?changes.at(id):state.transform;
        auto matrix=affine(transform);const auto& parent=state.definition.parent_id;
        if(!parent.empty())matrix=result.at(order_indices_.at(parent))*matrix;
        finite_matrix(matrix);result.push_back(matrix);
    }
    return result;
}
void SceneWorld::commit_transforms(const std::map<std::string,RuntimeTransform>& changes) {
    const auto candidate=matrices(changes);
    for(const auto& [id,value]:changes)entities_.at(id).transform=value;
    for(std::size_t index=0;index<order_.size();++index)entities_.at(order_[index]).world=candidate[index];
}
Json SceneWorld::entity_reference(const std::string& id)const {
    (void)entity(id);return {{"kind","entity"},{"id",id},{"type","entity"},{"scopeDocumentId",world_id_}};
}
Json SceneWorld::bind_entity(const Json& reference,const std::map<std::pair<std::string,std::string>,std::string>& overrides)const {
    require(reference.is_object() && reference.value("kind","")=="entity" && reference.value("type","")=="entity" &&
        reference.contains("scopeDocumentId") && reference.at("scopeDocumentId").is_string(),"RUNTIME_INVALID_REFERENCE");
    const auto key=std::pair{text(reference.at("scopeDocumentId")),text(reference.at("id"))};
    std::string selected;
    if(overrides.contains(key)) {
        selected=overrides.at(key);const auto& target=entity(selected).definition;
        require(target.author_document==key.first && target.author_id==key.second,"RUNTIME_INVALID_REFERENCE");
    } else {
        require(authors_.contains(key),"RUNTIME_INVALID_REFERENCE");const auto& candidates=authors_.at(key);
        require(candidates.size()==1,"RUNTIME_AMBIGUOUS_REFERENCE");selected=candidates.front();
    }
    return entity_reference(selected);
}
engine::Vec2 SceneWorld::position(const Json& reference)const {
    require(reference.is_object() && reference.value("kind","")=="entity" && reference.value("type","")=="entity" &&
        reference.at("scopeDocumentId")==world_id_,"RUNTIME_INVALID_REFERENCE");
    const auto& matrix=entity(text(reference.at("id"))).world;return {matrix.tx,matrix.ty};
}
void SceneWorld::begin_fixed_step() {
    for(auto& [id,state]:entities_){state.previous_transform=state.transform;state.previous_world=state.world;}
}
void SceneWorld::translate(const std::vector<std::pair<std::string,engine::Vec2>>& deltas) {
    std::map<std::string,RuntimeTransform> candidate;
    for(const auto& [id,delta]:deltas) {
        const auto& state=entity(id);require(engine::finite(delta),"RUNTIME_INVALID_TRANSFORM");
        require(state.definition.body==BodyMode::none || state.definition.body==BodyMode::kinematic,"BODY_TRANSLATE_FORBIDDEN");
        auto local_delta=delta;const auto& parent=state.definition.parent_id;
        if(!parent.empty()) {
            const auto inverse=entity(parent).world.inverse();require(inverse.has_value(),"RUNTIME_SINGULAR_PARENT");local_delta=inverse->direction(delta);
        }
        if(!candidate.contains(id))candidate[id]=state.transform;
        candidate.at(id).position=candidate.at(id).position+local_delta;finite_transform(candidate.at(id));
    }
    commit_transforms(candidate);
}
void SceneWorld::set_local_transform(const std::string& id,const RuntimeTransform& value) {
    (void)entity(id);finite_transform(value);commit_transforms({{id,value}});
}
void SceneWorld::set_local_transforms(const std::map<std::string,RuntimeTransform>& values) {
    for(const auto& [id,value]:values){(void)entity(id);finite_transform(value);}
    commit_transforms(values);
}
std::vector<engine::Affine2D> SceneWorld::interpolated_matrices(double alpha)const {
    require(std::isfinite(alpha) && alpha>=0 && alpha<=1,"RUNTIME_INVALID_ALPHA");
    std::map<std::string,RuntimeTransform> transforms;
    for(const auto& [id,state]:entities_) {
        const auto& a=state.previous_transform;const auto& b=state.transform;
        // 镜像符号在固定步离散切换，不能为了插值制造作者模型禁止的零缩放。
        auto scale=[&](double previous,double current){return std::signbit(previous)!=std::signbit(current)?current:previous*(1-alpha)+current*alpha;};
        transforms[id]={a.position*(1-alpha)+b.position*alpha,a.rotation_radians*(1-alpha)+b.rotation_radians*alpha,
            {scale(a.scale.x,b.scale.x),scale(a.scale.y,b.scale.y)}};
    }
    return matrices(transforms);
}
Json SceneWorld::author_projection(const std::string& id)const {
    const auto& state=entity(id);const auto& value=state.transform;
    return {{"id",id},{"authorId",state.definition.author_id.empty()?Json(nullptr):Json(state.definition.author_id)},
        {"transform",{{"x",value.position.x},{"y",value.position.y},{"rotation",value.rotation_radians*(180/std::numbers::pi)},
            {"scaleX",value.scale.x},{"scaleY",value.scale.y}}}};
}
void SceneWorld::swap(SceneWorld& other)noexcept {
    using std::swap;swap(world_id_,other.world_id_);entities_.swap(other.entities_);order_.swap(other.order_);
    order_indices_.swap(other.order_indices_);authors_.swap(other.authors_);
}
}
