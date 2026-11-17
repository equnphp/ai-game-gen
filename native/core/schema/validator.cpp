// 只解释内置合同的受控Schema子集；引用仅限同一根文档，不访问网络或项目文件。
#include "core/schema/value.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <regex>
#include <set>

namespace gg {
namespace {
struct Validation {
    const Json& root;
    std::size_t visits = 0;

    bool matches(const Json& value, const Json& schema, unsigned depth) {
        try { check(value, schema, depth); return true; }
        catch (const Error& error) {
            // 预算和不支持的合同必须向上传递，不能被anyOf当成普通分支不匹配吞掉。
            if (error.code == "SCHEMA_LIMIT_EXCEEDED" || error.code == "UNSUPPORTED_SCHEMA") throw;
            return false;
        }
    }
    void check(const Json& value, const Json& schema, unsigned depth) {
        require(depth <= 96 && ++visits <= 2000000, "SCHEMA_LIMIT_EXCEEDED");
        if (schema.is_boolean()) { require(schema.get<bool>(), "INVALID_MESSAGE"); return; }
        require(schema.is_object(), "UNSUPPORTED_SCHEMA");
        static const std::set<std::string> supported{
            "$schema","$id","title","description","$defs","$ref","type","const","enum",
            "oneOf","anyOf","allOf","not","properties","required","additionalProperties",
            "propertyNames","minProperties","maxProperties","items","minItems","maxItems",
            "uniqueItems","minLength","maxLength","pattern","format","minimum","maximum",
            "exclusiveMinimum","exclusiveMaximum"};
        for (auto it = schema.begin(); it != schema.end(); ++it)
            require(supported.contains(it.key()), "UNSUPPORTED_SCHEMA");
        if (schema.contains("$ref")) {
            const auto ref = text(schema.at("$ref"));
            require(ref.starts_with("#/"), "UNSUPPORTED_SCHEMA");
            try { check(value, root.at(Json::json_pointer(ref.substr(1))), depth + 1); }
            catch (const Json::exception&) { throw Error("UNSUPPORTED_SCHEMA"); }
        }
        if (schema.contains("oneOf")) {
            unsigned count = 0;
            for (const auto& branch : schema.at("oneOf")) if (matches(value, branch, depth + 1)) ++count;
            require(count == 1, "INVALID_MESSAGE");
        }
        if (schema.contains("anyOf")) {
            bool found = false;
            for (const auto& branch : schema.at("anyOf"))
                if (matches(value, branch, depth + 1)) { found = true; break; }
            require(found, "INVALID_MESSAGE");
        }
        if (schema.contains("allOf")) for (const auto& branch : schema.at("allOf")) check(value, branch, depth + 1);
        if (schema.contains("not")) require(!matches(value, schema.at("not"), depth + 1), "INVALID_MESSAGE");
        if (schema.contains("const")) require(value == schema.at("const"), "INVALID_MESSAGE");
        if (schema.contains("enum")) {
            const auto& values = schema.at("enum");
            require(std::find(values.begin(), values.end(), value) != values.end(), "INVALID_MESSAGE");
        }
        if (schema.contains("type")) {
            const auto type = text(schema.at("type"));
            const bool integer = value.is_number_integer() ||
                (value.is_number_float() && std::isfinite(value.get<double>()) && std::trunc(value.get<double>()) == value.get<double>());
            require((type == "object" && value.is_object()) || (type == "array" && value.is_array()) ||
                (type == "string" && value.is_string()) || (type == "boolean" && value.is_boolean()) ||
                (type == "integer" && integer) || (type == "number" && value.is_number()) ||
                (type == "null" && value.is_null()), "TYPE_MISMATCH");
        }
        if (value.is_object()) {
            require(value.size() >= schema.value("minProperties", std::size_t{0}) &&
                value.size() <= schema.value("maxProperties", std::numeric_limits<std::size_t>::max()), "LIMIT_EXCEEDED");
            if (schema.contains("required")) for (const auto& key : schema.at("required"))
                require(value.contains(text(key)), "INVALID_MESSAGE");
            for (auto it = value.begin(); it != value.end(); ++it) {
                if (schema.contains("propertyNames")) check(Json(it.key()), schema.at("propertyNames"), depth + 1);
                if (schema.contains("properties") && schema.at("properties").contains(it.key()))
                    check(it.value(), schema.at("properties").at(it.key()), depth + 1);
                else if (schema.contains("additionalProperties"))
                    check(it.value(), schema.at("additionalProperties"), depth + 1);
            }
        }
        if (value.is_array()) {
            require(value.size() >= schema.value("minItems", std::size_t{0}) &&
                value.size() <= schema.value("maxItems", std::numeric_limits<std::size_t>::max()), "LIMIT_EXCEEDED");
            if (schema.value("uniqueItems", false)) {
                std::set<Json> values;
                for (const auto& item : value) require(values.insert(item).second, "INVALID_MESSAGE");
            }
            if (schema.contains("items")) for (const auto& item : value) check(item, schema.at("items"), depth + 1);
        }
        if (value.is_string()) {
            const auto& str = value.get_ref<const std::string&>();
            const auto size = static_cast<std::size_t>(std::count_if(str.begin(), str.end(),
                [](unsigned char ch) { return (ch & 0xc0) != 0x80; }));
            require(size >= schema.value("minLength", std::size_t{0}) &&
                size <= schema.value("maxLength", std::numeric_limits<std::size_t>::max()), "LIMIT_EXCEEDED");
            if(schema.contains("format")) {
                require(schema.at("format")=="uuid","UNSUPPORTED_SCHEMA");
                require(uuid(str),"INVALID_MESSAGE");
            }
            if (schema.contains("pattern")) {
                // 模式来自有界内置注册表，缓存避免逐个实体重复编译相同正则。
                thread_local std::map<std::string, std::regex> patterns;
                const auto pattern = text(schema.at("pattern"));
                if (!patterns.contains(pattern)) {
                    require(pattern.size() <= 1024 && patterns.size() < 256, "SCHEMA_LIMIT_EXCEEDED");
                    try { patterns.emplace(pattern, std::regex(pattern)); }
                    catch (const std::regex_error&) { throw Error("UNSUPPORTED_SCHEMA"); }
                }
                require(std::regex_search(str, patterns.at(pattern)), "INVALID_MESSAGE");
            }
        }
        if (value.is_number()) {
            const auto number = value.get<double>();
            require(std::isfinite(number), "TYPE_MISMATCH");
            if (schema.contains("minimum")) require(number >= schema.at("minimum").get<double>(), "LIMIT_EXCEEDED");
            if (schema.contains("maximum")) require(number <= schema.at("maximum").get<double>(), "LIMIT_EXCEEDED");
            if (schema.contains("exclusiveMinimum")) require(number > schema.at("exclusiveMinimum").get<double>(), "LIMIT_EXCEEDED");
            if (schema.contains("exclusiveMaximum")) require(number < schema.at("exclusiveMaximum").get<double>(), "LIMIT_EXCEEDED");
        }
    }
};
}
void schema_check(const Json& value, const Json& schema) { Validation{schema}.check(value, schema, 0); }
void schema_check_definition(const Json& value,const Json& root,const std::string& pointer) {
    require(pointer.starts_with("/$defs/"),"UNSUPPORTED_SCHEMA");
    const auto location=Json::json_pointer(pointer);require(root.contains(location),"UNSUPPORTED_SCHEMA");
    Validation{root}.check(value,root.at(location),0);
}
}
