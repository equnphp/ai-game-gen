// 项目会话是唯一领域入口；调用由每Core的执行线程串行化。
#pragma once
#include "core/document/document.hpp"
#include "core/storage/sqlite/store.hpp"
#include "platform/platform.hpp"
#include <chrono>
#include <optional>
namespace gg {
struct Control {
    std::function<void()> checkpoint;
    std::function<void()> commit_gate;
    std::function<void(const Json&)> publish;
    std::function<bool()> sole_task;
};
struct Proposal {
    std::string id, digest, validated;
    std::int64_t base = 0;
    Json operations;
    std::chrono::steady_clock::time_point expires;
};
class Session {
    RootGrant& root_;
    Store store_;
    std::unique_ptr<ProjectLocation> location_;
    std::string project_, branch_, settings_;
    Json read_only_ = Json::array();
    bool recovery_required_ = false;
    std::map<std::string, Proposal> proposals_;
    struct Cached { std::string digest, result, proposal; };
    std::map<std::string, Cached> volatile_requests_;
    void open_metadata();
    State load_state(const std::optional<std::string>& snapshot = {});
    Document load_version(const std::string& id, const std::string& version);
    void record_identities(const State& before, const State& after, std::int64_t revision, bool restoring, bool dry_run = false);
    void insert_version(const Document& document, std::int64_t revision);
    std::string snapshot(const State& state, std::int64_t revision, const std::string& reason);
    void save_request(const Json& request, const std::string& digest, const std::string& result,
                      const Json& revision = nullptr);
    std::string commit(const Json& request, const std::string& digest, State candidate,
                       const std::string& kind, const Control& control,
                       const std::string& source = "", const std::function<void(std::int64_t)>& extra = {});
    Json query(const Json& request, const Control& control);
    std::string create(const Json& request, const std::string& digest, const Control& control);
    std::string operate(const Json& request, const std::string& digest, const Control& control);
    std::string asset_command(const Json& request, const std::string& digest, const Control& control);
    void writable();
    void expected(const Json& request);
    void expire_proposals();
    Json asset_metadata(const std::string& id);
    std::string maintenance(const Json& request, const std::string& digest, const Control& control);
public:
    explicit Session(RootGrant& grant) : root_(grant) {}
    bool is_open() const { return static_cast<bool>(location_); }
    std::int64_t head();
    void failed(const std::string& code) {
        if (code=="IO_ERROR" || code=="STORAGE_FULL" || code=="DATABASE_CORRUPT") recovery_required_=true;
    }
    std::string execute(const std::string& raw, const Control& control);
    std::string upload_write(const std::string& upload, std::uint64_t offset, std::string_view bytes, const Control& control);
    std::pair<std::string,std::string> blob_read(const std::string& hash, std::uint64_t offset,
                                              std::uint32_t maximum, const Control& control);
};
}
