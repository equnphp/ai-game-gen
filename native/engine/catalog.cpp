// 合同来自构建时嵌入资源，游戏包不能用项目文件替换验证器的指令定义。
#include "engine/catalog.hpp"
#include "contracts.hpp"
namespace gg::contracts {
const Json& graph_nodes() {static const auto value=parse(graph_node_catalog,1048576);return value;}
const Json& graph_ir() {static const auto value=parse(graph_ir_schema,1048576);return value;}
const Json& runtime_bundle() {static const auto value=parse(runtime_bundle_schema,1048576);return value;}
std::string graph_nodes_hash() {static const auto value=hash(graph_nodes().dump());return value;}
std::string graph_ir_hash() {static const auto value=hash(graph_ir().dump());return value;}
}
