// 任务保留到宿主显式释放；队列、结果和输入块都采用有界背压。
#pragma once
#include "core/application/session.hpp"
#include <atomic>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <thread>
#include <unordered_map>
namespace gg {
enum class Work { Message, Upload, BlobRead };
struct Task {
    std::uint64_t id=0, offset=0;
    std::uint32_t maximum=0;
    Work work=Work::Message;
    std::string input, bytes, result, binary;
    std::size_t reservation=0;
    std::string state="QUEUED", phase="queued";
    bool cancelled=false, committing=false, durable=false, binary_taken=false;
    bool terminal() const { return state=="SUCCEEDED" || state=="FAILED" || state=="CANCELLED"; }
};
class Core {
    RootGrant grant_;
    Session session_;
    std::thread worker_;
    std::condition_variable wake_;
    std::deque<std::shared_ptr<Task>> queue_;
    std::unordered_map<std::uint64_t,std::shared_ptr<Task>> tasks_;
    std::deque<Json> events_;
    std::size_t reserved_=0, blocks_=0;
    std::uint64_t sequence_=0;
    bool stop_=false, executing_=false, open_=false;
    void run();
    Control control(const std::shared_ptr<Task>& task);
public:
    std::mutex mutex;
    const std::string instance=random_uuid();
    explicit Core(const std::string& root);
    ~Core();
    void enqueue(const std::shared_ptr<Task>& task);
    std::shared_ptr<Task> task(std::uint64_t id);
    Json poll(const std::shared_ptr<Task>& task) const;
    void cancel(const std::shared_ptr<Task>& task);
    void release(const std::shared_ptr<Task>& task);
    Json events(std::uint64_t after, std::uint32_t limit) const;
    bool destroyable() const { return tasks_.empty() && !open_ && !executing_; }
};
std::uint64_t next_handle();
}
