// 动态库进程驻留；每个输出由原DLL释放，Rust从不接管C++分配器。
use crate::wire::{need, parse, Fault, Result};
use sha2::{Digest,Sha256};
use std::{fs, path::{Path,PathBuf}, sync::Arc};

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
    pub sqlite_module:Option<usize>,
    pub protocols:Vec<&'static str>,
    pub artifact_library:Option<PathBuf>,
    pub artifact_sha256:Option<String>,
    pub bundle_directory:PathBuf,
    pub installation_sha256:Option<String>,
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
        use std::os::windows::{ffi::{OsStrExt,OsStringExt},fs::MetadataExt};
        #[link(name="kernel32")] extern "system" {
            fn LoadLibraryExW(path:*const u16,file:*mut std::ffi::c_void,flags:u32)->*mut std::ffi::c_void;
            fn GetProcAddress(module:*mut std::ffi::c_void,name:*const u8)->*mut std::ffi::c_void;
            fn GetModuleHandleW(name:*const u16)->*mut std::ffi::c_void;
            fn GetModuleFileNameW(module:*mut std::ffi::c_void,out:*mut u16,size:u32)->u32;
        }
        need(directory.is_dir(),"LIBRARY_NOT_FOUND")?;
        let (selected,installation_sha256)=crate::compiler_component::selected_directory(directory)?;
        let directory=fs::canonicalize(selected).map_err(|_|Fault::new("LIBRARY_NOT_FOUND"))?;
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
        let entry=manifest["entryLibrary"].as_str().unwrap_or("ggcore.dll");
        need(entry.starts_with("ggcore") && listed.contains(&entry.to_lowercase()),"LIBRARY_INVALID")?;
        for entry in fs::read_dir(&directory).map_err(|_|Fault::new("LIBRARY_INVALID"))?{
            let name=entry.map_err(|_|Fault::new("LIBRARY_INVALID"))?.file_name().to_string_lossy().to_lowercase();
            if name.ends_with(".dll"){need(listed.contains(&name),"LIBRARY_INVALID")?;}
        }
        let build_id=manifest["buildId"].as_str().filter(|s|!s.is_empty()).ok_or_else(||Fault::new("LIBRARY_INVALID"))?.to_owned();
        let bundle=if directory.join("native-runtime-bundle.json").exists(){Some(parse(&fs::read(directory.join("native-runtime-bundle.json")).map_err(|_|Fault::new("LIBRARY_INVALID"))?,65536)?)}else{None};
        let mut protocols=vec!["1.0"];let mut artifact_library=None;let mut artifact_sha256=None;
        if let Some(bundle)=&bundle {
            crate::wire::shape(bundle,&["manifestVersion","buildId","platform","libraries","sqlite","coreProtocolManifest"])?;
            need(bundle["manifestVersion"]=="gg-native-runtime-bundle-2" && bundle["buildId"]==build_id && bundle["platform"]=="windows-x64","LIBRARY_INVALID")?;
            let libraries=bundle["libraries"].as_array().filter(|a|a.len()==3).ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
            let mut ids=std::collections::HashSet::new();
            for library in libraries {
                crate::wire::shape(library,&["id","relativeFile","sha256","bytes","dependencies"])?;
                let id=library["id"].as_str().ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
                need(["CORE","ARTIFACT","SQLITE"].contains(&id)&&ids.insert(id),"LIBRARY_INVALID")?;
                let name=library["relativeFile"].as_str().ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
                let item=list.iter().find(|i|i["name"]==name).ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
                need(library["sha256"]==format!("sha256:{}",item["sha256"].as_str().unwrap_or("")) &&
                    crate::wire::u64_string(&library["bytes"])?==fs::metadata(directory.join(name)).map_err(|_|Fault::new("LIBRARY_INVALID"))?.len(),"LIBRARY_INVALID")?;
                need(library["dependencies"]==if id=="SQLITE"{serde_json::json!([])}else{serde_json::json!(["SQLITE"])},"LIBRARY_INVALID")?;
                if id=="CORE"{need(name==entry,"LIBRARY_INVALID")?;}
                if id=="ARTIFACT"{need(manifest["artifactLibrary"]==name,"LIBRARY_INVALID")?;artifact_library=Some(directory.join(name));artifact_sha256=item["sha256"].as_str().map(str::to_owned);}
                if id=="SQLITE"{need(name=="gg_sqlite3.dll","SQLITE_RUNTIME_INVALID")?;}
            }
            let declaration=&bundle["coreProtocolManifest"];
            crate::wire::shape(declaration,&["manifestVersion","coreAbi","coreLibrarySha256","sourceRevision","declarationKind","coreProtocols","requestContracts"])?;
            let core=libraries.iter().find(|l|l["id"]=="CORE").unwrap();
            need(declaration["manifestVersion"]==1 && declaration["coreAbi"]=="1.0" && declaration["declarationKind"]=="build_declaration" &&
                declaration["coreLibrarySha256"]==core["sha256"] && declaration["sourceRevision"].as_str().is_some_and(|s|!s.is_empty()&&s.len()<=256),"LIBRARY_INVALID")?;
            need(declaration["coreProtocols"]==serde_json::json!(["1.0"]) || declaration["coreProtocols"]==serde_json::json!(["1.0","1.1"]),"LIBRARY_INVALID")?;
            let contracts=declaration["requestContracts"].as_array().ok_or_else(||Fault::new("LIBRARY_INVALID"))?;
            let expected=[("1.0",include_bytes!("../../../../native/core/schema/messages.schema.json").as_slice()),("1.1",include_bytes!("../../../../native/core/schema/messages_v1_1.schema.json").as_slice())];
            need(contracts.len()==declaration["coreProtocols"].as_array().unwrap().len(),"LIBRARY_INVALID")?;
            for (index,contract) in contracts.iter().enumerate(){
                crate::wire::shape(contract,&["protocolVersion","requestSchemaSha256"])?;
                need(contract["protocolVersion"]==expected[index].0 && contract["requestSchemaSha256"]==format!("sha256:{:x}",Sha256::digest(expected[index].1)),"LIBRARY_INVALID")?;
            }
            protocols=if contracts.len()==2{vec!["1.0","1.1"]}else{vec!["1.0"]};
        }
        let sqlite_module=if !manifest["sqliteRuntime"].is_null(){
            let sqlite=&manifest["sqliteRuntime"];
            need(sqlite["name"]=="gg_sqlite3.dll" && sqlite["version"]=="3.54.1" && listed.contains("gg_sqlite3.dll"),"SQLITE_RUNTIME_INVALID")?;
            let expected=directory.join("gg_sqlite3.dll");
            let name:Vec<u16>="gg_sqlite3.dll".encode_utf16().chain(Some(0)).collect();
            let previous=unsafe{GetModuleHandleW(name.as_ptr())};
            // 先排除同名但来自其他目录的模块，不能让Core和Artifact各用一份锁状态。
            if !previous.is_null(){
                let mut buffer=vec![0u16;32768];let count=unsafe{GetModuleFileNameW(previous,buffer.as_mut_ptr(),buffer.len() as u32)};
                need(count>0 && (count as usize)<buffer.len(),"SQLITE_RUNTIME_CONFLICT")?;
                let loaded=std::path::PathBuf::from(std::ffi::OsString::from_wide(&buffer[..count as usize]));
                need(fs::canonicalize(loaded).map_err(|_|Fault::new("SQLITE_RUNTIME_CONFLICT"))?==fs::canonicalize(&expected).map_err(|_|Fault::new("LIBRARY_INVALID"))?,"SQLITE_RUNTIME_CONFLICT")?;
            }
            let wide:Vec<u16>=expected.as_os_str().encode_wide().chain(Some(0)).collect();
            let module=unsafe{LoadLibraryExW(wide.as_ptr(),std::ptr::null_mut(),0x100|0x800)};need(!module.is_null(),"SQLITE_RUNTIME_INVALID")?;
            let version=unsafe{GetProcAddress(module,b"sqlite3_libversion_number\0".as_ptr())};
            let option=unsafe{GetProcAddress(module,b"sqlite3_compileoption_used\0".as_ptr())};
            need(!version.is_null() && !option.is_null(),"SQLITE_RUNTIME_INVALID")?;
            let version:unsafe extern "C" fn()->i32=unsafe{std::mem::transmute(version)};
            let option:unsafe extern "C" fn(*const i8)->i32=unsafe{std::mem::transmute(option)};
            need(unsafe{version()}==3054001,"SQLITE_RUNTIME_INVALID")?;
            for flag in [b"THREADSAFE=1\0".as_slice(),b"OMIT_LOAD_EXTENSION\0".as_slice(),b"DQS=0\0".as_slice()]{need(unsafe{option(flag.as_ptr().cast())}!=0,"SQLITE_RUNTIME_INVALID")?;}
            if let Some(bundle)=&bundle {
                let sqlite=&bundle["sqlite"];crate::wire::shape(sqlite,&["version","sourceId","compileOptionsHash","providerTarget","providerInstancePolicy","wasmLinked"])?;
                let source=unsafe{GetProcAddress(module,b"sqlite3_sourceid\0".as_ptr())};need(!source.is_null(),"SQLITE_RUNTIME_INVALID")?;
                let source:unsafe extern "C" fn()->*const i8=unsafe{std::mem::transmute(source)};let source=unsafe{source()};need(!source.is_null(),"SQLITE_RUNTIME_INVALID")?;
                let source=unsafe{std::ffi::CStr::from_ptr(source)}.to_str().map_err(|_|Fault::new("SQLITE_RUNTIME_INVALID"))?;
                need(sqlite["version"]=="3.54.1" && sqlite["sourceId"]==source && sqlite["providerTarget"]=="gg_sqlite" && sqlite["providerInstancePolicy"]=="one_per_process_linker_namespace" && sqlite["wasmLinked"]==false &&
                    sqlite["compileOptionsHash"]==format!("sha256:{:x}",Sha256::digest(b"[\"DQS=0\",\"OMIT_LOAD_EXTENSION\",\"THREADSAFE=1\"]")),"SQLITE_RUNTIME_INVALID")?;
            }
            if previous.is_null(){
                let configure=unsafe{GetProcAddress(module,b"sqlite3_config\0".as_ptr())};let initialize=unsafe{GetProcAddress(module,b"sqlite3_initialize\0".as_ptr())};
                need(!configure.is_null()&&!initialize.is_null(),"SQLITE_RUNTIME_INVALID")?;
                let configure:unsafe extern "C" fn(i32,...)->i32=unsafe{std::mem::transmute(configure)};
                let initialize:unsafe extern "C" fn()->i32=unsafe{std::mem::transmute(initialize)};
                // 在任何Core/Artifact连接打开前配置一次；模块终生驻留且不调用shutdown。
                need(unsafe{configure(3)}==0 && unsafe{initialize()}==0,"SQLITE_RUNTIME_INVALID")?;
            }
            Some(module as usize)
        }else{None};
        need(bundle.is_none() || sqlite_module.is_some(),"SQLITE_RUNTIME_INVALID")?;
        let wide:Vec<u16>=directory.join(entry).as_os_str().encode_wide().chain(Some(0)).collect();
        let module=unsafe{LoadLibraryExW(wide.as_ptr(),std::ptr::null_mut(),0x100|0x800)};
        need(!module.is_null(),"LIBRARY_INVALID")?;
        let mut loaded_path=vec![0u16;32768];let loaded_count=unsafe{GetModuleFileNameW(module,loaded_path.as_mut_ptr(),loaded_path.len() as u32)};
        need(loaded_count>0 && (loaded_count as usize)<loaded_path.len(),"LIBRARY_INVALID")?;
        let loaded_path=std::path::PathBuf::from(std::ffi::OsString::from_wide(&loaded_path[..loaded_count as usize]));
        need(fs::canonicalize(loaded_path).map_err(|_|Fault::new("LIBRARY_INVALID"))?==fs::canonicalize(directory.join(entry)).map_err(|_|Fault::new("LIBRARY_INVALID"))?,"LIBRARY_INVALID")?;
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
            free:symbol!("gg_buffer_release",unsafe extern "C" fn(*mut Buffer)->i32),build_id,sqlite_module,protocols,artifact_library,artifact_sha256,bundle_directory:directory,installation_sha256};
        need(unsafe{(api.version)()}==0x10000,"VERSION_MISMATCH")?;Ok(Arc::new(api))
    }
    #[cfg(not(windows))]
    pub fn load(_: &Path)->Result<Arc<Self>>{
        // Android的DT_NEEDED和同NDK运行库另包接入，不借旧JNI创建第二个领域会话。
        Err(Fault::new("UNSUPPORTED"))
    }
}
