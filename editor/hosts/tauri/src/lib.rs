// 所有IPC工作在阻塞工作池内进入同一actor；测试代理不进入生产宿主。
mod wire;
mod ffi;
mod core;
mod locale;
mod store_io;
mod workspace;
mod artifact_bridge;
mod sqlite;
mod source_lease;
mod artifact_store;
mod compiler_component;
mod contracts;
use crate::{core::Host,locale::LocalUX,wire::*,workspace::Workspace};
use serde_json::{json,Value};
use std::{sync::{Arc,Mutex,atomic::{AtomicUsize,Ordering}},time::{Instant,Duration}};
use tauri::{Manager,Emitter};
struct AppState { host:Mutex<Host>,ux:LocalUX,workspace:Arc<Mutex<Workspace>>,components:Arc<compiler_component::CompilerComponents>,pending:AtomicUsize }
struct Permit(Arc<AppState>);
impl Drop for Permit {fn drop(&mut self){self.0.pending.fetch_sub(1,Ordering::AcqRel);}}
fn permit(state:&Arc<AppState>)->Result<Permit>{
    let mut previous=state.pending.load(Ordering::Acquire);
    loop{
        need(previous<16,"QUEUE_FULL")?;
        match state.pending.compare_exchange_weak(previous,previous+1,Ordering::AcqRel,Ordering::Acquire){
            Ok(_)=>return Ok(Permit(state.clone())),Err(now)=>previous=now,
        }
    }
}
fn host_error(request:&Value,fault:Fault)->Value{
    json!({"protocol":"1.0","callId":request["callId"],"method":request["method"],"ok":false,"error":fault.value()})
}
#[tauri::command]
async fn compiler_component_rpc(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->std::result::Result<Value,String>{
    fn failed(request:&Value,code:&str)->Value{json!({"protocolVersion":"1.0","requestId":request["requestId"],"ok":false,"error":{"code":code,"messageKey":format!("compiler.{code}"),"retryable":code=="TIMEOUT"}})}
    if window.label()!="main"{return Ok(failed(&request,"COMPONENT_UNAVAILABLE"));}
    let state=state.inner().clone();let permit=match permit(&state){Ok(p)=>p,Err(_)=>return Ok(failed(&request,"LIMIT_EXCEEDED"))};let fallback=request.clone();
    Ok(tauri::async_runtime::spawn_blocking(move||{
        let _permit=permit;
        let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||->Result<Value>{
            let encoded=serde_json::to_vec(&request).map_err(|_|Fault::new("INVALID_MESSAGE"))?;parse(&encoded,65536)?;
            shape(&request,&["protocolVersion","requestId","method","params"])?;need(request["requestId"].as_str().is_some_and(uuid),"INVALID_MESSAGE")?;
            need(request["protocolVersion"]=="1.0","UNSUPPORTED_PROTOCOL")?;need(request["method"]=="compiler.component.read","UNSUPPORTED_METHOD")?;shape(&request["params"],&[])?;
            crate::contracts::check(crate::contracts::Contract::CompilerPort,&request)?;
            // 初始化受控组件不建立Core会话；耗时hash工作由单一组件worker处理。
            let provider=state.host.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.native_api().map_err(|_|Fault::new("COMPONENT_UNAVAILABLE"))?;
            let component=state.components.read(provider)?;Ok(json!({"protocolVersion":"1.0","requestId":request["requestId"],"ok":true,"data":component.projection}))
        }));
        match result{Ok(Ok(v))=>v,Ok(Err(f))=>{let code=if ["INVALID_MESSAGE","UNSUPPORTED_PROTOCOL","UNSUPPORTED_METHOD","COMPONENT_UNAVAILABLE","COMPONENT_INTEGRITY_ERROR","COMPONENT_CHANGED","LIMIT_EXCEEDED","TIMEOUT","INTERNAL_ERROR"].contains(&f.code.as_str()){f.code.as_str()}else{"COMPONENT_INTEGRITY_ERROR"};failed(&request,code)},Err(_)=>failed(&request,"INTERNAL_ERROR")}
    }).await.unwrap_or_else(|_|failed(&fallback,"INTERNAL_ERROR")))
}
#[tauri::command]
async fn host_bootstrap(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>)->std::result::Result<Value,String>{
    if window.label()!="main"{return Err("PERMISSION_DENIED".into());}
    let state=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        state.ux.bind("main").map_err(|e|e.code)?;
        state.workspace.lock().map_err(|_|"INTERNAL_ERROR".to_string())?.bind();
        let host=state.host.lock().map_err(|_|"INTERNAL_ERROR".to_string())?;
        Ok(json!({"grantRef":host.grant(),"hostKind":"tauri-native"}))
    }).await.map_err(|_|"INTERNAL_ERROR".to_string())?
}
#[tauri::command]
async fn workspace_dispatch(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->std::result::Result<Value,String>{
    fn failure(r:&Value,code:&str)->Value {json!({"workspaceProtocol":"1.0","callId":r["callId"],"method":r["method"],"ok":false,
        "error":{"code":code,"messageKey":format!("workspace.{code}"),"retryable":false,"outcome":"not_applicable","operationId":null,"coreRequestId":null}})}
    if window.label()!="main"{return Ok(failure(&request,"PERMISSION_DENIED"));}
    let state=state.inner().clone();let guard=match permit(&state){Ok(p)=>p,Err(_)=>return Ok(failure(&request,"QUEUE_FULL"))};
    let fallback=request.clone();
    let response=tauri::async_runtime::spawn_blocking(move||{
        let _guard=guard;
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(||{
            let encoded=match serde_json::to_vec(&request){Ok(bytes)=>bytes,Err(_)=>return failure(&request,"INVALID_MESSAGE")};
            if encoded.len()>65536{return failure(&request,"LIMIT_EXCEEDED");}
            if parse(&encoded,65536).is_err(){return failure(&request,"INVALID_MESSAGE");}
            let (response,work,scan)={
                // 全部双锁按Host→Workspace顺序，观察器也沿同一顺序进入，不反向等待。
                let mut host=match state.host.lock(){Ok(h)=>h,Err(_)=>return failure(&request,"INTERNAL_ERROR")};
                if request["method"]=="workspace.describe"{let _=host.ensure_components();}
                let mut workspace=match state.workspace.lock(){Ok(w)=>w,Err(_)=>return failure(&request,"INTERNAL_ERROR")};
                workspace.refresh_sessions(&host);let response=workspace.dispatch(&request,!host.has_session());let work=workspace.take_open_work();
                if let Some(work)=&work{if host.reserve_workspace_gate(&work.id).is_err(){return failure(&request,"RESULT_UNKNOWN");}}
                let scan=workspace.take_scan_work();(response,work,scan)
            };
            if let Some(work)=work{let worker_state=state.clone();tauri::async_runtime::spawn_blocking(move||workspace::run_open(&worker_state.host,&worker_state.workspace,work));}
            if let Some(scan)=scan{let worker_state=state.clone();tauri::async_runtime::spawn_blocking(move||workspace::run_scan(&worker_state.workspace,scan));}
            if serde_json::to_vec(&response).map(|b|b.len()>524288).unwrap_or(true){return failure(&request,"LIMIT_EXCEEDED");}response
        })).unwrap_or_else(|_|failure(&request,"INTERNAL_ERROR"))
    }).await.unwrap_or_else(|_|failure(&fallback,"INTERNAL_ERROR"));Ok(response)
}
#[tauri::command]
async fn core_dispatch(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->std::result::Result<Value,String>{
    if window.label()!="main"{return Ok(host_error(&request,Fault::new("PERMISSION_DENIED").at_submission(request["method"].as_str().unwrap_or(""),false)));}
    let state=state.inner().clone();
    let guard=match permit(&state){Ok(p)=>p,Err(e)=>return Ok(host_error(&request,e.at_submission(request["method"].as_str().unwrap_or(""),false)))};
    let fallback=request.clone();
    // 异步State借用须以Result返回；协议失败仍放在Value中，保持前端线协议不变。
    let response=tauri::async_runtime::spawn_blocking(move||{
        let _guard=guard;
        let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||->Result<Value>{
            // 尚未进入actor/native的限额拒绝是确定未受理，不能让UI进入结果未知。
            let method=request["method"].as_str().unwrap_or("");
            let size=serde_json::to_vec(&request).map_err(|_|Fault::new("INVALID_MESSAGE").at_submission(method,false))?.len();
            need(size<=16777216,"LIMIT_EXCEEDED").map_err(|f|f.at_submission(method,false))?;
            if request["method"]=="session.close"{
                let deadline_ms=request["params"]["deadlineMs"].as_u64().filter(|n|*n>=1 && *n<=30000)
                    .ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
                let deadline=Instant::now()+Duration::from_millis(deadline_ms);
                loop{
                    let step=state.host.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?.closing_step(&request)?;
                    if let Some(value)=step{return Ok(json!({"protocol":"1.0","callId":request["callId"],
                        "method":"session.close","ok":true,"result":value}));}
                    if Instant::now()>=deadline{
                        let mut f=Fault::new("TIMEOUT");f.outcome="submitted_unknown";
                        let mut response=host_error(&request,f);response["error"]["sessionState"]=json!("CLOSING");return Ok(response);
                    }
                    std::thread::sleep(Duration::from_millis(4));
                }
            }
            Ok(state.host.lock().map_err(|_|Fault::new("INTERNAL_ERROR").at_submission(method,false))?.dispatch(&request))
        }));
        match result{Ok(Ok(value))=>value,Ok(Err(f))=>host_error(&request,f),Err(_)=>{
            // panic/join失败无法证明原生未受理，保留原请求供确认。
            host_error(&request,Fault::new("INTERNAL_ERROR").at_submission(request["method"].as_str().unwrap_or(""),true))}}
    }).await.unwrap_or_else(|_|host_error(&fallback,Fault::new("INTERNAL_ERROR").at_submission(fallback["method"].as_str().unwrap_or(""),true)));
    Ok(response)
}
#[tauri::command]
async fn ux_dispatch(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->std::result::Result<Value,String>{
    let principal=window.label().to_owned();
    if principal!="main"{return Ok(json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],
        "ok":false,"error":{"code":"PERMISSION_DENIED","messageKey":"ux.PERMISSION_DENIED","retryable":false}}));}
    let state=state.inner().clone();
    let guard=match permit(&state){Ok(p)=>p,Err(_)=>return Ok(json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
        "error":{"code":"PROFILE_LIMIT","messageKey":"ux.pendingCalls","retryable":false}}))};
    let fallback=request.clone();
    // Result只适配Tauri异步命令生命周期，UX错误收据继续原样返回。
    let response=tauri::async_runtime::spawn_blocking(move||{
        let _guard=guard;
        if serde_json::to_vec(&request).map(|b|b.len()>65536).unwrap_or(true){
            return json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
                "error":{"code":"PROFILE_LIMIT","messageKey":"ux.requestTooLarge","retryable":false}});
        }
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(||state.ux.dispatch(&principal,&request)))
            .unwrap_or_else(|_|json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
                "error":{"code":"INTERNAL_ERROR","messageKey":"ux.INTERNAL_ERROR","retryable":false}}))
    }).await.unwrap_or_else(|_|json!({"uxProtocol":"1.1","callId":fallback["callId"],"method":fallback["method"],"ok":false,
        "error":{"code":"INTERNAL_ERROR","messageKey":"ux.INTERNAL_ERROR","retryable":false}}));
    Ok(response)
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default()
        .setup(|app|{
            let app_data=app.path().app_local_data_dir()?;
            let projects=app_data.join("projects");
            std::fs::create_dir_all(&projects)?;
            let library=app.path().resource_dir()?.join("native/windows-x86_64");
            let workspace=Arc::new(Mutex::new(Workspace::new(projects.clone(),app_data.join("workspace"))));
            let state=Arc::new(AppState{host:Mutex::new(Host::new(projects,library,workspace.clone())),workspace,
                ux:LocalUX::new(app_data.join("editor-profile")),components:Arc::new(compiler_component::CompilerComponents::default()),pending:AtomicUsize::new(0)});
            app.manage(state);Ok(())
        })
        .on_window_event(|window,event|{
            if let tauri::WindowEvent::Destroyed=event{
                if let Some(state)=window.try_state::<Arc<AppState>>(){state.ux.unbind(window.label());}
            }
            if let tauri::WindowEvent::CloseRequested{api,..}=event{
                if let Some(state)=window.try_state::<Arc<AppState>>(){
                    if state.host.lock().map(|h|h.has_session()).unwrap_or(true){
                        api.prevent_close();let _=window.emit("host:close-requested",());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![host_bootstrap,core_dispatch,ux_dispatch,workspace_dispatch,compiler_component_rpc])
        .run(tauri::generate_context!())
        .expect("GameGen host startup failed");
}
