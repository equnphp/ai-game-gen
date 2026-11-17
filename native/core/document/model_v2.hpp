// format2模型只生成候选、引用和身份；数据库提交仍由原Session事务入口负责。
#pragma once
#include "core/document/document.hpp"
namespace gg {
struct ObjectIdentity { std::string id, kind, type, scope; };
bool registered_model(const Document& document);
void validate_model(const Document& document);
std::vector<Reference> model_references(const Document& document);
std::vector<ObjectIdentity> model_identities(const Document& document);
std::vector<std::string> model_field_path(const Document& document, const std::string& path);
const Json& model_schema();
std::string model_catalog_hash();
Json describe_model(const std::string& kind,int schema);
Json list_models(const Json& params);
}
