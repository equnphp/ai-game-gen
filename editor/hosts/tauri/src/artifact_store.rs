// 本机jobs库与作者库隔离，版本不匹配只读保留；全部连接来自同一受控动态provider。
use crate::{sqlite::{Sqlite,SqliteApi},store_io::{directory_lease,safe_metadata,publish_new},wire::*};
use fs2::FileExt;
use serde_json::{json,Value};
use std::{fs::{self,File,OpenOptions},path::{Path,PathBuf},sync::Arc,time::{SystemTime,UNIX_EPOCH}};
const DDL:&str=include_str!("artifact/contracts/jobs-v1.sql");
const SCHEMA_SQL:&str="SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
pub(crate) fn now_ms()->i64 {SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().min(i64::MAX as u128) as i64}
pub(crate) struct ArtifactStore {pub db:Sqlite,pub writable:bool,pub path:PathBuf,_directory:File,_lock:Option<File>}
fn verify(db:&Sqlite,expected:&[Vec<Value>])->Result<()> {
    need(db.query("PRAGMA application_id",&[])?==vec![vec![json!(1195854410)]] && db.query("PRAGMA user_version",&[])?==vec![vec![json!(1)]],"JOB_STORE_NEEDS_MIGRATION")?;
    need(db.query(SCHEMA_SQL,&[])?.as_slice()==expected,"JOB_STORE_NEEDS_MIGRATION")?;
    let meta=db.query("SELECT store_id,schema_version,next_job_ordinal FROM service_meta WHERE singleton=1",&[])?;
    need(meta.len()==1&&meta[0].len()==3&&meta[0][0].as_str().is_some_and(uuid)&&meta[0][1]==1&&meta[0][2].as_i64().is_some_and(|n|n>=0),"JOB_STORE_CORRUPT")?;Ok(())
}
impl ArtifactStore {
    pub fn open(api:Arc<SqliteApi>,directory:PathBuf)->Result<Self>{
        fs::create_dir_all(&directory).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;let directory_guard=directory_lease(&directory)?;
        let lock_path=directory.join(".jobs.lock");
        if lock_path.exists(){need(safe_metadata(&lock_path).is_ok_and(|m|m.is_file()),"JOB_STORE_ERROR")?;}
        let lock=OpenOptions::new().read(true).write(true).create(true).open(lock_path).ok().filter(|file|file.try_lock_exclusive().is_ok());
        let path=directory.join("jobs-v1.sqlite");
        let expected=Sqlite::memory(api.clone())?;expected.exec(DDL)?;let schema=expected.query(SCHEMA_SQL,&[])?;drop(expected);
        if !path.exists(){
            need(lock.is_some(),"JOB_STORE_READ_ONLY")?;
            let partial=directory.join(format!(".jobs-{}.partial.sqlite",id()));
            let created=OpenOptions::new().read(true).write(true).create_new(true).open(&partial).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;created.sync_all().map_err(|_|Fault::new("JOB_STORE_ERROR"))?;drop(created);
            let initialized=(||->Result<()>{
                let db=Sqlite::open(api.clone(),&partial,true,false)?;
                // WAL/FK等PRAGMA在事务外设置；新库尚未发布，半建表也不会被当作可用库。
                db.exec(DDL)?;
                db.transaction(|db|db.run("INSERT INTO service_meta VALUES(1,?,1,0)",&[json!(id())]))?;
                verify(&db,&schema)?;
                let checkpoint=db.query("PRAGMA wal_checkpoint(TRUNCATE)",&[])?;
                need(checkpoint.first().and_then(|r|r.first()).and_then(Value::as_i64)==Some(0),"JOB_STORE_BUSY")?;drop(db);
                OpenOptions::new().read(true).write(true).open(&partial).and_then(|f|f.sync_all()).map_err(|_|Fault::new("JOB_STORE_ERROR"))?;
                publish_new(&partial,&path).map_err(|_|Fault::new("JOB_STORE_PUBLISH_UNKNOWN"))?;Ok(())
            })();
            if let Err(fault)=initialized{
                // 仅清理这个随机新库名及其伴随文件；不递归遍历，也不删除既有jobs库。
                for owned in [partial.clone(),PathBuf::from(format!("{}-wal",partial.to_string_lossy())),PathBuf::from(format!("{}-shm",partial.to_string_lossy()))]{
                    if safe_metadata(&owned).is_ok_and(|m|m.is_file()){let _=fs::remove_file(owned);}
                }return Err(fault);
            }
        }
        check_files(&path)?;
        // 先只读核对实际DDL；旧/未来设备库不执行CREATE IF NOT EXISTS或就地覆盖。
        let reader=Sqlite::open(api.clone(),&path,false,true)?;verify(&reader,&schema)?;drop(reader);
        let writable=lock.is_some();let db=Sqlite::open(api,&path,false,!writable)?;
        verify(&db,&schema)?;
        db.exec("PRAGMA foreign_keys=ON")?;
        if writable{db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL")?;}
        Ok(Self{db,writable,path,_directory:directory_guard,_lock:lock})
    }
    pub fn write<T>(&self,body:impl FnOnce(&Sqlite)->Result<T>)->Result<T>{need(self.writable,"JOB_STORE_READ_ONLY")?;self.db.transaction(body)}
}
fn check_files(path:&Path)->Result<()> {
    for file in [path.to_owned(),PathBuf::from(format!("{}-wal",path.to_string_lossy())),PathBuf::from(format!("{}-shm",path.to_string_lossy()))]{
        if file.exists(){need(safe_metadata(&file).is_ok_and(|m|m.is_file()),"JOB_STORE_ERROR")?;}
    }Ok(())
}
