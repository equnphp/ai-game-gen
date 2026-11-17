// 原生私有文件采用同目录同步暂存与原子替换，语言和工作区共享这一落盘边界。
use std::{fs::{self,File,OpenOptions},io::Write,path::Path};
use crate::wire::*;
pub(crate) fn write_new(path:&Path,bytes:&[u8])->std::io::Result<()>{
    let mut options=OpenOptions::new();options.create_new(true).write(true);
    #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
    let mut file=options.open(path)?;file.write_all(bytes)?;file.sync_all()
}
pub(crate) fn replace(from:&Path,to:&Path)->std::io::Result<()>{
    #[cfg(windows)]{
        use std::os::windows::ffi::OsStrExt;
        #[link(name="kernel32")]extern "system"{fn MoveFileExW(a:*const u16,b:*const u16,flags:u32)->i32;}
        let a:Vec<_>=from.as_os_str().encode_wide().chain(Some(0)).collect();
        let b:Vec<_>=to.as_os_str().encode_wide().chain(Some(0)).collect();
        if unsafe{MoveFileExW(a.as_ptr(),b.as_ptr(),1|8)}==0{return Err(std::io::Error::last_os_error());}
        Ok(())
    }
    #[cfg(not(windows))]{fs::rename(from,to)?;File::open(to.parent().unwrap())?.sync_all()}
}
pub(crate) fn publish_new(from:&Path,to:&Path)->std::io::Result<()>{
    #[cfg(windows)]{
        use std::os::windows::ffi::OsStrExt;
        #[link(name="kernel32")]extern "system"{fn MoveFileExW(a:*const u16,b:*const u16,flags:u32)->i32;}
        let a:Vec<_>=from.as_os_str().encode_wide().chain(Some(0)).collect();let b:Vec<_>=to.as_os_str().encode_wide().chain(Some(0)).collect();
        // 不设置REPLACE_EXISTING；新设备库发布不能覆盖同时出现的既有文件。
        if unsafe{MoveFileExW(a.as_ptr(),b.as_ptr(),8)}==0{return Err(std::io::Error::last_os_error());}Ok(())
    }
    #[cfg(not(windows))]{fs::hard_link(from,to)?;fs::remove_file(from)?;File::open(to.parent().unwrap())?.sync_all()}
}

// 私有设备文件与工作区共用物理目录检查，不在各服务复制Win32身份算法。
pub(crate) fn safe_metadata(path:&Path)->std::io::Result<fs::Metadata>{
    let m=fs::symlink_metadata(path)?;
    #[cfg(windows)]{use std::os::windows::fs::MetadataExt;if m.file_attributes()&0x400!=0{return Err(std::io::ErrorKind::PermissionDenied.into());}}
    if m.file_type().is_symlink(){return Err(std::io::ErrorKind::PermissionDenied.into());}Ok(m)
}
pub(crate) fn safe_ancestors(path:&Path)->bool {path.ancestors().all(|p|safe_metadata(p).is_ok())}
#[cfg(windows)]
pub(crate) fn directory_identity(file:&File)->Result<String>{
    use std::{os::windows::io::AsRawHandle,ffi::c_void};
    #[repr(C)]struct Info{attributes:u32,created:[u32;2],accessed:[u32;2],modified:[u32;2],volume:u32,size_high:u32,size_low:u32,links:u32,index_high:u32,index_low:u32}
    #[link(name="kernel32")]extern "system"{fn GetFileInformationByHandle(file:*mut c_void,out:*mut Info)->i32;}
    let mut info=Info{attributes:0,created:[0;2],accessed:[0;2],modified:[0;2],volume:0,size_high:0,size_low:0,links:0,index_high:0,index_low:0};
    need(unsafe{GetFileInformationByHandle(file.as_raw_handle(),&mut info)}!=0 && info.attributes&0x10!=0 && info.attributes&0x400==0,"PATH_UNSAFE")?;
    Ok(format!("{}:{}:{}",info.volume,info.index_high,info.index_low))
}
#[cfg(not(windows))]
pub(crate) fn directory_identity(_: &File)->Result<String>{Err(Fault::new("WORKSPACE_UNAVAILABLE"))}
#[cfg(windows)]
pub(crate) fn directory_lease(path:&Path)->Result<File>{
    use std::os::windows::fs::OpenOptionsExt;
    need(safe_ancestors(path) && safe_metadata(path).is_ok_and(|m|m.is_dir()),"PATH_UNSAFE")?;
    let file=OpenOptions::new().access_mode(0x80).share_mode(1|2).custom_flags(0x02000000|0x00200000).open(path).map_err(|_|Fault::new("WORKSPACE_UNAVAILABLE"))?;directory_identity(&file)?;Ok(file)
}
#[cfg(not(windows))]
pub(crate) fn directory_lease(_: &Path)->Result<File>{Err(Fault::new("WORKSPACE_UNAVAILABLE"))}
