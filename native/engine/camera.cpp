// 标准等距基矩阵[[1,-1],[0.5,0.5]]；高度只减投影Y，镜像/缩放不混入相机角度。
#include "engine/camera.hpp"
#include "core/schema/value.hpp"
#include <cmath>
namespace gg::runtime {
namespace {
void validate(const CameraView& camera) {
    require(engine::finite(camera.position) && engine::finite(camera.viewport) && camera.viewport.x>0 && camera.viewport.y>0 &&
        std::isfinite(camera.rotation_radians) && std::isfinite(camera.zoom) && camera.zoom>0,"CAMERA_INVALID");
}
engine::Vec2 rotate(engine::Vec2 value,double angle) {
    const auto cosine=std::cos(angle),sine=std::sin(angle);
    return {cosine*value.x-sine*value.y,sine*value.x+cosine*value.y};
}
}
engine::Vec2 CameraView::project(engine::Vec2 world,double height,engine::Vec2 offset)const {
    validate(*this);require(engine::finite(world) && engine::finite(offset) && std::isfinite(height),"CAMERA_INVALID");
    auto point=world-position;
    if(projection==Projection::isometric)point={point.x-point.y,(point.x+point.y)*0.5};
    point.y-=height;point=point+offset;
    point=viewport*0.5+rotate(point,-rotation_radians)*zoom;
    require(engine::finite(point),"CAMERA_NON_FINITE");return point;
}
engine::Vec2 CameraView::unproject(engine::Vec2 screen,double height,engine::Vec2 offset)const {
    validate(*this);require(engine::finite(screen) && engine::finite(offset) && std::isfinite(height),"CAMERA_INVALID");
    auto point=rotate((screen-viewport*0.5)*(1/zoom),rotation_radians)-offset;point.y+=height;
    if(projection==Projection::isometric)point={point.x*0.5+point.y,-point.x*0.5+point.y};
    point=point+position;require(engine::finite(point),"CAMERA_NON_FINITE");return point;
}
}
