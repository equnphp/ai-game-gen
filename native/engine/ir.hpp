// 只有Verifier可以创建可执行程序；调用方不能修改已验证IR后继续使用旧的通过标记。
#pragma once
#include "core/schema/value.hpp"
#include <map>
namespace gg::runtime {
struct EntryRange {std::size_t entry,begin,end;};
class VerifiedProgram {
    Json ir_;
    std::vector<EntryRange> entries_;
    bool uses_i32_tick_=false;
    VerifiedProgram()=default;
    friend VerifiedProgram verify_ir(const Json&,const std::string&);
public:
    VerifiedProgram(const VerifiedProgram&)=default;
    VerifiedProgram(VerifiedProgram&&)=default;
    VerifiedProgram& operator=(const VerifiedProgram&)=delete;
    VerifiedProgram& operator=(VerifiedProgram&&)=delete;
    const Json& ir() const {return ir_;}
    const std::vector<EntryRange>& entries() const {return entries_;}
    bool uses_i32_tick() const {return uses_i32_tick_;}
};
VerifiedProgram verify_ir(const Json& ir,const std::string& runtime_profile);
void validate_typed_value(const Json& value);
}
