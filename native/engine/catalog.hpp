// 编译器与运行时读取同一份不可变指令/节点合同，避免各自维护目录摘要。
#pragma once
#include "core/schema/value.hpp"
namespace gg::contracts {
const Json& graph_nodes();
const Json& graph_ir();
const Json& runtime_bundle();
std::string graph_nodes_hash();
std::string graph_ir_hash();
}
