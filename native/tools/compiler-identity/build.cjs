// 只接受受控Ninja构建；内容闭包、实际动作和工具变化都会使旧组件身份失效。
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const [phase,configPath]=process.argv.slice(2);
if(!['stamp','prepare','verify'].includes(phase))throw Error('Invalid compiler identity phase');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(process.platform!=='win32'||cfg.generator!=='Ninja'||!cfg.buildType)throw Error('Unsupported identity build host');
const source=fs.realpathSync(cfg.source),build=fs.realpathSync(cfg.build);
const slash=s=>s.replaceAll('\\','/');
const canon=v=>Array.isArray(v)?v.map(canon):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const encode=v=>Buffer.from(JSON.stringify(canon(v)));
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
function fileDigest(file){
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Non-regular identity input');
  const fd=fs.openSync(file,'r'),h=crypto.createHash('sha256'),buffer=Buffer.alloc(1048576);let bytes=0;
  try{for(let n;(n=fs.readSync(fd,buffer,0,buffer.length,null))>0;){h.update(buffer.subarray(0,n));bytes+=n;}
    const end=fs.fstatSync(fd);if(end.size!==bytes||end.size!==stat.size||end.mtimeMs!==stat.mtimeMs)throw Error('Input changed while hashing');
  }finally{fs.closeSync(fd);}return{sha256:'sha256:'+h.digest('hex'),bytes:String(bytes)};
}
function within(parent,file){const relative=path.relative(parent,file);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function walk(directory,skip=()=>false){const out=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
  const full=path.join(dir,entry.name);if(skip(full,entry))continue;if(entry.isSymbolicLink())throw Error('Symlink in build inputs');
  if(entry.isDirectory())visit(full);else if(entry.isFile())out.push(full);else throw Error('Unsupported build input');
}}visit(directory);return out;}
function runRaw(tool,args){return cp.execFileSync(tool,args,{cwd:build,maxBuffer:33554432,windowsHide:true});}
function run(tool,args){return runRaw(tool,args).toString('utf8');}
// Microsoft CRT参数规则；只在已拆开的cmd连接段中使用，不通过空格重拆参数。
function words(command){const out=[];let i=0;while(i<command.length){while(/\s/.test(command[i]||'')&&i<command.length)i++;if(i===command.length)break;
  let token='',quoted=false;while(i<command.length){if(!quoted&&/\s/.test(command[i]))break;
    let n=0;while(command[i]==='\\'){n++;i++;}if(command[i]==='"'){token+='\\'.repeat(Math.floor(n/2));if(n%2)token+='"';else quoted=!quoted;i++;}
    else{token+='\\'.repeat(n);if(i<command.length)token+=command[i++];}}
  if(quoted)throw Error('Unclosed command quote');out.push(token);
}return out;}
function segments(command){
  const prefix=/^\S*cmd\.exe\s+\/C\s+"([\s\S]*)"$/i.exec(command);if(prefix)command=prefix[1];
  const out=[];let start=0,quoted=false;for(let i=0;i<command.length;i++){
    if(command[i]==='"'){let n=0;for(let j=i-1;j>=0&&command[j]==='\\';j--)n++;if(n%2===0)quoted=!quoted;}
    if(!quoted&&command.slice(i,i+2)==='&&'){out.push(command.slice(start,i).trim());start=i+2;i++;}
    else if(!quoted&&/[|<>%]/.test(command[i]))throw Error('Unsupported shell action in compiler closure');
  }out.push(command.slice(start).trim());return out.filter(s=>s!=='cd .');
}
function replace(file,bytes){if(fs.existsSync(file)&&fs.readFileSync(file).equals(Buffer.from(bytes)))return;const temp=file+'.partial';fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);}
const unsupportedEnv=['CPATH','CPLUS_INCLUDE_PATH','C_INCLUDE_PATH','LIBRARY_PATH','COMPILER_PATH','SDKROOT','CCC_OVERRIDE_OPTIONS','CL','_CL_','INCLUDE','LIB','LDFLAGS','CFLAGS','CXXFLAGS'];
if(unsupportedEnv.some(name=>process.env[name]))throw Error('Implicit compiler environment must be expressed in CMake configuration');
const environment=['PATH','PATHEXT','SystemRoot','SystemDrive','TEMP','TMP','LANG','LC_ALL','SOURCE_DATE_EPOCH','ZERO_AR_DATE'].filter(name=>process.env[name]!==undefined)
  .map(name=>({name,value:process.env[name]})).sort((a,b)=>a.name<b.name?-1:1);
