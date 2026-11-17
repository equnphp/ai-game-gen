// 装配全新不可变组件目录；只在全部文件校核后切换私有激活记录，不覆盖已加载DLL。
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [build,runtimeBuild,destination]=process.argv.slice(2);
if(!destination)throw Error('Expected native build, runtime build and managed destination');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const descriptor=(file,relativeFile)=>{const bytes=fs.readFileSync(file);return{relativeFile,sha256:hash(bytes),bytes:String(bytes.length)};};
const config=JSON.parse(fs.readFileSync(path.join(build,'generated/compiler-configuration.json'),'utf8'));
const bundleFile=path.join(build,'native-runtime-bundle.json'),bundle=JSON.parse(fs.readFileSync(bundleFile,'utf8'));
if(bundle.platform!=='windows-x64'||bundle.manifestVersion!=='gg-native-runtime-bundle-2')throw Error('Unsupported package platform');
const inputsPath=path.join(build,'compiler-build-inputs.json'),inputs=JSON.parse(fs.readFileSync(inputsPath,'utf8'));
const inputsHash=hash(Buffer.from(JSON.stringify(canonical(inputs)))),compilerBuild='gg-compiler-1-'+inputsHash.slice(7);
if(!fs.readFileSync(path.join(build,'generated/compiler-build.hpp'),'utf8').includes('"'+compilerBuild+'"'))throw Error('Compiler header identity mismatch');
const receiptPath=path.join(build,'compiler-build-verified.json'),receiptBytes=fs.readFileSync(receiptPath),receipt=JSON.parse(receiptBytes.toString('utf8'));
if(receipt.schema!=='gg-compiler-build-verified-1'||receipt.kind!=='build_consistency'||receipt.compilerBuildInputsHash!==inputsHash||receipt.compilerBuild!==compilerBuild||receipt.files?.length!==3)throw Error('Missing matching postbuild receipt');
if(!fs.readFileSync(path.join(build,'ggartifact.dll')).includes(Buffer.from(compilerBuild)))throw Error('Artifact does not embed this compiler identity');
for(const entry of receipt.files){if(!['ggcore.dll','ggartifact.dll','gg_sqlite3.dll'].includes(entry.relativeFile)||JSON.stringify(descriptor(path.join(build,entry.relativeFile),entry.relativeFile))!==JSON.stringify(entry))throw Error('Postbuild receipt does not match actual files');}
const inventoryPath=path.join(runtimeBuild,'generated/runtime-inventory.json'),inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
if(inventory.profileHash!==hash(Buffer.from(JSON.stringify(canonical(inventory.identity)))))throw Error('Runtime inventory identity mismatch');
const pairPath=path.join(runtimeBuild,'game-runtime.pair.json'),pair=JSON.parse(fs.readFileSync(pairPath,'utf8'));
if(pair.schema!=='gg-game-runtime-pair-1'||pair.abi!=='1.1'||['profileId','profileHash','runtimeBuild'].some(k=>pair[k]!==inventory[k])||pair.variant!==inventory.identity.variant)throw Error('Runtime pair mismatch');
if(!/^[a-zA-Z0-9_-]+$/.test(inventory.profileId)||!/^sha256:[0-9a-f]{64}$/.test(inventory.profileHash))throw Error('Invalid runtime location');
const profileDir='runtimes/'+inventory.profileId+'/'+inventory.profileHash.slice(7)+'/'+pair.variant;
const runtime={runtimeProfileId:inventory.profileId,runtimeProfileHash:inventory.profileHash,runtimeBuild:inventory.runtimeBuild,variant:pair.variant,runtimeAbi:'1.1',runtimePortProtocol:'1.1',bundleFormat:'gg-runtime-bundle-1',irVersion:1,irRevision:2};
// 当前实际编译器仅IR1.2；未来profile不能凭静态文档被装配成可用组件。
if(inventory.profileId!=='gg-wasm32-scalar-js-eh-2a')throw Error('Runtime registration requires an implemented package handler');
const sources=new Map();
function add(file,relativeFile){if(sources.has(relativeFile))throw Error('Duplicate package file');const d=descriptor(file,relativeFile);sources.set(relativeFile,{file,...d});return d;}
const nativeBundle=add(bundleFile,'native-runtime-bundle.json');
if(add(receiptPath,'compiler-build-verified.json').sha256!==hash(receiptBytes))throw Error('Postbuild receipt changed during assembly');
let artifactLibrary;
for(const library of bundle.libraries){if(!/^[a-zA-Z0-9_-]+\.dll$/.test(library.relativeFile))throw Error('Unsafe native file');
  const d=add(path.join(build,library.relativeFile),library.relativeFile);if(d.sha256!==library.sha256||d.bytes!==library.bytes||!receipt.files.some(r=>r.relativeFile===d.relativeFile&&r.sha256===d.sha256&&r.bytes===d.bytes))throw Error('Native output changed');if(library.id==='ARTIFACT')artifactLibrary=d;
}
for(const name of ['libc++.dll','libunwind.dll'])add(path.join(config.toolchain,'bin',name),name);
const compilerBuildInputs=add(inputsPath,'compiler-build-inputs.json');
const catalog=add(path.join(config.source,'engine/node-catalog.json'),'compiler-catalog.json');
runtime.runtimeInventory=add(inventoryPath,profileDir+'/runtime-inventory.json');
runtime.runtimePairReceipt=add(pairPath,profileDir+'/game-runtime.pair.json');
runtime.runtimeJs=add(path.join(runtimeBuild,'game-runtime.js'),profileDir+'/game-runtime.js');
runtime.runtimeWasm=add(path.join(runtimeBuild,'game-runtime.wasm'),profileDir+'/game-runtime.wasm');
for(const [key,name] of [['runtimeJs','game-runtime.js'],['runtimeWasm','game-runtime.wasm']]){
  const entry=pair.files.find(f=>f.name===name);if(!entry||entry.sha256!==runtime[key].sha256.slice(7)||String(entry.bytes)!==runtime[key].bytes)throw Error('Runtime bytes do not match pair');
}
const metadata={metadataVersion:'gg-compiler-component-1',declarationKind:'build_declaration',nativeBuildId:bundle.buildId,platform:bundle.platform,nativeBundle,artifactAbi:'1.0',artifactLibrary,artifactJsonProtocols:['1.0'],compilerBuild,compilerBuildInputs,compilerBuildInputsHash:inputsHash,catalog:{catalogHash:inputs.catalogHash,hashPolicy:'gg-embedded-catalog-json-dump-1',file:catalog},runtimeProfiles:[runtime]};
const metadataBytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
const wrapper={abi:'1.0',target:'windows-x86_64',buildId:bundle.buildId,entryLibrary:bundle.libraries.find(l=>l.id==='CORE').relativeFile,artifactLibrary:artifactLibrary.relativeFile,
  sqliteRuntime:{name:'gg_sqlite3.dll',version:'3.54.1',sha256:bundle.libraries.find(l=>l.id==='SQLITE').sha256.slice(7),compileOptions:['THREADSAFE=1','OMIT_LOAD_EXTENSION','DQS=0'],consumers:['ggcore.dll','ggartifact.dll']},
  files:[...sources.values()].filter(f=>f.relativeFile.endsWith('.dll')).map(f=>({name:f.relativeFile,sha256:f.sha256.slice(7)}))};
