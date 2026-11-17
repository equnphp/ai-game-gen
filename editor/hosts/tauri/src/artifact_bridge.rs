// 独立gga桥只在后台调用线程持有；取消唯一允许跨线程，关闭与取消共用指针生命周期锁。
use crate::{ffi::Api,wire::*};
use serde_json::Value;
use sha2::{Digest,Sha256};
use std::{ffi::c_void,fs,sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},thread::{self,ThreadId}};

pub(crate) struct ArtifactApi {
    _provider:Arc<Api>,
    open:unsafe extern "C" fn(*const c_void,u32,*mut *mut c_void)->i32,
    submit:unsafe extern "C" fn(*mut c_void,*const c_void,u32)->i32,
    size:unsafe extern "C" fn(*mut c_void)->u32,
    copy:unsafe extern "C" fn(*mut c_void,*mut c_void,u32)->i32,
    release:unsafe extern "C" fn(*mut c_void),
    cancel:unsafe extern "C" fn(*mut c_void)->i32,
    close:unsafe extern "C" fn(*mut c_void),
}
impl ArtifactApi {
    #[cfg(windows)]
    pub fn load(provider:Arc<Api>)->Result<Arc<Self>>{
        use std::{os::windows::{ffi::{OsStrExt,OsStringExt},fs::MetadataExt},path::PathBuf};
        #[link(name="kernel32")]extern "system"{
            fn LoadLibraryExW(path:*const u16,file:*mut c_void,flags:u32)->*mut c_void;
            fn GetProcAddress(module:*mut c_void,name:*const u8)->*mut c_void;
            fn GetModuleFileNameW(module:*mut c_void,out:*mut u16,size:u32)->u32;
        }
        need(provider.sqlite_module.is_some(),"ARTIFACT_COMPONENT_UNAVAILABLE")?;
        let file=provider.artifact_library.as_ref().ok_or_else(||Fault::new("ARTIFACT_COMPONENT_UNAVAILABLE"))?;
        let expected=provider.artifact_sha256.as_ref().ok_or_else(||Fault::new("ARTIFACT_COMPONENT_UNAVAILABLE"))?;
        for p in file.ancestors(){let m=fs::symlink_metadata(p).map_err(|_|Fault::new("LIBRARY_INVALID"))?;need(m.file_attributes()&0x400==0,"LIBRARY_INVALID")?;}
        let metadata=fs::metadata(file).map_err(|_|Fault::new("LIBRARY_INVALID"))?;
        need(metadata.is_file() && metadata.len()<=134217728,"LIBRARY_INVALID")?;
        need(format!("{:x}",Sha256::digest(fs::read(file).map_err(|_|Fault::new("LIBRARY_INVALID"))?))==*expected,"LIBRARY_INVALID")?;
        let wide:Vec<_>=file.as_os_str().encode_wide().chain(Some(0)).collect();
        let module=unsafe{LoadLibraryExW(wide.as_ptr(),std::ptr::null_mut(),0x100|0x800)};need(!module.is_null(),"LIBRARY_INVALID")?;
        let mut loaded=vec![0u16;32768];let count=unsafe{GetModuleFileNameW(module,loaded.as_mut_ptr(),loaded.len() as u32)};
        need(count>0 && (count as usize)<loaded.len(),"LIBRARY_INVALID")?;
        let loaded=PathBuf::from(std::ffi::OsString::from_wide(&loaded[..count as usize]));
        need(fs::canonicalize(loaded).map_err(|_|Fault::new("LIBRARY_INVALID"))?==fs::canonicalize(file).map_err(|_|Fault::new("LIBRARY_INVALID"))?,"LIBRARY_INVALID")?;
        // 同Core loader约定：包括失败在内均不卸载DLL，避免跨模块CRT对象在途析构。
        macro_rules! symbol {($name:literal,$ty:ty)=>{{
            let address=unsafe{GetProcAddress(module,concat!($name,"\0").as_ptr())};need(!address.is_null(),"LIBRARY_INVALID")?;
            unsafe{std::mem::transmute::<*mut c_void,$ty>(address)}
        }}}
        let version=symbol!("gga_abi_version",unsafe extern "C" fn()->u32);need(unsafe{version()}==0x10000,"VERSION_MISMATCH")?;
        Ok(Arc::new(Self{_provider:provider,
            open:symbol!("gga_open",unsafe extern "C" fn(*const c_void,u32,*mut *mut c_void)->i32),
            submit:symbol!("gga_submit",unsafe extern "C" fn(*mut c_void,*const c_void,u32)->i32),
            size:symbol!("gga_result_size",unsafe extern "C" fn(*mut c_void)->u32),
            copy:symbol!("gga_result_copy",unsafe extern "C" fn(*mut c_void,*mut c_void,u32)->i32),
            release:symbol!("gga_result_release",unsafe extern "C" fn(*mut c_void)),
            cancel:symbol!("gga_cancel",unsafe extern "C" fn(*mut c_void)->i32),
            close:symbol!("gga_close",unsafe extern "C" fn(*mut c_void))}))
    }
    #[cfg(not(windows))]
    pub fn load(_:Arc<Api>)->Result<Arc<Self>>{Err(Fault::new("ARTIFACT_COMPONENT_UNAVAILABLE"))}
}
struct CancelState {requested:AtomicBool,live:Mutex<Option<(Arc<ArtifactApi>,usize)>>}
#[derive(Clone)]pub(crate) struct ArtifactCancellation(Arc<CancelState>);
impl ArtifactCancellation {
    pub fn new()->Self{Self(Arc::new(CancelState{requested:AtomicBool::new(false),live:Mutex::new(None)}))}
    pub fn request(&self)->Result<()>{
        self.0.requested.store(true,Ordering::Release);
        let live=self.0.live.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
        if let Some((api,context))=&*live{need(unsafe{(api.cancel)(*context as *mut c_void)}==0,"ARTIFACT_ABI")?;}Ok(())
    }
}
pub(crate) struct ArtifactBridge {api:Arc<ArtifactApi>,context:*mut c_void,thread:ThreadId,cancellation:ArtifactCancellation}
impl ArtifactBridge {
    pub fn open(api:Arc<ArtifactApi>,config:&Value,cancellation:ArtifactCancellation)->Result<Self>{
        let bytes=serde_json::to_vec(config).map_err(|_|Fault::new("INVALID_MESSAGE"))?;need(!bytes.is_empty()&&bytes.len()<=2097152,"LIMIT_EXCEEDED")?;
        let mut context=std::ptr::null_mut();let status=unsafe{(api.open)(bytes.as_ptr().cast(),bytes.len() as u32,&mut context)};
        need(status==0 && !context.is_null(),if status==-4{"LIMIT_EXCEEDED"}else{"SNAPSHOT_VALIDATION_FAILED"})?;
        let bridge=Self{api:api.clone(),context,thread:thread::current().id(),cancellation:cancellation.clone()};
        {
            let mut live=cancellation.0.live.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
            need(live.is_none(),"BUSY")?;*live=Some((api.clone(),context as usize));
            if cancellation.0.requested.load(Ordering::Acquire){need(unsafe{(api.cancel)(context)}==0,"ARTIFACT_ABI")?;}
        }Ok(bridge)
    }
    pub fn submit(&mut self,request:&Value)->Result<Value>{
        need(thread::current().id()==self.thread,"ARTIFACT_THREAD_MISMATCH")?;
        let bytes=serde_json::to_vec(request).map_err(|_|Fault::new("INVALID_MESSAGE"))?;need(!bytes.is_empty()&&bytes.len()<=2097152,"LIMIT_EXCEEDED")?;
        let status=unsafe{(self.api.submit)(self.context,bytes.as_ptr().cast(),bytes.len() as u32)};
        need(status==0,if status==-2{"BUSY"}else if status==-4{"LIMIT_EXCEEDED"}else{"ARTIFACT_ABI"})?;
        struct Slot<'a>(&'a ArtifactBridge);
        impl Drop for Slot<'_>{fn drop(&mut self){unsafe{(self.0.api.release)(self.0.context);}}}
        let _slot=Slot(self);let size=unsafe{(self.api.size)(self.context)};need(size>0&&size<=8388608,"ARTIFACT_CONTRACT_VIOLATION")?;
        let mut output=vec![0u8;size as usize];let copied=unsafe{(self.api.copy)(self.context,output.as_mut_ptr().cast(),size)};
        need(copied==size as i32,"ARTIFACT_CONTRACT_VIOLATION")?;let value=parse(&output,8388608)?;
        need(value["protocolVersion"]=="1.0" && value["requestId"]==request["requestId"] && value["ok"].is_boolean(),"ARTIFACT_CONTRACT_VIOLATION")?;Ok(value)
    }
}
impl Drop for ArtifactBridge {
    fn drop(&mut self){
        // 先清取消入口再销毁context，持锁取消不会访问已释放指针。
        let mut live=self.cancellation.0.live.lock().unwrap_or_else(|e|e.into_inner());
        if live.as_ref().is_some_and(|(_,p)|*p==self.context as usize){*live=None;}
        unsafe{(self.api.close)(self.context);}
    }
}
