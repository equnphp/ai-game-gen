// 历史只展示Core权威记录；锁定与恢复都走原命令，UI不自行改写历史或修订号。
import { useEffect,useState } from "react";
import { CoreClient } from "./core-client";
import { Dialog } from "./components";
import { useLocale } from "./localization";
type Entry={revision:string;transactionId:string;kind:string;sourceTransactionId:string|null};
export type Snapshot={snapshotId:string;revision:string;reason:string;locked:boolean;manifestHash:string};
export function HistoryPanel({client,projectId,revision,busy,readOnly,onRestore,onPin}:{
  client:CoreClient;projectId:string;revision:string;busy:boolean;readOnly:boolean;
  onRestore:(id:string)=>void;onPin:(id:string,locked:boolean)=>Promise<void>;
}){
  const {t}=useLocale();
  const [entries,setEntries]=useState<Entry[]>([]),[snapshots,setSnapshots]=useState<Snapshot[]>([]);
  const [nextSnapshot,setNextSnapshot]=useState<string|null>(null),[moreHistory,setMoreHistory]=useState(false);
  const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  const [restore,setRestore]=useState<Snapshot|null>(null);
  useEffect(()=>{
    let live=true;setLoading(true);setError(null);setEntries([]);setSnapshots([]);setNextSnapshot(null);setMoreHistory(false);setRestore(null);
    void Promise.all([
      client.submit<{transactions:Entry[]}>(client.request("history.read",{limit:100},projectId)),
      client.submit<{snapshots:Snapshot[];nextAfterId:string|null}>(client.request("snapshot.list",{limit:100},projectId)),
    ]).then(([history,saved])=>{
      if(!live)return;
      if(!history.data||!saved.data)throw new Error("CORE_CONTRACT_VIOLATION");
      setEntries(history.data.transactions);setMoreHistory(history.data.transactions.length===100);
      setSnapshots(saved.data.snapshots);setNextSnapshot(saved.data.nextAfterId);
    }).catch(failure=>{if(live)setError(failure instanceof Error?failure.message:String(failure));})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[client,projectId,revision,refresh]);
  async function loadMore(kind:"history"|"snapshots"){
    if(loading)return;setLoading(true);setError(null);
    try{
      if(kind==="history"){
        const last=entries.at(-1);if(!last)return;
        const result=await client.submit<{transactions:Entry[]}>(client.request("history.read",{limit:100,beforeRevision:last.revision},projectId));
        if(!result.data)throw new Error("CORE_CONTRACT_VIOLATION");
        setEntries(old=>[...old,...result.data!.transactions]);setMoreHistory(result.data.transactions.length===100);
      }else if(nextSnapshot){
        const result=await client.submit<{snapshots:Snapshot[];nextAfterId:string|null}>(client.request("snapshot.list",{limit:100,afterId:nextSnapshot},projectId));
        if(!result.data)throw new Error("CORE_CONTRACT_VIOLATION");
        setSnapshots(old=>[...old,...result.data!.snapshots]);setNextSnapshot(result.data.nextAfterId);
      }
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure));}
    finally{setLoading(false);}
  }
  return <>
    <div className="page-heading"><div><h1>{t("history")}</h1><p>{t("historyNote")}</p></div>
      <button className="button" disabled={loading||busy} onClick={()=>setRefresh(n=>n+1)}>{t("refresh")}</button></div>
    {error&&<div className="notice error" role="alert"><p>{t("error")}</p><code>{error}</code></div>}
    {loading&&<p role="status">{t("loading")}</p>}
    <div className="history-layout">
      <section className="panel"><div className="panel-heading"><h2>{t("history")}</h2></div>
        {!entries.length&&!loading&&<p className="empty-note">{t("historyEmpty")}</p>}
        {entries.map(entry=><article className="history-row" key={entry.transactionId}><strong>r{entry.revision}</strong>
          <div><span>{entry.kind==="edit"?t("historyEdit"):entry.kind==="restore"?t("restoreSnapshot"):entry.kind==="undo"?t("undo"):entry.kind==="redo"?t("redo"):entry.kind}</span>
            <details><summary>{t("details")}</summary><code>{entry.transactionId}</code>{entry.sourceTransactionId&&<code>{entry.sourceTransactionId}</code>}</details></div></article>)}
        {moreHistory&&<button className="button" disabled={loading||busy} onClick={()=>void loadMore("history")}>{t("loadMore")}</button>}
      </section>
      <section className="panel"><div className="panel-heading"><h2>{t("snapshots")}</h2></div>
        {!snapshots.length&&!loading&&<p className="empty-note">{t("historyEmpty")}</p>}
        {snapshots.map(snapshot=><article className="history-row snapshot-row" key={snapshot.snapshotId}><strong>r{snapshot.revision}</strong>
          <div><code title={snapshot.snapshotId}>{snapshot.snapshotId.slice(0,8)}</code>
            <details><summary>{t("details")}</summary><code>{snapshot.manifestHash}</code><code>{snapshot.reason}</code></details></div>
          <div className="toolbar"><button className="button" disabled={busy||loading||readOnly} onClick={()=>void onPin(snapshot.snapshotId,!snapshot.locked).then(()=>setRefresh(n=>n+1))}>{t(snapshot.locked?"unlockSnapshot":"lockSnapshot")}</button>
            <button className="button" disabled={busy||loading||readOnly} onClick={()=>setRestore(snapshot)}>{t("restoreSnapshot")}</button></div></article>)}
        {nextSnapshot&&<button className="button" disabled={loading||busy} onClick={()=>void loadMore("snapshots")}>{t("loadMore")}</button>}
      </section>
    </div>
    {restore&&<Dialog id="restore-snapshot" title={t("restoreTitle")} onClose={()=>setRestore(null)}><p>{t("restoreBody",{revision:restore.revision})}</p>
      <div className="dialog-actions"><button className="button" onClick={()=>setRestore(null)}>{t("cancel")}</button>
        <button className="button primary" disabled={busy} onClick={()=>{const selected=restore;setRestore(null);onRestore(selected.snapshotId);}}>{t("restoreSnapshot")}</button></div></Dialog>}
  </>;
}
