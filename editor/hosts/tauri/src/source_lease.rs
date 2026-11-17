// 生命周期租约只保护当前native绑定；耐久快照consumer仍由任务日志独立持有和释放。
use crate::wire::*;
use std::{collections::HashMap,sync::{Arc,Mutex}};
type Cancel=Arc<dyn Fn()+Send+Sync>;
#[derive(Clone)]pub(crate) struct SourceLeases(Arc<Mutex<HashMap<String,Cancel>>>);
pub(crate) struct SourceLease {registry:SourceLeases,id:String}
impl SourceLeases {
    pub fn new()->Self{Self(Arc::new(Mutex::new(HashMap::new())))}
    pub fn acquire(&self,cancel:Cancel)->Result<SourceLease>{
        let mut registry=self.0.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;need(registry.len()<32,"QUEUE_FULL")?;
        let id=id();registry.insert(id.clone(),cancel);Ok(SourceLease{registry:self.clone(),id})
    }
    pub fn active(&self)->bool {self.0.lock().map(|r|!r.is_empty()).unwrap_or(true)}
    pub fn cancel(&self){
        // 不在registry锁内回调，避免worker关闭桥并释放租约时形成反向等待。
        let callbacks=self.0.lock().map(|r|r.values().cloned().collect::<Vec<_>>()).unwrap_or_default();
        for callback in callbacks{callback();}
    }
}
impl Drop for SourceLease {fn drop(&mut self){self.registry.0.lock().unwrap_or_else(|e|e.into_inner()).remove(&self.id);}}
