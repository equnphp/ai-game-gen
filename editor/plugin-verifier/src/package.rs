// 签名先于载荷校验；流只通过受信宿主回调读取，文件名从不用于打开系统路径。
use crate::{schema::{self,Kind},strict};
use curve25519_dalek::edwards::CompressedEdwardsY;
use ed25519_dalek::{Signature,VerifyingKey};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::collections::{BTreeMap,BTreeSet};

pub(crate) const INVALID:i32=1;
pub(crate) const SIGNATURE:i32=2;
pub(crate) const HASH:i32=3;
pub(crate) const IO:i32=4;
pub(crate) const LIMIT:i32=7;
const MAX_PACKAGE:u64=64*1024*1024;
const MAX_MANIFEST:usize=65536;

pub(crate) trait Source {fn read(&mut self,buffer:&mut[u8])->Result<usize,i32>;}
fn exact(source:&mut impl Source,mut out:&mut[u8])->Result<(),i32>{while !out.is_empty(){let n=source.read(out)?;if n==0||n>out.len(){return Err(INVALID);}out=&mut out[n..];}Ok(())}
fn need(value:bool)->Result<(),i32>{if value{Ok(())}else{Err(INVALID)}}

pub(crate) fn verify(source:&mut impl Source)->Result<Value,i32>{
    let mut header=[0u8;12];exact(source,&mut header)?;need(&header[..8]==b"GGPLUG1\0")?;
    let length=u32::from_le_bytes(header[8..12].try_into().map_err(|_|INVALID)?) as usize;
    need((1..=MAX_MANIFEST).contains(&length))?;
    let mut manifest_bytes=vec![0;length];exact(source,&mut manifest_bytes)?;
    let manifest=strict::parse(&manifest_bytes,MAX_MANIFEST).map_err(|_|INVALID)?;
    schema::check(Kind::Manifest,&manifest).map_err(|_|INVALID)?;
    need(serde_json_canonicalizer::to_vec(&manifest).map_err(|_|INVALID)?==manifest_bytes)?;
    let declarations=validate_manifest(&manifest)?;
    let mut signature=[0u8;64];exact(source,&mut signature)?;
    let public=decode_key(manifest["publisher"]["publicKeyHex"].as_str().ok_or(INVALID)?)?;
    let mut r=[0u8;32];r.copy_from_slice(&signature[..32]);valid_point(public)?;valid_point(r)?;
    let key=VerifyingKey::from_bytes(&public).map_err(|_|SIGNATURE)?;
    let mut message=b"gamegen-plugin-signature-v1\0".to_vec();message.extend_from_slice(&manifest_bytes);
    key.verify_strict(&message,&Signature::from_bytes(&signature)).map_err(|_|SIGNATURE)?;
    let mut total=(12+length+64) as u64;
    let mut buffer=[0u8;32768];
    for item in manifest["files"].as_array().ok_or(INVALID)? {
        let path=item["path"].as_str().ok_or(INVALID)?;let size=item["size"].as_u64().ok_or(INVALID)?;
        total=total.checked_add(size).ok_or(INVALID)?;need(total<=MAX_PACKAGE)?;
        let kinds=declarations.get(path);let mut selected=if kinds.is_some(){Vec::with_capacity(size as usize)}else{Vec::new()};
        let mut digest=Sha256::new();let mut remaining=size;
        while remaining>0 {let n=remaining.min(buffer.len() as u64) as usize;exact(source,&mut buffer[..n])?;digest.update(&buffer[..n]);if kinds.is_some(){selected.extend_from_slice(&buffer[..n]);}remaining-=n as u64;}
        let actual=format!("sha256:{:x}",digest.finalize());if item["sha256"].as_str()!=Some(actual.as_str()){return Err(HASH);}
        if let Some(kinds)=kinds {for kind in kinds {validate_data(*kind,&selected)?;}}
    }
    let mut extra=[0u8;1];need(source.read(&mut extra)?==0)?;
    let mut digest=Sha256::new();digest.update(b"gamegen-plugin-package-v1\0");digest.update(&manifest_bytes);
    let package_hash=format!("sha256:{:x}",digest.finalize());
    let publisher_key_id=format!("sha256:{:x}",Sha256::digest(public));
    let manifest_json=String::from_utf8(manifest_bytes).map_err(|_|INVALID)?;
    Ok(json!({"manifestJson":manifest_json,"packageHash":package_hash,"publisherKeyId":publisher_key_id}))
}