function safeAncestors(file){for(let p=path.resolve(file);;p=path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Redirected package directory');if(path.dirname(p)===p)break;}}
safeAncestors(destination);fs.mkdirSync(path.join(destination,'components'),{recursive:true});safeAncestors(path.join(destination,'components'));
const name=inputsHash.slice(7)+'-'+hash(metadataBytes).slice(7,23),final=path.join(destination,'components',name);
const partial=path.join(destination,'components','.partial-'+crypto.randomUUID());fs.mkdirSync(partial);
const created=[];
try{
  for(const item of sources.values()){const target=path.join(partial,item.relativeFile);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(item.file,target,fs.constants.COPYFILE_EXCL);created.push(target);
    if(JSON.stringify(descriptor(target,item.relativeFile))!==JSON.stringify({relativeFile:item.relativeFile,sha256:item.sha256,bytes:item.bytes})||descriptor(item.file,item.relativeFile).sha256!==item.sha256)throw Error('Input changed while packaging');
  }
  for(const [file,bytes] of [['compiler-component.json',metadataBytes],['core-artifact.json',Buffer.from(JSON.stringify(wrapper,null,2)+'\n')]]){fs.writeFileSync(path.join(partial,file),bytes,{flag:'wx'});created.push(path.join(partial,file));}
  const installed=[...sources.values()].map(({relativeFile,sha256,bytes})=>({relativeFile,sha256,bytes}));
  installed.push(descriptor(path.join(partial,'compiler-component.json'),'compiler-component.json'),descriptor(path.join(partial,'core-artifact.json'),'core-artifact.json'));
  fs.writeFileSync(path.join(partial,'component-installation.json'),JSON.stringify({schema:'gg-local-component-installation-1',files:installed},null,2)+'\n',{flag:'wx'});created.push(path.join(partial,'component-installation.json'));
  if(fs.existsSync(final))throw Error('Component directory already exists; keep immutable installation');
  fs.renameSync(partial,final);
  const active={schema:'gg-native-component-selection-1',relativeRoot:'components/'+name,installation:descriptor(path.join(final,'component-installation.json'),'component-installation.json')};
  const pending=path.join(destination,'.active-'+crypto.randomUUID()+'.partial');fs.writeFileSync(pending,JSON.stringify(active,null,2)+'\n',{flag:'wx'});fs.renameSync(pending,path.join(destination,'active-component.json'));
  console.log(JSON.stringify({component:name,compilerBuild,profileId:runtime.runtimeProfileId,profileHash:runtime.runtimeProfileHash,files:installed.length}));
}catch(error){
  // 只清理本次创建且尚未发布的随机目录，不碰旧组件或作者工程。
  if(fs.existsSync(partial)){for(const file of created.reverse())if(fs.existsSync(file))fs.unlinkSync(file);const dirs=[];function visit(d){for(const e of fs.readdirSync(d,{withFileTypes:true}))if(e.isDirectory()){visit(path.join(d,e.name));dirs.push(path.join(d,e.name));}}visit(partial);for(const d of dirs)fs.rmdirSync(d);fs.rmdirSync(partial);}
  throw error;
}
