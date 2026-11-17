// 合同来自构建时嵌入资源，游戏包不能用项目文件替换验证器的指令定义。
#include "engine/catalog.hpp"
#include "contracts.hpp"
namespace gg::contracts {
const Json& graph_nodes() {static const auto value=parse(graph_node_catalog,1048576);return value;}
const Json& graph_ir() {static const auto value=parse(graph_ir_schema,1048576);return value;}
const Json& runtime_bundle() {static const auto value=parse(runtime_bundle_schema,1048576);return value;}
const Json& runtime_resources() {static const auto value=parse(runtime_host_resource_schema,1048576);return value;}
const Json& runtime_port(const std::string& version) {
    if(version=="1.0"){static const auto value=parse(runtime_port_1_0_schema,2097152);return value;}
    require(version=="1.1","PROTOCOL_VERSION_UNSUPPORTED");static const auto value=parse(runtime_port_1_1_schema,2097152);return value;
}
std::string graph_nodes_hash() {static const auto value=hash(graph_nodes().dump());return value;}
std::string graph_ir_hash() {static const auto value=hash(graph_ir().dump());return value;}
}
