// 仅编译本程序内置合同；关闭外部引用，不以作者文件或网络内容注册校验器。
use crate::wire::*;
use serde_json::Value;
use std::sync::OnceLock;
type Compiled=std::result::Result<jsonschema::Validator,()>;
struct NoExternalSchema;
impl jsonschema::Retrieve for NoExternalSchema {
    fn retrieve(&self,_uri:&jsonschema::Uri<String>)->std::result::Result<Value,Box<dyn std::error::Error+Send+Sync>>{
        // 即使未来Cargo特性被其他依赖合并打开，也不能变成任意文件或网络解析器。
        Err("External schema retrieval is disabled".into())
    }
}
pub(crate) enum Contract {Artifact,CompilerMetadata,CompilerInputs,CompilerPort}
pub(crate) fn check(kind:Contract,value:&Value)->Result<()> {
    static ARTIFACT:OnceLock<Compiled>=OnceLock::new();static METADATA:OnceLock<Compiled>=OnceLock::new();
    static INPUTS:OnceLock<Compiled>=OnceLock::new();static PORT:OnceLock<Compiled>=OnceLock::new();
    let (slot,bytes)=match kind {
        Contract::Artifact=>(&ARTIFACT,include_str!("artifact/contracts/artifact-port.schema.json")),
        Contract::CompilerMetadata=>(&METADATA,include_str!("compiler/contracts/compiler-component.schema.json")),
        Contract::CompilerInputs=>(&INPUTS,include_str!("compiler/contracts/compiler-build-inputs.schema.json")),
        Contract::CompilerPort=>(&PORT,include_str!("compiler/contracts/compiler-component-port.schema.json")),
    };
    let validator=slot.get_or_init(||{
        let schema:Value=serde_json::from_str(bytes).map_err(|_|())?;
        // 关闭网络/文件解析的依赖特性；合同自身无外部$ref，未知引用使构建校验器失败。
        jsonschema::draft202012::options().with_retriever(NoExternalSchema).should_validate_formats(true).build(&schema).map_err(|_|())
    }).as_ref().map_err(|_|Fault::new("INTERNAL_ERROR"))?;
    need(validator.is_valid(value),"INVALID_MESSAGE")
}
