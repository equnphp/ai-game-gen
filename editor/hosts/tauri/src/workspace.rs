// 最近索引只接受原生Core回执；列表是历史缓存，不能代替重新打开时的工程身份验证。
use crate::{store_io::{write_new,replace},wire::*};
use fs2::FileExt;
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{collections::{HashSet,HashMap},fs::{self,File,OpenOptions},path::{Path,PathBuf},time::{Instant,Duration,SystemTime,UNIX_EPOCH}};
#[path="workspace_jobs.rs"]mod jobs;
pub(crate) use jobs::{run_open,run_scan};
use jobs::{OpenState,OpenWork,ScanState,ScanWork,ScanSnapshot};

// 受管工作区及当前OS用户主体由宿主配置绑定，不从网页或最近文件取得路径权限。
pub(crate) const WORKSPACE_ID:&str="19e213fb-d005-4ca9-803d-e4ba2a7b862b";
const PRINCIPAL_ID:&str="a772f58f-fcee-46ca-8ac3-404f2228c984";
const METHODS:[&str;11]=["workspace.describe","workspace.roots.list","workspace.recent.list","workspace.recent.forget","workspace.open.start","workspace.operation.read","workspace.operation.cancel","workspace.request.lookup","workspace.discovery.start","workspace.discovery.read","workspace.discovery.cancel"];
pub(crate) fn directory_name(s:&str)->bool {
    s.strip_suffix(".ggproject").is_some_and(|v|!v.is_empty() && v.len()<=64 && v.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'||c==b'-'))
}
pub(crate) fn now()->String {
    // UTC只供展示；排序和CAS始终使用持久u64序号，系统时钟回拨不改变顺序。
    let secs=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let days=(secs/86400) as i64+719468;let era=days/146097;let doe=days-era*146097;
    let yoe=(doe-doe/1460+doe/36524-doe/146096)/365;let mut year=yoe+era*400;
    let doy=doe-(365*yoe+yoe/4-yoe/100);let mp=(5*doy+2)/153;let day=doy-(153*mp+2)/5+1;
    let month=mp+if mp<10{3}else{-9};if month<=2{year+=1;}
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",secs/3600%24,secs/60%60,secs%60)
}
fn safe_metadata(path:&Path)->std::io::Result<fs::Metadata>{
    let m=fs::symlink_metadata(path)?;
    #[cfg(windows)]{use std::os::windows::fs::MetadataExt;if m.file_attributes()&0x400!=0{return Err(std::io::ErrorKind::PermissionDenied.into());}}
    if m.file_type().is_symlink(){return Err(std::io::ErrorKind::PermissionDenied.into());}Ok(m)
}
fn safe_ancestors(path:&Path)->bool {path.ancestors().all(|p|safe_metadata(p).is_ok())}
fn validate_store(v:&Value)->Result<()> {
    shape(v,&["schemaVersion","storeId","revision","lastOpenOrdinal","entries","lastCommit"])?;
    need(v["schemaVersion"]==1 && uuid(string(v,"storeId")?),"STORE_CORRUPT")?;
    u64_string(&v["revision"])?;let ordinal=u64_string(&v["lastOpenOrdinal"])?;
    let entries=v["entries"].as_array().filter(|a|a.len()<=100).ok_or_else(||Fault::new("STORE_CORRUPT"))?;
    let mut ids=HashSet::new();let mut locations=HashSet::new();
    for item in entries {
        shape(item,&["entry","lastObservedOpen","principalScopeId"])?;
        need(uuid(string(item,"principalScopeId")?),"STORE_CORRUPT")?;
        let e=&item["entry"];
        shape(e,&["entryId","entryRevision","workspaceId","directory","projectId","name","projectFormat","coreProtocol","lastVerifiedHead","lastOpenedAt","lastOpenOrdinal","availability","lastProbeAt"])?;
        for key in ["entryId","workspaceId","projectId"]{need(uuid(string(e,key)?),"STORE_CORRUPT")?;}
        need(ids.insert(string(e,"entryId")?.to_owned()),"STORE_CORRUPT")?;
        need(directory_name(string(e,"directory")?) && locations.insert((string(e,"workspaceId")?.to_owned(),string(e,"directory")?.to_owned(),string(e,"projectId")?.to_owned())),"STORE_CORRUPT")?;
        need(!string(e,"name")?.is_empty() && string(e,"name")?.chars().count()<=80,"STORE_CORRUPT")?;
        need(matches!(e["projectFormat"].as_u64(),Some(1|2)) && ["1.0","1.1"].contains(&string(e,"coreProtocol")?),"STORE_CORRUPT")?;
        u64_string(&e["entryRevision"])?;u64_string(&e["lastVerifiedHead"])?;
        need(u64_string(&e["lastOpenOrdinal"])?<=ordinal,"STORE_CORRUPT")?;
        need(["unknown","present","missing","denied","unavailable","unsafe","identity_changed"].contains(&string(e,"availability")?),"STORE_CORRUPT")?;
        need(string(e,"lastOpenedAt")?.len()<=40 && (e["lastProbeAt"].is_null()||e["lastProbeAt"].as_str().is_some_and(|s|s.len()<=40)),"STORE_CORRUPT")?;
        let observed=&item["lastObservedOpen"];shape(observed,&["hostInstanceId","coreInstanceId","openRequestId"])?;
        for k in ["hostInstanceId","coreInstanceId","openRequestId"]{need(uuid(string(observed,k)?),"STORE_CORRUPT")?;}
    }
    if !v["lastCommit"].is_null(){let c=&v["lastCommit"];shape(c,&["serviceInstanceId","commandId","coreOpenRequestId","at"])?;
        need(uuid(string(c,"serviceInstanceId")?) && string(c,"at")?.len()<=40,"STORE_CORRUPT")?;
        for k in ["commandId","coreOpenRequestId"]{need(c[k].is_null()||c[k].as_str().is_some_and(uuid),"STORE_CORRUPT")?;}}
    Ok(())
}
fn read_store(path:&Path)->Result<Value>{
    let m=safe_metadata(path).map_err(|_|Fault::new("STORE_CORRUPT"))?;
    need(m.is_file() && m.len()<=1048576,"STORE_CORRUPT")?;
    let v=parse(&fs::read(path).map_err(|_|Fault::new("STORE_CORRUPT"))?,1048576)?;
    if v["schemaVersion"].as_u64().is_some_and(|n|n>1){return Err(Fault::new("FUTURE_STORE_SCHEMA"));}
    validate_store(&v).map_err(|_|Fault::new("STORE_CORRUPT"))?;Ok(v)
}
fn projection_hash(v:&Value)->String {format!("sha256:{:x}",Sha256::digest(serde_json::to_vec(v).unwrap_or_default()))}
fn observation_key(v:&Value)->Value {json!({"hostInstanceId":v["hostInstanceId"],"coreInstanceId":v["coreInstanceId"],"openRequestId":v["openRequestId"]})}
fn validate_observation(v:&Value)->Result<()> {
    shape(v,&["event","hostInstanceId","sessionId","coreInstanceId","workspaceId","directory","openOperation","openRequestId","readRequestId","coreProtocol","projectId","name","projectFormat","headRevision","observedAt"])?;
    need(v["event"]=="verified_project_open" && v["workspaceId"]==WORKSPACE_ID,"INTERNAL_ERROR")?;
    for k in ["hostInstanceId","sessionId","coreInstanceId","workspaceId","openRequestId","readRequestId","projectId"]{need(uuid(string(v,k)?),"INTERNAL_ERROR")?;}
    need(directory_name(string(v,"directory")?) && ["project.create","project.open"].contains(&string(v,"openOperation")?) && ["1.0","1.1"].contains(&string(v,"coreProtocol")?) &&
        matches!(v["projectFormat"].as_u64(),Some(1|2)) && !string(v,"name")?.is_empty() && string(v,"name")?.chars().count()<=80 && string(v,"observedAt")?.len()<=40,"INTERNAL_ERROR")?;
    u64_string(&v["headRevision"])?;Ok(())
}
fn validate_journal(v:&Value)->Result<()>{
    if v["schemaVersion"]!=2{return Err(Fault::new(if v["schemaVersion"].as_u64().is_some_and(|n|n>2){"FUTURE_STORE_SCHEMA"}else{"STORE_READ_ONLY"}));}
    shape(v,&["schemaVersion","journalId","revision","nextCommandOrdinal","records"])?;
    need(uuid(string(v,"journalId")?),"STORE_CORRUPT")?;u64_string(&v["revision"])?;
    let ordinal=u64_string(&v["nextCommandOrdinal"])?;
    let records=v["records"].as_array().filter(|a|a.len()<=128).ok_or_else(||Fault::new("STORE_CORRUPT"))?;
    let mut ids=HashSet::new();let mut keys=HashSet::new();let mut ordinals=HashSet::new();
    for r in records {
        if r["recordKind"]=="user_command"{jobs::validate_record(r)?;
            need(ids.insert(string(r,"commandId")?.to_owned()),"STORE_CORRUPT")?;
            let n=u64_string(&r["commandOrdinal"])?;need(n<ordinal&&ordinals.insert(n),"STORE_CORRUPT")?;continue;}
        need(r["recordKind"]=="core_observation","STORE_READ_ONLY")?;
        shape(r,&["recordKind","observationId","observationOrdinal","principalScopeId","originServiceInstanceId","observation","status","target","error","createdAt","updatedAt"])?;
        for k in ["observationId","principalScopeId","originServiceInstanceId"]{need(uuid(string(r,k)?),"STORE_CORRUPT")?;}
        need(ids.insert(string(r,"observationId")?.to_owned()),"STORE_CORRUPT")?;
        let n=u64_string(&r["observationOrdinal"])?;need(n<ordinal && ordinals.insert(n),"STORE_CORRUPT")?;
        validate_observation(&r["observation"])?;need(keys.insert(observation_key(&r["observation"]).to_string()),"STORE_CORRUPT")?;
        need(["VERIFIED","RECENT_PREPARED","RECENT_RECORDED","UNKNOWN"].contains(&string(r,"status")?) && r["error"].is_null(),"STORE_CORRUPT")?;
        for k in ["createdAt","updatedAt"]{need(string(r,k)?.len()<=40,"STORE_CORRUPT")?;}
        if !r["target"].is_null(){let t=&r["target"];shape(t,&["storeId","baseRevision","nextRevision","entryId","nextEntryRevision","nextLastOpenOrdinal","projectionHash"])?;
            for k in ["storeId","entryId"]{need(uuid(string(t,k)?),"STORE_CORRUPT")?;}
            for k in ["baseRevision","nextRevision","nextEntryRevision","nextLastOpenOrdinal"]{u64_string(&t[k])?;}
            let h=string(t,"projectionHash")?;need(h.len()==71&&h.starts_with("sha256:")&&h[7..].bytes().all(|c|c.is_ascii_digit()||(b'a'..=b'f').contains(&c)),"STORE_CORRUPT")?;
        }else{need(["VERIFIED","UNKNOWN"].contains(&string(r,"status")?),"STORE_CORRUPT")?;}
    }Ok(())
}
fn read_journal(path:&Path)->Result<Value>{
    let m=safe_metadata(path).map_err(|_|Fault::new("STORE_CORRUPT"))?;need(m.is_file()&&m.len()<=8388608,"STORE_CORRUPT")?;
    let v=parse(&fs::read(path).map_err(|_|Fault::new("STORE_CORRUPT"))?,8388608)?;validate_journal(&v)?;Ok(v)
}
fn load_journal(path:&Path,writable:bool)->Result<Value>{
    let m=safe_metadata(path).map_err(|_|Fault::new("STORE_CORRUPT"))?;need(m.is_file()&&m.len()<=8388608,"STORE_CORRUPT")?;
    let raw=fs::read(path).map_err(|_|Fault::new("STORE_CORRUPT"))?;let mut v=parse(&raw,8388608)?;
    if v["schemaVersion"]!=1{validate_journal(&v)?;return Ok(v);}
    // 设备日志升级保留每个原始意图，只增加分型；不合成内部观察或重放Core。
    let records=v["records"].as_array_mut().ok_or_else(||Fault::new("STORE_CORRUPT"))?;
    for record in records{need(record.is_object()&&record.get("recordKind").is_none(),"STORE_CORRUPT")?;record["recordKind"]=json!("user_command");}
    v["schemaVersion"]=json!(2);validate_journal(&v)?;
    if !writable{return Ok(v);}
    v["revision"]=json!(u64_string(&v["revision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?.to_string());validate_journal(&v)?;
    let directory=path.parent().ok_or_else(||Fault::new("STORE_WRITE_FAILED"))?;
    let backup=directory.join(format!("workspace-operations-schema1-{}.backup.json",id()));
    write_new(&backup,&raw).map_err(|_|Fault::new("STORE_WRITE_FAILED"))?;
    need(fs::read(path).is_ok_and(|bytes|bytes==raw),"RESULT_UNKNOWN")?;
    let next=serde_json::to_vec(&v).map_err(|_|Fault::new("STORE_WRITE_FAILED"))?;
    let temp=directory.join(format!(".workspace-upgrade-{}.tmp",id()));
    if write_new(&temp,&next).and_then(|_|replace(&temp,path)).is_err(){let _=fs::remove_file(&temp);return Err(Fault::new("RESULT_UNKNOWN"));}
    need(read_journal(path).is_ok_and(|stored|stored==v),"RESULT_UNKNOWN")?;Ok(v)
}
struct Snapshot {id:String,created:Instant,entries:Vec<Value>,store:Value}
pub(crate) struct Workspace {
    pub service:String,root:PathBuf,directory:PathBuf,store:Value,availability:String,persistence:String,last_error:Option<String>,
    _lock:Option<File>,snapshot:Option<Snapshot>,calls:HashSet<String>,core_protocols:Vec<&'static str>,
    journal:Value,journal_error:Option<String>,
    operations:HashMap<String,OpenState>,pending_open_work:Option<OpenWork>,
    scans:Vec<ScanState>,pending_scan_work:Option<ScanWork>,scan_snapshot:Option<ScanSnapshot>,
}
impl Workspace {
    pub(crate) fn canonical_directory(&self,directory:&str)->Result<String>{
        let guard=jobs::LocationGuard::open(&self.root,directory)?;Ok(guard.directory.clone())
    }
    pub fn new(root:PathBuf,directory:PathBuf)->Self {
        let mut store=json!({"schemaVersion":1,"storeId":id(),"revision":"0","lastOpenOrdinal":"0","entries":[],"lastCommit":null});
        let mut availability="new".to_owned();let mut error=None;
        let safe=fs::create_dir_all(&directory).is_ok() && safe_ancestors(&directory);
        let lock=if safe{OpenOptions::new().read(true).write(true).create(true).open(directory.join(".workspace.lock")).ok().filter(|f|f.try_lock_exclusive().is_ok())}else{None};
        let target=directory.join("recent-projects-v1.json");
        if target.exists(){match read_store(&target){Ok(v)=>{store=v;availability="loaded".into();},Err(f)=>{availability=if f.code=="FUTURE_STORE_SCHEMA"{"future_schema"}else{"corrupt"}.into();error=Some(f.code);}}}
        if lock.is_none() && !["corrupt","future_schema"].contains(&availability.as_str()){availability="read_only".into();error=Some("STORE_READ_ONLY".into());}
        let journal_path=directory.join("workspace-operations-v1.json");
        let mut journal=json!({"schemaVersion":2,"journalId":id(),"revision":"0","nextCommandOrdinal":"1","records":[]});let mut journal_error=None;
        if journal_path.exists(){match load_journal(&journal_path,lock.is_some()){Ok(v)=>journal=v,Err(f)=>journal_error=Some(f.code)}}
        let mut service=Self{service:id(),root,directory,store,availability,persistence:"clean".into(),last_error:error,_lock:lock,snapshot:None,calls:HashSet::new(),core_protocols:Vec::new(),journal,journal_error,operations:HashMap::new(),pending_open_work:None,scans:Vec::new(),pending_scan_work:None,scan_snapshot:None};
        if service.journal_error.is_none(){if service._lock.is_some(){service.reconcile_observations();}if let Err(f)=jobs::restore(&mut service){service.journal_error=Some(f.code);}}service
    }
    pub fn bind(&mut self){self.snapshot=None;self.scan_snapshot=None;self.calls.clear();}
    pub fn core_loaded(&mut self,protocols:Vec<&'static str>){self.core_protocols=protocols;}
    fn writable(&self)->Result<()>{
        if let Some(error)=&self.journal_error{return Err(Fault::new(error));}
        need(self.availability!="corrupt","STORE_CORRUPT")?;need(self.availability!="future_schema","FUTURE_STORE_SCHEMA")?;
        need(self._lock.is_some(),"STORE_READ_ONLY")?;need(self.persistence!="unknown","RESULT_UNKNOWN")
    }
    fn state(&self)->Value {json!({"schemaVersion":1,"storeId":if self.availability=="new"{Value::Null}else{self.store["storeId"].clone()},"revision":self.store["revision"],"availability":self.availability,
        "persistence":self.persistence,"lastError":self.journal_error.as_ref().or(self.last_error.as_ref())})}
    fn journal_commit(&mut self,mut next:Value)->Result<()> {
        need(self._lock.is_some() && self.journal_error.is_none(),"STORE_READ_ONLY")?;
        next["revision"]=json!(u64_string(&self.journal["revision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?.to_string());
        let raw=serde_json::to_vec(&next).map_err(|_|Fault::new("STORE_WRITE_FAILED"))?;need(raw.len()<=8388608,"LIMIT_EXCEEDED")?;
        let target=self.directory.join("workspace-operations-v1.json");
        if target.exists(){need(read_journal(&target)?==self.journal,"RESULT_UNKNOWN")?;}
        let temp=self.directory.join(format!(".workspace-journal-{}.tmp",id()));
        if write_new(&temp,&raw).is_err(){let _=fs::remove_file(&temp);return Err(Fault::new("STORE_WRITE_FAILED"));}
        if replace(&temp,&target).is_err(){let _=fs::remove_file(&temp);self.journal_error=Some("RESULT_UNKNOWN".into());return Err(Fault::new("RESULT_UNKNOWN"));}
        if !read_journal(&target).is_ok_and(|v|v==next){self.journal_error=Some("RESULT_UNKNOWN".into());return Err(Fault::new("RESULT_UNKNOWN"));}
        self.journal=next;self.prune_operations();Ok(())
    }
    fn reconcile_observations(&mut self){
        let mut next=self.journal.clone();let mut changed=false;
        for r in next["records"].as_array_mut().unwrap(){
            if r["recordKind"]!="core_observation"{continue;}
            if r["status"]=="RECENT_RECORDED"{continue;}let t=&r["target"];
            let matched=!t.is_null() && self.store["storeId"]==t["storeId"] && self.store["lastCommit"]["coreOpenRequestId"]==r["observation"]["openRequestId"] && self.store["entries"].as_array().unwrap().iter().any(|i|
                i["entry"]["entryId"]==t["entryId"] && i["lastObservedOpen"]==observation_key(&r["observation"]) && projection_hash(&i["entry"])==t["projectionHash"]);
            let status=if matched{"RECENT_RECORDED"}else{"UNKNOWN"};if r["status"]!=status{r["status"]=json!(status);r["updatedAt"]=json!(now());changed=true;}
        }
        if changed{if let Err(f)=self.journal_commit(next){self.journal_error=Some(f.code);}}
    }
    fn observation_record(&mut self,observation:&Value)->Result<usize>{
        validate_observation(observation)?;let key=observation_key(observation);
        if let Some(index)=self.journal["records"].as_array().unwrap().iter().position(|r|observation_key(&r["observation"])==key){
            // 同一open只能有一个真实read来源；后续重试复用原生保留的首份观察。
            need(self.journal["records"][index]["observation"]==*observation,"INTERNAL_ERROR")?;return Ok(index);
        }
        let mut next=self.journal.clone();let records=next["records"].as_array_mut().unwrap();
        if records.len()>=128 {let index=records.iter().enumerate().filter(|(_,r)|self.can_evict_record(r)).min_by_key(|(_,r)|jobs::ordinal(r)).map(|(i,_)|i).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;records.remove(index);}
        let ordinal=u64_string(&next["nextCommandOrdinal"])?;let following=ordinal.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;
        next["nextCommandOrdinal"]=json!(following.to_string());let time=now();
        let records=next["records"].as_array_mut().unwrap();let index=records.len();
        records.push(json!({"recordKind":"core_observation","observationId":id(),"observationOrdinal":ordinal.to_string(),"principalScopeId":PRINCIPAL_ID,"originServiceInstanceId":self.service,
            "observation":observation,"status":"VERIFIED","target":null,"error":null,"createdAt":time,"updatedAt":time}));self.journal_commit(next)?;Ok(index)
    }
    fn commit(&mut self,next:Value)->Result<()> {
        self.writable()?;validate_store(&next)?;
        let target=self.directory.join("recent-projects-v1.json");
        if target.exists(){let disk=read_store(&target)?;need(disk==self.store,"RESULT_UNKNOWN")?;}
        else{need(self.availability=="new","RESULT_UNKNOWN")?;}
        let raw=serde_json::to_vec(&next).map_err(|_|Fault::new("STORE_WRITE_FAILED"))?;need(raw.len()<=1048576,"LIMIT_EXCEEDED")?;
        let temp=self.directory.join(format!(".recent-{}.tmp",id()));
        // 原件始终保留到原子替换；替换后的确认失败进入unknown，不再次递增序号。
        if write_new(&temp,&raw).is_err(){let _=fs::remove_file(&temp);return Err(Fault::new("STORE_WRITE_FAILED"));}
        if replace(&temp,&target).is_err(){let _=fs::remove_file(&temp);
            if read_store(&target).is_ok_and(|v|v==next){self.persistence="unknown".into();return Err(Fault::new("RESULT_UNKNOWN"));}
            return Err(Fault::new("STORE_WRITE_FAILED"));}
        self.persistence="unknown".into();
        need(read_store(&target).is_ok_and(|v|v==next),"RESULT_UNKNOWN")?;
        self.store=next;self.availability="loaded".into();self.persistence="clean".into();self.last_error=None;Ok(())
    }
    pub fn observe(&mut self,observation:&Value)->Result<String>{
        let result=self.observe_verified(observation);
        if let Err(f)=&result {self.last_error=Some(f.code.clone());if self.persistence!="unknown"{self.persistence=if f.code=="RESULT_UNKNOWN"{"unknown"}else{"failed"}.into();}}
        result
    }
    fn observe_verified(&mut self,observation:&Value)->Result<String>{
        self.writable()?;validate_observation(observation)?;
        let project=string(observation,"projectId")?;let name=string(observation,"name")?;let format=&observation["projectFormat"];
        let directory=string(observation,"directory")?;let protocol=string(observation,"coreProtocol")?;
        let open_request=string(observation,"openRequestId")?;let observed=observation_key(observation);
        // 历史recent已有三元组就是去重基线；不替过去补造观察或用户意图。
        let existing_observation=self.store["entries"].as_array().unwrap().iter().find(|i|i["lastObservedOpen"]==observed).map(|i|i["entry"].clone());
        if let Some(entry)=existing_observation {
            if let Some(index)=self.journal["records"].as_array().unwrap().iter().position(|r|observation_key(&r["observation"])==observed){
                need(self.journal["records"][index]["observation"]==*observation,"INTERNAL_ERROR")?;
                let target=&self.journal["records"][index]["target"];
                need(!target.is_null() && target["entryId"]==entry["entryId"] && target["projectionHash"]==projection_hash(&entry),"RESULT_UNKNOWN")?;
                if self.journal["records"][index]["status"]!="RECENT_RECORDED"{let mut journal=self.journal.clone();journal["records"][index]["status"]=json!("RECENT_RECORDED");journal["records"][index]["updatedAt"]=json!(now());self.journal_commit(journal)?;}
            }
            return Ok(string(&entry,"entryId")?.into());
        }
        let record=self.observation_record(observation)?;let target=self.journal["records"][record]["target"].clone();
        if !target.is_null(){need(target["storeId"]==self.store["storeId"] && target["baseRevision"]==self.store["revision"],"RESULT_UNKNOWN")?;}
        let mut next=self.store.clone();let ordinal=u64_string(&next["lastOpenOrdinal"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;
        let revision=u64_string(&next["revision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;
        let entries=next["entries"].as_array_mut().unwrap();let time=string(observation,"observedAt")?;
        let existing=entries.iter().position(|i|i["entry"]["workspaceId"]==WORKSPACE_ID && i["entry"]["directory"]==directory && i["entry"]["projectId"]==project);
        let (entry_id,entry_revision)=if let Some(index)=existing{let item=entries.remove(index);(string(&item["entry"],"entryId")?.to_owned(),u64_string(&item["entry"]["entryRevision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?)}else{(if target.is_null(){id()}else{string(&target,"entryId")?.into()},1)};
        for item in entries.iter_mut(){if item["entry"]["workspaceId"]==WORKSPACE_ID && item["entry"]["directory"]==directory && item["entry"]["availability"]!="identity_changed"{item["entry"]["entryRevision"]=json!(u64_string(&item["entry"]["entryRevision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?.to_string());item["entry"]["availability"]=json!("identity_changed");}}
        if entries.len()>=100 {entries.sort_by(|a,b|u64_string(&a["entry"]["lastOpenOrdinal"]).unwrap().cmp(&u64_string(&b["entry"]["lastOpenOrdinal"]).unwrap()).then_with(||a["entry"]["entryId"].as_str().cmp(&b["entry"]["entryId"].as_str())));entries.remove(0);}
        let entry=json!({"entryId":entry_id,"entryRevision":entry_revision.to_string(),"workspaceId":WORKSPACE_ID,"directory":directory,"projectId":project,"name":name,
            "projectFormat":format,"coreProtocol":protocol,"lastVerifiedHead":observation["headRevision"],"lastOpenedAt":time,"lastOpenOrdinal":ordinal.to_string(),"availability":"present","lastProbeAt":time});
        entries.push(json!({"entry":entry,"lastObservedOpen":observed,"principalScopeId":PRINCIPAL_ID}));
        next["revision"]=json!(revision.to_string());next["lastOpenOrdinal"]=json!(ordinal.to_string());
        next["lastCommit"]=json!({"serviceInstanceId":self.service,"commandId":null,"coreOpenRequestId":open_request,"at":time});
        let prepared=json!({"storeId":next["storeId"],"baseRevision":self.store["revision"],"nextRevision":next["revision"],"entryId":entry_id,"nextEntryRevision":entry_revision.to_string(),"nextLastOpenOrdinal":ordinal.to_string(),"projectionHash":projection_hash(&entry)});
        if !target.is_null(){need(prepared==target,"RESULT_UNKNOWN")?;}
        let mut journal=self.journal.clone();journal["records"][record]["target"]=prepared;journal["records"][record]["status"]=json!("RECENT_PREPARED");journal["records"][record]["updatedAt"]=json!(now());self.journal_commit(journal)?;
        self.commit(next)?;
        let mut journal=self.journal.clone();journal["records"][record]["status"]=json!("RECENT_RECORDED");journal["records"][record]["updatedAt"]=json!(now());self.journal_commit(journal)?;Ok(entry_id)
    }
    pub fn dispatch(&mut self,request:&Value,session_free:bool)->Value {
        let call=request["callId"].as_str().unwrap_or("");let method=request["method"].as_str().unwrap_or("");
        let result=(||->Result<Value>{
            shape(request,&["workspaceProtocol","callId","method","params"])?;
            need(request["workspaceProtocol"]=="1.0","UNSUPPORTED_PROTOCOL")?;need(uuid(call),"INVALID_MESSAGE")?;
            need(self.calls.len()<65536,"LIMIT_EXCEEDED")?;need(self.calls.insert(call.into()),"INVALID_MESSAGE")?;
            let p=&request["params"];
            if method=="workspace.describe"{shape(p,&[])?;return Ok(json!({"workspaceProtocol":"1.0","serviceInstanceId":self.service,"adapterKind":"tauri_native","implementedMethods":METHODS,"coreProtocols":self.core_protocols,"store":self.state(),
                "limits":{"requestBytes":65536,"responseBytes":524288,"recentEntries":100,"workspaces":8,"pageItems":100,"openOperations":1,"pendingCalls":16,"activeScans":1,"scanEntries":10000,"snapshotSeconds":60,"commandReceipts":128}}));}
            need(p["serviceInstanceId"]==self.service,"SERVICE_INSTANCE_MISMATCH")?;
            match method {
                "workspace.roots.list"=>{shape(p,&["serviceInstanceId"])?;Ok(json!({"workspaces":[{"workspaceId":WORKSPACE_ID,"label":"GameGen","access":if safe_ancestors(&self.root){"read_write"}else{"unavailable"},"locationKind":"managed_local","default":true,"pathPolicyId":"local-basename-nofollow-1"}]}))},
                "workspace.recent.list"=>{
                    shape(p,&["serviceInstanceId","cursor","limit"])?;
                    let limit=p["limit"].as_u64().filter(|n|*n>=1&&*n<=100).ok_or_else(||Fault::new("INVALID_MESSAGE"))? as usize;
                    let after=if p["cursor"].is_null(){
                        let mut entries:Vec<_>=self.store["entries"].as_array().unwrap().iter().filter(|i|i["principalScopeId"]==PRINCIPAL_ID).map(|i|{let mut e=i["entry"].clone();if e["availability"]!="identity_changed"{e["availability"]=json!("unknown");e["lastProbeAt"]=Value::Null;}e}).collect();
                        entries.sort_by(|a,b|u64_string(&b["lastOpenOrdinal"]).unwrap().cmp(&u64_string(&a["lastOpenOrdinal"]).unwrap()).then_with(||a["entryId"].as_str().cmp(&b["entryId"].as_str())));
                        self.snapshot=Some(Snapshot{id:id(),created:Instant::now(),entries,store:self.state()});0
                    }else{let c=&p["cursor"];shape(c,&["serviceInstanceId","snapshotId","afterIndex"])?;
                        let s=self.snapshot.as_ref().ok_or_else(||Fault::new("SNAPSHOT_EXPIRED"))?;
                        need(c["serviceInstanceId"]==self.service&&c["snapshotId"]==s.id,"CURSOR_INVALID")?;
                        c["afterIndex"].as_u64().filter(|n|*n<=s.entries.len() as u64).ok_or_else(||Fault::new("CURSOR_INVALID"))? as usize};
                    let s=self.snapshot.as_ref().unwrap();need(s.created.elapsed()<Duration::from_secs(60),"SNAPSHOT_EXPIRED")?;
                    let end=(after+limit).min(s.entries.len());let next=if end<s.entries.len(){json!({"serviceInstanceId":self.service,"snapshotId":s.id,"afterIndex":end})}else{Value::Null};
                    Ok(json!({"store":s.store,"snapshotId":s.id,"entries":&s.entries[after..end],"nextCursor":next}))
                },
                _=>jobs::dispatch(self,method,p,session_free)
            }
        })();
        match result {Ok(result)=>json!({"workspaceProtocol":"1.0","callId":call,"method":method,"ok":true,"result":result}),
            Err(f)=>{
                let mutation=["workspace.recent.forget","workspace.open.start","workspace.operation.cancel","workspace.discovery.start","workspace.discovery.cancel"].contains(&method);
                let recorded=request["params"]["commandId"].as_str().is_some_and(|command|self.journal["records"].as_array().unwrap().iter().any(|r|r["recordKind"]=="user_command"&&r["commandId"]==command));
                let outcome=if mutation{if f.code=="RESULT_UNKNOWN"||recorded{"submitted_unknown"}else{"not_submitted"}}else{f.outcome};
                json!({"workspaceProtocol":"1.0","callId":call,"method":method,"ok":false,"error":{"code":f.code,"messageKey":format!("workspace.{}",f.code),"retryable":false,"outcome":outcome,"operationId":null,"coreRequestId":null}})
            }}
    }
}
