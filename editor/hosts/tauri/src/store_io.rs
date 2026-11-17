// 原生私有文件采用同目录同步暂存与原子替换，语言和工作区共享这一落盘边界。
use std::{fs::OpenOptions,io::Write,path::Path};
#[cfg(not(windows))]use std::fs::{self,File};
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
