// 动态库进程驻留；每个输出由原DLL释放，Rust从不接管C++分配器。
use crate::wire::{need, parse, Fault, Result};
use sha2::{Digest,Sha256};
use std::{fs, path::Path, sync::Arc};

#[repr(C)] #[derive(Clone,Copy)]
pub struct Bytes { pub data:*const u8, pub len:u64 }
#[repr(C)]
pub struct Buffer { pub data:*const u8, pub len:u64, pub token:u64 }
impl Default for Buffer {fn default()->Self{Self{data:std::ptr::null(),len:0,token:0}}}
#[repr(C)]
pub struct Config { pub size:u32,pub abi:u32,pub root:Bytes,pub flags:u32,pub reserved:u32 }
const _: () = {
    assert!(std::mem::size_of::<Bytes>()==16 && std::mem::align_of::<Bytes>()==8);
    assert!(std::mem::size_of::<Buffer>()==24 && std::mem::offset_of!(Buffer,token)==16);
    assert!(std::mem::size_of::<Config>()==32 && std::mem::offset_of!(Config,root)==8);
};
pub fn bytes(s:&[u8])->Bytes { Bytes{data:s.as_ptr(),len:s.len() as u64} }
pub struct Api {
    pub version:unsafe extern "C" fn()->u32,
    pub create:unsafe extern "C" fn(*const Config,*mut u64,*mut Buffer)->i32,
    pub submit:unsafe extern "C" fn(u64,Bytes,*mut u64,*mut Buffer)->i32,
    pub upload:unsafe extern "C" fn(u64,Bytes,u64,Bytes,*mut u64,*mut Buffer)->i32,
    pub read:unsafe extern "C" fn(u64,Bytes,u64,u32,*mut u64,*mut Buffer)->i32,
    pub poll:unsafe extern "C" fn(u64,u64,*mut Buffer,*mut Buffer)->i32,
    pub result:unsafe extern "C" fn(u64,u64,*mut Buffer,*mut Buffer,*mut Buffer)->i32,
    pub cancel:unsafe extern "C" fn(u64,u64,*mut Buffer)->i32,
    pub release:unsafe extern "C" fn(u64,u64,*mut Buffer)->i32,
    pub events:unsafe extern "C" fn(u64,u64,u32,*mut Buffer,*mut Buffer)->i32,
    pub destroy:unsafe extern "C" fn(u64,*mut Buffer)->i32,
    pub free:unsafe extern "C" fn(*mut Buffer)->i32,
    pub build_id:String,
}
struct Lease<'a>{api:&'a Api,buffer:Buffer}
impl Drop for Lease<'_>{fn drop(&mut self){unsafe{(self.api.free)(&mut self.buffer);}}}
impl Api {
    pub fn take(&self,buffer:Buffer,limit:usize)->Result<Vec<u8>>{
        let lease=Lease{api:self,buffer};
        need(lease.buffer.len<=limit as u64 && (lease.buffer.len==0 || !lease.buffer.data.is_null()),"CORE_CONTRACT_VIOLATION")?;
        if lease.buffer.len==0{return Ok(Vec::new());}
        Ok(unsafe{std::slice::from_raw_parts(lease.buffer.data,lease.buffer.len as usize)}.to_vec())
    }
    pub fn checked(&self,status:i32,error:Buffer)->Result<()>{
        let data=self.take(error,2097152)?;
        if status==0 {return Ok(());}
        let code=match status {2=>"VERSION_MISMATCH",3=>"TASK_INVALID",4=>"QUEUE_FULL",5=>"NOT_READY",6=>"BUSY",7=>"LIMIT_EXCEEDED",_=>"CORE_ABI"};
        Err(Fault{code:code.into(),outcome:"not_submitted",native:Some((status,data))})
    }
    #[cfg(windows)]
    pub fn load(directory:&Path)->Result<Arc<Self>>{
        use std::os::windows::{ffi::OsStrExt,fs::MetadataExt};
        #[link(name="kernel32")] extern "system" {
            fn LoadLibraryExW(path:*const u16,file:*mut std::ffi::c_void,flags:u32)->*mut std::ffi::c_void;
            fn GetProcAddress(module:*mut std::ffi::c_void,name:*const u8)->*mut std::ffi::c_void;
        }
        need(directory.is_dir(),"LIBRARY_NOT_FOUND")?;
        let directory=fs::canonicalize(directory).map_err(|_|Fault::new("LIBRARY_NOT_FOUND"))?;
        for ancestor in directory.ancestors(){
            let m=fs::symlink_metadata(ancestor).map_err(|_|Fault::new("LIBRARY_INVALID"))?;
            need(m.file_attributes() & 0x400==0,"LIBRARY_INVALID")?;
        }
        let manifest=parse(&fs::read(directory.join("core-artifact.json")).map_err(|_|Fault::new("LIBRARY_NOT_FOUND"))?,65536)?;
        need(manifest["abi"]=="1.0" && manifest["target"]=="windows-x86_64","LIBRARY_INVALID")?;
        let list=manifest["files"].as_array().ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
        need(!list.is_empty() && list.len()<=32,"LIBRARY_INVALID")?;
        let mut listed=std::collections::HashSet::new();
        for item in list{
            let name=item["name"].as_str().ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
            need(name.ends_with(".dll") && !name.contains(['/', '\\', ':']) && listed.insert(name.to_lowercase()),"LIBRARY_INVALID")?;
            let file=directory.join(name);
            let metadata=fs::symlink_metadata(&file).map_err(|_|Fault::new("LIBRARY_INVALID"))?;
            need(metadata.is_file() && metadata.file_attributes() & 0x400==0 && metadata.len()<=134217728,"LIBRARY_INVALID")?;
            let digest=format!("{:x}",Sha256::digest(fs::read(file).map_err(|_|Fault::new("LIBRARY_INVALID"))?));
            need(item["sha256"]==digest,"LIBRARY_INVALID")?;
        }
        need(listed.contains("ggcore.dll"),"LIBRARY_INVALID")?;
        for entry in fs::read_dir(&directory).map_err(|_|Fault::new("LIBRARY_INVALID"))?{
            let name=entry.map_err(|_|Fault::new("LIBRARY_INVALID"))?.file_name().to_string_lossy().to_lowercase();
            if name.ends_with(".dll"){need(listed.contains(&name),"LIBRARY_INVALID")?;}
        }
        let build_id=manifest["buildId"].as_str().filter(|s|!s.is_empty()).ok_or_else(||Fault::new("LIBRARY_INVALID"))?.to_owned();
        let wide:Vec<u16>=directory.join("ggcore.dll").as_os_str().encode_wide().chain(Some(0)).collect();
        let module=unsafe{LoadLibraryExW(wide.as_ptr(),std::ptr::null_mut(),0x100|0x800)};
        need(!module.is_null(),"LIBRARY_INVALID")?;
        // 不调用FreeLibrary，连缺符号失败也保持进程驻留，避免在途CRT/线程析构风险。
        macro_rules! symbol {($name:literal,$ty:ty)=>{{
            let address=unsafe{GetProcAddress(module,concat!($name,"\0").as_ptr())};
            need(!address.is_null(),"LIBRARY_INVALID")?;
            unsafe{std::mem::transmute::<*mut std::ffi::c_void,$ty>(address)}
        }}}
        let api=Self{
            version:symbol!("gg_abi_version",unsafe extern "C" fn()->u32),
            create:symbol!("gg_core_create",unsafe extern "C" fn(*const Config,*mut u64,*mut Buffer)->i32),
            submit:symbol!("gg_submit",unsafe extern "C" fn(u64,Bytes,*mut u64,*mut Buffer)->i32),
            upload:symbol!("gg_upload_write",unsafe extern "C" fn(u64,Bytes,u64,Bytes,*mut u64,*mut Buffer)->i32),
            read:symbol!("gg_blob_read",unsafe extern "C" fn(u64,Bytes,u64,u32,*mut u64,*mut Buffer)->i32),
            poll:symbol!("gg_task_poll",unsafe extern "C" fn(u64,u64,*mut Buffer,*mut Buffer)->i32),
            result:symbol!("gg_task_take_result",unsafe extern "C" fn(u64,u64,*mut Buffer,*mut Buffer,*mut Buffer)->i32),
            cancel:symbol!("gg_task_cancel",unsafe extern "C" fn(u64,u64,*mut Buffer)->i32),
            release:symbol!("gg_task_release",unsafe extern "C" fn(u64,u64,*mut Buffer)->i32),
            events:symbol!("gg_read_events",unsafe extern "C" fn(u64,u64,u32,*mut Buffer,*mut Buffer)->i32),
            destroy:symbol!("gg_core_destroy",unsafe extern "C" fn(u64,*mut Buffer)->i32),
            free:symbol!("gg_buffer_release",unsafe extern "C" fn(*mut Buffer)->i32),build_id};
        need(unsafe{(api.version)()}==0x10000,"VERSION_MISMATCH")?;Ok(Arc::new(api))
    }
    #[cfg(not(windows))]
    pub fn load(_: &Path)->Result<Arc<Self>>{
        // Android的DT_NEEDED和同NDK运行库另包接入，不借旧JNI创建第二个领域会话。
        Err(Fault::new("UNSUPPORTED"))
    }
}
