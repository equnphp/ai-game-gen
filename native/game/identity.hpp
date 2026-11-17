// 身份熵与游戏seed无关；安全源缺失时失败，不能用时间或Math.random回退。
#pragma once
#include <string>
namespace gg::game {std::string identity_uuid();}
