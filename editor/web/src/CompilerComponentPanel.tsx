// 页面读取安装声明供编译配置选择；不以声明读取成功冒充游戏运行成功。
import {useEffect,useRef,useState} from 'react';
import type {CompilerComponent} from '../../host-contract/compiler-component-port';
import {TauriCompilerComponents} from '../../host-contract/compiler-component';
import {useLocale} from './localization';
export function CompilerComponentPanel(){
  const {t}=useLocale(),port=useRef(new TauriCompilerComponents()).current;
  const [component,setComponent]=useState<CompilerComponent|null>(null),[busy,setBusy]=useState(false),[failure,setFailure]=useState<string|null>(null);
  const generation=useRef(0);
  async function load(){const own=++generation.current;setBusy(true);setFailure(null);
    try{const reply=await port.invoke({protocolVersion:'1.0',requestId:crypto.randomUUID(),method:'compiler.component.read',params:{}});
      if(own!==generation.current)return;if(reply.ok)setComponent(reply.data);else{setComponent(null);setFailure(reply.error.code);}
    }catch(error){if(own===generation.current){setComponent(null);setFailure(error instanceof Error?error.message:'INTERNAL_ERROR');}}
    finally{if(own===generation.current)setBusy(false);}
  }
  useEffect(()=>{void load();return()=>{generation.current++;};},[]);
  return <section className="panel compiler-panel" aria-busy={busy}>
    <div className="panel-heading"><h2>{t('localCompiler')}</h2><button type="button" className="button" disabled={busy} onClick={()=>void load()}>{busy?t('compilerReading'):t('refresh')}</button></div>
    <p className="muted">{t('localCompilerNote')}</p>
    {failure&&<p role="status">{t(failure==='TIMEOUT'?'compilerChecking':failure==='COMPONENT_UNAVAILABLE'?'compilerUnavailable':'compilerDamaged')}</p>}
    {component&&<><p className="status-line">{t('compilerInstalled')}</p><dl className="component-identities">
      <dt>{t('compilerVersion')}</dt><dd><code>{component.compilerBuild}</code></dd>
      <dt>{t('runtimeConfiguration')}</dt><dd>{component.runtimeProfiles.map(profile=><div key={profile.runtimeProfileId+profile.runtimeProfileHash}>
        <strong>{profile.runtimeProfileId}</strong> · {t(profile.variant==='development'?'runtimeDevelopment':'runtimeRelease')}
        <details><summary>{t('details')}</summary><code>{profile.runtimeBuild}</code><br/><code>{profile.runtimeProfileHash}</code></details>
      </div>)}</dd>
    </dl></>}
  </section>;
}
