// 独立 C ABI：调用方拥有全部缓冲区；回调仅在本次同步调用期间有效。
mod package;
mod schema;
mod strict;
use package::{Source,INVALID,IO,LIMIT};
use std::{ffi::c_void,panic::{catch_unwind,AssertUnwindSafe},slice};

type Reader=unsafe extern "C" fn(*mut c_void,*mut u8,u32,*mut u32)->i32;
struct Input {reader:Reader,context:*mut c_void}
impl Source for Input {
    fn read(&mut self,buffer:&mut[u8])->Result<usize,i32>{
        let cap=buffer.len().min(32768);let mut written=0u32;
        // 宿主保证回调和上下文直到同步返回才释放；不得由插件提供回调。
        let status=unsafe{(self.reader)(self.context,buffer.as_mut_ptr(),cap as u32,&mut written)};
        if status!=0{return Err(if [4,5,6].contains(&status){status}else{IO});}
        if written as usize>cap{return Err(IO);}Ok(written as usize)
    }
}

#[no_mangle]
pub extern "C" fn ggpv_abi_version()->u32{1}

unsafe fn output(bytes:&[u8],out:*mut u8,cap:u32,length:*mut u32)->Result<(),i32>{
    if length.is_null(){return Err(8);}
    if bytes.len()>cap as usize || bytes.len()>u32::MAX as usize{return Err(LIMIT);}
    if !bytes.is_empty(){if out.is_null(){return Err(8);}std::ptr::copy_nonoverlapping(bytes.as_ptr(),out,bytes.len());}
    *length=bytes.len() as u32;Ok(())
}

#[no_mangle]
pub unsafe extern "C" fn ggpv_verify_stream_v1(reader:Option<Reader>,context:*mut c_void,out:*mut u8,cap:u32,length:*mut u32)->i32{
    if length.is_null(){return 8;}*length=0;
    let Some(reader)=reader else{return 8;};
    if out.is_null(){return 8;}if cap==0{return LIMIT;}
    match catch_unwind(AssertUnwindSafe(||{
        let value=package::verify(&mut Input{reader,context})?;
        let bytes=serde_json::to_vec(&value).map_err(|_|INVALID)?;
        if bytes.len()>512*1024{return Err(LIMIT);}
        output(&bytes,out,cap,length)
    })){Ok(Ok(()))=>0,Ok(Err(code))=>code,Err(_)=>IO}
}

#[no_mangle]
pub unsafe extern "C" fn ggpv_canonicalize_v1(input:*const u8,input_len:u32,out:*mut u8,cap:u32,length:*mut u32)->i32{
    if length.is_null(){return 8;}*length=0;
    if input.is_null()||out.is_null()||input_len==0{return 8;}
    if input_len>16*1024*1024||cap>16*1024*1024||cap==0{return LIMIT;}
    match catch_unwind(AssertUnwindSafe(||{
        // 先严格解析原字节，不接收宿主已经转成 Value 的数据。
        let bytes=slice::from_raw_parts(input,input_len as usize);
        let value=strict::parse(bytes,16*1024*1024).map_err(|_|8)?;
        let canonical=serde_json_canonicalizer::to_vec(&value).map_err(|_|8)?;
        output(&canonical,out,cap,length)
    })){Ok(Ok(()))=>0,Ok(Err(code))=>code,Err(_)=>IO}
}
