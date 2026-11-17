// 引擎内部二维几何；不持有项目状态，编辑器与运行时共用相同变换语义。
#pragma once
#include <optional>
#include <span>
#include <vector>
namespace gg::engine {
inline constexpr double geometry_epsilon=1e-9;
struct Vec2 {
    double x=0,y=0;
    Vec2 operator+(Vec2 v)const{return{x+v.x,y+v.y};}
    Vec2 operator-(Vec2 v)const{return{x-v.x,y-v.y};}
    Vec2 operator*(double s)const{return{x*s,y*s};}
};
double dot(Vec2 a,Vec2 b);
double cross(Vec2 a,Vec2 b);
double length(Vec2 value);
bool finite(Vec2 value);
struct Transform2D {Vec2 position{};double rotation_degrees=0;Vec2 scale{1,1};};
struct Affine2D {
    double a=1,b=0,c=0,d=1,tx=0,ty=0;
    Vec2 point(Vec2 p)const;
    Vec2 direction(Vec2 p)const;
    Affine2D operator*(const Affine2D& child)const;
    std::optional<Affine2D> inverse()const;
};
Affine2D affine(const Transform2D& transform);
// 含剪切的世界矩阵不能静默丢信息还原为TRS，由调用方提示或保留矩阵。
std::optional<Transform2D> decompose(const Affine2D& matrix,double tolerance=1e-7);
struct Rect {Vec2 minimum,maximum;};
bool contains(Rect box,Vec2 point);
bool overlaps(Rect a,Rect b);
Rect transformed_bounds(Rect local,const Affine2D& transform);
struct RayHit {double fraction;Vec2 point,normal;};
std::optional<RayHit> ray_cast(Rect bounds,Vec2 origin,Vec2 displacement);
double signed_area(std::span<const Vec2> vertices);
bool simple_polygon(std::span<const Vec2> vertices);
bool convex_polygon(std::span<const Vec2> vertices);
bool contains(std::span<const Vec2> vertices,Vec2 point);
}