const packages=[
  ['toolchain',fs.realpathSync(cfg.toolchain)],['cmake',path.dirname(path.dirname(fs.realpathSync(cfg.cmake)))],
  ['ninja',path.dirname(fs.realpathSync(cfg.ninja))],['node',path.dirname(fs.realpathSync(cfg.node))]
];
const packageRecords=packages.map(([id,dir])=>({id,files:walk(dir).map(file=>({logicalPath:'tool/'+id+'/'+slash(path.relative(dir,file)),...fileDigest(file)}))}));
const packageHash=id=>hash(encode(packageRecords.find(x=>x.id===id)));
const generated=path.join(build,'generated');
replace(path.join(generated,'compiler-packages.json'),JSON.stringify(packageRecords,null,2)+'\n');
let files=walk(source,(full,entry)=>entry.isDirectory()&&['out','docs','.git'].includes(entry.name)).filter(f=>/\.(?:c|cpp|h|hpp|json|sql|cmake|cjs|in|txt)$/.test(f)&&!f.endsWith('README.txt'));
// 输出、身份派生头和sidecar不回灌identity，避免生成头/最终DLL的自引用。
files=files.filter(f=>!within(build,f));
const sourceFiles=files.map(file=>({logicalPath:'src/'+slash(path.relative(source,file)),...fileDigest(file)}));
for(const name of ['contracts.hpp','compiler-configuration.json','compiler-packages.json']){
  const file=path.join(generated,name);sourceFiles.push({logicalPath:'generated/'+name,...fileDigest(file)});
}
sourceFiles.push({logicalPath:'generated/build.ninja',...fileDigest(path.join(build,'build.ninja'))});
sourceFiles.push({logicalPath:'generated/rules.ninja',...fileDigest(path.join(build,'CMakeFiles/rules.ninja'))});
sourceFiles.sort((a,b)=>a.logicalPath<b.logicalPath?-1:1);
const tools=[],toolIds=new Map();
const catalogToolPath=path.resolve(cfg.catalogTool).toLowerCase();
function tool(file){const real=fs.realpathSync(file),key=real.toLowerCase();if(toolIds.has(key))return toolIds.get(key);
  const name=path.basename(real),pkg=packages.find(([,dir])=>within(dir,real));let reportRaw,version,target;
  if(real.toLowerCase()===catalogToolPath){reportRaw=runRaw(real,[]);version='gg-catalog-identity-1';target='windows-x64';}
  else if(name.toLowerCase()==='cmd.exe'){reportRaw=runRaw(real,['/d','/c','ver']);version='Windows '+(/[0-9]+(?:\.[0-9]+){2,}/.exec(reportRaw.toString('ascii'))?.[0]||'unknown');target='windows-x64';}
  else{reportRaw=runRaw(real,['--version']);const report=reportRaw.toString('utf8');version=report.trim().split(/\r?\n/)[0];target=/Target:\s*([^\r\n]+)/.exec(report)?.[1]||'windows-x64';}
  if(!pkg&&real.toLowerCase()!==catalogToolPath&&name.toLowerCase()!=='cmd.exe')throw Error('Unowned build tool');
  const id='tool-'+String(tools.length).padStart(3,'0')+'-'+name.toLowerCase();
  const binary=fileDigest(real);tools.push({id,version,target,binarySha256:binary.sha256,versionReportSha256:hash(reportRaw),packageInputHash:pkg?packageHash(pkg[0]):hash(encode({name,...binary}))});
  toolIds.set(key,id);return id;
}
for(const file of [cfg.node,cfg.cmake,cfg.ninja,cfg.compiler,...(phase==='stamp'?[]:[cfg.catalogTool]),process.env.ComSpec||path.join(process.env.SystemRoot,'System32/cmd.exe')])tool(file);
const commands=run(cfg.ninja,['-t','commands','ggartifact','ggcore',...(cfg.platform==='android-arm64-v8a'?['ggcore_jni']:[])]).trim().split(/\r?\n/).filter(line=>!line.includes('tools/compiler-identity/build.cjs'));
const actions=[],responseFiles=[],links=new Map();
const logical=file=>{const full=path.resolve(build,file);if(within(source,full)&&!within(build,full))return 'src/'+slash(path.relative(source,full));
  if(within(generated,full))return 'generated/'+slash(path.relative(generated,full));
  if(within(build,full))return 'generated/'+slash(path.relative(build,full));const p=packages.find(([,dir])=>within(dir,full));
  if(p)return 'tool/'+p[0]+'/'+slash(path.relative(p[1],full));throw Error('Input outside declared source/tool closure');};
