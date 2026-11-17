// 线协议与领域失败分开；原Core字节透传，不在Rust复制领域合法性规则。
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{de::{self, MapAccess, SeqAccess, Visitor}, Deserialize, Deserializer};
use serde_json::{json, Value};
use std::{collections::BTreeMap, fmt};

#[derive(Debug, Clone)]
pub struct Fault { pub code: String, pub outcome: &'static str, pub native: Option<(i32, Vec<u8>)> }
pub type Result<T> = std::result::Result<T, Fault>;
impl Fault {
    pub fn new(code: &str) -> Self { Self { code: code.into(), outcome: "not_applicable", native: None } }
    pub fn value(&self) -> Value {
        let mut v=json!({"code":self.code,"messageKey":format!("host.{}",self.code),
            "retryable":matches!(self.code.as_str(),"QUEUE_FULL"|"NOT_READY"|"BUSY"),"outcome":self.outcome});
        if let Some((status, bytes))=&self.native { v["coreStatus"]=json!(status); v["coreErrorJson"]=blob(bytes); }
        v
    }
}
pub fn need(ok: bool, code: &str) -> Result<()> { if ok { Ok(()) } else { Err(Fault::new(code)) } }
pub fn id() -> String { uuid::Uuid::new_v4().to_string() }
pub fn uuid(s: &str) -> bool {
    uuid::Uuid::parse_str(s).map(|u|u.get_version_num()==4 && u.to_string()==s).unwrap_or(false)
}
pub fn string<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key).and_then(Value::as_str).ok_or_else(||Fault::new("INVALID_MESSAGE"))
}
pub fn u64_string(v: &Value) -> Result<u64> {
    let s=v.as_str().ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
    need(!s.is_empty() && (s=="0" || !s.starts_with('0')) && s.bytes().all(|c|c.is_ascii_digit()),"INVALID_MESSAGE")?;
    s.parse().map_err(|_|Fault::new("LIMIT_EXCEEDED"))
}
pub fn shape(v: &Value, fields: &[&str]) -> Result<()> {
    let m=v.as_object().ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
    need(m.len()==fields.len() && fields.iter().all(|k|m.contains_key(*k)),"INVALID_MESSAGE")
}
pub fn blob(bytes: &[u8]) -> Value { json!({"decodedBytes":bytes.len(),"base64":STANDARD.encode(bytes)}) }
pub fn unblob(v: &Value, maximum: usize) -> Result<Vec<u8>> {
    shape(v,&["decodedBytes","base64"])?;
    let size=v["decodedBytes"].as_u64().ok_or_else(||Fault::new("INVALID_MESSAGE"))?;
    need(size<=maximum as u64,"LIMIT_EXCEEDED")?;
    let encoded=string(v,"base64")?;
    need(encoded.len()<=maximum.div_ceil(3)*4,"LIMIT_EXCEEDED")?;
    let bytes=STANDARD.decode(encoded).map_err(|_|Fault::new("INVALID_MESSAGE"))?;
    need(bytes.len() as u64==size && STANDARD.encode(&bytes)==encoded,"INVALID_MESSAGE")?;
    Ok(bytes)
}
// serde_json默认覆盖重复键，这个Visitor在每层对象中明确拒绝。
struct Strict(Value);
impl<'de> Deserialize<'de> for Strict {
    fn deserialize<D:Deserializer<'de>>(d:D)->std::result::Result<Self,D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value=Strict;
            fn expecting(&self,f:&mut fmt::Formatter)->fmt::Result { f.write_str("strict JSON") }
            fn visit_bool<E:de::Error>(self,v:bool)->std::result::Result<Strict,E>{Ok(Strict(json!(v)))}
            fn visit_i64<E:de::Error>(self,v:i64)->std::result::Result<Strict,E>{Ok(Strict(json!(v)))}
            fn visit_u64<E:de::Error>(self,v:u64)->std::result::Result<Strict,E>{Ok(Strict(json!(v)))}
            fn visit_f64<E:de::Error>(self,v:f64)->std::result::Result<Strict,E>{
                if !v.is_finite(){return Err(E::custom("non-finite"));}Ok(Strict(json!(v)))
            }
            fn visit_str<E:de::Error>(self,v:&str)->std::result::Result<Strict,E>{
                if v.contains('\0'){return Err(E::custom("NUL"));}Ok(Strict(json!(v)))
            }
            fn visit_string<E:de::Error>(self,v:String)->std::result::Result<Strict,E>{self.visit_str(&v)}
            fn visit_unit<E:de::Error>(self)->std::result::Result<Strict,E>{Ok(Strict(Value::Null))}
            fn visit_seq<A:SeqAccess<'de>>(self,mut a:A)->std::result::Result<Strict,A::Error>{
                let mut values=Vec::new();while let Some(Strict(v))=a.next_element()?{values.push(v);}Ok(Strict(json!(values)))
            }
            fn visit_map<A:MapAccess<'de>>(self,mut a:A)->std::result::Result<Strict,A::Error>{
                let mut values=BTreeMap::new();
                while let Some(k)=a.next_key::<String>()?{
                    if k.contains('\0') || values.contains_key(&k){return Err(de::Error::custom("duplicate key"));}
                    let Strict(v)=a.next_value()?;values.insert(k,v);
                }Ok(Strict(json!(values)))
            }
        }d.deserialize_any(V)
    }
}
pub fn parse(bytes:&[u8],maximum:usize)->Result<Value>{
    need(bytes.len()<=maximum && !bytes.starts_with(&[239,187,191]),"INVALID_MESSAGE")?;
    let mut d=serde_json::Deserializer::from_slice(bytes);
    let Strict(v)=Strict::deserialize(&mut d).map_err(|_|Fault::new("INVALID_MESSAGE"))?;
    d.end().map_err(|_|Fault::new("INVALID_MESSAGE"))?;
    fn depth(v:&Value,n:usize)->bool{ n<=32 && match v {
        Value::Array(a)=>a.iter().all(|x|depth(x,n+1)),
        Value::Object(m)=>m.values().all(|x|depth(x,n+1)),_=>true }}
    need(depth(&v,0),"LIMIT_EXCEEDED")?;Ok(v)
}
