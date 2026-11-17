// 作业库动态调用已验证的唯一SQLite provider；不引入Rust静态SQLite或接管C分配器。
use crate::{ffi::Api,wire::*};
use serde_json::Value;
use std::{ffi::{c_void,CStr,CString},path::Path,sync::Arc};
type Destructor=Option<unsafe extern "C" fn(*mut c_void)>;
pub(crate) struct SqliteApi {
    _provider:Arc<Api>,open:unsafe extern "C" fn(*const i8,*mut *mut c_void,i32,*const i8)->i32,
    close:unsafe extern "C" fn(*mut c_void)->i32,exec:unsafe extern "C" fn(*mut c_void,*const i8,Option<unsafe extern "C" fn(*mut c_void,i32,*mut *mut i8,*mut *mut i8)->i32>,*mut c_void,*mut *mut i8)->i32,
    free:unsafe extern "C" fn(*mut c_void),prepare:unsafe extern "C" fn(*mut c_void,*const i8,i32,u32,*mut *mut c_void,*mut *const i8)->i32,
    finalize:unsafe extern "C" fn(*mut c_void)->i32,step:unsafe extern "C" fn(*mut c_void)->i32,
    bind_null:unsafe extern "C" fn(*mut c_void,i32)->i32,bind_i64:unsafe extern "C" fn(*mut c_void,i32,i64)->i32,
    bind_f64:unsafe extern "C" fn(*mut c_void,i32,f64)->i32,bind_text:unsafe extern "C" fn(*mut c_void,i32,*const i8,i32,Destructor)->i32,
    bind_count:unsafe extern "C" fn(*mut c_void)->i32,columns:unsafe extern "C" fn(*mut c_void)->i32,
    column_type:unsafe extern "C" fn(*mut c_void,i32)->i32,column_i64:unsafe extern "C" fn(*mut c_void,i32)->i64,
    column_f64:unsafe extern "C" fn(*mut c_void,i32)->f64,column_text:unsafe extern "C" fn(*mut c_void,i32)->*const u8,
    column_bytes:unsafe extern "C" fn(*mut c_void,i32)->i32,
    busy:unsafe extern "C" fn(*mut c_void,i32)->i32,config:unsafe extern "C" fn(*mut c_void,i32,...)->i32,
}
fn checked(status:i32)->Result<()> {
    if [0,100,101].contains(&status){return Ok(());}
    Err(Fault::new(match status&255{5|6=>"JOB_STORE_BUSY",8|3|23=>"JOB_STORE_READ_ONLY",11|26=>"JOB_STORE_CORRUPT",13=>"STORAGE_FULL",_=>"JOB_STORE_ERROR"}))
}
impl SqliteApi {
    #[cfg(windows)]
    pub fn from_provider(provider:Arc<Api>)->Result<Arc<Self>>{
        #[link(name="kernel32")]extern "system"{fn GetProcAddress(module:*mut c_void,name:*const u8)->*mut c_void;}
        let module=provider.sqlite_module.ok_or_else(||Fault::new("SQLITE_PROVIDER_REQUIRED"))? as *mut c_void;
        macro_rules! symbol {($name:literal,$ty:ty)=>{{let address=unsafe{GetProcAddress(module,concat!($name,"\0").as_ptr())};need(!address.is_null(),"SQLITE_PROVIDER_REQUIRED")?;unsafe{std::mem::transmute::<*mut c_void,$ty>(address)}}}}
        Ok(Arc::new(Self{_provider:provider,
            open:symbol!("sqlite3_open_v2",unsafe extern "C" fn(*const i8,*mut *mut c_void,i32,*const i8)->i32),
            close:symbol!("sqlite3_close_v2",unsafe extern "C" fn(*mut c_void)->i32),
            exec:symbol!("sqlite3_exec",unsafe extern "C" fn(*mut c_void,*const i8,Option<unsafe extern "C" fn(*mut c_void,i32,*mut *mut i8,*mut *mut i8)->i32>,*mut c_void,*mut *mut i8)->i32),
            free:symbol!("sqlite3_free",unsafe extern "C" fn(*mut c_void)),
            prepare:symbol!("sqlite3_prepare_v3",unsafe extern "C" fn(*mut c_void,*const i8,i32,u32,*mut *mut c_void,*mut *const i8)->i32),
            finalize:symbol!("sqlite3_finalize",unsafe extern "C" fn(*mut c_void)->i32),step:symbol!("sqlite3_step",unsafe extern "C" fn(*mut c_void)->i32),
            bind_null:symbol!("sqlite3_bind_null",unsafe extern "C" fn(*mut c_void,i32)->i32),bind_i64:symbol!("sqlite3_bind_int64",unsafe extern "C" fn(*mut c_void,i32,i64)->i32),
            bind_f64:symbol!("sqlite3_bind_double",unsafe extern "C" fn(*mut c_void,i32,f64)->i32),bind_text:symbol!("sqlite3_bind_text",unsafe extern "C" fn(*mut c_void,i32,*const i8,i32,Destructor)->i32),
            bind_count:symbol!("sqlite3_bind_parameter_count",unsafe extern "C" fn(*mut c_void)->i32),columns:symbol!("sqlite3_column_count",unsafe extern "C" fn(*mut c_void)->i32),
            column_type:symbol!("sqlite3_column_type",unsafe extern "C" fn(*mut c_void,i32)->i32),column_i64:symbol!("sqlite3_column_int64",unsafe extern "C" fn(*mut c_void,i32)->i64),
            column_f64:symbol!("sqlite3_column_double",unsafe extern "C" fn(*mut c_void,i32)->f64),column_text:symbol!("sqlite3_column_text",unsafe extern "C" fn(*mut c_void,i32)->*const u8),
            column_bytes:symbol!("sqlite3_column_bytes",unsafe extern "C" fn(*mut c_void,i32)->i32),busy:symbol!("sqlite3_busy_timeout",unsafe extern "C" fn(*mut c_void,i32)->i32),
            config:symbol!("sqlite3_db_config",unsafe extern "C" fn(*mut c_void,i32,...)->i32)}))
    }
    #[cfg(not(windows))]
    pub fn from_provider(_:Arc<Api>)->Result<Arc<Self>>{Err(Fault::new("SQLITE_PROVIDER_REQUIRED"))}
}
pub(crate) struct Sqlite {api:Arc<SqliteApi>,raw:*mut c_void}
// 连接使用FULLMUTEX并且始终位于服务Mutex后；statement只借用单次调用，不能跨线程存活。
unsafe impl Send for Sqlite {}
struct Statement<'a>{db:&'a Sqlite,raw:*mut c_void}
impl Drop for Statement<'_>{fn drop(&mut self){unsafe{(self.db.api.finalize)(self.raw);}}}
impl Drop for Sqlite {fn drop(&mut self){unsafe{(self.api.close)(self.raw);}}}
impl Sqlite {
    pub fn open(api:Arc<SqliteApi>,path:&Path,create:bool,read_only:bool)->Result<Self>{
        let path=path.to_str().ok_or_else(||Fault::new("JOB_STORE_ERROR"))?;Self::open_name(api,path,create,read_only)
    }
    pub fn memory(api:Arc<SqliteApi>)->Result<Self>{Self::open_name(api,":memory:",true,false)}
    fn open_name(api:Arc<SqliteApi>,path:&str,create:bool,read_only:bool)->Result<Self>{
        let name=CString::new(path).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;let mut raw=std::ptr::null_mut();
        let flags=0x10000|0x1000000|if read_only{1}else{2|if create{4}else{0}};
        let status=unsafe{(api.open)(name.as_ptr(),&mut raw,flags,std::ptr::null())};
        if status!=0{if !raw.is_null(){unsafe{(api.close)(raw);}}checked(status)?;}
        need(!raw.is_null(),"JOB_STORE_ERROR")?;let db=Self{api,raw};
        checked(unsafe{(db.api.busy)(raw,1000)})?;
        checked(unsafe{(db.api.config)(raw,1010,1,std::ptr::null_mut::<i32>())})?;
        checked(unsafe{(db.api.config)(raw,1017,0,std::ptr::null_mut::<i32>())})?;Ok(db)
    }
    pub fn exec(&self,sql:&str)->Result<()> {
        let sql=CString::new(sql).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;let mut error=std::ptr::null_mut();
        let status=unsafe{(self.api.exec)(self.raw,sql.as_ptr(),None,std::ptr::null_mut(),&mut error)};
        // 本机SQL诊断不进入公开响应；即使失败也由同一provider释放原错误buffer。
        if !error.is_null(){unsafe{(self.api.free)(error.cast());}}checked(status)
    }
    fn prepare<'a>(&'a self,sql:&str,params:&[Value])->Result<Statement<'a>>{
        let sql=CString::new(sql).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;need(sql.as_bytes().len()<i32::MAX as usize,"LIMIT_EXCEEDED")?;
        let mut raw=std::ptr::null_mut();let mut tail=std::ptr::null();let status=unsafe{(self.api.prepare)(self.raw,sql.as_ptr(),sql.as_bytes().len() as i32+1,0,&mut raw,&mut tail)};
        if status!=0{if !raw.is_null(){unsafe{(self.api.finalize)(raw);}}checked(status)?;}
        need(!raw.is_null(),"JOB_STORE_ERROR")?;let statement=Statement{db:self,raw};
        need(!tail.is_null()&&unsafe{CStr::from_ptr(tail)}.to_bytes().iter().all(u8::is_ascii_whitespace),"JOB_STORE_ERROR")?;
        need(unsafe{(self.api.bind_count)(raw)}==params.len() as i32,"JOB_STORE_ERROR")?;
        for (index,value) in params.iter().enumerate(){let at=index as i32+1;
            let status=match value {
                Value::Null=>unsafe{(self.api.bind_null)(raw,at)},
                Value::Bool(v)=>unsafe{(self.api.bind_i64)(raw,at,if *v{1}else{0})},
                Value::Number(v)if v.as_i64().is_some()=>unsafe{(self.api.bind_i64)(raw,at,v.as_i64().unwrap())},
                Value::Number(v)if v.is_u64()=>return Err(Fault::new("LIMIT_EXCEEDED")),
                Value::Number(v)=>{let n=v.as_f64().filter(|n|n.is_finite()).ok_or_else(||Fault::new("JOB_STORE_ERROR"))?;unsafe{(self.api.bind_f64)(raw,at,n)}},
                Value::String(v)=>{need(v.len()<=8388608&&!v.contains('\0'),"LIMIT_EXCEEDED")?;
                    // SQLITE_TRANSIENT为SQLite明确约定的-1哨兵，要求绑定时立即复制。
                    let transient:Destructor=Some(unsafe{std::mem::transmute::<isize,unsafe extern "C" fn(*mut c_void)>(-1)});
                    unsafe{(self.api.bind_text)(raw,at,v.as_ptr().cast(),v.len() as i32,transient)}},
                _=>return Err(Fault::new("JOB_STORE_ERROR"))
            };checked(status)?;
        }Ok(statement)
    }
    pub fn run(&self,sql:&str,params:&[Value])->Result<()> {
        let statement=self.prepare(sql,params)?;let status=unsafe{(self.api.step)(statement.raw)};checked(status)?;need(status==101,"JOB_STORE_ERROR")
    }
    pub fn query(&self,sql:&str,params:&[Value])->Result<Vec<Vec<Value>>>{
        let statement=self.prepare(sql,params)?;let mut rows=Vec::new();let mut bytes=0usize;
        loop{let status=unsafe{(self.api.step)(statement.raw)};checked(status)?;if status==101{return Ok(rows);}
            need(rows.len()<4096,"LIMIT_EXCEEDED")?;let count=unsafe{(self.api.columns)(statement.raw)};need((0..=64).contains(&count),"JOB_STORE_ERROR")?;let mut row=Vec::new();
            for column in 0..count{let value=match unsafe{(self.api.column_type)(statement.raw,column)}{
                1=>Value::from(unsafe{(self.api.column_i64)(statement.raw,column)}),
                2=>{let value=unsafe{(self.api.column_f64)(statement.raw,column)};need(value.is_finite(),"JOB_STORE_CORRUPT")?;Value::from(value)},
                3=>{let size=unsafe{(self.api.column_bytes)(statement.raw,column)};need(size>=0&&size as usize<=8388608-bytes,"LIMIT_EXCEEDED")?;
                    let data=unsafe{(self.api.column_text)(statement.raw,column)};need(size==0||!data.is_null(),"JOB_STORE_CORRUPT")?;
                    let raw=if size==0{&[][..]}else{unsafe{std::slice::from_raw_parts(data,size as usize)}};
                    let text=std::str::from_utf8(raw).map_err(|_|Fault::new("JOB_STORE_CORRUPT"))?;need(!text.contains('\0'),"JOB_STORE_CORRUPT")?;bytes+=raw.len();Value::String(text.into())},
                5=>Value::Null,_=>return Err(Fault::new("JOB_STORE_CORRUPT"))
            };row.push(value);}rows.push(row);
        }
    }
    pub fn transaction<T>(&self,body:impl FnOnce(&Self)->Result<T>)->Result<T>{
        struct Rollback<'a>{db:&'a Sqlite,committed:bool}
        impl Drop for Rollback<'_>{fn drop(&mut self){if !self.committed{let _=self.db.exec("ROLLBACK");}}}
        self.exec("BEGIN IMMEDIATE")?;let mut guard=Rollback{db:self,committed:false};let value=body(self)?;
        // 提交I/O失败不能证明原件未改变，上层必须凭原requestId对账而非重发副作用。
        self.exec("COMMIT").map_err(|_|Fault::new("JOB_STORE_COMMIT_UNKNOWN"))?;guard.committed=true;Ok(value)
    }
}