for(const command of commands)for(const segment of segments(command)){
  const args=words(segment);if(!args.length)continue;const executable=args.shift();const toolId=tool(executable);const expanded=[];const responses=[];
  // 目前只接收无需间接驱动文件的固定构建路径；不完整展开比明确拒绝更危险。
  for(const arg of args){if(arg.includes('@')||/\.(cfg|rsp|def|lds|ldscript)$/i.test(arg))throw Error('Indirect compiler/linker input is not supported');expanded.push(arg);}
  const compile=expanded.includes('-c'),archive=/llvm-(ar|ranlib)(?:\.exe)?$/i.test(executable),link=!compile&&/clang(?:\+\+)?(?:\.exe)?$/i.test(executable)&&expanded.includes('-o');
  if(compile||link||/clang\+\+(?:\.exe)?$/i.test(executable)&&expanded.includes('-o')){
    if(!expanded.includes('--no-default-config'))throw Error('Implicit Clang configuration is forbidden');
    for(let i=0;i<expanded.length;i++){
      const arg=expanded[i];
      if(arg.startsWith('-Wl,')&&!/^-Wl,(?:--build-id=sha1|--no-rosegment|--no-undefined-version|--fatal-warnings|--no-undefined|--exclude-libs,ALL|-z,max-page-size=16384|-soname,[A-Za-z0-9_.-]+|--out-implib,[A-Za-z0-9_.-]+|--major-image-version,0,--minor-image-version,0)$/.test(arg))throw Error('Unregistered linker option');
      // 白名单只接纳当前两条受管工具链路径；新增flags须先补输入/搜索边界。
      const direct=/^(?:--no-default-config|--target=\S+|--sysroot=\S+|-D.+|-I.+|-L.+|-isystem.+|-iquote.+|-idirafter.+|-fuse-ld=.+|-stdlib=libc\+\+|-rtlib=compiler-rt|-unwindlib=libunwind|-g(?:[0-3])?|-O(?:[0-3sz])|-std=(?:gnu\+\+20|c\+\+20)|-fPIC|-fpic|-fvisibility=(?:hidden|default)|-fvisibility-inlines-hidden|-fno-limit-debug-info|-ffunction-sections|-fdata-sections|-funwind-tables|-fstack-protector-strong|-no-canonical-prefixes|-static|-static-libstdc\+\+|-shared|-MD|-MT|-MF|-o|-c|-Qunused-arguments|-Xlinker|-W[A-Za-z0-9_=-]+|-l[A-Za-z0-9_+-]+|-m(?!llvm$)[A-Za-z0-9_.=+-]+)$/;
      if(arg.startsWith('-')&&!arg.startsWith('-Wl,')&&!direct.test(arg)&&!['-I','-L','-isystem','-iquote','-idirafter','--sysroot','-resource-dir'].includes(arg))throw Error('Unregistered compiler option');
      if(arg==='-Xlinker'){
        const next=expanded[i+1]||'';
        if(!next.startsWith('--dependency-file=')||!within(build,path.resolve(build,next.slice('--dependency-file='.length))))throw Error('Unsupported indirect linker argument');
        i++;continue;
      }
      if(/^(?:--config|-B|-Xclang|-fplugin|-fpass-plugin|-specs|-wrapper|--gcc-toolchain|--gcc-install-dir|-gcc-toolchain|-fmodule|-ivfsoverlay)/.test(arg)||/-Wl,.*(?:@|--(?:plugin|script|version-script|dynamic-list|retain-symbols-file|just-symbols|symbol-ordering-file)|(?:^|,)-T)/.test(arg))throw Error('Unsupported indirect driver/linker option');
      const paired=['-I','-isystem','-iquote','-idirafter','-isysroot','--sysroot','-resource-dir','-L','-F','-iframework'];
      let input=paired.includes(arg)?expanded[++i]:null;
      if(!input){for(const prefix of ['--sysroot=','-isystem','-iquote','-idirafter','-I','-L','-F','-iframework'])if(arg.startsWith(prefix)&&arg.length>prefix.length){input=arg.slice(prefix.length);break;}}
      if(input){const full=path.resolve(build,input);
        // -l只可在完整内容散列的工具包中解析；source/build库必须用显式文件登记。
        if(arg==='-L'||arg.startsWith('-L')){if(!within(cfg.toolchain,full))throw Error('Library search must stay inside the toolchain package');}
        else if(!within(source,full)&&!within(build,full)&&!within(cfg.toolchain,full))throw Error('Search path escapes controlled inputs');
      }
      if(arg.startsWith('-l')&&!['bcrypt','kernel32','user32','gdi32','winspool','shell32','ole32','oleaut32','uuid','comdlg32','advapi32','atomic','m','dl','log','android'].includes(arg.slice(2)))throw Error('Unregistered library search');
      if(arg.startsWith('-Wl,-L')||arg.startsWith('-Wl,--library-path')||arg.startsWith('-Wl,-l')||arg.startsWith('-Wl,--sysroot'))throw Error('Indirect linker search is forbidden');
      if(arg.startsWith('-fuse-ld=')){const selected=arg.slice(9);if(!path.isAbsolute(selected)||!within(cfg.toolchain,selected))throw Error('Linker must be an explicit toolchain binary');tool(selected);}
    }
    if(!compile&&!expanded.some(a=>a.startsWith('-fuse-ld=')))throw Error('Explicit linker required');
  }
  if(archive){
    const ar=/llvm-ar(?:\.exe)?$/i.test(executable),parts=ar?expanded.slice(1):expanded;
    if(ar&&!['qc','rc'].includes(expanded[0])||!parts.length||!/^lib[A-Za-z0-9_-]+\.a$/.test(parts[0])||parts.some((p,i)=>i>0&&(!/\.(?:o|obj)$/.test(p)||!within(build,path.resolve(build,p))))||!ar&&parts.length!==1)throw Error('Unsupported archive action');
  }
  // -o的目标绝不能作为link input散列，否则Android .so会把自己的旧输出带回身份。
  const operands=expanded.filter((arg,i)=>!['-o','-MF','-MT'].includes(expanded[i-1]));
  const sourceOperands=(compile||link)?operands:archive?(/llvm-ar(?:\.exe)?$/i.test(executable)?operands.slice(2):operands):[];
  const inputs=sourceOperands.filter(arg=>/\.(?:cpp|c|h|hpp|a|lib|so|obj|o)$/.test(arg)&&!arg.startsWith('-')).map(arg=>logical(arg));
  if(link&&phase!=='stamp')for(const arg of operands.filter(a=>/\.(?:a|lib|so)$/.test(a)&&!a.startsWith('-'))){const full=path.resolve(build,arg);links.set(logical(full),fileDigest(full));}
  const action={kind:compile?'compile':archive?'archive':link?'link':'generate',language:compile?(expanded.some(a=>a.endsWith('.c'))?'c':'cpp'):'none',toolId,inputPaths:inputs,arguments:expanded,responseFiles:responses};
  actions.push({...action,actionId:'action-'+crypto.createHash('sha256').update(encode(action)).digest('hex')});
}
const unique=new Map(actions.map(a=>[a.actionId,a]));
if(phase==='stamp'){
  const stamp=hash(encode({sourceFiles,tools,actions:[...unique.values()].sort((a,b)=>a.actionId<b.actionId?-1:1),environment,configuration:cfg}));
  replace(path.join(generated,'compiler-input-stamp.hpp'),'// 传递对象内容输入变化必须重新编译；不包含任何最终二进制。\n#pragma once\n// '+stamp+'\n');
  console.log('compiler source/tool/config stamp '+stamp);process.exit(0);
}
const catalogReport=JSON.parse(run(cfg.catalogTool,[])),catalogHash=catalogReport.catalogHash;
if(!/^sha256:[0-9a-f]{64}$/.test(catalogHash)||catalogReport.rawHash!==fileDigest(path.join(source,'engine/node-catalog.json')).sha256)throw Error('Catalog tool is not bound to this source catalog');
const actualTargets=[...new Set(actions.filter(a=>a.kind==='compile').flatMap(a=>a.arguments.filter(x=>x.startsWith('--target=')).map(x=>x.slice(9))))];
if(actualTargets.length>1)throw Error('Mixed compiler targets');
const targetTriple=actualTargets[0]||run(cfg.compiler,['-dumpmachine']).trim();
const identity={schema:'gg-compiler-build-inputs-1',configuration:{platform:cfg.platform,buildType:cfg.buildType,cmakeGenerator:cfg.generator,cmakeVersion:cfg.cmakeVersion,targetTriple,sysrootInputHash:packageHash('toolchain'),environment},
  sourceFiles,tools:tools.sort((a,b)=>a.id<b.id?-1:1),dependencies:[{id:'compiled-static-inputs',version:'content-addressed-1',sourceInputHash:hash(encode(sourceFiles)),configHash:hash(encode(actions)),linkInputHashes:[...links.entries()].sort(([a],[b])=>a<b?-1:1).map(([,v])=>v.sha256)}],
  actions:[...unique.values()].sort((a,b)=>a.actionId<b.actionId?-1:1),catalogHash,contractFiles:sourceFiles.filter(f=>/\.(json|sql)$/.test(f.logicalPath)&&f.logicalPath.startsWith('src/'))};
