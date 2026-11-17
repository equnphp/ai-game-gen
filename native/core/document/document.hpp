// 候选状态在内存中整体校验；一个批次允许先删除引用再删除目标。
#pragma once
#include "core/schema/value.hpp"
#include <map>
#include <set>
namespace gg {
struct Document {
    std::string id, version, kind, content_hash;
    int schema = 1;
    Json body;
};
struct State {
    std::map<std::string, Document> documents;
    std::set<std::string> assets;
};
struct Reference { std::string path, kind, target; };
std::vector<Reference> references(const Document& document);
bool known_document(const Document& document);
void validate_state(const State& state, const std::string& settings_id);
void apply_operations(State& state, const Json& operations);
Json delta(const State& before, const State& after);
Json manifest(const State& state, const std::string& project, const std::string& branch, std::int64_t revision);
}
