// 所有IPC工作在阻塞工作池内进入同一actor；测试代理不进入生产宿主。
mod wire;
mod ffi;
mod core;
mod locale;
use crate::{core::Host,locale::LocalUX,wire::*};
use serde_json::{json,Value};
use std::{sync::{Arc,Mutex,atomic::{AtomicUsize,Ordering}},time::{Instant,Duration}};
use tauri::{Manager,Emitter};
struct AppState { host:Mutex<Host>,ux:LocalUX,pending:AtomicUsize }
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
async fn host_bootstrap(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>)->std::result::Result<Value,String>{
    if window.label()!="main"{return Err("PERMISSION_DENIED".into());}
    let state=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        state.ux.bind("main").map_err(|e|e.code)?;
        let host=state.host.lock().map_err(|_|"INTERNAL_ERROR".to_string())?;
        Ok(json!({"grantRef":host.grant(),"hostKind":"tauri-native"}))
    }).await.map_err(|_|"INTERNAL_ERROR".to_string())?
}
#[tauri::command]
async fn core_dispatch(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->Value{
    if window.label()!="main"{return host_error(&request,Fault::new("PERMISSION_DENIED").at_submission(request["method"].as_str().unwrap_or(""),false));}
    let state=state.inner().clone();
    let guard=match permit(&state){Ok(p)=>p,Err(e)=>return host_error(&request,e.at_submission(request["method"].as_str().unwrap_or(""),false))};
    let fallback=request.clone();
    tauri::async_runtime::spawn_blocking(move||{
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
    }).await.unwrap_or_else(|_|host_error(&fallback,Fault::new("INTERNAL_ERROR").at_submission(fallback["method"].as_str().unwrap_or(""),true)))
}
#[tauri::command]
async fn ux_dispatch(window:tauri::WebviewWindow,state:tauri::State<'_,Arc<AppState>>,request:Value)->Value{
    let principal=window.label().to_owned();
    if principal!="main"{return json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],
        "ok":false,"error":{"code":"PERMISSION_DENIED","messageKey":"ux.PERMISSION_DENIED","retryable":false}});}
    let state=state.inner().clone();
    let guard=match permit(&state){Ok(p)=>p,Err(_)=>return json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
        "error":{"code":"PROFILE_LIMIT","messageKey":"ux.pendingCalls","retryable":false}})};
    let fallback=request.clone();
    tauri::async_runtime::spawn_blocking(move||{
        let _guard=guard;
        if serde_json::to_vec(&request).map(|b|b.len()>65536).unwrap_or(true){
            return json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
                "error":{"code":"PROFILE_LIMIT","messageKey":"ux.requestTooLarge","retryable":false}});
        }
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(||state.ux.dispatch(&principal,&request)))
            .unwrap_or_else(|_|json!({"uxProtocol":"1.1","callId":request["callId"],"method":request["method"],"ok":false,
                "error":{"code":"INTERNAL_ERROR","messageKey":"ux.INTERNAL_ERROR","retryable":false}}))
    }).await.unwrap_or_else(|_|json!({"uxProtocol":"1.1","callId":fallback["callId"],"method":fallback["method"],"ok":false,
        "error":{"code":"INTERNAL_ERROR","messageKey":"ux.INTERNAL_ERROR","retryable":false}}))
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default()
        .setup(|app|{
            let app_data=app.path().app_local_data_dir()?;
            let projects=app_data.join("projects");
            std::fs::create_dir_all(&projects)?;
            let library=app.path().resource_dir()?.join("native/windows-x86_64");
            let state=Arc::new(AppState{host:Mutex::new(Host::new(projects,library)),
                ux:LocalUX::new(app_data.join("editor-profile")),pending:AtomicUsize::new(0)});
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
        .invoke_handler(tauri::generate_handler![host_bootstrap,core_dispatch,ux_dispatch])
        .run(tauri::generate_context!())
        .expect("GameGen host startup failed");
}
