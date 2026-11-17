// 运行端口是单写actor；宿主只通过受限资源消息和帧调度推进，不因查询偷偷执行tick。
#pragma once
#include "engine/resource.hpp"
#include <memory>
namespace gg::runtime {
struct PortConfig {
    std::string epoch,profile_id,profile_hash,build,adapter;
    bool development=false;
    std::function<std::string()> new_id;
    std::function<void(const Json&)> host_request;
};
class RuntimePort {
    class Impl;
    std::unique_ptr<Impl> impl_;
public:
    explicit RuntimePort(PortConfig);
    ~RuntimePort();
    std::string submit(std::string_view request);
    void resource_complete(const Json& result);
    bool accepts_completion(const Json& result)const;
    // 内部调度片；ABI层验证单调宿主时钟与生命周期后调用，单位为毫秒。
    unsigned advance(double elapsed_ms,unsigned maximum_steps);
    unsigned pending_flags()const;
    void lifecycle(unsigned event);
};
}
