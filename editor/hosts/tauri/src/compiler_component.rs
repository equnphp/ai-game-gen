// 构建声明只从已加载组件目录读取；租约持文件句柄，前端从不取得本机路径或工具参数。
use crate::{ffi::Api,store_io::{directory_lease,safe_ancestors,safe_metadata},wire::*};
use serde::Deserialize;
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{collections::{HashMap,HashSet},fs::{File,OpenOptions},io::{Read,Seek,SeekFrom},path::{Path,PathBuf},sync::{Arc,Mutex,Condvar},time::{Instant,Duration}};

#[derive(Clone,Deserialize)]#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Descriptor {relative_file:String,sha256:String,bytes:String}
#[derive(Deserialize)]#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Catalog {catalog_hash:String,hash_policy:String,file:Descriptor}
#[derive(Clone,Deserialize)]#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Profile {runtime_profile_id:String,runtime_profile_hash:String,runtime_build:String,variant:String,runtime_abi:String,runtime_port_protocol:String,bundle_format:String,ir_version:u32,ir_revision:u32,
    runtime_inventory:Descriptor,runtime_pair_receipt:Descriptor,runtime_js:Descriptor,runtime_wasm:Descriptor}
#[derive(Deserialize)]#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Metadata {metadata_version:String,declaration_kind:String,native_build_id:String,platform:String,native_bundle:Descriptor,artifact_abi:String,artifact_library:Descriptor,
    artifact_json_protocols:Vec<String>,compiler_build:String,compiler_build_inputs:Descriptor,compiler_build_inputs_hash:String,catalog:Catalog,runtime_profiles:Vec<Profile>}
fn digest(bytes:&[u8])->String{format!("sha256:{:x}",Sha256::digest(bytes))}
fn hash_string(s:&str)->bool{s.len()==71&&s.starts_with("sha256:")&&s[7..].bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b))}
fn bounded(s:&str,n:usize)->bool{!s.is_empty()&&s.len()<=n&&!s.contains('\0')}
// 私有安装清单还包含libc++.dll；公开metadata路径另由固定名称/受控profile目录收窄。
fn relative(s:&str)->bool{bounded(s,240)&&!s.contains(['\\',':'])&&s.split('/').all(|part|!part.is_empty()&&part!="."&&part!=".."&&part.bytes().all(|b|b.is_ascii_alphanumeric()||b"_.-+".contains(&b)))}
fn io<T>(r:std::io::Result<T>)->Result<T>{r.map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))}
#[track_caller]
fn need(ok:bool,code:&str)->Result<()>{
    // 开发构建仅记录静态检查位置，不记录路径、工具参数或任何作者内容。
    #[cfg(debug_assertions)]if !ok{eprintln!("compiler component rejected check {}:{} ({code})",file!(),std::panic::Location::caller().line());}
    crate::wire::need(ok,code)
}
fn open_bound(file:&Path)->Result<File>{
    need(safe_ancestors(file)&&safe_metadata(file).is_ok_and(|m|m.is_file()),"COMPONENT_INTEGRITY_ERROR")?;
    let mut options=OpenOptions::new();options.read(true);
    #[cfg(windows)]{use std::os::windows::fs::OpenOptionsExt;options.share_mode(1).custom_flags(0x00200000);}
    #[cfg(not(windows))]{return Err(Fault::new("COMPONENT_UNAVAILABLE"));}
    let handle=io(options.open(file))?;need(io(handle.metadata())?.is_file(),"COMPONENT_INTEGRITY_ERROR")?;Ok(handle)
}
fn small(file:&Path,maximum:usize)->Result<Vec<u8>>{let mut f=open_bound(file)?;need(io(f.metadata())?.len()<=maximum as u64,"COMPONENT_INTEGRITY_ERROR")?;let mut bytes=Vec::new();io(f.read_to_end(&mut bytes))?;Ok(bytes)}
fn decode<T:serde::de::DeserializeOwned>(bytes:&[u8],limit:usize)->Result<T>{serde_json::from_value(parse(bytes,limit)?).map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))}

