// 相机投影不改World/物理坐标；反投影必须给定所选逻辑高度。
#pragma once
#include "engine/math2d.hpp"
namespace gg::runtime {
enum class Projection {orthographic,isometric};
struct CameraView {
    engine::Vec2 position{},viewport{1280,720};
    double rotation_radians=0,zoom=1;
    Projection projection=Projection::orthographic;
    engine::Vec2 project(engine::Vec2 world,double height=0,engine::Vec2 visual_offset={})const;
    engine::Vec2 unproject(engine::Vec2 screen,double height=0,engine::Vec2 visual_offset={})const;
};
}
