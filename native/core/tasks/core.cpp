// 取消检查和提交闸门共用互斥量，消除“已确认取消却继续提交”的竞态。
#include "core/tasks/core.hpp"
namespace gg {
std::uint64_t next_handle() {
    static std::atomic<std::uint64_t> sequence{1};
    const auto id=sequence.fetch_add(1);
    require(id>0 && id<UINT64_MAX,"LIMIT_EXCEEDED");return id;
}
Core::Core(const std::string& root) : grant_(root),session_(grant_) { worker_=std::thread([this]{run();}); }
Core::~Core() {
    {std::lock_guard guard(mutex);stop_=true;}wake_.notify_one();
    if(worker_.joinable())worker_.join();
}
void Core::enqueue(const std::shared_ptr<Task>& t) {
    std::lock_guard guard(mutex);
    require(!stop_ && tasks_.size()<32 && reserved_+t->reservation<=8388608,"QUEUE_FULL");
    require(t->work!=Work::Upload || blocks_<4,"QUEUE_FULL");
    // 入队前预留收据空间；任务完成后由release回收预算。
    t->result.reserve(t->reservation);
    tasks_.emplace(t->id,t);
    try {queue_.push_back(t);}catch(...){tasks_.erase(t->id);throw;}
    reserved_+=t->reservation;if(t->work==Work::Upload)++blocks_;wake_.notify_one();
}
std::shared_ptr<Task> Core::task(std::uint64_t id) {
    const auto it=tasks_.find(id);require(it!=tasks_.end(),"INVALID_HANDLE");return it->second;
}
Json Core::poll(const std::shared_ptr<Task>& t) const {
    return {{"taskId",std::to_string(t->id)},{"state",t->state},{"phase",t->phase},
            {"cancellable",!t->committing && !t->terminal()},{"progress",t->terminal()?1.0:0.0},{"coreInstanceId",instance}};
}
void Core::cancel(const std::shared_ptr<Task>& t) {
    require(!t->durable,"ALREADY_COMMITTED");require(!t->committing,"CANCEL_TOO_LATE");
    if(!t->terminal())t->cancelled=true;
}
void Core::release(const std::shared_ptr<Task>& t) {
    require(t->terminal(),"TASK_NOT_READY");reserved_-=t->reservation;tasks_.erase(t->id);
}
Json Core::events(std::uint64_t after,std::uint32_t limit) const {
    require(limit>=1 && limit<=100,"INVALID_MESSAGE");
    const bool gap=!events_.empty() && after<events_.front().at("seq").get<std::uint64_t>()-1;
    Json records=Json::array();std::uint64_t next=after;
    for(const auto& e:events_)if(e.at("seq").get<std::uint64_t>()>after && records.size()<limit) {
        records.push_back(e);next=e.at("seq").get<std::uint64_t>();
    }
    return {{"coreInstanceId",instance},{"events",records},{"nextSeq",std::to_string(next)},{"gap",gap || after>sequence_}};
}
Control Core::control(const std::shared_ptr<Task>& t) {
    return {
        [this,t] {std::lock_guard guard(mutex);require(!t->cancelled,"CANCELLED");},
        [this,t] {std::lock_guard guard(mutex);require(!t->cancelled,"CANCELLED");t->committing=true;
                  t->state="COMMITTING";t->phase="commit";},
        [this](const Json& message) {std::lock_guard guard(mutex);auto e=message;e["seq"]=++sequence_;
                 events_.push_back(std::move(e));if(events_.size()>256)events_.pop_front();},
        [this] {std::lock_guard guard(mutex);return !executing_ || queue_.empty();}
    };
}
void Core::run() {
    for(;;) {
        std::shared_ptr<Task> t;
        {std::unique_lock lock(mutex);wake_.wait(lock,[this]{return stop_ || !queue_.empty();});
         if(stop_ && queue_.empty())return;t=queue_.front();queue_.pop_front();executing_=true;
         t->state="RUNNING";t->phase="execute";}
        std::string result,binary,state="SUCCEEDED";bool durable=false;
        try {
            const auto c=control(t);c.checkpoint();
            if(t->work==Work::Message)result=session_.execute(t->input,c);
            else if(t->work==Work::Upload)result=session_.upload_write(t->input,t->offset,t->bytes,c);
            else {auto pair=session_.blob_read(t->input,t->offset,t->maximum,c);result=std::move(pair.first);binary=std::move(pair.second);}
            require(result.size()+binary.size()<=t->reservation,"LIMIT_EXCEEDED");
            // 已成功的存储变更不因稍后的取消标志被改报CANCELLED。
            durable=t->committing;
        } catch(const Error& e) {
            session_.failed(e.code);
            state=e.code=="CANCELLED"?"CANCELLED":"FAILED";
            Json r=Json::object();try{if(t->work==Work::Message){const auto raw=parse(t->input);if(raw.is_object())for(const char* k:{"requestId","op","projectId"})if(raw.contains(k) && raw.at(k).is_string())r[k]=raw.at(k);}}catch(...){}
            result=Json{{"ok",false},{"requestId",r.value("requestId","")},{"op",r.value("op","")},
                        {"data",nullptr},{"error",error_json(e.code,r)}}.dump();
        } catch(...) {
            state="FAILED";result=Json{{"ok",false},{"requestId",""},{"op",""},{"data",nullptr},
                                       {"error",error_json("INTERNAL_ERROR")}}.dump();
        }
        {std::lock_guard guard(mutex);
         t->result=std::move(result);t->binary=std::move(binary);t->state=state;t->phase="complete";t->durable=durable;
         t->bytes.clear();t->input.clear();if(t->work==Work::Upload)--blocks_;
         open_=session_.is_open();executing_=false;}
    }
}
}
