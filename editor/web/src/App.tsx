// UI只保存草稿与只读投影；项目修改统一进入Core提案、校验和持久化提交。
import { useEffect,useRef,useState,type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SessionInfo,host_describe_Result,TaskTicket } from "../../host-contract/editor-host";
import { encodeBytes } from "../../host-contract/codec";
import { TauriHost,nativeHostAvailable } from "../../host-contract/tauri";
import { CoreClient } from "./core-client";
import { LocaleProvider,useLocale } from "./localization";
import { Dialog,Icon,LanguagePicker } from "./components";
import { AssetPreview,type Asset } from "./AssetPreview";
import { HistoryPanel } from "./HistoryPanel";
import { ComponentInspector } from "./ComponentInspector";
import type {Entity,Scene,NumberDraft} from './scene-model';
import {WorkspaceClient,type OpenIntent} from './workspace-client';
import {ProjectBrowser} from './ProjectBrowser';
import type {WorkspaceOpenOperation} from '../../host-contract/workspace-port';
type Document = {documentId:string;body:Scene;schemaVersion:number;versionId:string;revision:string};
type Project = {id:string;name:string;formatVersion:number;headRevision:string;rootDocuments:{settingsId:string;defaultSceneId:string};readOnlyReasons:string[]};
type Page = "projects"|"scene"|"tasks"|"assets"|"settings"|"history";
type SaveState = "saved"|"dirty"|"saving"|"error"|"unknown";
type Unknown = {ticket?:TaskTicket;originCallId?:string;coreRequestId?:string;projectId?:string;requestUtf8?:{decodedBytes:number;base64:string}};
const copy = <T,>(value:T):T => structuredClone(value);
// 已删对象/组件的旧输入框不再阻断保存；仍存在的非法数字草稿必须先修正。
function numberDraftActive(scene:Scene,key:string):boolean {
  const parts=key.split(':');if(parts[0]==='plane')return !!scene.planes?.[parts[1]];
  const entity=scene.entities[parts[0]];return !!entity && (parts.length===2 || !!entity.components?.[parts[1]]);
}
function errorCode(error:unknown):string {return error instanceof Error ? error.message : String(error);}
export default function App() {
  const [boot,setBoot] = useState<{connected:boolean;grant:string|null;error:string|null}>({connected:false,grant:null,error:null});
  useEffect(() => {
    if (!nativeHostAvailable()) {setBoot({connected:false,grant:null,error:"NATIVE_HOST_REQUIRED"});return;}
    let live = true;
    invoke<{grantRef:string}>("host_bootstrap").then(value => {
      if (live) setBoot({connected:true,grant:value.grantRef,error:null});
    }).catch(error => {if(live)setBoot({connected:false,grant:null,error:errorCode(error)});});
    return () => {live=false;};
  }, []);
  return <LocaleProvider connected={boot.connected}><Workspace boot={boot}/></LocaleProvider>;
}
function Workspace({boot}:{boot:{connected:boolean;grant:string|null;error:string|null}}) {
  const {t,state:locale} = useLocale();
  const client = useRef(new CoreClient(new TauriHost())).current;
  const workspaceClient=useRef(new WorkspaceClient()).current;
  const [workspaceOperation,setWorkspaceOperation]=useState<WorkspaceOpenOperation|null>(null);
  const [workspacePending,setWorkspacePending]=useState(false),[workspaceRefresh,setWorkspaceRefresh]=useState(0);
  const [host,setHost] = useState<host_describe_Result|null>(null);
  const [page,setPage] = useState<Page>("projects");
  const [project,setProject] = useState<Project|null>(null);
  const [document,setDocument] = useState<Document|null>(null);
  const [draft,setDraft] = useState<Scene|null>(null);
  const [selected,setSelected] = useState<string|null>(null);
  const [activePlane,setActivePlane] = useState<string|null>(null);
  const [numberText,setNumberText] = useState<Record<string,NumberDraft>>({});
  const numberTextRef=useRef(numberText);numberTextRef.current=numberText;
  const [busy,setBusy] = useState(false);
  const working = useRef(false);
  const [saveState,setSaveState] = useState<SaveState>("saved");
  const [error,setError] = useState<string|null>(null);
  const [unknown,setUnknown] = useState<Unknown|null>(null);
  const [showLanguage,setShowLanguage] = useState(false);
  const [showWorkspace,setShowWorkspace] = useState(false);
  const [welcome,setWelcome] = useState(true);
  const [form,setForm] = useState<"new"|"open"|null>(null);
  const [name,setName] = useState("");
  const [directory,setDirectory] = useState("");
  const [session,setSession] = useState<SessionInfo|null>(null);
  const [assets,setAssets] = useState<Asset[]>([]);
  const [previewAssetId,setPreviewAssetId] = useState<string|null>(null);
  const [license,setLicense] = useState("unknown");
  const [leave,setLeave] = useState<(()=>Promise<void>)|null>(null);
  const current = useRef({project,document,draft,saveState});
  current.current = {project,document,draft,saveState};
  const readOnly = (project?.readOnlyReasons.length ?? 0)>0;
  const dirty = saveState === "dirty" || saveState === "error";
  useEffect(() => {
    if (!boot.connected) return;
    client.call("host.describe",{}).then(setHost).catch(error => setError(errorCode(error)));
    try{setWorkspacePending(workspaceClient.pending()!==null);}catch(failure){setError(errorCode(failure));}
  }, [boot.connected]);
  async function withWork(action:()=>Promise<void>) {
    if (working.current) return; working.current=true;setBusy(true);setError(null);
    try {await action();}
    catch (error) {
      setError(errorCode(error));
      if (errorCode(error)==="RESULT_UNKNOWN") {setUnknown(error as Unknown);setSaveState("unknown");}
    } finally {working.current=false;setBusy(false);}
  }
  async function ensureSession() {
    if (!client.session) {
      if (!boot.grant) throw new Error("NATIVE_HOST_REQUIRED");
      await client.open(boot.grant);
    }
    await client.negotiateModels();
  }
  async function loadProject() {
    const old=current.current.project;
    const projectId=old?.id;
    if (!projectId) throw new Error("NOT_FOUND");
    await refreshProject(projectId);
  }
  async function refreshProject(projectId:string) {
    const response=await client.submit<Project>(client.request("project.read",{},projectId));
    if(!response.data)throw new Error("CORE_CONTRACT_VIOLATION");
    const next=response.data;
    const doc=await client.submit<Document>(client.request("document.read",{documentId:next.rootDocuments.defaultSceneId},projectId));
    if(!doc.data)throw new Error("CORE_CONTRACT_VIOLATION");
    if(!doc.data.body || typeof doc.data.body.name!=="string" || !doc.data.body.entities ||
      typeof doc.data.body.entities!=="object" || Object.values(doc.data.body.entities).some(e=>!e || !e.transform || typeof e.name!=="string")){
      setProject(next);setDocument(null);setDraft(null);setPage("projects");setError("UNSUPPORTED_SCHEMA");
      current.current={project:next,document:null,draft:null,saveState:"saved"};return;
    }
    setProject(next);setDocument(doc.data);setDraft(copy(doc.data.body));setNumberText({});setSaveState("saved");
    setActivePlane(previous=>previous&&doc.data!.body.planes?.[previous]?previous:Object.keys(doc.data!.body.planes??{})[0]??null);
    current.current={project:next,document:doc.data,draft:copy(doc.data.body),saveState:"saved"};
  }
  async function openProject(event:FormEvent) {
    event.preventDefault();
    await withWork(async()=>{
      await ensureSession();
      const params=form==="new" ? {directory:"project_"+crypto.randomUUID().slice(0,8)+".ggproject",
        name,projectId:crypto.randomUUID(),defaultSceneId:crypto.randomUUID(),settingsId:crypto.randomUUID()}
        : {directory,mode:"read_write"};
      const response=await client.submit<{projectId:string}>(client.request(form==="new"?"project.create":"project.open",params));
      if(!response.data)throw new Error("CORE_CONTRACT_VIOLATION");
      await refreshProject(response.data.projectId);setPage("scene");setForm(null);setWelcome(false);
      setWorkspaceRefresh(previous=>previous+1);
      setName("");setDirectory("");setSelected(null);setAssets([]);setPreviewAssetId(null);
    });
  }
  async function finishWorkspaceOpen(operation:WorkspaceOpenOperation){
    setWorkspaceOperation(operation);
    if(operation.state==='READY'){
      if(operation.sessionAvailability!=='current'||!operation.session||!operation.opened){workspaceClient.acknowledge();setWorkspacePending(false);throw new Error('WORKSPACE_SESSION_LOST');}
      await client.adopt(operation.session.sessionToken,operation.coreProtocol);await refreshProject(operation.opened.projectId);
      workspaceClient.acknowledge();setWorkspacePending(false);setWorkspaceRefresh(previous=>previous+1);setPage('scene');setForm(null);setWelcome(false);setSelected(null);setAssets([]);setPreviewAssetId(null);return;
    }
    if(operation.state==='FAILED'||operation.state==='CANCELLED'){
      workspaceClient.acknowledge();setWorkspacePending(false);if(operation.state==='FAILED')throw new Error(operation.error?.code??'CORE_FAILURE');return;
    }
    throw new Error('WORKSPACE_RESULT_UNKNOWN');
  }
  function openFromWorkspace(intent:OpenIntent){
    guardLeave(async()=>{
      if(client.session)await closeProject();setWorkspaceOperation(null);
      try{const operation=await workspaceClient.begin(intent);setWorkspacePending(true);await finishWorkspaceOpen(await workspaceClient.wait(operation,setWorkspaceOperation));}
      finally{setWorkspacePending(workspaceClient.pending()!==null);}
    });
  }
  function recoverWorkspaceOpen(){
    void withWork(async()=>{const operation=await workspaceClient.recover();await finishWorkspaceOpen(await workspaceClient.wait(operation,setWorkspaceOperation));});
  }
  async function cancelWorkspaceOpen(){
    if(!workspaceOperation)return;try{const result=await workspaceClient.cancel(workspaceOperation.operationId);setWorkspaceOperation(result.operation);}
    catch(failure){setError(errorCode(failure));}
  }
  function updateDraft(next:Scene) {setDraft(next);setSaveState("dirty");}
  function updateEntity(patch:Partial<Entity>) {
    if (!draft || !selected) return;
    updateDraft({...draft,entities:{...draft.entities,[selected]:{...draft.entities[selected],...patch}}});
  }
  async function save() {
    const {project:p,document:doc,draft:scene}=current.current;
    if(!p || !doc || !scene || readOnly) return;
    for(const [key,value] of Object.entries(numberTextRef.current)){
      if(numberDraftActive(scene,key) && !value.valid)throw new Error("TYPE_MISMATCH");
    }
    const operations:unknown[]=[];
    if(scene.name!==doc.body.name)operations.push({kind:"set_field",documentId:doc.documentId,path:"/name",value:scene.name});
    if(scene.planes && JSON.stringify(scene.planes)!==JSON.stringify(doc.body.planes))operations.push({kind:'set_field',documentId:doc.documentId,path:'/planes',value:scene.planes});
    const entityOperations:unknown[]=[];
    for(const id of Object.keys(doc.body.entities))if(!scene.entities[id])
      entityOperations.push({kind:"remove_field",documentId:doc.documentId,path:"/entities/"+id});
    for(const [id,value] of Object.entries(scene.entities)){
      if(Object.values(value.transform).some(number=>!Number.isFinite(number)))throw new Error("TYPE_MISMATCH");
      if(JSON.stringify(value)!==JSON.stringify(doc.body.entities[id]))
        entityOperations.push({kind:"set_field",documentId:doc.documentId,path:"/entities/"+id,value});
    }
    if(doc.schemaVersion===2 && operations.length+entityOperations.length>64)
      operations.push({kind:'set_field',documentId:doc.documentId,path:'/entities',value:scene.entities});
    else operations.push(...entityOperations);
    if(!operations.length){setSaveState("saved");return;}
    setSaveState("saving");
    try {await client.edit(p.id,p.headRevision,operations);await refreshProject(p.id);}
    catch(error){if(errorCode(error)!=="RESULT_UNKNOWN")setSaveState("error");throw error;}
  }
  useEffect(()=>{
    if(saveState!=="dirty" || busy || readOnly)return;
    if(draft&&Object.entries(numberText).some(([key,value])=>numberDraftActive(draft,key)&&!value.valid))return;
    const timer=setTimeout(()=>{void withWork(save);},1900);
    return()=>clearTimeout(timer);
  },[draft,numberText,saveState,busy,readOnly]);
  async function closeProject() {
    await client.close();
    setProject(null);setDocument(null);setDraft(null);setSelected(null);setSaveState("saved");setPage("projects");setAssets([]);setPreviewAssetId(null);
    current.current={project:null,document:null,draft:null,saveState:"saved"};
  }
  function guardLeave(action:()=>Promise<void>) {
    if(current.current.saveState==="unknown"){setError("RESULT_UNKNOWN");return;}
    if(["dirty","error"].includes(current.current.saveState)){setLeave(()=>action);return;}
    void withWork(action);
  }
  useEffect(()=>{
    if(!boot.connected)return;
    let stopped=false;let release:(()=>void)|undefined;
    listen("host:close-requested",()=>{
      guardLeave(async()=>{await closeProject();await getCurrentWindow().close();});
    }).then(unlisten=>{if(stopped)unlisten();else release=unlisten;});
    return()=>{stopped=true;release?.();};
  },[boot.connected,draft,saveState]);
  function addEntity() {
    if(!draft)return;
    const id=crypto.randomUUID();
    if(draft.planes && (!activePlane || !draft.planes[activePlane])){setError('INVALID_PLANE');return;}
    const spatial=draft.planes?{planeId:activePlane!,heightOffset:0,vertical:{min:0,max:0},visualOffset:{x:0,y:0}}:undefined;
    updateDraft({...draft,entities:{...draft.entities,[id]:{name:t("newObject"),parentId:null,
      transform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1},...(spatial?{spatial,components:{}}:{sprite:null}),extensions:{}}}});
    setSelected(id);
  }
  async function history(direction:"undo"|"redo") {
    const latest=current.current.project;if(!latest)return;
    await client.submit(client.request("history."+direction,{},latest.id,latest.headRevision));
    await refreshProject(latest.id);setSelected(null);
  }
  async function refreshTasks() {
    if(!client.session){setSession(null);return;}
    setSession(await client.call("session.state",{sessionToken:client.session}));
  }
  async function confirmUnknown() {
    if(!unknown)return;
    const confirmed=await client.confirm(unknown);
    if(current.current.project)await loadProject();
    else if(typeof confirmed.data?.projectId==="string")await refreshProject(confirmed.data.projectId);
    setUnknown(null);setSaveState("saved");
  }
  async function upload(file:File) {
    if(!project || !client.session)return;
    const assetId=crypto.randomUUID();
    const begin=await client.submit<{uploadId:string}>(client.request("asset.upload_begin",{
      assetId,byteLength:String(file.size),mediaType:file.type || "application/octet-stream",
      source:{kind:"file",displayName:file.name},license:{identifier:license,status:license==="unknown"?"unknown":"declared"}},project.id));
    const uploadId=begin.data!.uploadId;
    for(let offset=0;offset<file.size;offset+=1048576){
      const bytes=new Uint8Array(await file.slice(offset,offset+1048576).arrayBuffer());
      const ticket=await client.call("upload.write",{sessionToken:client.session,uploadId,offset:String(offset),chunk:encodeBytes(bytes)});
      await client.wait(ticket);
    }
    await client.submit(client.request("asset.upload_finish",{uploadId},project.id));
    const latest=await client.submit<Project>(client.request("project.read",{},project.id));
    await client.submit(client.request("asset.attach",{uploadId},project.id,latest.data!.headRevision));
    const asset=await client.submit<Asset>(client.request("asset.read",{assetId},project.id));
    setAssets(items=>[...items,asset.data!]);await refreshProject(project.id);
  }
  const entity=selected && draft?.entities[selected] || null;
  const rootError=error ?? boot.error;
  const unavailable=!boot.connected || !host?.coreAbi;
  const navigation:({key:Page;icon:string;label:"projects"|"scene"|"tasks"|"assets"|"settings"}|{key:"workflow"|"create"|"world"|"publish";icon:string;label:"workflow"|"create"|"world"|"publish"})[]=[
    {key:"projects",icon:"grid",label:"projects"},{key:"create",icon:"chat",label:"create"},
    {key:"scene",icon:"scene",label:"scene"},{key:"workflow",icon:"workflow",label:"workflow"},
    {key:"assets",icon:"assets",label:"assets"},{key:"world",icon:"layers",label:"world"},{key:"publish",icon:"globe",label:"publish"},
  ];
  if(!boot.error && (!boot.connected || locale.status==="reading"))return <div className="startup" role="status"><strong>GameGen</strong><p>{t("loading")}</p></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" onClick={e=>{e.preventDefault();setPage("projects");}}><span className="brand-mark"><Icon name="workflow"/></span>GameGen</a>
      <p className="brand-sub">AIMETA · GAME STUDIO</p>
      <nav aria-label={t("workspace")}>{navigation.map(item=>{
        const supported=["projects","scene","assets"].includes(item.key);
        const enabled=supported && (item.key==="projects" || !!project);
        return <button type="button" key={item.key} className={"nav-item "+(page===item.key?"active":"")} disabled={!enabled}
          data-testid={"nav-"+item.key} title={!supported?t("unavailable"):undefined}
          onClick={()=>setPage(item.key as Page)}><Icon name={item.icon}/><span>{t(item.label)}</span></button>;
      })}</nav>
      <div className="nav-divider"/>
      <p className="nav-caption">{t("workspace")}</p>
      <button className={"nav-item "+(page==="history"?"active":"")} disabled={!project} onClick={()=>setPage("history")} data-testid="nav-history"><Icon name="history"/>{t("history")}</button>
      <button className={"nav-item "+(page==="tasks"?"active":"")} onClick={()=>{setPage("tasks");void withWork(refreshTasks);}} data-testid="nav-tasks"><Icon name="clock"/>{t("tasks")}</button>
      <button className="nav-item" disabled title={t("unavailable")}><Icon name="sync"/>{t("devices")}</button>
      <button className="nav-item" disabled title={t("unavailable")}><Icon name="help"/>{t("learn")}</button>
      <div className="sidebar-bottom"><div className="privacy"><Icon name="shield"/>{t("localOnly")}</div>
        <button className={"nav-item "+(page==="settings"?"active":"")} onClick={()=>setPage("settings")} data-testid="nav-settings"><Icon name="settings"/>{t("settings")}</button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><Icon name="folder"/><strong>{project?.name ?? t("workspace")}</strong><span>/</span><span>{t(page)}</span></div>
        <div className="top-actions">
          <button className="button compact mobile-only" aria-label={t("workspace")} aria-haspopup="dialog" aria-expanded={showWorkspace}
            data-testid="open-workspace-menu" onClick={()=>setShowWorkspace(true)}><Icon name="folder"/></button>
          <button className="button compact" aria-label={t("tasks")} data-testid="open-tasks" onClick={()=>{setPage("tasks");void withWork(refreshTasks);}}><Icon name="clock"/></button>
          {project && <span className={"status-pill "+saveState} role="status">{saveState==="saved"?t("saved"):saveState==="dirty"?t("dirty"):saveState==="saving"?t("saving"):saveState==="unknown"?t("unknown"):t("saveFailed")}</span>}
          <button className="button compact" onClick={()=>setShowLanguage(true)} data-testid="open-language"><Icon name="globe"/><span>{locale.effectiveLocale}</span></button>
          <button className="button secondary optional" disabled title={t("noPreview")}><Icon name="play"/>{t("preview")}</button>
          <button className="button primary optional" disabled title={t("unavailable")}>{t("export")}</button>
        </div>
      </header>
      <main>
        {rootError && <div className="notice error" role="alert"><p>{rootError==="NATIVE_HOST_REQUIRED"?t("nativeRequired"):rootError==="RESULT_UNKNOWN"?t("unknown"):rootError==="CANCEL_REQUESTED"?t("cancelRequested"):t("error")}</p><details><summary>{t("details")}</summary><code>{rootError}</code></details>
          {unknown && <button className="button" disabled={busy} onClick={()=>void withWork(confirmUnknown)}>{t("checkResult")}</button>}</div>}
        {unavailable && !rootError && <div className="notice" role="status">{boot.connected?t("coreMissing"):t("loading")}</div>}
        {page==="projects" && <>
          <div className="page-heading"><div><h1>{t("projects")}</h1><p>{t("localOnly")}</p></div><div className="toolbar"><button className="button" disabled={unavailable||busy} onClick={()=>guardLeave(async()=>{if(project)await closeProject();setForm("open");})}>{t("openProject")}</button>
            <button className="button primary" disabled={unavailable||busy} onClick={()=>guardLeave(async()=>{if(project)await closeProject();setForm("new");})}>{t("newProject")}</button></div></div>
          {!project ? <section className="panel project-create-banner"><div className="sparkle" aria-hidden="true">✧</div><div><h2>{t("chooseLocalProject")}</h2><p>{t("localOnly")}</p></div>
            <button className="button primary large" data-testid="new-project" disabled={unavailable||busy||workspacePending} onClick={()=>setForm("new")}>{t("newProject")}</button></section>
            : <section className="panel project-card"><Icon name="folder"/><div><p className="eyebrow">{t("currentProject")}</p><h2>{project.name}</h2><p>{t("saved")} · r{project.headRevision}</p></div><button className="button primary" onClick={()=>setPage("scene")}>{t("scene")}</button><button className="button" disabled={busy} onClick={()=>guardLeave(closeProject)}>{t("close")}</button></section>}
          <ProjectBrowser client={workspaceClient} connected={boot.connected} refreshVersion={workspaceRefresh} busy={busy} operation={workspaceOperation} pending={workspacePending}
            onOpen={openFromWorkspace} onRecover={recoverWorkspaceOpen} onCancel={()=>void cancelWorkspaceOpen()}/>
          {welcome && <section className="welcome-card"><Icon name="help"/><div><h2>{t("welcome")}</h2><p>{t("welcomeBody")}</p></div><button className="button" onClick={()=>setShowLanguage(true)}>{t("language")}</button><button className="text-button" onClick={()=>setWelcome(false)}>{t("skip")}</button></section>}
        </>}
        {page==="scene" && project && draft && <><div className="page-heading"><div><h1>{t("scene")}</h1><p>{readOnly?t("readOnly"):t("autoSave")}</p></div>
          <div className="toolbar"><button className="button" disabled={busy||readOnly} onClick={()=>guardLeave(()=>history("undo"))}>{t("undo")}</button><button className="button" disabled={busy||readOnly} onClick={()=>guardLeave(()=>history("redo"))}>{t("redo")}</button>
          <button className="button primary" disabled={busy||readOnly||saveState==="unknown"} onClick={()=>void withWork(save)} data-testid="save-scene">{t("save")}</button></div></div>
          {draft.planes&&<div className="plane-toolbar"><label>{t('activePlane')}<select value={activePlane??''} onChange={event=>setActivePlane(event.target.value)}>
            {Object.entries(draft.planes).map(([id,plane])=><option key={id} value={id}>{plane.name}</option>)}</select></label></div>}
          <section className="scene-layout">
            <aside className="panel scene-tree"><div className="panel-heading"><h2>{t("objects")}</h2><button className="icon-button" disabled={busy||readOnly} aria-label={t("addEntity")} onClick={addEntity} data-testid="add-entity">+</button></div>
              <div role="tree" aria-label={t("objects")}>{Object.entries(draft.entities).map(([id,item])=><button key={id} role="treeitem" aria-selected={selected===id}
                className={"tree-item "+(selected===id?"selected":"")} data-testid={"entity-"+id} onClick={()=>setSelected(id)}><Icon name="scene"/>{item.name}</button>)}</div>
              {!Object.keys(draft.entities).length && <p className="empty-note">{t("emptyScene")}</p>}
            </aside>
            <div className="panel model-panel"><div className="panel-heading"><h2>{draft.name}</h2><span className="muted">{t("modelView")}</span></div>
              <div className="scene-grid" aria-label={t("modelView")} data-testid="scene-model">
                {!Object.keys(draft.entities).length && <p className="grid-empty">{t("emptyScene")}</p>}
                {Object.entries(draft.entities).map(([id,item])=><button key={id} className={"scene-object "+(selected===id?"selected":"")}
                  aria-label={item.name} aria-pressed={selected===id} data-testid={"viewport-entity-"+id} onClick={()=>setSelected(id)}
                  style={{left:"calc(50% + "+item.transform.x+"px)",top:"calc(50% + "+item.transform.y+"px)",
                    transform:"translate(-50%, -50%) rotate("+item.transform.rotation+"deg) scale("+item.transform.scaleX+", "+item.transform.scaleY+")"}}>
                  <span aria-hidden="true">◇</span><small>{item.name}</small></button>)}
              </div><p className="model-note">{t("noPreview")}</p>
            </div>
            <aside className="panel inspector"><div className="panel-heading"><h2>{t("properties")}</h2></div>
              {!entity ? <p className="empty-note">{t("selectObject")}</p> : <><fieldset disabled={busy||readOnly||saveState==="unknown"}>
                <label>{t("objectName")}<input value={entity.name} maxLength={80} onChange={e=>updateEntity({name:e.target.value})} data-testid="property-name"/></label>
                {(["x","y","rotation","scaleX","scaleY"] as const).map(key=><label key={key}>{t(key==="x"?"positionX":key==="y"?"positionY":key)}
                  <input type="text" inputMode="decimal" value={numberText[selected!+":"+key]?.text ?? String(entity.transform[key])} data-testid={"property-"+key}
                    aria-invalid={numberText[selected!+':'+key]?!numberText[selected!+':'+key].valid:undefined}
                    onChange={e=>{const text=e.target.value;const valid=!!text.trim()&&Number.isFinite(Number(text))&&(!['scaleX','scaleY'].includes(key)||Number(text)!==0);
                      setNumberText(previous=>({...previous,[selected!+":"+key]:{text,valid}}));
                      if(valid)updateEntity({transform:{...entity.transform,[key]:Number(text)}});
                      else setSaveState("dirty");}}/></label>)}
                {entity.spatial&&draft.planes&&<><label>{t('objectPlane')}<select value={entity.spatial.planeId} onChange={event=>updateEntity({spatial:{...entity.spatial!,planeId:event.target.value}})}>
                  {Object.entries(draft.planes).map(([id,plane])=><option key={id} value={id}>{plane.name}</option>)}</select></label>
                  <label>{t('heightOffset')}<input type="text" inputMode="decimal" value={numberText[selected!+':heightOffset']?.text??String(entity.spatial.heightOffset)}
                    onChange={event=>{const text=event.target.value,valid=!!text.trim()&&Number.isFinite(Number(text));setNumberText(previous=>({...previous,[selected!+':heightOffset']:{text,valid}}));
                      if(valid)updateEntity({spatial:{...entity.spatial!,heightOffset:Number(text)}});else setSaveState('dirty');}}/></label></>}
                {!entity.components&&<label>{t("sprite")}<select value={entity.sprite?.assetId ?? ""} onChange={e=>updateEntity({sprite:e.target.value?{assetId:e.target.value}:null})}>
                  <option value="">{t("none")}</option>{assets.map(a=><option key={a.assetId} value={a.assetId}>{a.source.displayName}</option>)}
                  {entity.sprite && !assets.some(a=>a.assetId===entity.sprite!.assetId) && <option value={entity.sprite.assetId}>{entity.sprite.assetId}</option>}
                </select></label>}
                <button className="button danger full" onClick={()=>{const entities={...draft.entities};delete entities[selected!];updateDraft({...draft,entities});setSelected(null);}}>{t("deleteObject")}</button>
              </fieldset>{entity.components&&document&&<ComponentInspector client={client} projectId={project.id} sceneId={document.documentId} entityId={selected!}
                entity={entity} entities={draft.entities} disabled={busy||readOnly||saveState==='unknown'} numbers={numberText}
                onNumber={(key,text,valid)=>{setNumberText(previous=>({...previous,[key]:{text,valid}}));if(!valid)setSaveState('dirty');}}
                onChange={components=>updateEntity({components})}/>}</>}
            </aside>
          </section></>}
        {page==="assets" && <><div className="page-heading"><div><h1>{t("assets")}</h1><p>{t("assetNote")}</p></div></div>
          <section className="panel asset-panel"><label>{t("license")}<input value={license} onChange={e=>setLicense(e.target.value)} maxLength={128}/></label><p className="muted">{t("unknownLicense")}</p>
            <label className="button primary file-picker" aria-disabled={busy||readOnly}>{busy?t("uploading"):t("upload")}<input type="file" disabled={busy||readOnly||!project}
              onChange={e=>{const file=e.target.files?.[0];if(file)guardLeave(()=>upload(file));e.target.value="";}}/></label>
            <div className="asset-list">{assets.map(asset=><article className="asset-row" key={asset.assetId}><Icon name="assets"/><div><strong>{asset.source.displayName}</strong><p>{asset.mediaType} · {Number(asset.byteLength).toLocaleString(locale.effectiveLocale)} B</p><code>{asset.hash}</code></div><button className="button" onClick={()=>setPreviewAssetId(asset.assetId)}>{t("assetPreview")}</button></article>)}</div>
            {assets.find(a=>a.assetId===previewAssetId) && <AssetPreview key={previewAssetId} asset={assets.find(a=>a.assetId===previewAssetId)!} client={client}/>}
          </section></>}
        {page==="history" && project && <HistoryPanel client={client} projectId={project.id} revision={project.headRevision} busy={busy} readOnly={readOnly}
          onRestore={id=>guardLeave(async()=>{const active=current.current.project;if(!active)return;await client.submit(client.request("snapshot.restore",{snapshotId:id},active.id,active.headRevision));await refreshProject(active.id);setSelected(null);})}
          onPin={(snapshotId,locked)=>withWork(async()=>{const active=current.current.project;if(active)await client.submit(client.request("snapshot.pin",{snapshotId,locked},active.id));})}/>}
        {page==="tasks" && <><div className="page-heading"><h1>{t("tasks")}</h1><button className="button" onClick={()=>void withWork(refreshTasks)} disabled={busy}>{t("refresh")}</button></div>
          <section className="panel">{!session?.tasks.length ? <p className="empty-note">{t("noTasks")}</p> : session.tasks.map(task=><article className="task-row" key={task.taskRef}><Icon name="clock"/><div><code>{task.coreRequestId ?? task.taskRef}</code><p>{session.state}</p></div>
            <button className="button" disabled={busy} onClick={()=>void withWork(async()=>{const confirmed=await client.confirm({ticket:task});await refreshTasks();if(current.current.project)await loadProject();else if(typeof confirmed.data?.projectId==="string")await refreshProject(confirmed.data.projectId);setUnknown(null);})}>{t("checkResult")}</button>
            <button className="button" disabled={busy} onClick={()=>void withWork(async()=>{await client.call("task.cancel",{sessionToken:client.session!,taskRef:task.taskRef});setError("CANCEL_REQUESTED");await refreshTasks();})}>{t("requestCancel")}</button></article>)}</section></>}
        {page==="settings" && <><div className="page-heading"><h1>{t("settings")}</h1></div><section className="panel settings-panel"><div><h2>{t("language")}</h2><p className="muted">{t("languageNote")}</p></div><button className="button" onClick={()=>setShowLanguage(true)}>{locale.effectiveLocale}</button></section></>}
      </main>
      <footer><span>{project?.name ?? "GameGen"} · {t("localOnly")}</span><span>{project?"r"+project.headRevision:""}</span></footer>
    </div>
    {showLanguage && <LanguagePicker onClose={()=>setShowLanguage(false)}/>}
    {/* 小屏侧栏会收起工作区入口，菜单保留历史/设置等已实现功能的语义导航。 */}
    {showWorkspace && <Dialog id="workspace-menu" title={t("workspace")} onClose={()=>setShowWorkspace(false)}>
      <div className="workspace-menu">
        {(["projects","scene","assets","history","tasks","settings"] as const).map(destination=><button type="button" className="button"
          key={destination} disabled={!["projects","tasks","settings"].includes(destination)&&!project} aria-current={page===destination?"page":undefined}
          onClick={()=>{setShowWorkspace(false);setPage(destination);if(destination==="tasks")void withWork(refreshTasks);}}>{t(destination)}</button>)}
      </div>
    </Dialog>}
    {form && <Dialog id="project-form" title={t(form==="new"?"newProject":"openProject")} onClose={()=>{if(!busy)setForm(null);}}>
      <form onSubmit={event=>void openProject(event)}><label>{t(form==="new"?"projectName":"directory")}
        <input autoFocus required value={form==="new"?name:directory} maxLength={form==="new"?80:75} data-testid="project-input"
          onChange={e=>form==="new"?setName(e.target.value):setDirectory(e.target.value)} disabled={busy}/></label>
        {form==="open" && <p className="muted">{t("directoryHelp")}</p>}
        <div className="dialog-actions"><button type="button" className="button" onClick={()=>setForm(null)} disabled={busy}>{t("cancel")}</button>
          <button className="button primary" disabled={busy}>{busy?t("loading"):t(form==="new"?"newProject":"openProject")}</button></div>
      </form></Dialog>}
    {leave && <Dialog id="unsaved-changes" title={t("discardTitle")} onClose={()=>setLeave(null)}><p>{t("discardBody")}</p>
      <div className="dialog-actions"><button className="button" onClick={()=>setLeave(null)}>{t("cancel")}</button>
        <button className="button danger" disabled={busy} onClick={()=>{const action=leave;setLeave(null);setDraft(document?copy(document.body):null);setNumberText({});setSaveState("saved");void withWork(action);}}>{t("discard")}</button>
        <button className="button primary" disabled={busy} onClick={()=>{const action=leave;void withWork(async()=>{await save();setLeave(null);await action();});}}>{t("save")}</button>
      </div></Dialog>}
  </div>;
}
