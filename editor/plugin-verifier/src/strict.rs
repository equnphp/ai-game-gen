// 先拒绝重复键、NUL 和超深结构，再交给 Schema 与 JCS；不能先让普通 map 覆盖重复键。
use serde::{de::{self, MapAccess, SeqAccess, Visitor}, Deserialize, Deserializer};
use serde_json::{json, Value};
use std::{collections::BTreeMap, fmt};

struct Strict(Value);
impl<'de> Deserialize<'de> for Strict {
    fn deserialize<D:Deserializer<'de>>(deserializer:D)->Result<Self,D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value=Strict;
            fn expecting(&self,f:&mut fmt::Formatter)->fmt::Result{f.write_str("strict JSON")}
            fn visit_bool<E:de::Error>(self,v:bool)->Result<Strict,E>{Ok(Strict(json!(v)))}
            // 插件 JSON 只接受安全数值域；大整数必须在业务合同中用十进制字符串表达。
            fn visit_i64<E:de::Error>(self,v:i64)->Result<Strict,E>{if v.unsigned_abs()>9_007_199_254_740_991{return Err(E::custom("unsafe number"));}Ok(Strict(json!(v)))}
            fn visit_u64<E:de::Error>(self,v:u64)->Result<Strict,E>{if v>9_007_199_254_740_991{return Err(E::custom("unsafe number"));}Ok(Strict(json!(v)))}
            fn visit_f64<E:de::Error>(self,v:f64)->Result<Strict,E>{if !v.is_finite()||v.abs()>9_007_199_254_740_991.0{return Err(E::custom("unsafe number"));}Ok(Strict(json!(v)))}
            fn visit_str<E:de::Error>(self,v:&str)->Result<Strict,E>{if v.contains('\0'){return Err(E::custom("NUL"));}Ok(Strict(json!(v)))}
            fn visit_string<E:de::Error>(self,v:String)->Result<Strict,E>{self.visit_str(&v)}
            fn visit_unit<E:de::Error>(self)->Result<Strict,E>{Ok(Strict(Value::Null))}
            fn visit_seq<A:SeqAccess<'de>>(self,mut seq:A)->Result<Strict,A::Error>{let mut out=Vec::new();while let Some(Strict(v))=seq.next_element()?{out.push(v);}Ok(Strict(json!(out)))}
            fn visit_map<A:MapAccess<'de>>(self,mut map:A)->Result<Strict,A::Error>{let mut out=BTreeMap::new();while let Some(k)=map.next_key::<String>()?{if k.contains('\0')||out.contains_key(&k){return Err(de::Error::custom("duplicate key"));}let Strict(v)=map.next_value()?;out.insert(k,v);}Ok(Strict(json!(out)))}
        }
        deserializer.deserialize_any(V)
    }
}
pub(crate) fn parse(bytes:&[u8],limit:usize)->Result<Value,()> {
    if bytes.len()>limit || bytes.starts_with(&[239,187,191]) {return Err(());}
    let mut d=serde_json::Deserializer::from_slice(bytes);
    let Strict(value)=Strict::deserialize(&mut d).map_err(|_|())?;
    d.end().map_err(|_|())?;
    fn depth(v:&Value,n:usize)->bool{n<=32&&match v{Value::Array(a)=>a.iter().all(|x|depth(x,n+1)),Value::Object(m)=>m.values().all(|x|depth(x,n+1)),_=>true}}
    if !depth(&value,0){return Err(());}Ok(value)
}
