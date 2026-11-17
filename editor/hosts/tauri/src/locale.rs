// 设备语言与项目/课程文件隔离；只有实际替换确认后才改变effectiveLocale。
use crate::{wire::*,store_io::{write_new,replace}};
use fs2::FileExt;
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{collections::{HashMap,VecDeque},fs::{self,File,OpenOptions},path::{Path,PathBuf},
    sync::{Arc,Mutex,Condvar},thread::{self,JoinHandle}};
const LOCALES:[(&str,&str);7]=[("en","English"),("zh-Hans","简体中文"),("zh-Hant","繁體中文"),
    ("ja","日本語"),("ko","한국어"),("es","Español"),("fr","Français")];
const METHODS:[&str;4]=["ux.describe","ux.snapshot","ux.locale.select","ux.events.read"];
#[derive(Clone)]struct Intent {command:String,ticket:u64,locale:String}
struct Channel {id:String,sequence:u64}
struct Data {
    service:String,state:Value,channels:HashMap<String,Channel>,ticket:u64,pending:Option<Intent>,stop:bool,
    receipts:VecDeque<(String,String,Value)>,events:VecDeque<Value>,seq:u64,
}
pub struct LocalUX {inner:Arc<(Mutex<Data>,Condvar)>,directory:PathBuf,_lock:Option<File>,worker:Option<JoinHandle<()>>}
fn checksum(v:&Value)->String{format!("{:x}",Sha256::digest(serde_json::to_vec(v).unwrap_or_default()))}
fn normalize(locale:&str)->Option<&str>{
    match locale{"en-US"|"en-GB"=>Some("en"),"zh-CN"|"zh-SG"=>Some("zh-Hans"),
        "zh-TW"|"zh-HK"|"zh-MO"=>Some("zh-Hant"),"ja-JP"=>Some("ja"),"ko-KR"=>Some("ko"),
        "es-ES"=>Some("es"),"fr-FR"=>Some("fr"),v if LOCALES.iter().any(|(l,_)|*l==v)=>Some(v),_=>None}
}
fn load(path:&Path)->Result<Value>{
    let metadata=fs::symlink_metadata(path).map_err(|_|Fault::new("LOCALE_STORAGE_FAILED"))?;
    need(metadata.is_file() && !metadata.file_type().is_symlink() && metadata.len()<=8192,"LOCALE_STORAGE_FAILED")?;
    let bytes=fs::read(path).map_err(|_|Fault::new("LOCALE_STORAGE_FAILED"))?;
    let mut value=parse(&bytes,8192)?;
    need(value["schemaVersion"]==1,"LOCALE_READ_ONLY")?;
    let digest=value.as_object_mut().ok_or_else(||Fault::new("LOCALE_STORAGE_FAILED"))?
        .remove("checksum").and_then(|x|x.as_str().map(str::to_owned)).ok_or_else(||Fault::new("LOCALE_STORAGE_FAILED"))?;
    need(checksum(&value)==digest && uuid(string(&value,"localeStoreId")?) &&
        normalize(string(&value,"locale")?).is_some(),"LOCALE_STORAGE_FAILED")?;
    u64_string(&value["localeRevision"])?;
    shape(&value["lastCommit"],&["serviceInstanceId","commandId","ticket"])?;
    need(uuid(string(&value["lastCommit"],"serviceInstanceId")?) && uuid(string(&value["lastCommit"],"commandId")?),"LOCALE_STORAGE_FAILED")?;
    u64_string(&value["lastCommit"]["ticket"])?;
    shape(&value,&["schemaVersion","localeStoreId","locale","localeRevision","lastCommit"])?;
    Ok(value)
}
fn apply_saved(state:&mut Value,v:&Value){
    state["localeStoreId"]=v["localeStoreId"].clone();state["localeRevision"]=v["localeRevision"].clone();
    let locale=normalize(v["locale"].as_str().unwrap_or("")).unwrap_or("en");
    state["effectiveLocale"]=json!(locale);state["persistedLocale"]=json!(locale);
    state["source"]=json!("saved");state["availability"]=json!("loaded");
    state["lastOutcome"]=json!({"serviceInstanceId":v["lastCommit"]["serviceInstanceId"],
        "commandId":v["lastCommit"]["commandId"],"ticket":v["lastCommit"]["ticket"],
        "outcome":"committed","errorCode":null});
}
fn publish(d:&mut Data,kind:&str,intent:Option<&Intent>){
    d.seq+=1;
    d.events.push_back(json!({"seq":d.seq.to_string(),"kind":kind,"localeState":d.state,
        "commandId":intent.map(|i|i.command.clone()),"ticket":intent.map(|i|i.ticket.to_string())}));
    if d.events.len()>256{d.events.pop_front();}
}
fn outcome(d:&mut Data,intent:&Intent,result:&str,error:Option<&str>){
    d.state["lastOutcome"]=json!({"serviceInstanceId":d.service,"commandId":intent.command,
        "ticket":intent.ticket.to_string(),"outcome":result,"errorCode":error});
}
impl LocalUX {
    pub fn new(directory:PathBuf)->Self{
        let directory_ok=fs::create_dir_all(&directory).is_ok() &&
            fs::symlink_metadata(&directory).map(|m|!m.file_type().is_symlink()).unwrap_or(false);
        let lock=if directory_ok{OpenOptions::new().read(true).write(true).create(true).open(directory.join(".locale.lock")).ok()
            .filter(|f|f.try_lock_exclusive().is_ok())}else{None};
        let writable=lock.is_some();
        let mut state=json!({"storeSchemaVersion":1,"localeStoreId":null,"localeRevision":"0","effectiveLocale":"en",
            "persistedLocale":null,"source":"default","status":"idle","availability":"new",
            "latestAcceptedTicket":"0","pending":null,"lastOutcome":null,"lastError":null});
        let file=directory.join("editor-locale-v1.json");
        if file.exists(){
            match load(&file){
                Ok(v)=>apply_saved(&mut state,&v),
                Err(f)=>{state["availability"]=json!(if f.code=="LOCALE_READ_ONLY"{"future_schema"}else{"corrupt"});
                    state["lastError"]=json!(f.code);if state["availability"]=="future_schema"{state["status"]=json!("read_only");}}
            }
        }
        if !writable {state["availability"]=json!("read_only");state["status"]=json!("read_only");state["lastError"]=json!("LOCALE_READ_ONLY");}
        let inner=Arc::new((Mutex::new(Data{service:id(),state,channels:HashMap::new(),ticket:0,pending:None,stop:false,
            receipts:VecDeque::new(),events:VecDeque::new(),seq:0}),Condvar::new()));
        let work=inner.clone();let destination=directory.clone();
        let worker=if writable{Some(thread::spawn(move||Self::run(work,destination)))}else{None};
        Self{inner,directory,_lock:lock,worker}
    }
    pub fn bind(&self,principal:&str)->Result<()>{
        let mut d=self.inner.0.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
        need(d.channels.contains_key(principal)||d.channels.len()<32,"PROFILE_LIMIT")?;
        d.channels.insert(principal.into(),Channel{id:id(),sequence:0});Ok(())
    }
    pub fn unbind(&self,principal:&str){
        if let Ok(mut d)=self.inner.0.lock(){d.channels.remove(principal);}
    }
    fn profile(d:&Data)->Value{
        // 引导服务未在本增量实现，不能把内存占位值报告为已持久化学习记录。
        json!({"serviceInstanceId":d.service,"profileSchemaVersion":1,"profileRevision":"0","persistedRevision":null,
            "persistenceState":"clean","availability":"memory_only","lastWriteError":null,"welcomeHandled":false,
            "preferences":{"autoHints":true,"showLearningProgress":true,"suppressedHintIds":[]},
            "courses":[],"activeRun":null,"localeState":d.state})
    }
    pub fn dispatch(&self,principal:&str,request:&Value)->Value{
        let call=request["callId"].as_str().unwrap_or("");let method=request["method"].as_str().unwrap_or("");
        let result=(||->Result<Value>{
            need(request["uxProtocol"]=="1.1","UNSUPPORTED_PROTOCOL")?;
            shape(request,&["uxProtocol","callId","method","params"])?;need(uuid(call),"INVALID_MESSAGE")?;
            let p=&request["params"];let mut d=self.inner.0.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
            let channel=d.channels.get(principal).ok_or_else(||Fault::new("PERMISSION_DENIED"))?;
            if method=="ux.describe"{
                shape(p,&[])?;
                let catalog:Value=serde_json::from_str(include_str!("../../../web/src/locales/catalogue.json"))
                    .map_err(|_|Fault::new("INTERNAL_ERROR"))?;
                return Ok(json!({"uxProtocol":"1.1","serviceInstanceId":d.service,"adapterKind":"tauri-local",
                    "profileSchemaVersion":1,"guideCatalogHash":null,"availableGuides":[],"implementedMethods":METHODS,
                    "supportedUxProtocols":["1.1"],"limits":{"profileBytes":262144,"practiceJournalBytes":8388608,
                    "pendingPracticeRuns":1,"practiceJournalRecords":128,"commandReceipts":128,"courseVersionRecords":32,
                    "stepsPerCourse":64,"suppressedHints":512,"requestBytes":65536,"responseBytes":524288,
                    "eventRing":256,"eventReadItems":100,"localeFileBytes":8192,"localeWriteJobs":1,
                    "localePendingIntents":1,"localeSelectionChannels":32},
                    "locale":{"supportedLocales":LOCALES.iter().map(|(id,name)|json!({"id":id,"nativeName":name})).collect::<Vec<_>>(),
                    "defaultLocale":"en","fallbackLocale":"en","localeSchemaVersion":1,"selectionChannelId":channel.id,
                    "latestSelectionSeq":channel.sequence.to_string(),"resourceCatalogVersion":catalog["version"],
                    "resourceCatalogHash":catalog["hash"],"resourceLocales":catalog["locales"]}}));
            }
            need(p["serviceInstanceId"]==d.service,"SERVICE_RESTARTED")?;
            match method {
                "ux.snapshot"=>{
                    shape(p,&["serviceInstanceId"])?;
                    if d.state["status"]=="reconciling" {
                        if let Ok(value)=load(&self.directory.join("editor-locale-v1.json")){
                            if OpenOptions::new().read(true).write(true).open(self.directory.join("editor-locale-v1.json")).and_then(|f|f.sync_all()).is_ok(){
                                apply_saved(&mut d.state,&value);d.state["status"]=json!("idle");d.state["lastError"]=Value::Null;
                                d.state["pending"]=Value::Null;publish(&mut d,"locale.reconciled",None);
                            }
                        }
                    }
                    Ok(Self::profile(&d))
                },
                "ux.events.read"=>{
                    shape(p,&["serviceInstanceId","afterSeq","limit"])?;let after=u64_string(&p["afterSeq"])?;
                    let limit=p["limit"].as_u64().filter(|n|*n>=1 && *n<=100).ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
                    let events:Vec<_>=d.events.iter().filter(|e|u64_string(&e["seq"]).unwrap_or(0)>after).take(limit as usize).cloned().collect();
                    // 超前游标先回到真实尾部；gap要求调用方重取snapshot，随后可继续读新增事件。
                    let next=events.last().map(|e|e["seq"].clone()).unwrap_or_else(||json!(after.min(d.seq).to_string()));
                    let gap=d.events.front().is_some_and(|e|after.saturating_add(1)<u64_string(&e["seq"]).unwrap_or(0))||after>d.seq;
                    Ok(json!({"serviceInstanceId":d.service,"nextSeq":next,"gap":gap,"events":events}))
                },
                "ux.locale.select"=>{
                    shape(p,&["serviceInstanceId","commandId","selectionChannelId","selectionSeq","locale"])?;
                    let command=string(p,"commandId")?;need(uuid(command),"INVALID_MESSAGE")?;
                    let digest=checksum(p);
                    if let Some((_,old,receipt))=d.receipts.iter().find(|(id,_,_)|id==command){
                        need(old==&digest,"IDEMPOTENCY_CONFLICT")?;return Ok(receipt.clone());
                    }
                    let locale=string(p,"locale")?;need(LOCALES.iter().any(|(id,_)|*id==locale),"UNSUPPORTED_LOCALE")?;
                    need(d.state["status"]!="read_only","LOCALE_READ_ONLY")?;
                    need(d.state["status"]!="reconciling","LOCALE_RESULT_UNKNOWN")?;
                    let seq=u64_string(&p["selectionSeq"])?;
                    let channel=d.channels.get(principal).ok_or_else(||Fault::new("LOCALE_CHANNEL_INVALID"))?;
                    need(p["selectionChannelId"]==channel.id,"LOCALE_CHANNEL_INVALID")?;
                    need(seq>channel.sequence,"LOCALE_INTENT_STALE")?;
                    let ticket=d.ticket.checked_add(1).ok_or_else(||Fault::new("PROFILE_LIMIT"))?;
                    let revision=u64_string(&d.state["localeRevision"])?;
                    need(revision<u64::MAX,"LOCALE_REVISION_EXHAUSTED")?;
                    d.channels.get_mut(principal).unwrap().sequence=seq;d.ticket=ticket;
                    let intent=Intent{command:command.into(),ticket,locale:locale.into()};
                    if let Some(previous)=d.pending.take(){
                        outcome(&mut d,&previous,"superseded",None);publish(&mut d,"locale.superseded",Some(&previous));
                    }
                    d.state["latestAcceptedTicket"]=json!(ticket.to_string());
                    d.state["pending"]=json!({"commandId":command,"ticket":ticket.to_string(),"locale":locale});
                    d.state["status"]=json!("saving");d.state["lastError"]=Value::Null;
                    d.pending=Some(intent.clone());publish(&mut d,"locale.pending",Some(&intent));
                    let receipt=json!({"commandId":command,"accepted":true,"ticket":ticket.to_string(),"localeState":d.state});
                    d.receipts.push_back((command.into(),digest,receipt.clone()));if d.receipts.len()>128{d.receipts.pop_front();}
                    self.inner.1.notify_one();Ok(receipt)
                },
                _=>Err(Fault::new("MISSING_CAPABILITY"))
            }
        })();
        match result{
            Ok(value)=>json!({"uxProtocol":"1.1","callId":call,"method":method,"ok":true,"result":value}),
            Err(fault)=>{let mut error=json!({"code":fault.code,"messageKey":format!("ux.{}",fault.code),"retryable":false});
                if let Ok(d)=self.inner.0.lock(){error["localeState"]=d.state.clone();}
                json!({"uxProtocol":"1.1","callId":call,"method":method,"ok":false,"error":error})}
        }
    }
    fn run(shared:Arc<(Mutex<Data>,Condvar)>,directory:PathBuf){
        loop{
            let (intent,mut payload)={
                let mut d=match shared.0.lock(){Ok(d)=>d,Err(_)=>return};
                while d.pending.is_none() && !d.stop{d=match shared.1.wait(d){Ok(d)=>d,Err(_)=>return};}
                if d.stop{return;}
                let intent=d.pending.take().unwrap();
                if d.state["persistedLocale"]==intent.locale && d.state["source"]=="saved" {
                    outcome(&mut d,&intent,"unchanged",None);d.state["pending"]=Value::Null;d.state["status"]=json!("idle");
                    publish(&mut d,"locale.committed",Some(&intent));continue;
                }
                let revision=u64_string(&d.state["localeRevision"]).unwrap_or(0);
                let store=d.state["localeStoreId"].as_str().map(str::to_owned).unwrap_or_else(id);
                let payload=json!({"schemaVersion":1,"localeStoreId":store,"locale":intent.locale,
                    "localeRevision":revision.saturating_add(1).to_string(),
                    "lastCommit":{"serviceInstanceId":d.service,"commandId":intent.command,"ticket":intent.ticket.to_string()}});
                (intent,payload)
            };
            let digest=checksum(&payload);payload["checksum"]=json!(digest);
            let raw=match serde_json::to_vec(&payload){Ok(v)if v.len()<=8192=>v,_=>return};
            let temp=directory.join(format!(".locale-{}.tmp",id()));let target=directory.join("editor-locale-v1.json");
            let prepared=write_new(&temp,&raw);
            let mut d=match shared.0.lock(){Ok(d)=>d,Err(_)=>return};
            // 最终闸门与替换共用actor锁，后来的意图不能被旧暂存覆盖。
            if d.stop || d.ticket!=intent.ticket{
                let _=fs::remove_file(&temp);outcome(&mut d,&intent,"superseded",None);
                publish(&mut d,"locale.superseded",Some(&intent));if d.stop{return;}continue;
            }
            if target.exists() && d.state["availability"]!="corrupt" {
                let disk=load(&target);
                let mismatch=match &disk {
                    Ok(value)=>value["localeStoreId"]!=d.state["localeStoreId"] || value["localeRevision"]!=d.state["localeRevision"],
                    Err(_)=>true,
                };
                if mismatch {
                    let _=fs::remove_file(&temp);d.state["pending"]=Value::Null;
                    let future=disk.as_ref().err().is_some_and(|f|f.code=="LOCALE_READ_ONLY");
                    d.state["status"]=json!(if future{"read_only"}else{"reconciling"});
                    if future{d.state["availability"]=json!("future_schema");}
                    let code=if future{"LOCALE_READ_ONLY"}else{"LOCALE_RESULT_UNKNOWN"};
                    d.state["lastError"]=json!(code);outcome(&mut d,&intent,"unknown",Some(code));
                    publish(&mut d,"locale.failed",Some(&intent));continue;
                }
            }
            let saved=(||->std::io::Result<()>{
                prepared?;
                if target.exists(){
                    let previous=fs::read(&target)?;
                    if previous.len()>8192{return Err(std::io::ErrorKind::InvalidData.into());}
                    if d.state["availability"]=="corrupt"{
                        // 只保留一个有界损坏原件；未来schema绝不进入可写分支。
                        let evidence=directory.join("editor-locale-v1.corrupt");
                        if !evidence.exists(){write_new(&evidence,&previous)?;}
                    }else{
                        let backup=directory.join(format!(".locale-backup-{}.tmp",id()));
                        write_new(&backup,&previous)?;replace(&backup,&directory.join("editor-locale-v1.previous"))?;
                    }
                }
                replace(&temp,&target)
            })();
            if saved.is_ok(){
                if let Ok(confirmed)=load(&target){
                    if confirmed["lastCommit"]["commandId"]==intent.command{
                        apply_saved(&mut d.state,&confirmed);d.state["pending"]=Value::Null;d.state["status"]=json!("idle");
                        d.state["lastError"]=Value::Null;outcome(&mut d,&intent,"committed",None);
                        publish(&mut d,"locale.committed",Some(&intent));continue;
                    }
                }
            }
            let _=fs::remove_file(&temp);
            let changed=load(&target).map(|v|v["lastCommit"]["commandId"]==intent.command).unwrap_or(false);
            d.state["pending"]=Value::Null;
            d.state["status"]=json!(if changed{"reconciling"}else{"failed"});
            let code=if changed{"LOCALE_RESULT_UNKNOWN"}else{"LOCALE_STORAGE_FAILED"};
            d.state["lastError"]=json!(code);outcome(&mut d,&intent,if changed{"unknown"}else{"failed"},Some(code));
            publish(&mut d,"locale.failed",Some(&intent));
        }
    }
}
impl Drop for LocalUX{
    fn drop(&mut self){
        if let Ok(mut d)=self.inner.0.lock(){d.stop=true;self.inner.1.notify_all();}
        if let Some(worker)=self.worker.take(){let _=worker.join();}
    }
}
