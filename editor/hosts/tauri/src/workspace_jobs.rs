// Workspace用户意图与Core观察分开记账；重启不重放打开，历史成功不恢复旧会话令牌。
use super::*;
use crate::{core::Host,store_io::{directory_lease as directory_handle,directory_identity as identity}};
use std::{sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},thread};

pub(crate) struct OpenWork {
    pub id:String,pub directory:String,pub expected_project:Option<String>,pub expected_format:Option<u64>,
    pub capabilities:Value,pub cancel:Arc<AtomicBool>,pub location:LocationGuard,
}
pub(super) struct OpenState {pub operation:Value,pub cancel:Arc<AtomicBool>}
pub(super) struct Candidate{pub value:Value,pub identity:String}
pub(super) struct ScanState {pub value:Value,pub root_identity:String,pub command:String,pub cancel:Arc<AtomicBool>,pub finished:Option<Instant>,pub candidates:Vec<Candidate>}
pub(crate) struct ScanWork{pub id:String,pub root:PathBuf,pub _guard:File,pub cancel:Arc<AtomicBool>}
pub(super) struct ScanSnapshot{pub id:String,pub scan:String,pub created:Instant,pub candidates:Vec<Value>}
// 受限路径的字符串检查之外还持有真实目录句柄；Core随后复用自己的no-follow校验。
pub(crate) struct LocationGuard {pub root:File,pub project:File,pub directory:String}
impl LocationGuard {
    pub(super) fn open(root:&Path,directory:&str)->Result<Self>{
        need(directory_name(directory),"PATH_UNSAFE")?;
        let root_handle=directory_handle(root)?;let project=directory_handle(&root.join(directory)).map_err(|f|if !root.join(directory).exists(){Fault::new("DIRECTORY_MISSING")}else{f})?;
        let canonical=fs::canonicalize(root.join(directory)).map_err(|_|Fault::new("PATH_UNSAFE"))?;
        need(canonical.parent()==Some(fs::canonicalize(root).map_err(|_|Fault::new("PATH_UNSAFE"))?.as_path()),"PATH_UNSAFE")?;
        let directory=canonical.file_name().and_then(|s|s.to_str()).filter(|s|directory_name(s)).ok_or_else(||Fault::new("PATH_UNSAFE"))?.to_owned();
        Ok(Self{root:root_handle,project,directory})
    }
}
pub(super) fn error_value(f:&Fault,operation:Option<&str>,request:Option<&str>)->Value {
    json!({"code":f.code,"messageKey":format!("workspace.{}",f.code),"retryable":false,"outcome":f.outcome,"operationId":operation,"coreRequestId":request})
}
fn valid_error(v:&Value)->Result<()> {
    if v.is_null(){return Ok(());}shape(v,&["code","messageKey","retryable","outcome","operationId","coreRequestId"])?;
    need(v["retryable"].is_boolean() && ["not_submitted","submitted_unknown","not_applicable"].contains(&string(v,"outcome")?),"STORE_CORRUPT")?;
    need(["INVALID_MESSAGE","UNSUPPORTED_PROTOCOL","UNSUPPORTED_METHOD","SERVICE_INSTANCE_MISMATCH","PERMISSION_DENIED","WORKSPACE_NOT_FOUND","WORKSPACE_UNAVAILABLE","PATH_UNSAFE","ENTRY_NOT_FOUND","ENTRY_REVISION_CONFLICT","STORE_REVISION_CONFLICT","STORE_READ_ONLY","STORE_CORRUPT","FUTURE_STORE_SCHEMA","STORE_WRITE_FAILED","RESULT_UNKNOWN","SNAPSHOT_EXPIRED","CURSOR_INVALID","SCAN_NOT_FOUND","SCAN_EXPIRED","SCAN_LIMIT","CANDIDATE_NOT_FOUND","DIRECTORY_MISSING","PROJECT_ID_MISMATCH","PROJECT_FORMAT_MISMATCH","CORE_PROTOCOL_UNSUPPORTED","CORE_FAILURE","SESSION_LIMIT","BUSY","QUEUE_FULL","LIMIT_EXCEEDED","IDEMPOTENCY_CONFLICT","OPERATION_NOT_FOUND","CANCEL_TOO_LATE","INTERNAL_ERROR"].contains(&string(v,"code")?) && string(v,"messageKey")?.len()<=256,"STORE_CORRUPT")?;
    for k in ["operationId","coreRequestId"]{need(v[k].is_null()||v[k].as_str().is_some_and(uuid),"STORE_CORRUPT")?;}Ok(())
}
fn valid_source(v:&Value)->Result<()> {
    match string(v,"kind")? {
        "recent"=>{shape(v,&["kind","entryId","expectedEntryRevision"])?;need(uuid(string(v,"entryId")?),"STORE_CORRUPT")?;u64_string(&v["expectedEntryRevision"])?;},
        "relative"=>{shape(v,&["kind","workspaceId","directory"])?;need(uuid(string(v,"workspaceId")?)&&directory_name(string(v,"directory")?),"STORE_CORRUPT")?;},
        "candidate"=>{shape(v,&["kind","scanId","candidateId"])?;need(uuid(string(v,"scanId")?)&&uuid(string(v,"candidateId")?),"STORE_CORRUPT")?;},
        _=>return Err(Fault::new("STORE_CORRUPT"))
    }Ok(())
}
pub(super) fn validate_operation(v:&Value)->Result<()> {
    shape(v,&["operationId","originCommandId","originServiceInstanceId","state","source","mode","coreProtocol","coreOpenRequestId","coreReadRequestId","sessionAvailability","session","opened","error","cancellable","createdAt","updatedAt"])?;
    for k in ["operationId","originCommandId","originServiceInstanceId","coreOpenRequestId","coreReadRequestId"]{need(uuid(string(v,k)?),"STORE_CORRUPT")?;}
    valid_source(&v["source"])?;
    need(["QUEUED","OPENING","VERIFYING","READY","CANCELLING","CANCELLED","FAILED","UNKNOWN"].contains(&string(v,"state")?)&&["read_write","read_only"].contains(&string(v,"mode")?)&&["1.0","1.1"].contains(&string(v,"coreProtocol")?),"STORE_CORRUPT")?;
    need(v["session"].is_null() && ["not_issued","lost"].contains(&string(v,"sessionAvailability")?) && v["cancellable"].is_boolean(),"STORE_CORRUPT")?;
    for k in ["createdAt","updatedAt"]{need(string(v,k)?.len()<=40,"STORE_CORRUPT")?;}
    valid_error(&v["error"])?;
    if v["state"]=="READY"{need(!v["opened"].is_null()&&v["error"].is_null(),"STORE_CORRUPT")?;}
    if v["state"]=="FAILED"{need(!v["error"].is_null(),"STORE_CORRUPT")?;}
    if !v["opened"].is_null(){let o=&v["opened"];shape(o,&["workspaceId","directory","projectId","name","projectFormat","coreProtocol","headRevision","entryId","recentPersistence","warningCode"])?;
        for k in ["workspaceId","projectId"]{need(uuid(string(o,k)?),"STORE_CORRUPT")?;}
        need(directory_name(string(o,"directory")?)&&!string(o,"name")?.is_empty()&&string(o,"name")?.chars().count()<=80&&matches!(o["projectFormat"].as_u64(),Some(1|2))&&["1.0","1.1"].contains(&string(o,"coreProtocol")?),"STORE_CORRUPT")?;
        u64_string(&o["headRevision"])?;need(o["entryId"].is_null()||o["entryId"].as_str().is_some_and(uuid),"STORE_CORRUPT")?;
        need(["committed","failed","unknown"].contains(&string(o,"recentPersistence")?)&&(o["warningCode"].is_null()||o["warningCode"].as_str().is_some_and(|s|!s.is_empty()&&s.len()<=256)),"STORE_CORRUPT")?;
    }Ok(())
}
pub(super) fn validate_record(r:&Value)->Result<()> {
    shape(r,&["recordKind","commandId","commandOrdinal","principalScopeId","originServiceInstanceId","method","paramsHash","status","outcome","operationId","scanId","operation","verifiedObservation","forget","error","createdAt","updatedAt"])?;
    for k in ["commandId","principalScopeId","originServiceInstanceId"]{need(uuid(string(r,k)?),"STORE_CORRUPT")?;}
    u64_string(&r["commandOrdinal"])?;
    need(r["recordKind"]=="user_command" && ["workspace.open.start","workspace.operation.cancel","workspace.recent.forget","workspace.discovery.start","workspace.discovery.cancel","workspace.request.lookup"].contains(&string(r,"method")?) &&
        ["PREPARED","ACCEPTED","SUBMITTING","CORE_OPENED","CORE_VERIFIED","RECENT_PREPARED","RECENT_RECORDED","TERMINAL","UNKNOWN"].contains(&string(r,"status")?)&&["accepted","committed","failed","unknown"].contains(&string(r,"outcome")?),"STORE_CORRUPT")?;
    let hash=string(r,"paramsHash")?;need(hash.len()==71&&hash.starts_with("sha256:")&&hash[7..].bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)),"STORE_CORRUPT")?;
    for k in ["operationId","scanId"]{need(r[k].is_null()||r[k].as_str().is_some_and(uuid),"STORE_CORRUPT")?;}
    for k in ["createdAt","updatedAt"]{need(string(r,k)?.len()<=40,"STORE_CORRUPT")?;}
    valid_error(&r["error"])?;if !r["operation"].is_null(){validate_operation(&r["operation"])?;need(r["operationId"]==r["operation"]["operationId"],"STORE_CORRUPT")?;}
    if !r["verifiedObservation"].is_null(){validate_observation(&r["verifiedObservation"])?;}
    if !r["forget"].is_null(){let f=&r["forget"];shape(f,&["expectedStoreId","expectedStoreRevision","entryId","expectedEntryRevision","removed"])?;
        for k in ["expectedStoreId","entryId"]{need(uuid(string(f,k)?),"STORE_CORRUPT")?;}
        for k in ["expectedStoreRevision","expectedEntryRevision"]{u64_string(&f[k])?;}need(f["removed"].is_null()||f["removed"].is_boolean(),"STORE_CORRUPT")?;
    }Ok(())
}
fn projection(operation:&Value)->Value {
    let mut copy=operation.clone();copy["session"]=Value::Null;
    if copy["sessionAvailability"]=="current"{copy["sessionAvailability"]=json!("lost");}copy
}
pub(super) fn terminal_record(r:&Value)->bool {if r["recordKind"]=="core_observation"{r["status"]=="RECENT_RECORDED"}else{r["status"]=="TERMINAL"}}
pub(super) fn ordinal(r:&Value)->u64 {u64_string(&r[if r["recordKind"]=="core_observation"{"observationOrdinal"}else{"commandOrdinal"}]).unwrap_or(0)}
impl Workspace {
    pub(super) fn can_evict_record(&self,r:&Value)->bool {terminal_record(r) && !(r["method"]=="workspace.open.start" && r["operationId"].as_str().and_then(|id|self.operations.get(id)).is_some_and(|o|!o.operation["session"].is_null()))}
    pub(super) fn prune_operations(&mut self){
        let retained:HashSet<_>=self.journal["records"].as_array().unwrap().iter().filter_map(|r|r["operationId"].as_str().map(str::to_owned)).collect();
        self.operations.retain(|id,o|retained.contains(id)||!o.operation["session"].is_null());
    }
    fn command_index(&self,command:&str)->Option<usize>{self.journal["records"].as_array().unwrap().iter().position(|r|r["recordKind"]=="user_command" && r["principalScopeId"]==PRINCIPAL_ID && r["commandId"]==command)}
    fn semantic_hash(method:&str,p:&Value)->String {let mut params=p.clone();params.as_object_mut().unwrap().remove("serviceInstanceId");params.as_object_mut().unwrap().remove("commandId");projection_hash(&json!({"method":method,"params":params}))}
    fn original(&self,method:&str,p:&Value)->Result<Option<Value>>{
        let command=string(p,"commandId")?;need(uuid(command),"INVALID_MESSAGE")?;
        if let Some(index)=self.command_index(command){let r=&self.journal["records"][index];need(r["method"]==method&&r["paramsHash"]==Self::semantic_hash(method,p),"IDEMPOTENCY_CONFLICT")?;return Ok(Some(r.clone()));}Ok(None)
    }
    fn insert_command(&mut self,method:&str,p:&Value,operation:Option<&Value>,scan:Option<&str>,forget:Value)->Result<()> {
        let mut next=self.journal.clone();let records=next["records"].as_array_mut().unwrap();
        if records.len()>=128{let index=records.iter().enumerate().filter(|(_,r)|self.can_evict_record(r)).min_by_key(|(_,r)|ordinal(r)).map(|(i,_)|i).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;records.remove(index);}
        let n=u64_string(&next["nextCommandOrdinal"])?;next["nextCommandOrdinal"]=json!(n.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?.to_string());let time=now();
        next["records"].as_array_mut().unwrap().push(json!({"recordKind":"user_command","commandId":p["commandId"],"commandOrdinal":n.to_string(),"principalScopeId":PRINCIPAL_ID,"originServiceInstanceId":self.service,
            "method":method,"paramsHash":Self::semantic_hash(method,p),"status":if method=="workspace.recent.forget"{"PREPARED"}else{"ACCEPTED"},"outcome":if method=="workspace.recent.forget"{"unknown"}else{"accepted"},
            "operationId":operation.map(|o|o["operationId"].clone()),"scanId":scan,"operation":operation.map(projection),"verifiedObservation":null,"forget":forget,"error":null,"createdAt":time,"updatedAt":time}));
        self.journal_commit(next)
    }
    fn update_operation(&mut self,operation:&str,state:&str,error:Value,session:Value,opened:Value)->Result<()> {
        let index=self.journal["records"].as_array().unwrap().iter().position(|r|r["recordKind"]=="user_command"&&r["method"]=="workspace.open.start"&&r["operationId"]==operation).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?;
        let mut value=self.operations.get(operation).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?.operation.clone();
        value["state"]=json!(state);value["error"]=error;value["session"]=session;value["opened"]=opened;value["updatedAt"]=json!(now());
        value["sessionAvailability"]=json!(if value["session"].is_null(){if value["state"]=="READY"{"lost"}else{"not_issued"}}else{"current"});
        value["cancellable"]=json!(["QUEUED","OPENING","VERIFYING","CANCELLING"].contains(&state));
        let mut next=self.journal.clone();let r=&mut next["records"][index];r["operation"]=projection(&value);r["updatedAt"]=json!(now());
        r["status"]=json!(match state{"QUEUED"=>"ACCEPTED","OPENING"=>"SUBMITTING","VERIFYING"=>"CORE_OPENED","UNKNOWN"=>"UNKNOWN",_=>"TERMINAL"});
        r["outcome"]=json!(match state{"READY"=>"committed","FAILED"|"CANCELLED"=>"failed","UNKNOWN"=>"unknown",_=>"accepted"});r["error"]=value["error"].clone();
        self.journal_commit(next)?;self.operations.get_mut(operation).unwrap().operation=value;Ok(())
    }
    pub fn refresh_sessions(&mut self,host:&Host){for state in self.operations.values_mut(){let token=state.operation["session"]["sessionToken"].as_str();if token.is_some_and(|token|!host.session_is_current(token)){state.operation["session"]=Value::Null;state.operation["sessionAvailability"]=json!("lost");}}}
    pub fn take_open_work(&mut self)->Option<OpenWork>{self.pending_open_work.take()}
    pub fn take_scan_work(&mut self)->Option<ScanWork>{self.pending_scan_work.take()}
    fn expire_scans(&mut self){
        self.scans.retain(|s|s.finished.is_none_or(|t|t.elapsed()<Duration::from_secs(300)));
        while self.scans.iter().filter(|s|s.finished.is_some()).count()>2 {let index=self.scans.iter().position(|s|s.finished.is_some()).unwrap();self.scans.remove(index);}
    }
    fn scan_index(&mut self,scan:&str)->Result<usize>{
        self.expire_scans();if let Some(index)=self.scans.iter().position(|s|s.value["scanId"]==scan){return Ok(index);}
        let known=self.journal["records"].as_array().unwrap().iter().any(|r|r["recordKind"]=="user_command"&&r["scanId"]==scan);
        Err(Fault::new(if known{"SCAN_EXPIRED"}else{"SCAN_NOT_FOUND"}))
    }
}
pub(super) fn restore(w:&mut Workspace)->Result<()> {
    let mut next=w.journal.clone();let mut changed=false;
    for r in next["records"].as_array_mut().unwrap(){
        if r["recordKind"]!="user_command"{continue;}
        if r["method"]!="workspace.open.start" || r["operation"].is_null(){
            if r["status"]!="TERMINAL"{
                let f=&r["forget"];
                let committed=r["method"]=="workspace.recent.forget" && !f.is_null() && w.store["storeId"]==f["expectedStoreId"] && w.store["lastCommit"]["commandId"]==r["commandId"] &&
                    u64_string(&w.store["revision"]).ok()==u64_string(&f["expectedStoreRevision"]).ok().and_then(|n|n.checked_add(1)) && !w.store["entries"].as_array().unwrap().iter().any(|i|i["entry"]["entryId"]==f["entryId"]);
                r["status"]=json!(if committed{"TERMINAL"}else{"UNKNOWN"});r["outcome"]=json!(if committed{"committed"}else{"unknown"});if committed{r["forget"]["removed"]=json!(true);r["error"]=Value::Null;}changed=true;
            }continue;
        }
        let mut operation=r["operation"].clone();operation["session"]=Value::Null;operation["sessionAvailability"]=json!("lost");operation["cancellable"]=json!(false);
        if !["READY","FAILED","CANCELLED"].contains(&operation["state"].as_str().unwrap_or("")){operation["state"]=json!("UNKNOWN");r["status"]=json!("UNKNOWN");r["outcome"]=json!("unknown");changed=true;}
        r["operation"]=operation.clone();w.operations.insert(string(&operation,"operationId")?.into(),OpenState{operation,cancel:Arc::new(AtomicBool::new(false))});
    }
    if changed && w._lock.is_some(){w.journal_commit(next)?;}Ok(())
}
pub(super) fn dispatch(w:&mut Workspace,method:&str,p:&Value,session_free:bool)->Result<Value>{
    match method {
        "workspace.recent.forget"=>{
            shape(p,&["serviceInstanceId","commandId","expectedStoreId","expectedStoreRevision","entryId","expectedEntryRevision"])?;
            if let Some(r)=w.original(method,p)?{
                need(r["status"]=="TERMINAL"&&r["outcome"]=="committed"&&r["forget"]["removed"]==true,"RESULT_UNKNOWN")?;
                let revision=u64_string(&r["forget"]["expectedStoreRevision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?;
                return Ok(json!({"commandId":p["commandId"],"outcome":"committed","removed":true,"store":{"schemaVersion":1,"storeId":r["forget"]["expectedStoreId"],"revision":revision.to_string(),"availability":"loaded","persistence":"clean","lastError":null}}));
            }
            w.writable()?;need(w.store["storeId"]==p["expectedStoreId"]&&w.store["revision"]==p["expectedStoreRevision"],"STORE_REVISION_CONFLICT")?;
            for key in ["expectedStoreId","entryId"]{need(uuid(string(p,key)?),"INVALID_MESSAGE")?;}u64_string(&p["expectedStoreRevision"])?;u64_string(&p["expectedEntryRevision"])?;
            let entry=w.store["entries"].as_array().unwrap().iter().position(|i|i["principalScopeId"]==PRINCIPAL_ID&&i["entry"]["entryId"]==p["entryId"]).ok_or_else(||Fault::new("ENTRY_NOT_FOUND"))?;
            need(w.store["entries"][entry]["entry"]["entryRevision"]==p["expectedEntryRevision"],"ENTRY_REVISION_CONFLICT")?;
            let forget=json!({"expectedStoreId":p["expectedStoreId"],"expectedStoreRevision":p["expectedStoreRevision"],"entryId":p["entryId"],"expectedEntryRevision":p["expectedEntryRevision"],"removed":null});
            w.insert_command(method,p,None,None,forget)?;let record=w.command_index(string(p,"commandId")?).unwrap();
            let mut store=w.store.clone();store["entries"].as_array_mut().unwrap().remove(entry);store["revision"]=json!(u64_string(&store["revision"])?.checked_add(1).ok_or_else(||Fault::new("LIMIT_EXCEEDED"))?.to_string());
            store["lastCommit"]=json!({"serviceInstanceId":w.service,"commandId":p["commandId"],"coreOpenRequestId":null,"at":now()});
            let committed=w.commit(store);let mut journal=w.journal.clone();journal["records"][record]["updatedAt"]=json!(now());
            if let Err(f)=committed{journal["records"][record]["status"]=json!("UNKNOWN");journal["records"][record]["outcome"]=json!("unknown");journal["records"][record]["error"]=error_value(&f,None,None);let _=w.journal_commit(journal);return Err(f);}
            journal["records"][record]["status"]=json!("TERMINAL");journal["records"][record]["outcome"]=json!("committed");journal["records"][record]["forget"]["removed"]=json!(true);w.journal_commit(journal)?;
            Ok(json!({"commandId":p["commandId"],"outcome":"committed","removed":true,"store":w.state()}))
        },
        "workspace.open.start"=>{
            shape(p,&["serviceInstanceId","commandId","source","mode","coreProtocol","expectedProjectId","requiredCapabilities"])?;
            if let Some(r)=w.original(method,p)?{return Ok(json!({"commandId":p["commandId"],"accepted":true,"operationId":r["operationId"],"state":"QUEUED"}));}
            need(session_free && w.pending_open_work.is_none(),"SESSION_LIMIT")?;
            need(w.core_protocols.contains(&string(p,"coreProtocol")?),"CORE_PROTOCOL_UNSUPPORTED")?;
            need(["read_write","read_only"].contains(&string(p,"mode")?) && (p["expectedProjectId"].is_null()||p["expectedProjectId"].as_str().is_some_and(uuid)),"INVALID_MESSAGE")?;
            let capabilities=p["requiredCapabilities"].as_array().filter(|a|a.len()<=6).ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
            let mut unique=HashSet::new();for c in capabilities{let s=c.as_str().ok_or_else(||Fault::new("INVALID_MESSAGE"))?;need(["core.project_store","core.scene_documents","core.asset_stream","core.events","editor.graph","preview.control"].contains(&s)&&unique.insert(s),"INVALID_MESSAGE")?;}
            valid_source(&p["source"]).map_err(|_|Fault::new("INVALID_MESSAGE"))?;
            let source=&p["source"];let mut expected_location=None;let (directory,expected_format)=match string(source,"kind")? {
                "recent"=>{let item=w.store["entries"].as_array().unwrap().iter().find(|i|i["principalScopeId"]==PRINCIPAL_ID&&i["entry"]["entryId"]==source["entryId"]).ok_or_else(||Fault::new("ENTRY_NOT_FOUND"))?;
                    let e=&item["entry"];need(e["entryRevision"]==source["expectedEntryRevision"],"ENTRY_REVISION_CONFLICT")?;need(e["projectId"]==p["expectedProjectId"],"PROJECT_ID_MISMATCH")?;
                    need(e["workspaceId"]==WORKSPACE_ID,"WORKSPACE_NOT_FOUND")?;(string(e,"directory")?.to_owned(),e["projectFormat"].as_u64())},
                "relative"=>{need(source["workspaceId"]==WORKSPACE_ID,"WORKSPACE_NOT_FOUND")?;(string(source,"directory")?.to_owned(),None)},
                "candidate"=>{
                    let index=w.scan_index(string(source,"scanId")?)?;let scan=&w.scans[index];need(scan.finished.is_some(),"BUSY")?;
                    let candidate=scan.candidates.iter().find(|c|c.value["candidateId"]==source["candidateId"]).ok_or_else(||Fault::new("CANDIDATE_NOT_FOUND"))?;
                    let guard=LocationGuard::open(&w.root,string(&candidate.value,"directory")?)?;
                    need(identity(&guard.root)?==scan.root_identity && identity(&guard.project)?==candidate.identity,"PATH_UNSAFE")?;
                    expected_location=Some((scan.root_identity.clone(),candidate.identity.clone()));
                    (guard.directory.clone(),None)
                },
                _=>return Err(Fault::new("CANDIDATE_NOT_FOUND"))
            };
            let location=LocationGuard::open(&w.root,&directory)?;let directory=location.directory.clone();let operation=id();let time=now();let cancel=Arc::new(AtomicBool::new(false));
            if let Some((root_identity,project_identity))=expected_location{need(identity(&location.root)?==root_identity && identity(&location.project)?==project_identity,"PATH_UNSAFE")?;}
            let value=json!({"operationId":operation,"originCommandId":p["commandId"],"originServiceInstanceId":w.service,"state":"QUEUED","source":source,"mode":p["mode"],"coreProtocol":p["coreProtocol"],
                "coreOpenRequestId":id(),"coreReadRequestId":id(),"sessionAvailability":"not_issued","session":null,"opened":null,"error":null,"cancellable":true,"createdAt":time,"updatedAt":time});
            w.insert_command(method,p,Some(&value),None,Value::Null)?;
            w.operations.insert(operation.clone(),OpenState{operation:value,cancel:cancel.clone()});
            w.pending_open_work=Some(OpenWork{id:operation.clone(),directory,expected_project:p["expectedProjectId"].as_str().map(str::to_owned),expected_format,capabilities:p["requiredCapabilities"].clone(),cancel,location});
            Ok(json!({"commandId":p["commandId"],"accepted":true,"operationId":operation,"state":"QUEUED"}))
        },
        "workspace.operation.read"=>{shape(p,&["serviceInstanceId","operationId"])?;let o=w.operations.get(string(p,"operationId")?).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?;Ok(json!({"operation":o.operation}))},
        "workspace.operation.cancel"=>{
            shape(p,&["serviceInstanceId","commandId","operationId"])?;
            if let Some(r)=w.original(method,p)?{let operation=w.operations.get(string(&r,"operationId")?).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?;return Ok(json!({"commandId":p["commandId"],"cancelRequested":r["outcome"]=="accepted","operation":operation.operation}));}
            let key=string(p,"operationId")?;let o=w.operations.get(key).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?;let operation=o.operation.clone();let requested=operation["cancellable"]==true;
            w.insert_command(method,p,Some(&operation),None,Value::Null)?;
            if requested{w.operations.get(key).unwrap().cancel.store(true,Ordering::Release);w.update_operation(key,"CANCELLING",Value::Null,Value::Null,Value::Null)?;}
            let index=w.command_index(string(p,"commandId")?).unwrap();let mut next=w.journal.clone();next["records"][index]["status"]=json!("TERMINAL");next["records"][index]["outcome"]=json!(if requested{"accepted"}else{"committed"});w.journal_commit(next)?;
            Ok(json!({"commandId":p["commandId"],"cancelRequested":requested,"operation":w.operations.get(key).unwrap().operation}))
        },
        "workspace.request.lookup"=>{shape(p,&["serviceInstanceId","commandId"])?;need(uuid(string(p,"commandId")?),"INVALID_MESSAGE")?;
            let record=w.command_index(string(p,"commandId")?).map(|i|{let r=&w.journal["records"][i];json!({"commandId":r["commandId"],"method":r["method"],"paramsHash":r["paramsHash"],"outcome":r["outcome"],"operationId":r["operationId"],"scanId":r["scanId"],"removed":r["forget"]["removed"],"error":r["error"]})});
            Ok(json!({"found":record.is_some(),"record":record}))},
        "workspace.discovery.start"=>{
            shape(p,&["serviceInstanceId","commandId","workspaceId"])?;
            if let Some(r)=w.original(method,p)?{let index=w.scan_index(string(&r,"scanId")?)?;return Ok(json!({"commandId":p["commandId"],"accepted":true,"scan":w.scans[index].value}));}
            w.expire_scans();need(w.pending_scan_work.is_none()&&!w.scans.iter().any(|s|s.finished.is_none()),"BUSY")?;need(p["workspaceId"]==WORKSPACE_ID,"WORKSPACE_NOT_FOUND")?;
            let root=directory_handle(&w.root)?;let root_identity=identity(&root)?;let scan=id();let cancel=Arc::new(AtomicBool::new(false));
            let value=json!({"scanId":scan,"serviceInstanceId":w.service,"workspaceId":WORKSPACE_ID,"state":"QUEUED","visitedEntries":0,"candidateCount":0,"skippedUnsafe":0,"scope":"workspace_direct_children","truncated":false,"consistency":"observed_directory_listing","error":null});
            w.insert_command(method,p,None,Some(&scan),Value::Null)?;
            w.scans.push(ScanState{value:value.clone(),root_identity,command:string(p,"commandId")?.into(),cancel:cancel.clone(),finished:None,candidates:Vec::new()});
            w.pending_scan_work=Some(ScanWork{id:scan,root:w.root.clone(),_guard:root,cancel});Ok(json!({"commandId":p["commandId"],"accepted":true,"scan":value}))
        },
        "workspace.discovery.read"=>{
            shape(p,&["serviceInstanceId","scanId","cursor","limit"])?;let index=w.scan_index(string(p,"scanId")?)?;
            let limit=p["limit"].as_u64().filter(|n|*n>=1&&*n<=100).ok_or_else(||Fault::new("INVALID_MESSAGE"))? as usize;
            let scan=w.scans[index].value.clone();
            if w.scans[index].finished.is_none(){need(p["cursor"].is_null(),"CURSOR_INVALID")?;return Ok(json!({"scan":scan,"snapshotId":null,"candidates":[],"nextCursor":null}));}
            let after=if p["cursor"].is_null(){w.scan_snapshot=Some(ScanSnapshot{id:id(),scan:string(&scan,"scanId")?.into(),created:Instant::now(),candidates:w.scans[index].candidates.iter().map(|c|c.value.clone()).collect()});0}else{
                let c=&p["cursor"];shape(c,&["serviceInstanceId","snapshotId","afterIndex"])?;let snapshot=w.scan_snapshot.as_ref().ok_or_else(||Fault::new("SNAPSHOT_EXPIRED"))?;
                need(c["serviceInstanceId"]==w.service&&c["snapshotId"]==snapshot.id&&snapshot.scan==string(&scan,"scanId")?,"CURSOR_INVALID")?;
                c["afterIndex"].as_u64().filter(|n|*n<=snapshot.candidates.len() as u64).ok_or_else(||Fault::new("CURSOR_INVALID"))? as usize};
            let s=w.scan_snapshot.as_ref().unwrap();need(s.created.elapsed()<Duration::from_secs(60),"SNAPSHOT_EXPIRED")?;let end=(after+limit).min(s.candidates.len());
            let next=if end<s.candidates.len(){json!({"serviceInstanceId":w.service,"snapshotId":s.id,"afterIndex":end})}else{Value::Null};
            Ok(json!({"scan":scan,"snapshotId":s.id,"candidates":&s.candidates[after..end],"nextCursor":next}))
        },
        "workspace.discovery.cancel"=>{
            shape(p,&["serviceInstanceId","commandId","scanId"])?;
            if let Some(r)=w.original(method,p)?{let index=w.scan_index(string(&r,"scanId")?)?;return Ok(json!({"commandId":p["commandId"],"cancelRequested":r["outcome"]=="accepted","scan":w.scans[index].value}));}
            let index=w.scan_index(string(p,"scanId")?)?;let requested=w.scans[index].finished.is_none();w.insert_command(method,p,None,p["scanId"].as_str(),Value::Null)?;
            if requested{w.scans[index].cancel.store(true,Ordering::Release);}
            let record=w.command_index(string(p,"commandId")?).unwrap();let mut next=w.journal.clone();next["records"][record]["status"]=json!("TERMINAL");next["records"][record]["outcome"]=json!(if requested{"accepted"}else{"committed"});w.journal_commit(next)?;
            Ok(json!({"commandId":p["commandId"],"cancelRequested":requested,"scan":w.scans[index].value}))
        },
        _=>Err(Fault::new("UNSUPPORTED_METHOD"))
    }
}
pub(crate) fn run_scan(shared:&Mutex<Workspace>,work:ScanWork){
    let mut candidates=Vec::new();let mut visited=0usize;let mut unsafe_count=0usize;let mut bytes=0usize;let start=Instant::now();
    let result=(||->Result<&'static str>{
        let mut entries=fs::read_dir(&work.root).map_err(|_|Fault::new("WORKSPACE_UNAVAILABLE"))?;
        loop {
            if work.cancel.load(Ordering::Acquire){return Ok("CANCELLED");}
            if visited>=10000||start.elapsed()>=Duration::from_secs(30){return Ok("PARTIAL");}
            let Some(next)=entries.next()else{return Ok("SUCCEEDED");};visited+=1;let entry=next.map_err(|_|Fault::new("WORKSPACE_UNAVAILABLE"))?;
            let name=entry.file_name();let name=name.to_str().unwrap_or("");
            if directory_name(name){
                match directory_handle(&entry.path()) {
                    Ok(file)=>{let identity=identity(&file)?;let cached=shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.store["entries"].as_array().unwrap().iter().find(|i|i["principalScopeId"]==PRINCIPAL_ID&&i["entry"]["workspaceId"]==WORKSPACE_ID&&i["entry"]["directory"]==name).map(|i|i["entry"]["entryId"].clone());
                        let value=json!({"candidateId":id(),"workspaceId":WORKSPACE_ID,"directory":name,"locationState":"present","identityStatus":"unverified","cachedEntryId":cached});
                        let size=serde_json::to_vec(&value).map_err(|_|Fault::new("INTERNAL_ERROR"))?.len();if size>8388608-bytes{return Ok("PARTIAL");}bytes+=size;candidates.push(Candidate{value,identity});
                    },Err(_)=>unsafe_count+=1
                }
            }
            if visited%64==0{let mut w=shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;let scan=w.scans.iter_mut().find(|s|s.value["scanId"]==work.id).ok_or_else(||Fault::new("SCAN_NOT_FOUND"))?;
                scan.value["state"]=json!("RUNNING");scan.value["visitedEntries"]=json!(visited);scan.value["candidateCount"]=json!(candidates.len());scan.value["skippedUnsafe"]=json!(unsafe_count);}
        }
    })();
    if let Ok(mut w)=shared.lock(){
        let Some(index)=w.scans.iter().position(|s|s.value["scanId"]==work.id)else{return;};
        let (state,error)=match result{Ok("PARTIAL")=>("PARTIAL",error_value(&Fault::new("SCAN_LIMIT"),None,None)),Ok(state)=>(state,Value::Null),Err(f)=>("FAILED",error_value(&f,None,None))};
        candidates.sort_by(|a,b|a.value["directory"].as_str().cmp(&b.value["directory"].as_str()).then_with(||a.value["candidateId"].as_str().cmp(&b.value["candidateId"].as_str())));
        let scan=&mut w.scans[index];scan.value["state"]=json!(state);scan.value["visitedEntries"]=json!(visited);scan.value["candidateCount"]=json!(candidates.len());scan.value["skippedUnsafe"]=json!(unsafe_count);scan.value["truncated"]=json!(state=="PARTIAL");scan.value["error"]=error.clone();scan.finished=Some(Instant::now());scan.candidates=candidates;let command=scan.command.clone();
        if let Some(record)=w.command_index(&command){let mut next=w.journal.clone();next["records"][record]["status"]=json!("TERMINAL");next["records"][record]["updatedAt"]=json!(now());next["records"][record]["error"]=error;
            if let Err(f)=w.journal_commit(next){w.last_error=Some(f.code);}}
        w.expire_scans();
    }
}
fn host_call(host:&Mutex<Host>,method:&str,p:Value)->Result<Value>{
    let reply=host.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.dispatch(&json!({"protocol":"1.0","callId":id(),"method":method,"params":p}));
    if reply["ok"]==true {return Ok(reply["result"].clone());}
    let mut fault=Fault::new(if ["SESSION_INVALID","SESSION_LIMIT","BUSY","QUEUE_FULL"].contains(&reply["error"]["code"].as_str().unwrap_or("")){reply["error"]["code"].as_str().unwrap()}else{"CORE_FAILURE"});
    if reply["error"]["outcome"]=="submitted_unknown"{fault.outcome="submitted_unknown";}Err(fault)
}
fn core_call(host:&Mutex<Host>,token:&str,request:Value,cancel:&AtomicBool)->Result<Value>{
    let payload=serde_json::to_vec(&request).map_err(|_|Fault::new("INVALID_MESSAGE"))?;
    let ticket=host_call(host,"core.submit",json!({"sessionToken":token,"requestUtf8":blob(&payload)}))?;
    let task=string(&ticket,"taskRef")?;let started=Instant::now();let mut cancellation_sent=false;
    loop {
        let p=json!({"sessionToken":token,"taskRef":task});
        let status=host_call(host,"task.status",p.clone())?;
        if ["SUCCEEDED","FAILED","CANCELLED"].contains(&status["state"].as_str().unwrap_or("")){
            let result=match host_call(host,"task.result",p.clone()){Ok(v)=>v,Err(f)if ["BUSY","NOT_READY"].contains(&f.code.as_str())=>{thread::sleep(Duration::from_millis(4));continue;},Err(mut f)=>{f.outcome="submitted_unknown";return Err(f);}};
            let bytes=unblob(&result["coreResultUtf8"],8388608)?;let value=parse(&bytes,8388608)?;
            // 先保存可信结果再释放槽；清理失败不把已知Core结果改成相反业务结果。
            let _=host_call(host,"task.release",p);
            if value["ok"]==true{return Ok(value["data"].clone());}return Err(Fault::new(if status["state"]=="CANCELLED"{"CANCEL_TOO_LATE"}else{"CORE_FAILURE"}));
        }
        if cancel.load(Ordering::Acquire)&&!cancellation_sent{let _=host_call(host,"task.cancel",p);cancellation_sent=true;}
        if started.elapsed()>Duration::from_secs(30){let mut f=Fault::new("RESULT_UNKNOWN");f.outcome="submitted_unknown";return Err(f);}
        thread::sleep(Duration::from_millis(4));
    }
}
fn close(host:&Mutex<Host>,token:&str)->Result<()> {
    let request=json!({"protocol":"1.0","callId":id(),"method":"session.close","params":{"sessionToken":token,"mode":"cancel","deadlineMs":30000}});let start=Instant::now();
    loop {if host.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.closing_step(&request)?.is_some(){return Ok(());}if start.elapsed()>Duration::from_secs(30){return Err(Fault::new("RESULT_UNKNOWN"));}thread::sleep(Duration::from_millis(4));}
}
pub(crate) fn run_open(host:&Mutex<Host>,shared:&Mutex<Workspace>,work:OpenWork){
    let mut session:Option<Value>=None;let mut current_request:Option<String>=None;
    let result=(||->Result<()>{
        let operation=shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.operations.get(&work.id).ok_or_else(||Fault::new("OPERATION_NOT_FOUND"))?.operation.clone();
        if work.cancel.load(Ordering::Acquire){return Err(Fault::new("CANCEL_TOO_LATE"));}
        shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.update_operation(&work.id,"OPENING",Value::Null,Value::Null,Value::Null)?;
        let opened=host.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.open_for_workspace(&work.id,work.capabilities.clone(),work.expected_project.clone(),work.expected_format)?;
        let token=string(&opened,"sessionToken")?.to_owned();session=Some(opened);
        current_request=operation["coreOpenRequestId"].as_str().map(str::to_owned);
        let project=core_call(host,&token,json!({"protocolVersion":operation["coreProtocol"],"requestId":operation["coreOpenRequestId"],"op":"project.open","params":{"directory":work.directory,"mode":operation["mode"]}}),&work.cancel)?;
        let project_id=string(&project,"projectId")?.to_owned();
        shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.update_operation(&work.id,"VERIFYING",Value::Null,Value::Null,Value::Null)?;
        current_request=operation["coreReadRequestId"].as_str().map(str::to_owned);
        let actual=core_call(host,&token,json!({"protocolVersion":operation["coreProtocol"],"requestId":operation["coreReadRequestId"],"op":"project.read","projectId":project_id,"params":{}}),&work.cancel)?;
        need(actual["id"]==project_id && uuid(&project_id) && actual["name"].as_str().is_some_and(|n|!n.is_empty()&&n.chars().count()<=80)&&matches!(actual["formatVersion"].as_u64(),Some(1|2)),"CORE_FAILURE")?;
        need(work.expected_project.as_ref().is_none_or(|p|*p==project_id),"PROJECT_ID_MISMATCH")?;need(work.expected_format.is_none_or(|f|actual["formatVersion"]==f),"PROJECT_FORMAT_MISMATCH")?;
        if work.cancel.load(Ordering::Acquire){return Err(Fault::new("CANCEL_TOO_LATE"));}
        let mut workspace=shared.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
        if work.cancel.load(Ordering::Acquire){return Err(Fault::new("CANCEL_TOO_LATE"));}
        let entry=workspace.store["entries"].as_array().unwrap().iter().find(|i|i["entry"]["directory"]==work.directory&&i["entry"]["projectId"]==project_id&&i["lastObservedOpen"]["openRequestId"]==operation["coreOpenRequestId"]);
        let committed=entry.is_some()&&workspace.persistence=="clean";let persistence=if committed{"committed"}else if workspace.persistence=="unknown"{"unknown"}else{"failed"};
        let opened=json!({"workspaceId":WORKSPACE_ID,"directory":work.directory,"projectId":project_id,"name":actual["name"],"projectFormat":actual["formatVersion"],"coreProtocol":operation["coreProtocol"],"headRevision":actual["headRevision"],
            "entryId":entry.map(|i|i["entry"]["entryId"].clone()),"recentPersistence":persistence,"warningCode":if committed{None}else{workspace.journal_error.as_ref().or(workspace.last_error.as_ref()).cloned().or(Some("STORE_WRITE_FAILED".into()))}});
        workspace.update_operation(&work.id,"READY",Value::Null,session.clone().unwrap(),opened)?;Ok(())
    })();
    if let Err(mut fault)=result {
        let unknown=fault.outcome=="submitted_unknown"||fault.code=="RESULT_UNKNOWN";
        let closed=if unknown{false}else{session.as_ref().is_none_or(|s|close(host,s["sessionToken"].as_str().unwrap_or("")).is_ok())};
        let state=if !closed{"UNKNOWN"}else if work.cancel.load(Ordering::Acquire){"CANCELLED"}else{"FAILED"};
        if state=="UNKNOWN"{fault.code="RESULT_UNKNOWN".into();fault.outcome="submitted_unknown";}
        if let Ok(mut w)=shared.lock(){let error=if state=="CANCELLED"{Value::Null}else{error_value(&fault,Some(&work.id),current_request.as_deref())};
            if w.update_operation(&work.id,state,error.clone(),Value::Null,Value::Null).is_err(){if let Some(o)=w.operations.get_mut(&work.id){o.operation["state"]=json!("UNKNOWN");o.operation["cancellable"]=json!(false);o.operation["error"]=error_value(&Fault::new("RESULT_UNKNOWN"),Some(&work.id),current_request.as_deref());}}}
        if closed{if let Ok(mut host)=host.lock(){host.release_workspace_gate(&work.id);}}
    }else{if let Ok(mut host)=host.lock(){host.release_workspace_gate(&work.id);}}
    // 句柄一直保留至Core打开/验证/必要关闭完成，不能在受理后就丢弃路径身份保护。
    drop(work.location);
}
