// 无GUI接入工具只转发请求，所有领域合法性由核心决定。
#include "gg_core_v1.h"
#include <chrono>
#include <iostream>
#include <string>
#include <thread>
namespace {
gg_bytes_v1 bytes(const std::string& s) { return {reinterpret_cast<const uint8_t*>(s.data()),s.size()}; }
std::string take(gg_buffer_v1& b) {
    std::string value = b.len ? std::string(reinterpret_cast<const char*>(b.data),b.len) : "";
    gg_buffer_release(&b);return value;
}
void report(gg_buffer_v1& error) { std::cerr << take(error) << '\n'; }
}
int main(int argc,char** argv) {
    if(argc!=2) {std::cerr<<"Usage: gg-core-driver <existing-authorized-root>\n";return 2;}
    const std::string root=argv[1];
    gg_core_config_v1 config{sizeof(gg_core_config_v1),gg_abi_version(),bytes(root),0,0};
    gg_core core=0;gg_buffer_v1 error{};
    if(gg_core_create(&config,&core,&error)!=GG_OK){report(error);return 1;}
    std::string line;
    while(std::getline(std::cin,line)) {
        if(line.empty())continue;gg_task task=0;
        if(gg_submit(core,bytes(line),&task,&error)!=GG_OK){report(error);continue;}
        bool polling=true;
        while(polling) {
            gg_buffer_v1 state{};
            if(gg_task_poll(core,task,&state,&error)!=GG_OK){report(error);break;}
            const auto value=take(state);
            polling=value.find("\"state\":\"SUCCEEDED\"")==std::string::npos &&
                    value.find("\"state\":\"FAILED\"")==std::string::npos &&
                    value.find("\"state\":\"CANCELLED\"")==std::string::npos;
            if(polling)std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        gg_buffer_v1 result{},binary{};
        if(gg_task_take_result(core,task,&result,&binary,&error)==GG_OK)std::cout<<take(result)<<'\n';
        else report(error);
        gg_buffer_release(&binary);
        if(gg_task_release(core,task,&error)!=GG_OK)report(error);
    }
    // 调用者须先发送project.close；忙时不隐式等待/销毁有会话的Core。
    if(gg_core_destroy(core,&error)!=GG_OK){report(error);return 1;}
    return 0;
}
