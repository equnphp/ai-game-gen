// 能力卡只创建已有作者组件；未支持的运行能力不冒充可试玩，未知数据只读保留。
import { useEffect,useState } from 'react';
import type { Component,Entity,NumberDraft } from './scene-model';
import { CoreClient,type CoreResult } from './core-client';
import { Dialog } from './components';
import { useLocale } from './localization';
type DocumentOption={id:string;kind:string;name:string;entries:string[]};
type Props={client:CoreClient;projectId:string;sceneId:string;entityId:string;entity:Entity;entities:Record<string,Entity>;disabled:boolean;
  numbers:Record<string,NumberDraft>;onNumber:(key:string,text:string,valid:boolean)=>void;
  onChange:(components:Record<string,Component>)=>void};
const supported=['camera2d','physics.body2d','input.controller','graph.behavior'] as const;
export function ComponentInspector(props:Props) {
  const {t}=useLocale();const {entity,entityId,disabled}=props;
  const [adding,setAdding]=useState(false),[type,setType]=useState<string>('camera2d'),[reference,setReference]=useState('');
  const [documents,setDocuments]=useState<DocumentOption[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const [removing,setRemoving]=useState<Component|null>(null);
  const components=entity.components??{};
  useEffect(()=>{setAdding(false);setRemoving(null);setReference('');},[entityId]);
  useEffect(()=>{
    let live=true;setDocuments([]);setLoading(true);setError(null);
    void (async()=>{
      const list:{id:string;kind:string}[]=[];let afterId:string|null=null;
      do {
        const result:CoreResult<{documents:{id:string;kind:string}[];nextAfterId:string|null}>=await props.client.submit(props.client.request('document.list',
          {limit:100,...(afterId?{afterId}:{})},props.projectId));
        if(!result.data)throw new Error('CORE_CONTRACT_VIOLATION');list.push(...result.data.documents);afterId=result.data.nextAfterId;
        if(list.length>500)throw new Error('LIMIT_EXCEEDED');
      }while(afterId);
      const options:DocumentOption[]=[];
      // 有界批次读取名称，不让大型工程占满Core的32个任务槽。
      const selected=list.filter(item=>item.kind==='graph'||item.kind==='input.map');
      for(let offset=0;offset<selected.length;offset+=4) {
        const batch=await Promise.all(selected.slice(offset,offset+4).map(async item=>{
          const result=await props.client.submit<{body:{name:string;entries?:Record<string,string|null>}}>(props.client.request('document.read',{documentId:item.id},props.projectId));
          if(!result.data || typeof result.data.body.name!=='string')throw new Error('CORE_CONTRACT_VIOLATION');
          return {...item,name:result.data.body.name,entries:Object.entries(result.data.body.entries??{}).filter(([,node])=>node!==null).map(([event])=>event)};
        }));options.push(...batch);
      }
      if(live)setDocuments(options);
    })().catch(failure=>{if(live)setError(failure instanceof Error?failure.message:String(failure));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[props.client,props.projectId]);
  const label=(value:string)=>t(value==='camera2d'?'cameraComponent':value==='physics.body2d'?'bodyComponent':value==='input.controller'?'inputComponent':value==='graph.behavior'?'behaviorComponent':'otherComponent');
  function replace(component:Component){props.onChange({...components,[component.id]:component});}
  function set(component:Component,path:string[],value:unknown){const data=structuredClone(component.data);let target=data;
    for(const key of path.slice(0,-1))target=target[key] as Record<string,unknown>;target[path.at(-1)!]=value;replace({...component,data});}
  function value(component:Component,path:string[]):unknown {let current:unknown=component.data;for(const key of path)current=(current as Record<string,unknown>)[key];return current;}
  function numeric(component:Component,path:string[],title:string,minimum?:number,maximum?:number,integer=false){
    const key=entityId+':'+component.id+':'+path.join('.');const draft=props.numbers[key];
    return <label key={key}>{title}<input type="text" inputMode="decimal" value={draft?.text??String(value(component,path))}
      aria-invalid={draft?!draft.valid:undefined} onChange={event=>{const text=event.target.value,number=Number(text);
        const valid=!!text.trim()&&Number.isFinite(number)&&(!integer||Number.isInteger(number))&&(minimum===undefined||number>=minimum)&&(maximum===undefined||number<=maximum);
        props.onNumber(key,text,valid);if(valid)set(component,path,number);}}/>{draft&&!draft.valid&&<span className="field-error">{t('invalidNumber')}</span>}</label>;
  }
  function check(component:Component,path:string[],title:string){return <label className="check-field" key={path.join('.')}>
    <input type="checkbox" checked={value(component,path)===true} onChange={event=>set(component,path,event.target.checked)}/>{title}</label>;}
  function documentSelect(component:Component,path:string[],kind:string,title:string){
    const current=value(component,path) as {id:string};return <label>{title}<select value={current.id} onChange={event=>set(component,path,{kind:'document',id:event.target.value,type:kind,scopeDocumentId:null})}>
      {!documents.some(item=>item.id===current.id)&&<option value={current.id}>{t('referenceUnavailable')}</option>}
      {documents.filter(item=>item.kind===kind).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>;
  }
  function add(){
    if(disabled)return;const id=crypto.randomUUID();let data:Record<string,unknown>;
    if(type==='camera2d')data={viewport:{width:1280,height:720},zoom:1,projection:'orthographic',followEntity:null,
      main:!Object.values(props.entities).some(object=>Object.values(object.components??{}).some(component=>component.type==='camera2d'&&component.enabled&&component.data.main===true))};
    else if(type==='physics.body2d')data={mode:'kinematic',mass:1,gravityScale:1,linearDamping:0,angularDamping:0,fixedRotation:false,continuous:false};
    else {
      const selected=documents.find(item=>item.id===reference);if(!selected)return;
      if(type==='input.controller')data={map:{kind:'document',id:reference,type:'input.map',scopeDocumentId:null},player:0,enabledWhenPaused:false};
      else {if(!selected.entries.length)return;data={graph:{kind:'document',id:reference,type:'graph',scopeDocumentId:null},entry:selected.entries[0],initialVariables:{}};}
    }
    props.onChange({...components,[id]:{id,type,schemaVersion:1,enabled:true,data}});setAdding(false);
  }
  return <section className="component-inspector">
    <div className="panel-heading"><h3>{t('objectComponents')}</h3><button type="button" className="icon-button" disabled={disabled} aria-label={t('addComponent')} onClick={()=>{
      setType(supported.find(kind=>kind==='graph.behavior'||!Object.values(components).some(component=>component.type===kind))!);setAdding(true);setReference('');}}>+</button></div>
    {error&&<p className="notice error" role="alert">{t('error')}<code>{error}</code></p>}
    {!Object.keys(components).length&&<p className="empty-note">{t('noComponents')}</p>}
    {Object.values(components).map(component=><details className="component-card" key={component.id} open>
      <summary>{label(component.type)}</summary><fieldset disabled={disabled||component.schemaVersion!==1}>
        <label className="check-field"><input type="checkbox" checked={component.enabled} onChange={event=>replace({...component,enabled:event.target.checked})}/>{t('enabled')}</label>
        {component.type==='camera2d'&&component.schemaVersion===1&&<>
          {numeric(component,['viewport','width'],t('viewportWidth'),1,16384,true)}{numeric(component,['viewport','height'],t('viewportHeight'),1,16384,true)}
          {numeric(component,['zoom'],t('cameraZoom'),Number.MIN_VALUE,100)}
          <label>{t('projection')}<select value={String(component.data.projection)} onChange={event=>set(component,['projection'],event.target.value)}>
            <option value="orthographic">{t('orthographic')}</option><option value="isometric">{t('isometric')}</option></select></label>
          {check(component,['main'],t('mainCamera'))}
          <label>{t('followObject')}<select value={(component.data.followEntity as {id:string}|null)?.id??''} onChange={event=>set(component,['followEntity'],event.target.value?{kind:'entity',id:event.target.value,type:'entity',scopeDocumentId:props.sceneId}:null)}>
            <option value="">{t('none')}</option>{Object.entries(props.entities).map(([id,object])=><option key={id} value={id}>{object.name}</option>)}</select></label>
        </>}
        {component.type==='physics.body2d'&&component.schemaVersion===1&&<>
          <label>{t('bodyMode')}<select value={String(component.data.mode)} onChange={event=>set(component,['mode'],event.target.value)}>
            <option value="static">{t('staticBody')}</option><option value="kinematic">{t('kinematicBody')}</option><option value="dynamic">{t('dynamicBody')}</option></select></label>
          {numeric(component,['mass'],t('bodyMass'),Number.MIN_VALUE)}{numeric(component,['gravityScale'],t('gravityScale'))}
          {numeric(component,['linearDamping'],t('linearDamping'),0)}{numeric(component,['angularDamping'],t('angularDamping'),0)}
          {check(component,['fixedRotation'],t('fixedRotation'))}{check(component,['continuous'],t('continuousCollision'))}
        </>}
        {component.type==='input.controller'&&component.schemaVersion===1&&<>{documentSelect(component,['map'],'input.map',t('inputMap'))}
          {numeric(component,['player'],t('playerIndex'),0,7,true)}{check(component,['enabledWhenPaused'],t('inputWhenPaused'))}</>}
        {component.type==='graph.behavior'&&component.schemaVersion===1&&<>{documentSelect(component,['graph'],'graph',t('workflow'))}
          <label>{t('manualEntry')}<select value={String(component.data.entry)} onChange={event=>set(component,['entry'],event.target.value)}>
            {(['onStart','onTick','onInput','onSignal'] as const).map(entry=><option key={entry} value={entry}>{t(entry)}</option>)}</select></label>
          <details><summary>{t('initialVariables')}</summary><pre>{JSON.stringify(component.data.initialVariables,null,2)}</pre></details></>}
        {(!supported.includes(component.type as typeof supported[number])||component.schemaVersion!==1)&&<p className="muted">{t('componentDetailsPending')}</p>}
        <details><summary>{t('details')}</summary><code>{component.type} · v{component.schemaVersion}</code><code>{component.id}</code></details>
        <button type="button" className="button danger full" onClick={()=>setRemoving(component)}>{t('removeComponent')}</button>
      </fieldset></details>)}
    {adding&&<Dialog id="add-component" title={t('addComponent')} onClose={()=>setAdding(false)}>
      <label>{t('componentKind')}<select value={type} onChange={event=>{setType(event.target.value);setReference('');}}>
        {supported.filter(kind=>kind==='graph.behavior'||!Object.values(components).some(component=>component.type===kind)).map(kind=><option key={kind} value={kind}>{label(kind)}</option>)}</select></label>
      {type==='camera2d'&&<p>{t('cameraPreset')}</p>}{type==='physics.body2d'&&<p>{t('bodyPreset')}</p>}
      {(type==='input.controller'||type==='graph.behavior')&&<label>{t(type==='graph.behavior'?'workflow':'inputMap')}<select value={reference} disabled={loading} onChange={event=>setReference(event.target.value)}>
        <option value="">{t('chooseReference')}</option>{documents.filter(item=>item.kind===(type==='graph.behavior'?'graph':'input.map')).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="dialog-actions"><button className="button" onClick={()=>setAdding(false)}>{t('cancel')}</button>
        <button className="button primary" disabled={disabled || !['camera2d','physics.body2d'].includes(type)&&(!reference||loading)} onClick={add}>{t('addComponent')}</button></div>
    </Dialog>}
    {removing&&<Dialog id="remove-component" title={t('removeComponent')} onClose={()=>setRemoving(null)}><p>{t('removeComponentNote')}</p>
      <div className="dialog-actions"><button className="button" onClick={()=>setRemoving(null)}>{t('cancel')}</button>
        <button className="button danger" disabled={disabled} onClick={()=>{const next={...components};delete next[removing.id];props.onChange(next);setRemoving(null);}}>{t('removeComponent')}</button></div></Dialog>}
  </section>;
}