const identityHash=hash(encode(identity)),inputPath=path.join(build,'compiler-build-inputs.json');
if(phase==='prepare'){
  replace(inputPath,JSON.stringify(identity,null,2)+'\n');
  replace(path.join(generated,'compiler-build.hpp'),'// 真实构建输入派生；不得手工编辑。\n#pragma once\ninline constexpr char gg_compiler_build[]="gg-compiler-1-'+identityHash.slice(7)+'";\n');
  console.log('compiler input identity '+identityHash);
}else{
  if(hash(encode(JSON.parse(fs.readFileSync(inputPath,'utf8'))))!==identityHash)throw Error('Compiler inputs changed during build; rebuild identity and Artifact');
  const artifact=path.join(build,cfg.platform==='windows-x64'?'ggartifact.dll':'libggartifact.so');
  if(!fs.readFileSync(artifact).includes(Buffer.from('gg-compiler-1-'+identityHash.slice(7))))throw Error('Artifact did not embed this compiler input identity');
  const deps=run(cfg.ninja,['-t','deps']);
  // 链接器depfile还包含显式登记的派生对象/归档；其字节由最终link inputs另行绑定。
  const known=new Set([...sourceFiles.map(f=>f.logicalPath),...identity.actions.flatMap(a=>a.inputPaths)]);
  for(const line of deps.split(/\r?\n/).filter(s=>/^    \S/.test(s))){const file=path.resolve(build,line.trim());const name=logical(file);
    if(name==='generated/compiler-build.hpp')continue;
    if(name.startsWith('tool/'))continue;
    if(!known.has(name))throw Error('Compiler discovered an undeclared dependency: '+name);
  }
  const names=cfg.platform==='windows-x64'?['ggcore.dll','ggartifact.dll','gg_sqlite3.dll']:['libggcore.so','libggartifact.so','libgg_sqlite3.so'];
  const receipt={schema:'gg-compiler-build-verified-1',kind:'build_consistency',compilerBuildInputsHash:identityHash,compilerBuild:'gg-compiler-1-'+identityHash.slice(7),files:names.map(relativeFile=>({relativeFile,...fileDigest(path.join(build,relativeFile))}))};
  replace(path.join(build,'compiler-build-verified.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('compiler input closure verified '+identityHash);
}
