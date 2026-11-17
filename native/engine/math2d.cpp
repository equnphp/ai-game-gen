// 使用逻辑坐标计算；屏幕投影、伪3D视觉高度不能改写碰撞或父子变换。
#include "engine/math2d.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>
namespace gg::engine {
double dot(Vec2 a,Vec2 b){return a.x*b.x+a.y*b.y;}
double cross(Vec2 a,Vec2 b){return a.x*b.y-a.y*b.x;}
double length(Vec2 value){return std::hypot(value.x,value.y);}
bool finite(Vec2 value){return std::isfinite(value.x)&&std::isfinite(value.y);}
Vec2 Affine2D::point(Vec2 p)const{return{a*p.x+c*p.y+tx,b*p.x+d*p.y+ty};}
Vec2 Affine2D::direction(Vec2 p)const{return{a*p.x+c*p.y,b*p.x+d*p.y};}
Affine2D Affine2D::operator*(const Affine2D& v)const{
    return{a*v.a+c*v.b,b*v.a+d*v.b,a*v.c+c*v.d,b*v.c+d*v.d,a*v.tx+c*v.ty+tx,b*v.tx+d*v.ty+ty};
}
std::optional<Affine2D> Affine2D::inverse()const{
    if(!finite({a,b})||!finite({c,d})||!finite({tx,ty}))return std::nullopt;
    const double determinant=a*d-b*c;
    if(!std::isfinite(determinant)||determinant==0)return std::nullopt;
    Affine2D result{d/determinant,-b/determinant,-c/determinant,a/determinant,0,0};
    const Vec2 offset=result.direction({-tx,-ty});result.tx=offset.x;result.ty=offset.y;
    if(!finite({result.a,result.b})||!finite({result.c,result.d})||!finite(offset))return std::nullopt;
    return result;
}
Affine2D affine(const Transform2D& value){
    const double radians=value.rotation_degrees*(std::numbers::pi/180);
    const double cosine=std::cos(radians),sine=std::sin(radians);
    return{cosine*value.scale.x,sine*value.scale.x,-sine*value.scale.y,cosine*value.scale.y,value.position.x,value.position.y};
}
std::optional<Transform2D> decompose(const Affine2D& matrix,double tolerance){
    if(!finite({matrix.a,matrix.b})||!finite({matrix.c,matrix.d})||!finite({matrix.tx,matrix.ty})||
        !std::isfinite(tolerance)||tolerance<0)return std::nullopt;
    const double sx=std::hypot(matrix.a,matrix.b),sy=std::hypot(matrix.c,matrix.d);
    if(sx<=geometry_epsilon||sy<=geometry_epsilon||std::abs(matrix.a*matrix.c+matrix.b*matrix.d)>tolerance*sx*sy)
        return std::nullopt;
    const double signed_y=(matrix.a*matrix.d-matrix.b*matrix.c)/sx;
    return Transform2D{{matrix.tx,matrix.ty},std::atan2(matrix.b,matrix.a)*180/std::numbers::pi,{sx,signed_y}};
}
bool contains(Rect box,Vec2 point){
    return point.x>=box.minimum.x&&point.y>=box.minimum.y&&point.x<=box.maximum.x&&point.y<=box.maximum.y;
}
bool overlaps(Rect a,Rect b){
    return a.minimum.x<=b.maximum.x&&a.maximum.x>=b.minimum.x&&a.minimum.y<=b.maximum.y&&a.maximum.y>=b.minimum.y;
}
Rect transformed_bounds(Rect box,const Affine2D& transform){
    Rect result{transform.point(box.minimum),transform.point(box.minimum)};
    for(Vec2 p:{Vec2{box.minimum.x,box.maximum.y},Vec2{box.maximum.x,box.minimum.y},box.maximum}){
        const Vec2 v=transform.point(p);
        result.minimum={std::min(result.minimum.x,v.x),std::min(result.minimum.y,v.y)};
        result.maximum={std::max(result.maximum.x,v.x),std::max(result.maximum.y,v.y)};
    }
    return result;
}
std::optional<RayHit> ray_cast(Rect box,Vec2 origin,Vec2 displacement){
    if(!finite(origin)||!finite(displacement)||!finite(box.minimum)||!finite(box.maximum)||
        box.minimum.x>box.maximum.x||box.minimum.y>box.maximum.y)return std::nullopt;
    double near=0,far=1;Vec2 normal{};
    // 射线参数限定在[0,1]；零方向轴不除零，起点在内部返回fraction=0。
    for(int axis=0;axis<2;++axis){
        const double start=axis?origin.y:origin.x,move=axis?displacement.y:displacement.x;
        const double minimum=axis?box.minimum.y:box.minimum.x,maximum=axis?box.maximum.y:box.maximum.x;
        if(std::abs(move)<=geometry_epsilon){if(start<minimum||start>maximum)return std::nullopt;continue;}
        double entry=(minimum-start)/move,exit=(maximum-start)/move,sign=-1;
        if(entry>exit){std::swap(entry,exit);sign=1;}
        if(entry>near){near=entry;normal=axis?Vec2{0,sign}:Vec2{sign,0};}
        far=std::min(far,exit);if(near>far)return std::nullopt;
    }
    return RayHit{near,origin+displacement*near,normal};
}
namespace {
bool on_segment(Vec2 a,Vec2 b,Vec2 p){
    return std::abs(cross(b-a,p-a))<=geometry_epsilon&&
        p.x>=std::min(a.x,b.x)-geometry_epsilon&&p.x<=std::max(a.x,b.x)+geometry_epsilon&&
        p.y>=std::min(a.y,b.y)-geometry_epsilon&&p.y<=std::max(a.y,b.y)+geometry_epsilon;
}
bool segments_intersect(Vec2 a,Vec2 b,Vec2 c,Vec2 d){
    const double ab_c=cross(b-a,c-a),ab_d=cross(b-a,d-a),cd_a=cross(d-c,a-c),cd_b=cross(d-c,b-c);
    if(((ab_c>geometry_epsilon&&ab_d< -geometry_epsilon)||(ab_c< -geometry_epsilon&&ab_d>geometry_epsilon))&&
       ((cd_a>geometry_epsilon&&cd_b< -geometry_epsilon)||(cd_a< -geometry_epsilon&&cd_b>geometry_epsilon)))return true;
    return on_segment(a,b,c)||on_segment(a,b,d)||on_segment(c,d,a)||on_segment(c,d,b);
}
}
double signed_area(std::span<const Vec2> vertices){
    double twice=0;if(vertices.empty())return 0;
    for(std::size_t i=0;i<vertices.size();++i)twice+=cross(vertices[i],vertices[(i+1)%vertices.size()]);
    return twice*0.5;
}
bool simple_polygon(std::span<const Vec2> vertices){
    if(vertices.size()<3||vertices.size()>64)return false;
    for(std::size_t i=0;i<vertices.size();++i){
        const auto next=(i+1)%vertices.size();
        if(!finite(vertices[i])||length(vertices[next]-vertices[i])<=geometry_epsilon)return false;
        for(std::size_t j=i+1;j<vertices.size();++j){
            const auto following=(j+1)%vertices.size();
            if(j==next||following==i)continue;
            if(segments_intersect(vertices[i],vertices[next],vertices[j],vertices[following]))return false;
        }
    }
    const double area=signed_area(vertices);return std::isfinite(area)&&std::abs(area)>geometry_epsilon;
}
bool convex_polygon(std::span<const Vec2> vertices){
    if(!simple_polygon(vertices))return false;int direction=0;
    for(std::size_t i=0;i<vertices.size();++i){
        const double turn=cross(vertices[(i+1)%vertices.size()]-vertices[i],vertices[(i+2)%vertices.size()]-vertices[(i+1)%vertices.size()]);
        if(std::abs(turn)<=geometry_epsilon)continue;
        const int sign=turn>0?1:-1;if(direction&&direction!=sign)return false;direction=sign;
    }
    return direction!=0;
}
bool contains(std::span<const Vec2> vertices,Vec2 point){
    if(vertices.size()<3||!finite(point))return false;bool inside=false;
    for(std::size_t i=0,j=vertices.size()-1;i<vertices.size();j=i++){
        const Vec2 a=vertices[j],b=vertices[i];if(on_segment(a,b,point))return true;
        if((a.y>point.y)!=(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
}
}
