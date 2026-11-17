// 资源参数不包含外部文件授权或跨文档引用；来源和许可必须随不可变版本保留。
#include "core/assets/metadata.hpp"
#include "core/assets/logical_path.hpp"
#include "contracts.hpp"
#include <set>

namespace gg {
const Json& asset_metadata_schema(){static const auto value=parse(asset_metadata_schema_json,1048576);return value;}
const Json& import_profiles(){static const auto value=parse(import_profiles_json,1048576);return value;}
namespace {
void unicode_ranges(const Json& ranges) {
    for(const auto& range:ranges) {
        const auto start=range.at("start").get<std::uint32_t>(),end=range.at("end").get<std::uint32_t>();
        require(start<=end && end<=0x10ffff && (end<0xd800 || start>0xdfff),"TYPE_MISMATCH");
        require(end<0xfdd0 || start>0xfdef,"TYPE_MISMATCH");
        for(std::uint32_t plane=0;plane<=16;++plane) {
            const auto noncharacter=plane*65536+65534;
            require(end<noncharacter || start>noncharacter+1,"TYPE_MISMATCH");
        }
    }
}
void unique_mapping(const Json& values) {
    std::set<std::string> source,target;
    for(const auto& value:values)require(source.insert(text(value.at("sourceName"))).second && target.insert(text(value.at("targetName"))).second,"TYPE_MISMATCH");
}
}
void validate_asset_metadata(const Json& metadata) {
    require(metadata.dump().size()<=262144,"LIMIT_EXCEEDED");schema_check(metadata,asset_metadata_schema());
    (void)logical_path(text(metadata.at("logicalPath")));
    std::set<std::string> tags;
    for(const auto& tag:metadata.at("tags"))require(tags.insert(unicode_search_key(text(tag))).second,"DUPLICATE_TAG");
    const auto& settings=metadata.at("importSettings");const auto kind=text(settings.at("settingsKind"));const auto& values=settings.at("values");
    if(kind=="font.import") {
        const auto& glyphs=values.at("glyphSet");
        if(glyphs.at("mode")=="ranges")require(!glyphs.at("ranges").empty(),"TYPE_MISMATCH");
        unicode_ranges(glyphs.at("ranges"));
    }
    if(kind=="skeleton.import") {
        unique_mapping(values.at("boneNameMap"));unique_mapping(values.at("animationNameMap"));
    }
}
}
