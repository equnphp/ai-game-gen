// 单一宿主会话管理器串行调用FFI；等待任务由调用端分轮查询，不占住actor。
use crate::{ffi::{Api,Buffer,Config,bytes},wire::*,workspace::Workspace};
use serde_json::{json,Value};
use std::{collections::HashMap,path::PathBuf,sync::{Arc,Mutex},time::{Duration,Instant}};

const METHODS:[&str;12]=["host.describe","session.open","session.state","session.close","core.submit","upload.write",
    "blob.read","task.status","task.result","task.cancel","task.release","events.read"];
fn limits()->Value {json!({"requestJsonBytes":2097152,"binaryChunkBytes":1048576,"resultDecodedBytes":8388608,
    "coreTaskSlots":32,"hostPendingCalls":16,"coreEventRing":256,"eventPollItems":100,"eventDecodedBytes":1048576,
    "resultCacheSlots":1,"resultCacheDecodedBytes":8388608,"wireLineBytes":16777216,"uploadPendingChunks":4,
    "driverMaxRequestIds":65536,"driverNewWorkThreshold":65000})}
struct Ticket { native:u64,reference:String,request_id:Option<String>,origin:String,op:String,protocol:String,directory:Option<String> }
struct OpenObservation {request:String,directory:String,protocol:String,operation:String,verified:Option<Value>}
pub(crate) struct NativeProjectContext {pub api:Arc<Api>,pub directory:PathBuf,pub project_id:String,pub protocol:String,pub session_id:String,pub core_id:String}
struct Cache { task:String,state:String,json:Vec<u8>,binary:Option<Vec<u8>> }
struct Session {
    api:Arc<Api>,native:u64,token:String,id:String,core_id:String,state:String,
    tasks:HashMap<String,Ticket>,cache:Option<Cache>,project:Option<String>,durable:Option<String>,closing_task:Option<u64>,protocol:String,
    host_id:String,workspace:Arc<Mutex<Workspace>>,pending_open:Option<OpenObservation>,
    verified_directory:Option<String>,
    expected_project:Option<String>,expected_format:Option<u64>,
}
impl Session {
    fn poll(&self,native:u64)->Result<(String,Value)> {
        let (mut output,mut error)=(Buffer::default(),Buffer::default());
        let status=unsafe{(self.api.poll)(self.native,native,&mut output,&mut error)};
        let data=self.api.take(output,2097152)?;self.api.checked(status,error)?;
        let v=parse(&data,2097152)?;let state=string(&v,"state")?.to_owned();
        need(["QUEUED","RUNNING","COMMITTING","SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()),"CORE_CONTRACT_VIOLATION")?;
        Ok((state,v))
    }
    fn native_result(&self,native:u64)->Result<(Vec<u8>,Vec<u8>)>{
        let (mut output,mut binary,mut error)=(Buffer::default(),Buffer::default(),Buffer::default());
        let status=unsafe{(self.api.result)(self.native,native,&mut output,&mut binary,&mut error)};
        // 每个buffer均释放，即使另一个字段超限或ABI返回失败。
        let data=self.api.take(output,8388608);let block=self.api.take(binary,1048576);
        self.api.checked(status,error)?;let (data,block)=(data?,block?);
        need(data.len()+block.len()<=8388608,"CORE_CONTRACT_VIOLATION")?;Ok((data,block))
    }
    fn release_native(&self,native:u64)->Result<()>{
        let mut error=Buffer::default();let status=unsafe{(self.api.release)(self.native,native,&mut error)};
        self.api.checked(status,error)
    }
    fn update_project(&mut self,op:&str,raw:&[u8],protocol:&str,request:Option<&str>,directory:Option<&str>)->Result<()>{
        let value=parse(raw,8388608)?;
        if value["ok"]!=true{return Ok(());}
        let data=&value["data"];
        if matches!(op,"project.create"|"project.open"){
            self.project=data["projectId"].as_str().map(str::to_owned);
            self.verified_directory=None;
            if let (Some(request),Some(directory))=(request,directory){
                let directory=self.workspace.lock().ok().and_then(|w|w.canonical_directory(directory).ok()).unwrap_or_else(||directory.into());
                self.pending_open=Some(OpenObservation{request:request.into(),directory,protocol:protocol.into(),operation:op.into(),verified:None});}
        }
        if op=="project.read" && self.pending_open.as_ref().is_some_and(|o|o.protocol==protocol) && self.project.as_deref()==data["id"].as_str() &&
            self.expected_project.as_ref().is_none_or(|p|data["id"]==*p) && self.expected_format.is_none_or(|f|data["formatVersion"]==f){
            need(data["id"].as_str().is_some_and(uuid) && data["name"].as_str().is_some_and(|n|!n.is_empty()&&n.chars().count()<=80) && matches!(data["formatVersion"].as_u64(),Some(1|2)),"CORE_CONTRACT_VIOLATION")?;
            u64_string(&data["headRevision"]).map_err(|_|Fault::new("CORE_CONTRACT_VIOLATION"))?;
            let observed=self.pending_open.as_mut().unwrap();
            self.verified_directory=Some(observed.directory.clone());
            if observed.verified.is_none(){
                // 一次open固定首个成功read的来源；缓存失败后的重试不能偷换成后来head。
                if let Some(read_request)=request{observed.verified=Some(json!({"event":"verified_project_open","hostInstanceId":self.host_id,"sessionId":self.id,"coreInstanceId":self.core_id,
                    "workspaceId":crate::workspace::WORKSPACE_ID,"directory":observed.directory,"openOperation":observed.operation,"openRequestId":observed.request,"readRequestId":read_request,
                    "coreProtocol":protocol,"projectId":data["id"],"name":data["name"],"projectFormat":data["formatVersion"],"headRevision":data["headRevision"],"observedAt":crate::workspace::now()}));}
            }
            // 索引失败只能成为本机缓存警告，不能篡改已经成功的Core工程收据。
            let recorded=observed.verified.as_ref().is_some_and(|v|self.workspace.lock().ok().is_some_and(|mut w|w.observe(v).is_ok()));
            if recorded{self.pending_open=None;}
        }
        // 关闭使用已成功访问项目的消息版本；format2不能再被M1关闭命令误拒绝。
        if matches!(op,"project.create"|"project.open"|"project.read"|"project.upgrade.commit") && !protocol.is_empty(){self.protocol=protocol.into();}
        if op=="project.close"{self.project=None;self.pending_open=None;self.verified_directory=None;}
        if let Some(v)=data.get("revision").or_else(||data.get("headRevision")).and_then(Value::as_str){
            u64_string(&json!(v))?;self.durable=Some(v.into());
        }
        Ok(())
    }
    fn result(&mut self,key:&str)->Result<Value>{
        if let Some(cache)=&self.cache{
            need(cache.task==key,"BUSY")?;
            return Ok(json!({"state":cache.state,"coreResultUtf8":blob(&cache.json),
                "binary":cache.binary.as_ref().map(|b|blob(b))}));
        }
        let ticket=self.tasks.get(key).ok_or_else(||Fault::new("TASK_INVALID"))?;
        let (native,op,protocol,request,directory)=(ticket.native,ticket.op.clone(),ticket.protocol.clone(),ticket.request_id.clone(),ticket.directory.clone());let (state,_)=self.poll(native)?;
        need(["SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()),"NOT_READY")?;
        let (raw,binary)=self.native_result(native)?;
        let decoded=parse(&raw,8388608)?;
        need(decoded["ok"].as_bool()==Some(state=="SUCCEEDED"),"CORE_CONTRACT_VIOLATION")?;
        if op!="blob.read"{need(binary.is_empty(),"CORE_CONTRACT_VIOLATION")?;}
        self.update_project(&op,&raw,&protocol,request.as_deref(),directory.as_deref())?;
        self.cache=Some(Cache{task:key.into(),state:state.clone(),json:raw,binary:if op=="blob.read"{Some(binary)}else{None}});
        self.result(key)
    }
    fn release(&mut self,key:&str)->Result<Value>{
        let task=self.tasks.get(key).ok_or_else(||Fault::new("TASK_INVALID"))?;
        let (native,op,protocol,request,directory)=(task.native,task.op.clone(),task.protocol.clone(),task.request_id.clone(),task.directory.clone());
        let (state,_)=self.poll(native)?;
        need(["SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()),"NOT_READY")?;
        if !self.cache.as_ref().is_some_and(|c|c.task==key) &&
            (op.starts_with("project.") || matches!(op.as_str(),"document.commit"|"history.undo"|"history.redo"|"snapshot.restore"|"asset.attach")){
            let(raw,_)=self.native_result(native)?;self.update_project(&op,&raw,&protocol,request.as_deref(),directory.as_deref())?;
        }
        self.release_native(native)?;self.tasks.remove(key);
        if self.cache.as_ref().is_some_and(|x|x.task==key){self.cache=None;}
        Ok(json!({"released":true}))
    }
    fn close_step(&mut self,cancel:bool)->Result<Option<Value>>{
        self.state="CLOSING".into();
        let keys:Vec<_>=self.tasks.keys().cloned().collect();
        let mut waiting=false;
        for key in keys{
            let Some(task)=self.tasks.get(&key)else{continue;};
            let native=task.native;let (state,_)=self.poll(native)?;
            if !["SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()){
                if cancel{
                    let mut error=Buffer::default();let status=unsafe{(self.api.cancel)(self.native,native,&mut error)};
                    let result=self.api.checked(status,error);if status!=6{result?;}
                }waiting=true;continue;
            }
            if self.cache.as_ref().is_some_and(|x|x.task!=key){
                let cached=self.cache.as_ref().map(|x|x.task.clone()).unwrap();self.release(&cached)?;
            }
            self.result(&key)?;self.release(&key)?;
        }
        if waiting{return Ok(None);}
        if let Some(project)=&self.project{
            if self.closing_task.is_none(){
                let raw=serde_json::to_vec(&json!({"protocolVersion":self.protocol,"requestId":id(),"op":"project.close",
                    "projectId":project,"params":{}})).map_err(|_|Fault::new("INTERNAL_ERROR"))?;
                let (mut task,mut error)=(0,Buffer::default());
                let status=unsafe{(self.api.submit)(self.native,bytes(&raw),&mut task,&mut error)};
                self.api.checked(status,error)?;self.closing_task=Some(task);
            }
            let task=self.closing_task.unwrap();let (state,_)=self.poll(task)?;
            if !["SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()){return Ok(None);}
            let (raw,_)=self.native_result(task)?;let value=parse(&raw,8388608)?;
            need(value["ok"]==true,"CORE_ABI")?;
            self.release_native(task)?;self.closing_task=None;self.project=None;
            self.durable=value["data"]["lastDurableRevision"].as_str().map(str::to_owned);
        }
        let mut error=Buffer::default();let status=unsafe{(self.api.destroy)(self.native,&mut error)};
        self.api.checked(status,error)?;self.native=0;
        Ok(Some(json!({"state":"CLOSED","lastDurableRevision":self.durable})))
    }
}
pub struct Host {
    host_id:String,grant:String,root:PathBuf,library:PathBuf,api:Option<Arc<Api>>,
    session:Option<Session>,quarantined:Option<(Arc<Api>,u64)>,load_error:Option<Fault>,workspace:Arc<Mutex<Workspace>>,workspace_gate:Option<String>,
}
impl Host {
    pub fn new(root:PathBuf,library:PathBuf,workspace:Arc<Mutex<Workspace>>)->Self{
        Self{host_id:id(),grant:format!("g1.{}",id()),root,library,api:None,session:None,quarantined:None,load_error:None,workspace,workspace_gate:None}
    }
    pub fn has_session(&self)->bool{self.session.is_some() || self.quarantined.is_some() || self.workspace_gate.is_some()}
    pub(crate) fn session_is_current(&self,token:&str)->bool{self.session.as_ref().is_some_and(|s|s.token==token&&s.state=="OPEN")}
    pub(crate) fn ensure_components(&mut self)->Result<()>{self.load().map(|_|())}
    pub(crate) fn reserve_workspace_gate(&mut self,operation:&str)->Result<()>{need(!self.has_session(),"SESSION_LIMIT")?;self.workspace_gate=Some(operation.into());Ok(())}
    pub(crate) fn release_workspace_gate(&mut self,operation:&str){if self.workspace_gate.as_deref()==Some(operation){self.workspace_gate=None;}}
    pub(crate) fn open_for_workspace(&mut self,operation:&str,capabilities:Value,expected_project:Option<String>,expected_format:Option<u64>)->Result<Value>{
        need(self.workspace_gate.as_deref()==Some(operation),"PERMISSION_DENIED")?;
        let grant=format!("g1.{}",id());
        let opened=self.open_with_grant(&json!({"grantRef":grant,"requiredCapabilities":capabilities}),&grant)?;
        // 预设身份在原生结果观察之前绑定；身份不符的read不能先污染最近索引。
        if let Some(session)=&mut self.session{session.expected_project=expected_project;session.expected_format=expected_format;}Ok(opened)
    }
    pub(crate) fn native_project_context(&self,token:&str,project:&str)->Result<NativeProjectContext>{
        let session=self.session.as_ref().filter(|s|s.token==token).ok_or_else(||Fault::new("SESSION_INVALID"))?;
        need(session.state=="OPEN" && session.project.as_deref()==Some(project),"PERMISSION_DENIED")?;
        let directory=session.verified_directory.as_ref().ok_or_else(||Fault::new("NOT_READY"))?;
        need(crate::workspace::directory_name(directory),"PERMISSION_DENIED")?;
        // 目录只来自同会话成功open+read，WebView提供的项目ID不能转成任意磁盘路径。
        Ok(NativeProjectContext{api:session.api.clone(),directory:self.root.join(directory),project_id:project.into(),protocol:session.protocol.clone(),session_id:session.id.clone(),core_id:session.core_id.clone()})
    }
    pub fn grant(&self)->String{self.grant.clone()}
    fn load(&mut self)->Result<Arc<Api>>{
        if let Some(api)=&self.api{return Ok(api.clone());}
        if let Some(fault)=&self.load_error{return Err(fault.clone());}
        match Api::load(&self.library){Ok(api)=>{if let Ok(mut w)=self.workspace.lock(){w.core_loaded(api.protocols.clone());}self.api=Some(api.clone());Ok(api)},
            Err(fault)=>{self.load_error=Some(fault.clone());Err(fault)}}
    }
    fn get(&mut self,p:&Value)->Result<&mut Session>{
        let token=string(p,"sessionToken")?;
        self.session.as_mut().filter(|s|s.token==token).ok_or_else(||Fault::new("SESSION_INVALID"))
    }
    fn open(&mut self,p:&Value)->Result<Value>{
        let grant=self.grant.clone();self.open_with_grant(p,&grant)
    }
    fn open_with_grant(&mut self,p:&Value,grant:&str)->Result<Value>{
        shape(p,&["grantRef","requiredCapabilities"])?;
        need(self.session.is_none() && self.quarantined.is_none(),"SESSION_LIMIT")?;
        // Workspace内部grant只在当前作业/受管根/可信main主体中使用，不向网页发放。
        need(string(p,"grantRef")?==grant,"PERMISSION_DENIED")?;
        let required=p["requiredCapabilities"].as_array().ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
        let offered=["core.project_store","core.scene_documents","core.asset_stream","core.events"];
        for capability in required{need(offered.contains(&capability.as_str().unwrap_or("")),"UNSUPPORTED")?;}
        let api=self.load()?;
        let root=self.root.to_str().ok_or_else(||Fault::new("PERMISSION_DENIED"))?.as_bytes();
        let config=Config{size:32,abi:0x10000,root:bytes(root),flags:0,reserved:0};
        let (mut core,mut error)=(0,Buffer::default());
        let status=unsafe{(api.create)(&config,&mut core,&mut error)};
        api.checked(status,error).map_err(|mut f|{if status==3{f.code="SESSION_INVALID".into();}f})?;
        let mut session=Session{api:api.clone(),native:core,token:String::new(),id:id(),core_id:String::new(),state:"OPEN".into(),
            tasks:HashMap::new(),cache:None,project:None,durable:None,closing_task:None,protocol:"1.0".into(),
            host_id:self.host_id.clone(),workspace:self.workspace.clone(),pending_open:None,verified_directory:None,expected_project:None,expected_format:None};
        let initialized=(||->Result<()>{
            let request=serde_json::to_vec(&json!({"protocolVersion":"1.0","requestId":id(),"op":"core.capabilities","params":{}}))
                .map_err(|_|Fault::new("INTERNAL_ERROR"))?;
            let (mut task,mut error)=(0,Buffer::default());
            let status=unsafe{(api.submit)(core,bytes(&request),&mut task,&mut error)};api.checked(status,error)?;
            let deadline=Instant::now()+Duration::from_secs(2);
            loop{
                let (state,poll)=session.poll(task)?;
                if ["SUCCEEDED","FAILED","CANCELLED"].contains(&state.as_str()){
                    session.core_id=string(&poll,"coreInstanceId")?.into();
                    let (raw,_)=session.native_result(task)?;session.release_native(task)?;
                    let result=parse(&raw,8388608)?;
                    need(result["ok"]==true && result["data"]["capabilities"]["localCore"]==true,"UNSUPPORTED")?;break;
                }
                need(Instant::now()<deadline,"TIMEOUT")?;std::thread::sleep(Duration::from_millis(2));
            }Ok(())
        })();
        if let Err(fault)=initialized{
            let mut error=Buffer::default();let code=unsafe{(api.destroy)(core,&mut error)};
            let _=api.checked(code,error);
            if code!=0{self.quarantined=Some((api,core));}return Err(fault);
        }
        session.token=format!("s1.{}.{}",self.host_id,session.id);
        let result=json!({"state":"OPEN","sessionToken":session.token,"sessionId":session.id,"hostInstanceId":self.host_id,
            "coreInstanceId":session.core_id,"capabilities":offered,"cursor":{"hostInstanceId":self.host_id,
            "sessionId":session.id,"coreInstanceId":session.core_id,"afterSeq":"0"}});
        self.session=Some(session);Ok(result)
    }
    fn operate(&mut self,method:&str,p:&Value,call:&str,accepted:&mut bool)->Result<Value>{
        if method=="host.describe"{
            shape(p,&[])?;let _=self.load();
            return Ok(json!({"contractVersion":"1.0","hostInstanceId":self.host_id,"adapterKind":"tauri-native",
                "hostBuildId":null,"coreBuildId":self.api.as_ref().map(|a|a.build_id.clone()),
                "coreAbi":self.api.as_ref().map(|_|"1.0"),"implementedMethods":METHODS,"limits":limits()}));
        }
        if method=="session.open"{need(self.workspace_gate.is_none(),"SESSION_LIMIT")?;return self.open(p);}
        if method=="events.read"{
            shape(p,&["sessionToken","cursor","limit"])?;
            let host_id=self.host_id.clone();let session=self.get(p)?;
            let limit=p["limit"].as_u64().filter(|x|*x>=1 && *x<=100).ok_or_else(||Fault::new("INVALID_MESSAGE"))? as u32;
            let cursor=&p["cursor"];
            let after=if cursor.is_null(){0}else{
                shape(cursor,&["hostInstanceId","sessionId","coreInstanceId","afterSeq"])?;
                need(cursor["hostInstanceId"]==host_id && cursor["sessionId"]==session.id &&
                    cursor["coreInstanceId"]==session.core_id,"CURSOR_INVALID")?;
                u64_string(&cursor["afterSeq"])?
            };
            let(mut out,mut error)=(Buffer::default(),Buffer::default());
            let code=unsafe{(session.api.events)(session.native,after,limit,&mut out,&mut error)};
            let raw=session.api.take(out,1048576)?;session.api.checked(code,error)?;let v=parse(&raw,1048576)?;
            need(v["coreInstanceId"]==session.core_id,"CORE_CONTRACT_VIOLATION")?;
            let items=v["events"].as_array().ok_or_else(||Fault::new("CORE_CONTRACT_VIOLATION"))?;
            let mut events=Vec::new();for item in items{
                let seq=item["seq"].as_u64().ok_or_else(||Fault::new("CORE_CONTRACT_VIOLATION"))?;
                events.push(json!({"seq":seq.to_string(),"jsonUtf8":blob(&serde_json::to_vec(item).map_err(|_|Fault::new("INTERNAL_ERROR"))?)}));
            }
            return Ok(json!({"nextCursor":{"hostInstanceId":host_id,"sessionId":session.id,
                "coreInstanceId":session.core_id,"afterSeq":v["nextSeq"]},"gap":v["gap"],"events":events}));
        }
        let session=self.get(p)?;
        match method{
            "session.state"=>{
                shape(p,&["sessionToken"])?;
                let tasks:Vec<_>=session.tasks.values().map(|t|json!({"taskRef":t.reference,"coreRequestId":t.request_id,"originCallId":t.origin})).collect();
                Ok(json!({"state":session.state,"sessionId":session.id,"coreInstanceId":session.core_id,
                    "projectState":if session.tasks.values().any(|t|matches!(t.op.as_str(),"project.create"|"project.open"|"project.close")){"UNKNOWN"}else if session.project.is_some(){"OPEN"}else{"NONE"},"activeTasks":tasks.len(),"tasks":tasks,
                    "resultSlotTask":session.cache.as_ref().map(|c|c.task.clone())}))
            },
            "core.submit"|"upload.write"|"blob.read"=>{
                need(session.state=="OPEN","SESSION_CLOSING")?;need(session.tasks.len()<32,"QUEUE_FULL")?;
                let (mut native,mut error)=(0,Buffer::default());let request_id;let op;let protocol;let directory;
                let code=if method=="core.submit"{
                    shape(p,&["sessionToken","requestUtf8"])?;let raw=unblob(&p["requestUtf8"],2097152)?;
                    let value=parse(&raw,2097152)?;let rid=string(&value,"requestId")?;
                    need(uuid(rid),"INVALID_MESSAGE")?;request_id=Some(rid.to_owned());op=string(&value,"op")?.to_owned();
                    protocol=value["protocolVersion"].as_str().filter(|v|v.len()<=16).unwrap_or("").to_owned();
                    directory=if matches!(op.as_str(),"project.create"|"project.open"){value["params"]["directory"].as_str().filter(|s|s.len()<=74).map(str::to_owned)}else{None};
                    unsafe{(session.api.submit)(session.native,bytes(&raw),&mut native,&mut error)}
                }else if method=="upload.write"{
                    shape(p,&["sessionToken","uploadId","offset","chunk"])?;
                    let upload=string(p,"uploadId")?;need(uuid(upload),"INVALID_MESSAGE")?;
                    let data=unblob(&p["chunk"],1048576)?;need(!data.is_empty(),"INVALID_MESSAGE")?;
                    request_id=None;op=method.into();protocol=String::new();directory=None;
                    unsafe{(session.api.upload)(session.native,bytes(upload.as_bytes()),u64_string(&p["offset"])?,bytes(&data),&mut native,&mut error)}
                }else{
                    shape(p,&["sessionToken","contentHash","offset","maxBytes"])?;
                    let content=string(p,"contentHash")?;need(content.len()==71 && content.starts_with("sha256:") &&
                        content[7..].bytes().all(|c|c.is_ascii_digit()||(b'a'..=b'f').contains(&c)),"INVALID_MESSAGE")?;
                    let max=p["maxBytes"].as_u64().filter(|n|*n>=1 && *n<=1048576).ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
                    request_id=None;op=method.into();protocol=String::new();directory=None;
                    unsafe{(session.api.read)(session.native,bytes(content.as_bytes()),u64_string(&p["offset"])?,max as u32,&mut native,&mut error)}
                };
                // 状态码为成功后，即使回执buffer/句柄违约也不能声称未受理。
                *accepted=code==0;
                session.api.checked(code,error)?;need(native!=0,"CORE_CONTRACT_VIOLATION")?;
                let reference=format!("t1.{}.{}",session.id,id());
                let result=json!({"taskRef":reference,"coreRequestId":request_id,"originCallId":call});
                session.tasks.insert(reference.clone(),Ticket{native,reference,request_id,origin:call.into(),op,protocol,directory});Ok(result)
            },
            "task.status"|"task.result"|"task.cancel"|"task.release"=>{
                shape(p,&["sessionToken","taskRef"])?;let reference=string(p,"taskRef")?;
                let task=session.tasks.get(reference).ok_or_else(||Fault::new("TASK_INVALID"))?;
                let native=task.native;
                match method{
                    "task.status"=>{let(state,v)=session.poll(native)?;Ok(json!({"state":state,"cancellable":v["cancellable"],
                        "coreStateUtf8":blob(&serde_json::to_vec(&v).map_err(|_|Fault::new("INTERNAL_ERROR"))?)}))},
                    "task.result"=>session.result(reference),
                    "task.cancel"=>{let mut error=Buffer::default();
                        let code=unsafe{(session.api.cancel)(session.native,native,&mut error)};session.api.checked(code,error)?;
                        Ok(json!({"cancelRequested":true}))},
                    _=>session.release(reference)
                }
            },
            _=>Err(Fault::new("INVALID_MESSAGE"))
        }
    }
    pub fn dispatch(&mut self,request:&Value)->Value{
        let call=request["callId"].as_str().unwrap_or("").to_owned();let method=request["method"].as_str().unwrap_or("").to_owned();
        let mut accepted=false;
        let result=(||{
            need(request["protocol"]=="1.0","UNSUPPORTED_PROTOCOL")?;
            shape(request,&["protocol","callId","method","params"])?;need(uuid(&call),"INVALID_MESSAGE")?;
            need(METHODS.contains(&method.as_str()),"INVALID_MESSAGE")?;
            self.operate(&method,&request["params"],&call,&mut accepted)
        })();
        match result{
            Ok(value)=>json!({"protocol":"1.0","callId":call,"method":method,"ok":true,"result":value}),
            Err(fault)=>{
                let fault=fault.at_submission(&method,accepted);
                if fault.code=="CORE_CONTRACT_VIOLATION"{if let Some(s)=&mut self.session{s.state="FAILED".into();}}
                json!({"protocol":"1.0","callId":call,"method":method,"ok":false,"error":fault.value()})
            }
        }
    }
    pub fn closing_step(&mut self,request:&Value)->Result<Option<Value>>{
        need(request["protocol"]=="1.0","UNSUPPORTED_PROTOCOL")?;
        shape(request,&["protocol","callId","method","params"])?;need(uuid(string(request,"callId")?),"INVALID_MESSAGE")?;
        let p=&request["params"];shape(p,&["sessionToken","mode","deadlineMs"])?;
        let mode=string(p,"mode")?;need(["drain","cancel"].contains(&mode),"INVALID_MESSAGE")?;
        let result=self.get(p)?.close_step(mode=="cancel")?;
        if result.is_some(){self.session=None;}Ok(result)
    }
}
