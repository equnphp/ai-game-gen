// Schema 仅取内置文件；任何外部网络或文件引用均不可解析。
use serde_json::{json,Value};
use std::sync::OnceLock;
type Compiled=Result<jsonschema::Validator,()>;
struct NoExternal;
impl jsonschema::Retrieve for NoExternal {
    fn retrieve(&self,_:&jsonschema::Uri<String>)->Result<Value,Box<dyn std::error::Error+Send+Sync>>{Err("external schema disabled".into())}
}
pub(crate) enum Kind{Manifest,View,Template}
pub(crate) fn check(kind:Kind,value:&Value)->Result<(),()> {
    static MANIFEST:OnceLock<Compiled>=OnceLock::new();
    static VIEW:OnceLock<Compiled>=OnceLock::new();
    static TEMPLATE:OnceLock<Compiled>=OnceLock::new();
    let (slot,bytes,template)=match kind{
        Kind::Manifest=>(&MANIFEST,include_str!("../contracts/manifest.schema.json"),false),
        Kind::View=>(&VIEW,include_str!("../contracts/view.schema.json"),false),
        Kind::Template=>(&TEMPLATE,include_str!("../contracts/host.schema.json"),true),
    };
    let validator=slot.get_or_init(||{
        let mut schema:Value=serde_json::from_str(bytes).map_err(|_|())?;
        if template {schema["$ref"]=json!("#/$defs/proposal");schema.as_object_mut().ok_or(())?.remove("oneOf");}
        jsonschema::draft202012::options().with_retriever(NoExternal).should_validate_formats(true).build(&schema).map_err(|_|())
    }).as_ref().map_err(|_|())?;
    if validator.is_valid(value){Ok(())}else{Err(())}
}
