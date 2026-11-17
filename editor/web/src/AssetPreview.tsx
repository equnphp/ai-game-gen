// 预览只读取Core已入库的资源字节；不执行资源正文，不通过外部URL回退。
import { useEffect, useState } from "react";
import { CoreClient } from "./core-client";
import { useLocale } from "./localization";
export type Asset = {assetId:string;hash:string;byteLength:string;mediaType:string;source:{displayName:string};license:{identifier:string;status:string}};
export function AssetPreview({asset,client}:{asset:Asset;client:CoreClient}) {
  const {t}=useLocale();
  const [url,setUrl]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  const [progress,setProgress]=useState(0),[attempt,setAttempt]=useState(0);
  const supported=/^(image\/(?:png|jpeg|webp|gif|bmp)|audio\/|video\/)/.test(asset.mediaType);
  useEffect(()=>{
    let live=true,objectUrl:string|null=null;setUrl(null);setError(null);setProgress(0);
    if(!supported)return;
    void(async()=>{
      try {
        const length=Number(asset.byteLength);
        if(!Number.isSafeInteger(length)||length<0||length>8388608)throw new Error("PREVIEW_LIMIT_EXCEEDED");
        const bytes=new Uint8Array(length);let offset=0;
        while(offset<length){
          // 视图关闭后仍接收并释放当前块任务，随后停止，不遗留半读结果槽。
          const chunk=await client.readBlobChunk(asset.hash,offset,Math.min(1048576,length-offset));
          if(!live)return;
          if(!chunk.length || offset+chunk.length>length)throw new Error("CORE_CONTRACT_VIOLATION");
          bytes.set(chunk,offset);offset+=chunk.length;setProgress(Math.round(offset/length*100));
        }
        const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
        const actual="sha256:"+Array.from(digest,n=>n.toString(16).padStart(2,"0")).join("");
        if(actual!==asset.hash)throw new Error("HASH_MISMATCH");
        if(!live)return;
        objectUrl=URL.createObjectURL(new Blob([bytes],{type:asset.mediaType}));setUrl(objectUrl);
      }catch(failure){if(live)setError(failure instanceof Error?failure.message:String(failure));}
    })();
    return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[asset.assetId,asset.hash,asset.byteLength,asset.mediaType,client,attempt,supported]);
  return <section className="asset-preview" aria-label={t("assetPreview")}>
    <h2>{t("assetPreview")}</h2>
    {!supported?<p>{t("previewUnsupported")}</p>:error?<div role="alert"><p>{error==="PREVIEW_LIMIT_EXCEEDED"?t("previewLimit"):t("error")}</p>
      <details><summary>{t("details")}</summary><code>{error}</code></details><button className="button" onClick={()=>setAttempt(n=>n+1)}>{t("retry")}</button></div>
      :!url?<p role="status">{t("loading")} {progress}%</p>
      :asset.mediaType.startsWith("image/")?<img src={url} alt={asset.source.displayName}/>
      :asset.mediaType.startsWith("audio/")?<audio src={url} controls preload="metadata" aria-label={asset.source.displayName}/>
      :<video src={url} controls preload="metadata" aria-label={asset.source.displayName}/>}
    <p className="muted">{asset.source.displayName}</p><p>{asset.license.identifier} · {asset.license.status}</p>
  </section>;
}
