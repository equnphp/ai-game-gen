// 开发者显式指定文件进行离线检查；本工具不安装、启用或授予插件权限。
use gamegen_plugin_verifier::ggpv_verify_stream_v1;
use std::{ffi::c_void,fs::File,io::{self,Read,Write},process::ExitCode};

unsafe extern "C" fn read_file(context:*mut c_void,dst:*mut u8,cap:u32,written:*mut u32)->i32{
    if context.is_null()||dst.is_null()||written.is_null(){return 4;}
    *written=0;
    let file=&mut *(context as *mut File);
    let buffer=std::slice::from_raw_parts_mut(dst,cap as usize);
    match file.read(buffer){Ok(n)=>{*written=n as u32;0},Err(_)=>4}
}

fn run()->Result<(),String>{
    let mut args=std::env::args_os();let _=args.next();
    let file=args.next().ok_or_else(||"用法：gg-plugin-inspect <插件包路径>".to_owned())?;
    if args.next().is_some(){return Err("用法：gg-plugin-inspect <插件包路径>".into());}
    let mut source=File::open(file).map_err(|_|"无法读取所选插件包".to_owned())?;
    let mut output=vec![0u8;512*1024];let mut len=0u32;
    let code=unsafe{ggpv_verify_stream_v1(Some(read_file),&mut source as *mut File as *mut c_void,output.as_mut_ptr(),output.len() as u32,&mut len)};
    if code!=0{return Err(format!("插件包检查失败，错误码 {code}"));}
    io::stdout().lock().write_all(&output[..len as usize]).and_then(|_|io::stdout().lock().write_all(b"\n"))
        .map_err(|_|"无法输出检查结果".to_owned())
}
fn main()->ExitCode{match run(){Ok(())=>ExitCode::SUCCESS,Err(message)=>{let _=writeln!(io::stderr().lock(),"{message}");ExitCode::FAILURE}}}
