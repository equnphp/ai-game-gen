// 项目虚拟路径不是OS授权路径；规范化结果由提案差异明确展示。
#pragma once
#include <string>
namespace gg {
inline constexpr const char* path_key_version="gg-pathkey-nfc-cf-u18-v1";
struct LogicalPath {std::string normalized,key;};
LogicalPath logical_path(const std::string& value);
std::string unicode_search_key(const std::string& value);
}