// 激活记录只选择资源根下的新组件目录；损坏记录失败，不回退到不相干旧DLL。
pub(crate) fn selected_directory(root:&Path)->Result<(PathBuf,Option<String>)>{
    let selection=root.join("active-component.json");if !selection.exists(){return Ok((root.to_owned(),None));}
    let value=parse(&small(&selection,65536)?,65536)?;shape(&value,&["schema","relativeRoot","installation"])?;
    need(value["schema"]=="gg-native-component-selection-1","LIBRARY_INVALID")?;
    let relative_root=string(&value,"relativeRoot")?;need(relative(relative_root)&&relative_root.starts_with("components/")&&relative_root.split('/').count()==2,"LIBRARY_INVALID")?;
    let directory=root.join(relative_root);let _lease=directory_lease(&directory)?;
    let descriptor:Descriptor=serde_json::from_value(value["installation"].clone()).map_err(|_|Fault::new("LIBRARY_INVALID"))?;
    need(descriptor.relative_file=="component-installation.json"&&hash_string(&descriptor.sha256),"LIBRARY_INVALID")?;
    let bytes=small(&directory.join(&descriptor.relative_file),65536)?;
    need(digest(&bytes)==descriptor.sha256&&bytes.len() as u64==u64_string(&json!(descriptor.bytes))?,"LIBRARY_INVALID")?;Ok((directory,Some(descriptor.sha256)))
}
struct BoundFiles {root:PathBuf,handles:Vec<File>,descriptors:HashMap<String,Descriptor>,_directory:File}
impl BoundFiles {
    fn new(root:&Path)->Result<Self>{Ok(Self{root:root.to_owned(),handles:Vec::new(),descriptors:HashMap::new(),_directory:directory_lease(root)?})}
    fn bind(&mut self,d:&Descriptor,limit:u64)->Result<Vec<u8>>{
        need(relative(&d.relative_file)&&hash_string(&d.sha256),"COMPONENT_INTEGRITY_ERROR")?;
        let size=u64_string(&json!(d.bytes))?;need(size<=limit,"COMPONENT_INTEGRITY_ERROR")?;
        if let Some(prior)=self.descriptors.get(&d.relative_file.to_ascii_lowercase()){
            need(prior.relative_file==d.relative_file&&prior.sha256==d.sha256&&prior.bytes==d.bytes,"COMPONENT_INTEGRITY_ERROR")?;
        }
        let mut file=open_bound(&self.root.join(&d.relative_file))?;need(io(file.metadata())?.len()==size,"COMPONENT_INTEGRITY_ERROR")?;
        let mut h=Sha256::new();let mut buffer=vec![0u8;1048576];let mut count=0u64;
        loop{let n=io(file.read(&mut buffer))?;if n==0{break;}h.update(&buffer[..n]);count+=n as u64;need(count<=size,"COMPONENT_CHANGED")?;}
        need(count==size&&format!("sha256:{:x}",h.finalize())==d.sha256,"COMPONENT_INTEGRITY_ERROR")?;
        // 大文件仅保留句柄；JS/WASM/DLL不会整体编码给前端。
        let result=if limit<=16777216{io(file.seek(SeekFrom::Start(0)))?;let mut bytes=Vec::with_capacity(size as usize);io(file.read_to_end(&mut bytes))?;bytes}else{Vec::new()};
        self.descriptors.insert(d.relative_file.to_ascii_lowercase(),d.clone());self.handles.push(file);Ok(result)
    }
    fn declared(&self,d:&Descriptor)->Result<()>{let listed=self.descriptors.get(&d.relative_file.to_ascii_lowercase()).ok_or_else(||Fault::new("COMPONENT_INTEGRITY_ERROR"))?;
        need(listed.relative_file==d.relative_file&&listed.sha256==d.sha256&&listed.bytes==d.bytes,"COMPONENT_INTEGRITY_ERROR")}
}
pub(crate) struct CompilerComponent {pub projection:Value,pub root:PathBuf,_files:BoundFiles}
impl CompilerComponent {
    pub fn matches(&self,profile:&str,options:&Value)->bool{
        options["compilerBuild"]==self.projection["compilerBuild"]&&options["catalogHash"]==self.projection["catalogHash"]&&
            self.projection["runtimeProfiles"].as_array().is_some_and(|p|p.iter().any(|p|p["runtimeProfileId"]==profile&&p["runtimeProfileId"]==options["runtimeProfileId"]&&p["runtimeProfileHash"]==options["runtimeProfileHash"]))
    }
}
fn validate(provider:Arc<Api>)->Result<Arc<CompilerComponent>>{
    need(provider.sqlite_module.is_some()&&provider.artifact_library.is_some(),"COMPONENT_UNAVAILABLE")?;
    let root=provider.bundle_directory.clone();let mut files=BoundFiles::new(&root)?;
    let expected=provider.installation_sha256.as_ref().ok_or_else(||Fault::new("COMPONENT_UNAVAILABLE"))?;
    let installation_bytes=small(&root.join("component-installation.json"),65536)?;
    need(digest(&installation_bytes)==*expected,"COMPONENT_CHANGED")?;
    let installation_descriptor=Descriptor{relative_file:"component-installation.json".into(),sha256:expected.clone(),bytes:installation_bytes.len().to_string()};
    let installation=parse(&files.bind(&installation_descriptor,65536)?,65536)?;shape(&installation,&["schema","files"])?;
    need(installation["schema"]=="gg-local-component-installation-1","COMPONENT_INTEGRITY_ERROR")?;
    let list=installation["files"].as_array().filter(|a|!a.is_empty()&&a.len()<=96).ok_or_else(||Fault::new("COMPONENT_INTEGRITY_ERROR"))?;
    let mut names=HashSet::new();
    for item in list {let d:Descriptor=serde_json::from_value(item.clone()).map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))?;need(names.insert(d.relative_file.to_ascii_lowercase()),"COMPONENT_INTEGRITY_ERROR")?;files.bind(&d,134217728)?;}
    let meta_descriptor=files.descriptors.get("compiler-component.json").cloned().ok_or_else(||Fault::new("COMPONENT_UNAVAILABLE"))?;
    let bytes=files.bind(&meta_descriptor,262144)?;
    crate::contracts::check(crate::contracts::Contract::CompilerMetadata,&parse(&bytes,262144)?)?;
    let metadata:Metadata=decode(&bytes,262144)?;
    need(metadata.metadata_version=="gg-compiler-component-1"&&metadata.declaration_kind=="build_declaration"&&metadata.native_build_id==provider.build_id&&metadata.platform=="windows-x64"&&metadata.artifact_abi=="1.0"&&metadata.artifact_json_protocols==["1.0"],"COMPONENT_INTEGRITY_ERROR")?;
    for d in [&metadata.native_bundle,&metadata.artifact_library,&metadata.compiler_build_inputs,&metadata.catalog.file]{files.declared(d)?;}
    need(metadata.native_bundle.relative_file=="native-runtime-bundle.json"&&metadata.compiler_build_inputs.relative_file=="compiler-build-inputs.json"&&metadata.catalog.file.relative_file=="compiler-catalog.json"&&metadata.catalog.hash_policy=="gg-embedded-catalog-json-dump-1","COMPONENT_INTEGRITY_ERROR")?;
    need(provider.artifact_library.as_ref()==Some(&root.join(&metadata.artifact_library.relative_file))&&metadata.artifact_library.sha256==format!("sha256:{}",provider.artifact_sha256.as_deref().unwrap_or("")),"COMPONENT_CHANGED")?;
    let bundle=parse(&files.bind(&metadata.native_bundle,65536)?,65536)?;
    let libs=bundle["libraries"].as_array().ok_or_else(||Fault::new("COMPONENT_INTEGRITY_ERROR"))?;
    need(bundle["buildId"]==metadata.native_build_id&&bundle["platform"]==metadata.platform&&libs.iter().filter(|l|l["id"]=="ARTIFACT").count()==1,"COMPONENT_INTEGRITY_ERROR")?;
    let library=libs.iter().find(|l|l["id"]=="ARTIFACT").unwrap();
    need(library["relativeFile"]==metadata.artifact_library.relative_file&&library["sha256"]==metadata.artifact_library.sha256&&library["bytes"]==metadata.artifact_library.bytes,"COMPONENT_INTEGRITY_ERROR")?;
    let inputs=parse(&files.bind(&metadata.compiler_build_inputs,16777216)?,16777216)?;validate_inputs(&inputs)?;
    let input_hash=digest(&serde_json::to_vec(&inputs).map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))?);
    need(input_hash==metadata.compiler_build_inputs_hash&&metadata.compiler_build==format!("gg-compiler-1-{}",&input_hash[7..]),"COMPONENT_INTEGRITY_ERROR")?;
    let catalog=parse(&files.bind(&metadata.catalog.file,8388608)?,8388608)?;
    // 当前注册目录仅使用整数数值；浮点序列化口径尚未扩展时保守拒绝不一致。
    need(digest(&serde_json::to_vec(&catalog).map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))?)==metadata.catalog.catalog_hash&&inputs["catalogHash"]==metadata.catalog.catalog_hash,"COMPONENT_INTEGRITY_ERROR")?;
    need(!metadata.runtime_profiles.is_empty()&&metadata.runtime_profiles.len()<=16,"COMPONENT_INTEGRITY_ERROR")?;
    let mut profiles=Vec::new();let mut identities=HashSet::new();
    for p in metadata.runtime_profiles {
        need(bounded(&p.runtime_profile_id,128)&&p.runtime_profile_id.bytes().all(|b|b.is_ascii_alphanumeric()||b"_-".contains(&b))&&hash_string(&p.runtime_profile_hash)&&identities.insert((p.runtime_profile_id.clone(),p.runtime_profile_hash.clone()))&&["development","release"].contains(&p.variant.as_str()),"COMPONENT_INTEGRITY_ERROR")?;
        need(p.runtime_abi=="1.1"&&p.runtime_port_protocol=="1.1"&&p.bundle_format=="gg-runtime-bundle-1"&&p.ir_version==1&&p.ir_revision==2,"COMPONENT_INTEGRITY_ERROR")?;
        let prefix=format!("runtimes/{}/{}/{}/",p.runtime_profile_id,&p.runtime_profile_hash[7..],p.variant);
        for(d,name)in[(&p.runtime_inventory,"runtime-inventory.json"),(&p.runtime_pair_receipt,"game-runtime.pair.json"),(&p.runtime_js,"game-runtime.js"),(&p.runtime_wasm,"game-runtime.wasm")]{need(d.relative_file==format!("{prefix}{name}"),"COMPONENT_INTEGRITY_ERROR")?;files.declared(d)?;}
        let inventory=parse(&files.bind(&p.runtime_inventory,16777216)?,16777216)?;
        need(inventory["profileId"]==p.runtime_profile_id&&inventory["profileHash"]==p.runtime_profile_hash&&inventory["runtimeBuild"]==p.runtime_build&&inventory["identity"]["variant"]==p.variant&&digest(&serde_json::to_vec(&inventory["identity"]).map_err(|_|Fault::new("COMPONENT_INTEGRITY_ERROR"))?)==p.runtime_profile_hash,"COMPONENT_INTEGRITY_ERROR")?;
        let pair=parse(&files.bind(&p.runtime_pair_receipt,262144)?,262144)?;
        need(pair["schema"]=="gg-game-runtime-pair-1"&&pair["abi"]=="1.1"&&pair["profileId"]==p.runtime_profile_id&&pair["profileHash"]==p.runtime_profile_hash&&pair["runtimeBuild"]==p.runtime_build&&pair["variant"]==p.variant,"COMPONENT_INTEGRITY_ERROR")?;
        let pair_files=pair["files"].as_array().filter(|a|a.len()==2).ok_or_else(||Fault::new("COMPONENT_INTEGRITY_ERROR"))?;
        for(d,name)in[(&p.runtime_js,"game-runtime.js"),(&p.runtime_wasm,"game-runtime.wasm")]{let list:Vec<_>=pair_files.iter().filter(|f|f["name"]==name).collect();need(list.len()==1&&list[0]["sha256"]==d.sha256[7..]&&list[0]["bytes"].as_u64()==Some(u64_string(&json!(d.bytes))?),"COMPONENT_INTEGRITY_ERROR")?;}
        profiles.push(json!({"runtimeProfileId":p.runtime_profile_id,"runtimeProfileHash":p.runtime_profile_hash,"runtimeBuild":p.runtime_build,"variant":p.variant,"runtimeAbi":p.runtime_abi,"runtimePortProtocol":p.runtime_port_protocol,"bundleFormat":p.bundle_format,"irVersion":p.ir_version,"irRevision":p.ir_revision,"runtimePairSha256":p.runtime_pair_receipt.sha256,"runtimeJsSha256":p.runtime_js.sha256,"runtimeWasmSha256":p.runtime_wasm.sha256}));
    }
    let projection=json!({"componentGeneration":id(),"metadataSha256":meta_descriptor.sha256,"nativeBundleSha256":metadata.native_bundle.sha256,"artifactLibrarySha256":metadata.artifact_library.sha256,"nativeBuildId":metadata.native_build_id,"platform":metadata.platform,"compilerBuild":metadata.compiler_build,"compilerBuildInputsHash":input_hash,"catalogHash":metadata.catalog.catalog_hash,"runtimeProfiles":profiles,"integrityState":"bound_to_installed_files","declarationKind":"build_declaration"});
    Ok(Arc::new(CompilerComponent{projection,root,_files:files}))
}
fn array<'a>(v:&'a Value,min:usize,max:usize)->Result<&'a Vec<Value>>{v.as_array().filter(|a|a.len()>=min&&a.len()<=max).ok_or_else(||Fault::new("COMPONENT_INTEGRITY_ERROR"))}
fn text_limit(v:&Value,max:usize)->Result<()> {need(v.as_str().is_some_and(|s|s.len()<=max&&!s.contains('\0')),"COMPONENT_INTEGRITY_ERROR")}
fn file_inputs(v:&Value,min:usize,max:usize)->Result<()> {let mut prior=String::new();for row in array(v,min,max)? {shape(row,&["logicalPath","sha256","bytes"])?;let name=string(row,"logicalPath")?;need(bounded(name,512)&&name>prior.as_str()&&["src/","generated/","dependency/","tool/"].iter().any(|p|name.starts_with(p))&&name.split('/').all(|p|p!=".."&&p!="."&&!p.is_empty())&&hash_string(string(row,"sha256")?),"COMPONENT_INTEGRITY_ERROR")?;u64_string(&row["bytes"])?;prior=name.into();}Ok(())}
fn validate_inputs(v:&Value)->Result<()> {
    crate::contracts::check(crate::contracts::Contract::CompilerInputs,v)?;
    shape(v,&["schema","configuration","sourceFiles","tools","dependencies","actions","catalogHash","contractFiles"])?;need(v["schema"]=="gg-compiler-build-inputs-1"&&hash_string(string(v,"catalogHash")?),"COMPONENT_INTEGRITY_ERROR")?;
    let c=&v["configuration"];shape(c,&["platform","buildType","cmakeGenerator","cmakeVersion","targetTriple","sysrootInputHash","environment"])?;
    for k in ["platform","buildType","cmakeGenerator","cmakeVersion","targetTriple"]{need(bounded(string(c,k)?,512),"COMPONENT_INTEGRITY_ERROR")?;}need(hash_string(string(c,"sysrootInputHash")?),"COMPONENT_INTEGRITY_ERROR")?;
    let mut prior=String::new();for e in array(&c["environment"],0,128)?{shape(e,&["name","value"])?;let name=string(e,"name")?;need(bounded(name,512)&&name>prior.as_str(),"COMPONENT_INTEGRITY_ERROR")?;text_limit(&e["value"],8192)?;prior=name.into();}
    file_inputs(&v["sourceFiles"],1,100000)?;file_inputs(&v["contractFiles"],1,1024)?;
    let sources=array(&v["sourceFiles"],1,100000)?;for f in array(&v["contractFiles"],1,1024)?{need(sources.contains(f),"COMPONENT_INTEGRITY_ERROR")?;}
    let mut tools=HashSet::new();let mut prior=String::new();for t in array(&v["tools"],1,64)?{shape(t,&["id","version","target","binarySha256","versionReportSha256","packageInputHash"])?;let name=string(t,"id")?;need(bounded(name,512)&&name>prior.as_str()&&tools.insert(name),"COMPONENT_INTEGRITY_ERROR")?;for k in ["version","target"]{need(bounded(string(t,k)?,512),"COMPONENT_INTEGRITY_ERROR")?;}for k in ["binarySha256","versionReportSha256","packageInputHash"]{need(hash_string(string(t,k)?),"COMPONENT_INTEGRITY_ERROR")?;}prior=name.into();}
    let mut prior=String::new();for d in array(&v["dependencies"],0,256)?{shape(d,&["id","version","sourceInputHash","configHash","linkInputHashes"])?;let name=string(d,"id")?;need(bounded(name,512)&&name>prior.as_str()&&bounded(string(d,"version")?,512),"COMPONENT_INTEGRITY_ERROR")?;for k in ["sourceInputHash","configHash"]{need(hash_string(string(d,k)?),"COMPONENT_INTEGRITY_ERROR")?;}for h in array(&d["linkInputHashes"],0,128)?{need(h.as_str().is_some_and(hash_string),"COMPONENT_INTEGRITY_ERROR")?;}prior=name.into();}
    let mut prior=String::new();for a in array(&v["actions"],1,100000)?{shape(a,&["kind","language","toolId","inputPaths","arguments","responseFiles","actionId"])?;let name=string(a,"actionId")?;need(bounded(name,512)&&name>prior.as_str()&&tools.contains(string(a,"toolId")?)&&["compile","link","archive","generate"].contains(&string(a,"kind")?)&&["c","cpp","assembler","none"].contains(&string(a,"language")?),"COMPONENT_INTEGRITY_ERROR")?;for p in array(&a["inputPaths"],0,10000)?{need(p.as_str().is_some_and(|s|bounded(s,512)),"COMPONENT_INTEGRITY_ERROR")?;}for arg in array(&a["arguments"],0,4096)?{text_limit(arg,8192)?;}file_inputs(&a["responseFiles"],0,128)?;prior=name.into();}Ok(())
}
#[derive(Default)]struct Status {started:bool,result:Option<Result<Arc<CompilerComponent>>>}
#[derive(Default)]pub(crate) struct CompilerComponents {state:Mutex<Status>,changed:Condvar}
impl CompilerComponents {
    pub fn read(self:&Arc<Self>,provider:Arc<Api>)->Result<Arc<CompilerComponent>>{
        let mut state=self.state.lock().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
        if !state.started{state.started=true;let service=self.clone();std::thread::spawn(move||{
            let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||validate(provider))).unwrap_or_else(|_|Err(Fault::new("INTERNAL_ERROR")));
            #[cfg(debug_assertions)]if let Err(f)=&result{eprintln!("compiler component rejected: {}",f.code);}
            let mut state=service.state.lock().unwrap_or_else(|e|e.into_inner());state.result=Some(result);service.changed.notify_all();
        });}
        let deadline=Instant::now()+Duration::from_secs(5);
        while state.result.is_none(){let left=deadline.saturating_duration_since(Instant::now());if left.is_zero(){return Err(Fault::new("TIMEOUT"));}
            state=self.changed.wait_timeout(state,left).map_err(|_|Fault::new("INTERNAL_ERROR"))?.0;
        }state.result.as_ref().unwrap().clone()
    }
}
