// 产物计划绑定只读快照；编译器输出不能回写作者工程或借用活动head。
#pragma once
#include "core/storage/sqlite/repository.hpp"
#include <map>
namespace gg::artifact {
inline constexpr char compiler_build[]="gg-compiler-ir1.2-local-1";
struct BuildPlan {
    std::string id,hash;
    Json options,diagnostics=Json::array();
};
BuildPlan prepare(SnapshotReadPort&,const std::string& settings_id,const Json& options,const std::function<void()>& checkpoint);
struct BundleOutput {Json manifest;std::map<std::string,std::string> blocks;};
BundleOutput compile(SnapshotReadPort&,const std::string& settings_id,const BuildPlan&,const std::function<void()>& checkpoint);
}
