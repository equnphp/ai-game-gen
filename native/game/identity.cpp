// 固定MbedTLS CTR_DRBG通过标准getentropy取得熵，宿主负责同步安全熵facade。
#include "game/identity.hpp"
#include "core/schema/value.hpp"
#include <mbedtls/ctr_drbg.h>
#include <unistd.h>
#include <array>
#include <algorithm>
namespace gg::game {
namespace {
int entropy(void*,unsigned char* output,std::size_t bytes) {
    while(bytes) {const auto count=std::min<std::size_t>(bytes,256);if(getentropy(output,count)!=0)return MBEDTLS_ERR_CTR_DRBG_ENTROPY_SOURCE_FAILED;output+=count;bytes-=count;}
    return 0;
}
struct Identity {
    mbedtls_ctr_drbg_context state;
    Identity() {
        mbedtls_ctr_drbg_init(&state);constexpr char personalization[]="GameGen ABI1.1 identity";
        const auto status=mbedtls_ctr_drbg_seed(&state,entropy,nullptr,reinterpret_cast<const unsigned char*>(personalization),sizeof(personalization)-1);
        if(status!=0){mbedtls_ctr_drbg_free(&state);throw Error("ENTROPY_UNAVAILABLE");}
        mbedtls_ctr_drbg_set_reseed_interval(&state,1024);
    }
    ~Identity(){mbedtls_ctr_drbg_free(&state);}
};
}
std::string identity_uuid() {
    static Identity identity;std::array<unsigned char,16> data{};
    require(mbedtls_ctr_drbg_random(&identity.state,data.data(),data.size())==0,"ENTROPY_UNAVAILABLE");
    data[6]=(data[6]&15)|64;data[8]=(data[8]&63)|128;constexpr char hex[]="0123456789abcdef";
    std::string result;result.reserve(36);
    for(std::size_t i=0;i<data.size();++i){if(i==4 || i==6 || i==8 || i==10)result.push_back('-');result.push_back(hex[data[i]>>4]);result.push_back(hex[data[i]&15]);}
    return result;
}
}
