// 共享值边界：严格消息、结构化错误和摘要不依赖任何宿主UI类型。
#pragma once
#include <nlohmann/json.hpp>
#include <mbedtls/sha256.h>
#include <mbedtls/version.h>
static_assert(NLOHMANN_JSON_VERSION_MAJOR==3 && NLOHMANN_JSON_VERSION_MINOR==12 && NLOHMANN_JSON_VERSION_PATCH==0);
static_assert(MBEDTLS_VERSION_NUMBER==0x03060700);
#include <cstdint>
#include <functional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>
namespace gg {
using Json = nlohmann::json;
struct Error : std::runtime_error {
    std::string code;
    explicit Error(std::string c) : std::runtime_error(c), code(std::move(c)) {}
};
inline void require(bool b, const char* code) { if (!b) throw Error(code); }
Json parse(std::string_view s, std::size_t limit = 2097152);
void schema_check(const Json& value, const Json& schema);
void request_check(const Json& request);
bool uuid(std::string_view s);
bool content_hash(std::string_view s);
std::uint64_t decimal(const Json& value);
std::string text(const Json& value);
std::string hash(std::string_view bytes);
class Hasher {
    mbedtls_sha256_context context_{};
public:
    Hasher();
    ~Hasher();
    Hasher(const Hasher&) = delete;
    Hasher& operator=(const Hasher&) = delete;
    void update(std::string_view bytes);
    std::string finish();
};
Json error_json(std::string_view code, const Json& request = Json::object());
std::string envelope(const Json& request, const Json& data);
std::int64_t now_ms();
std::string random_uuid();
}
