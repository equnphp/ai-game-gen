// 不依赖解析器的默认覆盖策略，重复键与非有限数字在入口明确拒绝。
#include "core/schema/value.hpp"
#include "contracts.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>
#include <regex>
#include <set>
namespace gg {
namespace {
void normalize(Json& v) {
    if (v.is_string()) require(v.get_ref<const std::string&>().find('\0') == std::string::npos, "INVALID_MESSAGE");
    if (v.is_number_float()) {
        const auto n = v.get<double>();
        require(std::isfinite(n), "INVALID_MESSAGE");
        if (n == 0) v = 0.0;
    }
    if (v.is_structured()) for (auto& x : v) normalize(x);
}
std::size_t characters(const std::string& s) {
    return std::count_if(s.begin(), s.end(), [](unsigned char c) { return (c & 0xc0) != 0x80; });
}
}
Json parse(std::string_view s, std::size_t limit) {
    require(!s.empty() && s.size() <= limit, "LIMIT_EXCEEDED");
    require(!s.starts_with("\xef\xbb\xbf"), "INVALID_MESSAGE");
    std::vector<std::set<std::string>> keys;
    auto cb = [&](int depth, Json::parse_event_t event, Json& value) {
        require(depth <= 32, "LIMIT_EXCEEDED");
        if (event == Json::parse_event_t::object_start) keys.emplace_back();
        if (event == Json::parse_event_t::key)
            require(!keys.empty() && keys.back().insert(value.get<std::string>()).second, "INVALID_MESSAGE");
        if (event == Json::parse_event_t::object_end) keys.pop_back();
        return true;
    };
    try {
        auto v = Json::parse(s.begin(), s.end(), cb, true, false);
        normalize(v);
        return v;
    } catch (const Json::exception&) { throw Error("INVALID_MESSAGE"); }
}
void request_check(const Json& request) {
    static const Json schema = parse(message_schema, 1048576);
    static const Json schema_v1_1 = parse(message_schema_v1_1, 1048576);
    schema_check(request, request.is_object() && request.value("protocolVersion", "") == "1.1" ? schema_v1_1 : schema);
}
bool uuid(std::string_view s) {
    static const std::regex re("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    return std::regex_match(s.begin(), s.end(), re);
}
bool content_hash(std::string_view s) {
    return s.size() == 71 && s.starts_with("sha256:") &&
        std::all_of(s.begin() + 7, s.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); });
}
std::uint64_t decimal(const Json& value) {
    require(value.is_string(), "TYPE_MISMATCH");
    const auto str = value.get<std::string>();
    require(!str.empty() && (str == "0" || str[0] != '0'), "TYPE_MISMATCH");
    std::uint64_t result = 0;
    for (char c : str) {
        require(c >= '0' && c <= '9', "TYPE_MISMATCH");
        const auto digit = static_cast<unsigned>(c - '0');
        require(result <= (INT64_MAX - digit) / 10, "LIMIT_EXCEEDED");
        result = result * 10 + digit;
    }
    return result;
}
std::string text(const Json& value) {
    require(value.is_string(), "TYPE_MISMATCH");
    return value.get<std::string>();
}
Hasher::Hasher() { mbedtls_sha256_init(&context_); require(mbedtls_sha256_starts(&context_, 0) == 0, "INTERNAL_ERROR"); }
Hasher::~Hasher() { mbedtls_sha256_free(&context_); }
void Hasher::update(std::string_view bytes) {
    require(mbedtls_sha256_update(&context_, reinterpret_cast<const unsigned char*>(bytes.data()), bytes.size()) == 0,
            "INTERNAL_ERROR");
}
std::string Hasher::finish() {
    unsigned char out[32]{};
    require(mbedtls_sha256_finish(&context_, out) == 0, "INTERNAL_ERROR");
    static constexpr char digits[] = "0123456789abcdef";
    std::string s = "sha256:";
    for (unsigned char c : out) { s += digits[c >> 4]; s += digits[c & 15]; }
    return s;
}
std::string hash(std::string_view bytes) { Hasher h; h.update(bytes); return h.finish(); }
Json error_json(std::string_view code, const Json& request) {
    Json e = {{"code", code}, {"messageKey", "core." + std::string(code)}, {"retryable", code == "QUEUE_FULL"},
              {"recoveryActions", Json::array()}};
    for (const char* key : {"requestId", "projectId"}) if (request.contains(key)) e[key] = request.at(key);
    if (code == "IO_ERROR" || code == "DATABASE_CORRUPT" || code == "STORAGE_FULL")
        e["recoveryActions"] = {"preserve_original", "reopen_then_request_lookup"};
    return e;
}
std::string envelope(const Json& request, const Json& data) {
    return Json{{"ok", true}, {"requestId", request.value("requestId", "")},
                {"op", request.value("op", "")}, {"data", data}, {"error", nullptr}}.dump();
}
std::int64_t now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}
}
