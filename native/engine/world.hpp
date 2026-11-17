// World持有运行态副本；作者数据只通过显式回写提案保存，不共享可写JSON对象。
#pragma once
#include "core/schema/value.hpp"
#include "engine/math2d.hpp"
#include <map>
#include <set>

namespace gg::runtime {
struct RuntimeTransform {engine::Vec2 position{};double rotation_radians=0;engine::Vec2 scale{1,1};};
enum class BodyMode {none,static_body,kinematic,dynamic};
struct EntityDefinition {
    std::string id,author_id,author_document,parent_id;
    RuntimeTransform transform;
    BodyMode body=BodyMode::none;
    double plane_height=0,height_offset=0,vertical_min=0,vertical_max=0;
    engine::Vec2 visual_offset{};
};
struct EntityState {
    EntityDefinition definition;
    RuntimeTransform transform,previous_transform;
    engine::Affine2D world,previous_world;
};
class SceneWorld {
    std::string world_id_;
    std::map<std::string,EntityState> entities_;
    std::vector<std::string> order_;
    std::map<std::string,std::size_t> order_indices_;
    std::map<std::pair<std::string,std::string>,std::vector<std::string>> authors_;
    std::vector<engine::Affine2D> matrices(const std::map<std::string,RuntimeTransform>& changes) const;
    void commit_transforms(const std::map<std::string,RuntimeTransform>& changes);
public:
    SceneWorld(std::string world_id,std::vector<EntityDefinition> entities);
    const std::string& id()const{return world_id_;}
    const std::map<std::string,EntityState>& entities()const{return entities_;}
    const EntityState& entity(const std::string& id)const;
    Json entity_reference(const std::string& id) const;
    Json bind_entity(const Json& author_reference,const std::map<std::pair<std::string,std::string>,std::string>& overrides={}) const;
    engine::Vec2 position(const Json& runtime_reference) const;
    void begin_fixed_step();
    void translate(const std::vector<std::pair<std::string,engine::Vec2>>& world_deltas);
    void set_local_transform(const std::string& id,const RuntimeTransform& value);
    void set_local_transforms(const std::map<std::string,RuntimeTransform>& values);
    void swap(SceneWorld& other)noexcept;
    std::vector<engine::Affine2D> interpolated_matrices(double alpha) const;
    Json author_projection(const std::string& id) const;
};
}
