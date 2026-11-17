// JNI仅复制UTF-8/二进制和翻译ABI错误，绝不解析项目或直接操作数据库。
#include "gg_core_v1.h"
#include <jni.h>
#include <stdexcept>
#include <string>
namespace {
struct Buffer {
    gg_buffer_v1 b{};
    ~Buffer(){gg_buffer_release(&b);}
};
std::string copy(JNIEnv* env,jbyteArray array) {
    if(!array)throw std::runtime_error("INVALID_ARGUMENT");
    const auto n=env->GetArrayLength(array);
    if(n>2097152)throw std::runtime_error("LIMIT_EXCEEDED");
    std::string bytes(n,'\0');
    env->GetByteArrayRegion(array,0,n,reinterpret_cast<jbyte*>(bytes.data()));
    if(env->ExceptionCheck())throw std::runtime_error("JNI_COPY_FAILED");
    return bytes;
}
gg_bytes_v1 bytes(const std::string& s){return {reinterpret_cast<const uint8_t*>(s.data()),s.size()};}
void check(gg_status status,Buffer& error) {
    if(status!=GG_OK)throw std::runtime_error(error.b.len?
        std::string(reinterpret_cast<const char*>(error.b.data),error.b.len):"CORE_ABI_ERROR");
}
jbyteArray array(JNIEnv* env,const gg_buffer_v1& buffer) {
    auto value=env->NewByteArray(static_cast<jsize>(buffer.len));
    if(!value)throw std::runtime_error("JNI_ALLOCATION_FAILED");
    if(buffer.len)env->SetByteArrayRegion(value,0,static_cast<jsize>(buffer.len),reinterpret_cast<const jbyte*>(buffer.data));
    if(env->ExceptionCheck())throw std::runtime_error("JNI_COPY_FAILED");
    return value;
}
template<class F> auto guard(JNIEnv* env,F f)->decltype(f()) {
    try{return f();}catch(const std::exception& e){
        if(!env->ExceptionCheck()){
            auto cls=env->FindClass("java/lang/IllegalStateException");
            if(cls)env->ThrowNew(cls,e.what());
        }
    }catch(...){
        if(!env->ExceptionCheck()){
            auto cls=env->FindClass("java/lang/IllegalStateException");
            if(cls)env->ThrowNew(cls,"CORE_INTERNAL_ERROR");
        }
    }
    return {};
}
}
#define JNI_NAME(name) Java_com_aimeta_gamegen_core_NativeCore_##name
extern "C" {
JNIEXPORT jlong JNICALL JNI_NAME(create)(JNIEnv* env,jobject,jbyteArray root) {
    return guard(env,[&]()->jlong {auto s=copy(env,root);gg_core core=0;Buffer error;
        gg_core_config_v1 config{sizeof(gg_core_config_v1),gg_abi_version(),bytes(s),0,0};
        check(gg_core_create(&config,&core,&error.b),error);return static_cast<jlong>(core);});
}
JNIEXPORT jlong JNICALL JNI_NAME(submit)(JNIEnv* env,jobject,jlong core,jbyteArray message) {
    return guard(env,[&]()->jlong {auto s=copy(env,message);gg_task task=0;Buffer error;
        check(gg_submit(core,bytes(s),&task,&error.b),error);return static_cast<jlong>(task);});
}
JNIEXPORT jlong JNICALL JNI_NAME(uploadWrite)(JNIEnv* env,jobject,jlong core,jbyteArray upload,jlong offset,jbyteArray data) {
    return guard(env,[&]()->jlong {if(offset<0)throw std::runtime_error("RANGE_ERROR");
        auto id=copy(env,upload),s=copy(env,data);gg_task task=0;Buffer error;
        check(gg_upload_write(core,bytes(id),offset,bytes(s),&task,&error.b),error);return static_cast<jlong>(task);});
}
JNIEXPORT jlong JNICALL JNI_NAME(blobRead)(JNIEnv* env,jobject,jlong core,jbyteArray content,jlong offset,jint maximum) {
    return guard(env,[&]()->jlong {if(offset<0 || maximum<1)throw std::runtime_error("RANGE_ERROR");
        auto id=copy(env,content);gg_task task=0;Buffer error;
        check(gg_blob_read(core,bytes(id),offset,maximum,&task,&error.b),error);return static_cast<jlong>(task);});
}
JNIEXPORT jbyteArray JNICALL JNI_NAME(poll)(JNIEnv* env,jobject,jlong core,jlong task) {
    return guard(env,[&]{Buffer out,error;check(gg_task_poll(core,task,&out.b,&error.b),error);return array(env,out.b);});
}
JNIEXPORT jobjectArray JNICALL JNI_NAME(takeResult)(JNIEnv* env,jobject,jlong core,jlong task) {
    return guard(env,[&]()->jobjectArray {Buffer out,binary,error;
        check(gg_task_take_result(core,task,&out.b,&binary.b,&error.b),error);
        auto cls=env->FindClass("[B");if(!cls)throw std::runtime_error("JNI_CLASS_FAILED");
        auto result=env->NewObjectArray(2,cls,nullptr);if(!result)throw std::runtime_error("JNI_ALLOCATION_FAILED");
        auto a=array(env,out.b),b=array(env,binary.b);
        env->SetObjectArrayElement(result,0,a);env->SetObjectArrayElement(result,1,b);
        env->DeleteLocalRef(a);env->DeleteLocalRef(b);return result;});
}
JNIEXPORT void JNICALL JNI_NAME(cancel)(JNIEnv* env,jobject,jlong core,jlong task) {
    guard(env,[&]{Buffer error;check(gg_task_cancel(core,task,&error.b),error);return 0;});
}
JNIEXPORT void JNICALL JNI_NAME(releaseTask)(JNIEnv* env,jobject,jlong core,jlong task) {
    guard(env,[&]{Buffer error;check(gg_task_release(core,task,&error.b),error);return 0;});
}
JNIEXPORT jbyteArray JNICALL JNI_NAME(events)(JNIEnv* env,jobject,jlong core,jlong after,jint limit) {
    return guard(env,[&]{if(after<0 || limit<1)throw std::runtime_error("INVALID_ARGUMENT");Buffer out,error;
        check(gg_read_events(core,after,limit,&out.b,&error.b),error);return array(env,out.b);});
}
JNIEXPORT void JNICALL JNI_NAME(destroy)(JNIEnv* env,jobject,jlong core) {
    guard(env,[&]{Buffer error;check(gg_core_destroy(core,&error.b),error);return 0;});
}
}
