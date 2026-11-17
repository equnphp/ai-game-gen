// Schema存在与处理器可用分开；这里只校验作者选择的闭合参数，不伪造已转换结果。
#pragma once
#include "core/schema/value.hpp"
namespace gg {
const Json& asset_metadata_schema();
const Json& import_profiles();
void validate_asset_metadata(const Json& metadata);
}
