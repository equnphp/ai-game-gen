// NFC后做默认Unicode casefold；保留重音、兼容字符和用户路径大小写。
#include "core/assets/logical_path.hpp"
#include "core/schema/value.hpp"
#include <utf8proc.h>
#include <memory>
#include <set>
#include <string_view>
static_assert(UTF8PROC_VERSION_MAJOR==2 && UTF8PROC_VERSION_MINOR==12 && UTF8PROC_VERSION_PATCH==0);
namespace gg {
namespace {
std::string normalized(const std::string& value,bool fold) {
    utf8proc_uint8_t* result=nullptr;
    const auto options=UTF8PROC_STABLE|UTF8PROC_COMPOSE|UTF8PROC_REJECTNA|(fold?UTF8PROC_CASEFOLD:0);
    const auto size=utf8proc_map(reinterpret_cast<const utf8proc_uint8_t*>(value.data()),static_cast<utf8proc_ssize_t>(value.size()),&result,options);
    std::unique_ptr<utf8proc_uint8_t,decltype(&utf8proc_free)> owned(result,&utf8proc_free);
    require(size>=0,size==UTF8PROC_ERROR_NOMEM?"OUT_OF_MEMORY":"INVALID_PATH");
    if(size==0)return {};
    return {reinterpret_cast<const char*>(result),static_cast<std::size_t>(size)};
}
void segment(const std::string& value) {
    require(!value.empty() && value.size()<=255 && !value.ends_with(' ') && !value.ends_with('.') && value!="." && value!="..","INVALID_PATH");
    std::size_t count=0,offset=0;
    while(offset<value.size()) {
        utf8proc_int32_t scalar=0;
        const auto bytes=utf8proc_iterate(reinterpret_cast<const utf8proc_uint8_t*>(value.data()+offset),static_cast<utf8proc_ssize_t>(value.size()-offset),&scalar);
        require(bytes>0 && scalar!=0 && ++count<=80,"INVALID_PATH");offset+=static_cast<std::size_t>(bytes);
        require(utf8proc_category(scalar)!=UTF8PROC_CATEGORY_CC && !(scalar>=0x202a && scalar<=0x202e) &&
            !(scalar>=0x2066 && scalar<=0x2069) && !(scalar>=0xfdd0 && scalar<=0xfdef) && (scalar&0xffff)<0xfffe,"INVALID_PATH");
        if(scalar<128)require(std::string_view("<>:\"\\|?*").find(static_cast<char>(scalar))==std::string_view::npos,"INVALID_PATH");
    }
    const auto folded=normalized(value,true);const auto base=folded.substr(0,folded.find('.'));
    static const std::set<std::string> reserved{"con","prn","aux","nul","com1","com2","com3","com4","com5","com6","com7","com8","com9",
        "lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9"};
    require(!reserved.contains(base),"INVALID_PATH");
}
}
LogicalPath logical_path(const std::string& value) {
    require(!value.empty() && value.size()<=512 && value.front()=='/' && !value.ends_with('/'),"INVALID_PATH");
    const auto stored=normalized(value,false);require(stored.size()<=512,"INVALID_PATH");
    std::size_t start=1,count=0;
    for(std::size_t i=1;i<=stored.size();++i)if(i==stored.size() || stored[i]=='/') {
        require(++count<=32,"LIMIT_EXCEEDED");segment(stored.substr(start,i-start));start=i+1;
    }
    auto key=normalized(stored,true);require(key.size()<=2048,"LIMIT_EXCEEDED");return {stored,std::move(key)};
}
std::string unicode_search_key(const std::string& value) {return normalized(value,true);}
}
