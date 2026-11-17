// 与Artifact复用同一解析器/dump规则；仅输出构建目录的真实目录摘要。
#include "engine/catalog.hpp"
#include "contracts.hpp"
#include <iostream>
int main(){try{std::cout<<gg::Json{{"catalogHash",gg::contracts::graph_nodes_hash()},{"rawHash",gg::hash(gg::graph_node_catalog)}}.dump()<<'\n';return 0;}catch(...){return 1;}}
