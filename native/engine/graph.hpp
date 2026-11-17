// 编译器只读冻结Graph值，不依赖创作数据库、UI或模型接口。
#pragma once
#include "core/schema/value.hpp"
#include <map>
#include <set>
namespace gg::compiler {
struct GraphSource {std::string document_id,version;int schema=1;Json body;};
struct NodePorts {std::map<std::string,std::string> inputs,outputs;std::string effect;};
struct Connection {std::string node,port;};
struct GraphAnalysis {
    std::map<std::string,NodePorts> nodes;
    std::map<std::pair<std::string,std::string>,Connection> data_inputs,exec_outputs;
    std::map<std::string,std::string> entries;
};
const Json& node_catalog();
std::string node_catalog_hash();
GraphAnalysis analyze_graph(const GraphSource& graph,bool require_complete=false);
struct CompileOptions {
    std::string runtime_profile,compiler_build;
    unsigned fixed_step_hz=60;
    std::map<std::string,std::string> input_actions;
};
struct CompiledGraph {Json ir;std::string ir_hash,semantic_hash,execution_hash;};
CompiledGraph compile_graph(const GraphSource& graph,const CompileOptions& options);
}