#[derive(Clone,Copy,Ord,PartialOrd,Eq,PartialEq)]enum DataKind{View,Template}
fn validate_manifest(manifest:&Value)->Result<BTreeMap<String,BTreeSet<DataKind>>,i32>{
    let mut previous:Option<&str>=None;let mut paths=BTreeSet::new();let mut total=0u64;
    for file in manifest["files"].as_array().ok_or(INVALID)?{
        let path=file["path"].as_str().ok_or(INVALID)?;need(valid_path(path)&&previous.is_none_or(|v|v<path))?;
        for (i,_) in path.match_indices('/'){need(!paths.contains(&path[..i]))?;}paths.insert(path.to_owned());previous=Some(path);
        total=total.checked_add(file["size"].as_u64().ok_or(INVALID)?).ok_or(INVALID)?;need(total<=MAX_PACKAGE)?;
    }
    let wasm=manifest["entryWasm"].as_str().ok_or(INVALID)?;let notice=manifest["license"]["noticeFile"].as_str().ok_or(INVALID)?;
    need(wasm.ends_with(".wasm")&&paths.contains(wasm)&&paths.contains(notice))?;
    sorted_objects(&manifest["dependencies"],"pluginId")?;sorted_objects(&manifest["permissions"],"id")?;sorted_objects(&manifest["contributions"],"id")?;sorted_strings(&manifest["platforms"])?;
    let permissions:BTreeSet<&str>=manifest["permissions"].as_array().ok_or(INVALID)?.iter().map(|x|x["id"].as_str().ok_or(INVALID)).collect::<Result<_,_>>()?;
    let mut declarations:BTreeMap<String,BTreeSet<DataKind>>=BTreeMap::new();
    for contribution in manifest["contributions"].as_array().ok_or(INVALID)? {
        for field in ["permissionIds","formats","targetProfiles","adapterIds"] {if !contribution[field].is_null(){sorted_strings(&contribution[field])?;}}
        for permission in contribution["permissionIds"].as_array().ok_or(INVALID)? {need(permission.as_str().is_some_and(|s|permissions.contains(s)))?;}
        for (field,kind) in [("viewFile",DataKind::View),("templateFile",DataKind::Template)] {
            if let Some(path)=contribution[field].as_str(){need(path.ends_with(".json")&&paths.contains(path))?;declarations.entry(path.to_owned()).or_default().insert(kind);}
        }
    }
    Ok(declarations)
}
fn valid_path(path:&str)->bool{path.split('/').all(|p|{
    if p.is_empty()||p.len()>64||p.ends_with('.')||p=="."||p==".."{return false;}
    let stem=p.split('.').next().unwrap_or("");if ["con","prn","aux","nul"].contains(&stem){return false;}
    !(stem.len()==4&&(stem.starts_with("com")||stem.starts_with("lpt"))&&matches!(stem.as_bytes()[3],b'1'..=b'9'))
})}
fn sorted_objects(value:&Value,field:&str)->Result<(),i32>{let mut prev:Option<&str>=None;for o in value.as_array().ok_or(INVALID)?{let s=o[field].as_str().ok_or(INVALID)?;need(prev.is_none_or(|p|p<s))?;prev=Some(s);}Ok(())}
fn sorted_strings(value:&Value)->Result<(),i32>{let mut prev:Option<&str>=None;for v in value.as_array().ok_or(INVALID)?{let s=v.as_str().ok_or(INVALID)?;need(prev.is_none_or(|p|p<s))?;prev=Some(s);}Ok(())}
fn decode_key(hex:&str)->Result<[u8;32],i32>{need(hex.len()==64)?;let mut out=[0u8;32];for(i,p)in hex.as_bytes().chunks_exact(2).enumerate(){let d=|b:u8|match b{b'0'..=b'9'=>Some(b-b'0'),b'a'..=b'f'=>Some(b-b'a'+10),_=>None};out[i]=(d(p[0]).ok_or(INVALID)?<<4)|d(p[1]).ok_or(INVALID)?;}Ok(out)}
fn valid_point(encoded:[u8;32])->Result<(),i32>{let p=CompressedEdwardsY(encoded).decompress().ok_or(SIGNATURE)?;if p.compress().to_bytes()!=encoded||p.is_small_order()||!p.is_torsion_free(){return Err(SIGNATURE);}Ok(())}
fn validate_data(kind:DataKind,bytes:&[u8])->Result<(),i32>{
    let v=strict::parse(bytes,16*1024*1024).map_err(|_|INVALID)?;
    match kind {
        DataKind::Template=>{schema::check(Kind::Template,&v).map_err(|_|INVALID)?;need(v["expectedRevision"]=="0")?;},
        DataKind::View=>{
            schema::check(Kind::View,&v).map_err(|_|INVALID)?;
            need(serde_json_canonicalizer::to_vec(&v).map_err(|_|INVALID)?.len()<=48*1024)?;
            let mut nodes:Vec<(&Value,usize)>=v["nodes"].as_array().ok_or(INVALID)?.iter().map(|n|(n,1)).collect();let mut ids=BTreeSet::new();let mut count=0;
            while let Some((node,depth))=nodes.pop(){count+=1;need(depth<=8&&count<=128&&ids.insert(node["id"].as_str().ok_or(INVALID)?))?;if let Some(children)=node["children"].as_array(){nodes.extend(children.iter().map(|n|(n,depth+1)));}}
        }
    }Ok(())
}
