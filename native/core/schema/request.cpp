// 作者Core消息校验不进入游戏Runtime；共享值库只保留值/Schema/摘要的受管能力。
#include "core/schema/value.hpp"
#include "contracts.hpp"
namespace gg {
void request_check(const Json& request) {
    static const Json legacy=parse(message_schema,1048576);
    static const Json current=parse(message_schema_v1_1,1048576);
    schema_check(request,request.is_object() && request.value("protocolVersion","")=="1.1"?current:legacy);
}
}
