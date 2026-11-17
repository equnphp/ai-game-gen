// 最近项展示历史缓存，目录扫描展示未识别候选；只有Core作业READY才交付编辑会话。
import {useEffect,useState} from 'react';
import type {RecentProject,DiscoveryScan,WorkspaceMethodMap,WorkspaceStore,WorkspaceOpenOperation} from '../../host-contract/workspace-port';
import {WorkspaceClient,type OpenIntent,type WorkspaceDescription} from './workspace-client';
import {Dialog,Icon} from './components';
import {useLocale} from './localization';
type Candidate=WorkspaceMethodMap['workspace.discovery.read']['result']['candidates'][number];
type Props={client:WorkspaceClient;connected:boolean;refreshVersion:number;busy:boolean;operation:WorkspaceOpenOperation|null;pending:boolean;
  onOpen:(intent:OpenIntent)=>void;onRecover:()=>void;onCancel:()=>void};
export function ProjectBrowser(props:Props){
  const {t}=useLocale();const [description,setDescription]=useState<WorkspaceDescription|null>(null),[store,setStore]=useState<WorkspaceStore|null>(null);
  const [recent,setRecent]=useState<RecentProject[]>([]),[scan,setScan]=useState<DiscoveryScan|null>(null),[candidates,setCandidates]=useState<Candidate[]>([]);
  const [reading,setReading]=useState(false),[scanning,setScanning]=useState(false),[error,setError]=useState<string|null>(null),[forget,setForget]=useState<RecentProject|null>(null);
  const [mode,setMode]=useState<'read_write'|'read_only'>('read_write'),[protocol,setProtocol]=useState<'1.0'|'1.1'>('1.1');
  async function refresh(){
    if(!props.connected)return;setReading(true);setError(null);
    try {
      const d=await props.client.initialize(true);setDescription(d);if(!d.coreProtocols.includes(protocol))setProtocol(d.coreProtocols.includes('1.1')?'1.1':'1.0');
      let cursor:WorkspaceMethodMap['workspace.recent.list']['params']['cursor']=null;const entries:RecentProject[]=[];let snapshot:string|null=null;let actualStore:WorkspaceStore|null=null;
      do {const page:WorkspaceMethodMap['workspace.recent.list']['result']=await props.client.call('workspace.recent.list',{serviceInstanceId:d.serviceInstanceId,cursor,limit:100});
        if(snapshot!==null&&snapshot!==page.snapshotId)throw new Error('WORKSPACE_CONTRACT_VIOLATION');snapshot=page.snapshotId;actualStore=page.store;entries.push(...page.entries);if(entries.length>100)throw new Error('LIMIT_EXCEEDED');cursor=page.nextCursor;
      }while(cursor);setStore(actualStore);setRecent(entries);
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure));}finally{setReading(false);}
  }
  useEffect(()=>{void refresh();},[props.connected,props.refreshVersion]);
  async function discover(){
    if(!description||scanning)return;setScanning(true);setError(null);setCandidates([]);
    try {
      const roots=await props.client.call('workspace.roots.list',{serviceInstanceId:description.serviceInstanceId});const root=roots.workspaces.find(r=>r.default&&r.access!=='unavailable');if(!root)throw new Error('WORKSPACE_UNAVAILABLE');
      const accepted=await props.client.call('workspace.discovery.start',{serviceInstanceId:description.serviceInstanceId,commandId:crypto.randomUUID(),workspaceId:root.workspaceId});setScan(accepted.scan);
      const start=performance.now();
      for(;;){const result=await props.client.call('workspace.discovery.read',{serviceInstanceId:description.serviceInstanceId,scanId:accepted.scan.scanId,cursor:null,limit:100});setScan(result.scan);
        if(!['QUEUED','RUNNING'].includes(result.scan.state)){
          const entries=[...result.candidates];let cursor=result.nextCursor;
          while(cursor){const page=await props.client.call('workspace.discovery.read',{serviceInstanceId:description.serviceInstanceId,scanId:accepted.scan.scanId,cursor,limit:100});if(page.snapshotId!==result.snapshotId)throw new Error('WORKSPACE_CONTRACT_VIOLATION');entries.push(...page.candidates);if(entries.length>10000)throw new Error('LIMIT_EXCEEDED');cursor=page.nextCursor;}
          setCandidates(entries);break;
        }
        if(performance.now()-start>45000)throw new Error('WORKSPACE_RESULT_UNKNOWN');await new Promise<void>(resolve=>setTimeout(resolve,120));
      }
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure));}finally{setScanning(false);}
  }
  async function cancelScan(){if(!description||!scan)return;try{const result=await props.client.call('workspace.discovery.cancel',{serviceInstanceId:description.serviceInstanceId,commandId:crypto.randomUUID(),scanId:scan.scanId});setScan(result.scan);}catch(failure){setError(String(failure));}}
  async function forgetRecent(){
    if(!description||!store?.storeId||!forget)return;setReading(true);setError(null);
    try{await props.client.call('workspace.recent.forget',{serviceInstanceId:description.serviceInstanceId,commandId:crypto.randomUUID(),expectedStoreId:store.storeId,expectedStoreRevision:store.revision,entryId:forget.entryId,expectedEntryRevision:forget.entryRevision});setForget(null);await refresh();}
    catch(failure){setError(failure instanceof Error?failure.message:String(failure));}finally{setReading(false);}
  }
  const disabled=props.busy||props.pending;
  return <section className="project-browser">
    {props.pending&&<div className="notice" role="status"><strong>{t('projectOpenJob')}</strong><p>{props.operation?t(`workspaceState${props.operation.state}` as const):t('workspaceOpenPending')}</p>
      <div className="toolbar"><button className="button" disabled={props.busy} onClick={props.onRecover}>{t('checkResult')}</button>
        {props.operation?.cancellable&&<button className="button" onClick={props.onCancel}>{t('requestCancel')}</button>}</div></div>}
    <div className="panel-heading"><h2>{t('recentProjects')}</h2><button className="button" disabled={reading||!props.connected} onClick={()=>void refresh()}>{reading?t('loading'):t('refresh')}</button></div>
    <p className="muted">{t('recentProjectsNote')}</p>
    {error&&<p className="notice error" role="alert">{t('error')} <code>{error}</code></p>}
    {store?.lastError&&<p className="notice error">{t('recentCacheWarning')} <code>{store.lastError}</code></p>}
    <div className="toolbar project-open-options"><label className="check-field"><input type="checkbox" checked={mode==='read_only'} onChange={e=>setMode(e.target.checked?'read_only':'read_write')} disabled={disabled}/>{t('openReadOnly')}</label></div>
    {recent.length===0&&!reading&&<p className="empty-note">{t('noRecentProjects')}</p>}
    <div className="project-list">{recent.map(item=><article className="panel project-row" key={item.entryId}><Icon name="folder"/><div className="project-row-body"><h3>{item.name}</h3><p>{item.directory}</p><small>{t('lastVerifiedRevision')} r{item.lastVerifiedHead} · {t('projectFormat')} {item.projectFormat}</small>
      {item.availability==='identity_changed'&&<p className="notice error">{t('projectIdentityChanged')}</p>}</div>
      <button className="button primary" disabled={disabled||item.availability==='identity_changed'||!description?.coreProtocols.includes(item.coreProtocol)} onClick={()=>props.onOpen({source:{kind:'recent',entryId:item.entryId,expectedEntryRevision:item.entryRevision},mode,coreProtocol:item.coreProtocol,expectedProjectId:item.projectId})}>{t('openProject')}</button>
      <button className="text-button" disabled={reading} onClick={()=>setForget(item)}>{t('forgetRecent')}</button></article>)}</div>
    <section className="panel workspace-discovery"><div className="panel-heading"><h2>{t('findLocalProjects')}</h2><div className="toolbar"><button className="button" disabled={scanning||!description||disabled} onClick={()=>void discover()}>{scanning?t('findingLocalProjects'):t('findLocalProjects')}</button>{scanning&&<button className="button" onClick={()=>void cancelScan()}>{t('requestCancel')}</button>}</div></div>
      <p className="muted">{t('discoveryNote')}</p>
      <details><summary>{t('details')}</summary><label>{t('projectProtocol')}<select value={protocol} disabled={disabled||scanning} onChange={e=>setProtocol(e.target.value as '1.0'|'1.1')}>{description?.coreProtocols.map(p=><option key={p} value={p}>{t(p==='1.1'?'standardOpenMode':'legacyOpenMode')}</option>)}</select></label></details>
      {scan&&<p role="status">{t(`workspaceScan${scan.state}` as const)} · {t('visitedDirectories')} {scan.visitedEntries} · {t('foundCandidates')} {scan.candidateCount}</p>}
      {scan?.error&&<p className="notice error">{t('discoveryIncomplete')} <code>{scan.error.code}</code></p>}
      <div className="project-list">{candidates.map(item=><article className="project-row" key={item.candidateId}><Icon name="folder"/><div className="project-row-body"><strong>{recent.find(r=>r.entryId===item.cachedEntryId)?.name??item.directory}</strong><p>{item.directory} · {t('projectUnverified')}</p></div>
        <button className="button" disabled={disabled||!scan||item.locationState!=='present'||!description?.coreProtocols.includes(protocol)} onClick={()=>props.onOpen({source:{kind:'candidate',scanId:scan!.scanId,candidateId:item.candidateId},mode,coreProtocol:protocol,expectedProjectId:null})}>{t('identifyAndOpen')}</button></article>)}</div>
    </section>
    {forget&&<Dialog id="forget-recent" title={t('forgetRecent')} onClose={()=>{if(!reading)setForget(null);}}><p>{t('forgetRecentNote')}</p><strong>{forget.name}</strong><div className="dialog-actions"><button className="button" disabled={reading} onClick={()=>setForget(null)}>{t('cancel')}</button><button className="button" disabled={reading} onClick={()=>void forgetRecent()}>{t('forgetRecent')}</button></div></Dialog>}
  </section>;
}
