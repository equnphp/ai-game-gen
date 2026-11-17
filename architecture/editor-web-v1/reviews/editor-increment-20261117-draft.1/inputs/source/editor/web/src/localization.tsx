// 语言只改变内置文案；Provider不重建Core、草稿或业务组件。
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale, LocaleSnapshot, UXMethodMap, UXRequest, ux_describe_Result } from "../../host-contract/editor-ux";
import { TauriUX } from "../../host-contract/tauri";
import en from "./locales/en.json";
import zhHans from "./locales/zh-Hans.json";
import zhHant from "./locales/zh-Hant.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
const messages: Record<Locale, Record<string,string>> = { en, "zh-Hans": zhHans, "zh-Hant": zhHant, ja, ko, es, fr };
const fallback: LocaleSnapshot = { storeSchemaVersion:1,localeStoreId:null,localeRevision:"0",effectiveLocale:"en",
  persistedLocale:null,source:"default",status:"reading",availability:"memory_only",latestAcceptedTicket:"0",
  pending:null,lastOutcome:null,lastError:null };
type LocaleContext = { state: LocaleSnapshot; descriptor: ux_describe_Result | null; ready: boolean;
  select: (locale: Locale) => Promise<void>; refresh: () => Promise<void>;
  t: (key: keyof typeof en, parameters?: Record<string,string|number>) => string };
const Context = createContext<LocaleContext | null>(null);
export function useLocale(): LocaleContext {
  const value = useContext(Context); if (!value) throw new Error("LOCALE_CONTEXT_MISSING"); return value;
}
export function LocaleProvider({ children, connected }: { children: ReactNode; connected: boolean }) {
  const [state, setState] = useState<LocaleSnapshot>(fallback);
  const [descriptor, setDescriptor] = useState<ux_describe_Result | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef(state); current.current = state;
  const seq = useRef(0n);
  const ux = useRef(new TauriUX()).current;
  const live = useRef(true);
  const service = useRef<string | null>(null);
  const missing = useRef(new Set<string>());
  async function call<M extends keyof UXMethodMap>(method: M, params: UXMethodMap[M]["params"]): Promise<UXMethodMap[M]["result"]> {
    const request = { uxProtocol:"1.1",callId:crypto.randomUUID(),method,params } as UXRequest<M>;
    const reply = await ux.dispatch(request);
    if (!reply.ok) {
      if (reply.error.code==="SERVICE_RESTARTED") {setDescriptor(null);service.current=null;throw Object.assign(new Error(reply.error.code),{authoritative:true});}
      if (reply.error.localeState) apply(reply.error.localeState);
      throw Object.assign(new Error(reply.error.code),{authoritative:true});
    }
    return reply.result as UXMethodMap[M]["result"];
  }
  function apply(next: LocaleSnapshot) {
    if (!live.current) return;
    const previous=current.current;
    const nextTicket=BigInt(next.latestAcceptedTicket),previousTicket=BigInt(previous.latestAcceptedTicket);
    if(nextTicket<previousTicket)return;
    if(previous.localeStoreId && !next.localeStoreId)return;
    if(previous.localeStoreId===next.localeStoreId && BigInt(next.localeRevision)<BigInt(previous.localeRevision))return;
    const terminal=(value:LocaleSnapshot)=>!value.pending && value.lastOutcome?.ticket===value.latestAcceptedTicket &&
      ["committed","unchanged","failed","superseded"].includes(value.lastOutcome.outcome);
    // 同一意图的accepted响应可能晚于已提交/失败快照，不能回退到saving或旧有效语言。
    if(nextTicket===previousTicket && terminal(previous) && !terminal(next))return;
    if(previous.localeStoreId && next.localeStoreId && previous.localeStoreId!==next.localeStoreId)return;
    current.current = next; setState(next);
  }
  async function refresh() {
    if (!service.current) return;
    const result = await call("ux.snapshot", { serviceInstanceId:service.current }); apply(result.localeState);
  }
  useEffect(() => {
    live.current = true;
    if (!connected) return () => { live.current = false; };
    (async () => {
      try {
        const description = await call("ux.describe", {});
        if (!description.supportedUxProtocols.includes("1.1") || !description.implementedMethods.includes("ux.locale.select"))
          throw new Error("UNSUPPORTED_PROTOCOL");
        service.current = description.serviceInstanceId;
        seq.current = BigInt(description.locale.latestSelectionSeq);
        if (live.current) setDescriptor(description);
        await refresh();
      } catch (error) {
        if (live.current) apply({ ...fallback,status:"read_only",availability:"read_only",lastError:String(error) });
      } finally { if (live.current) setReady(true); }
    })();
    return () => { live.current = false; };
  }, [connected]);
  useEffect(() => {
    document.documentElement.lang = state.effectiveLocale;
  }, [state.effectiveLocale]);
  useEffect(() => {
    if (!connected || !["saving","reconciling"].includes(state.status)) return;
    let stopped = false, pending = false;
    const timer = window.setInterval(async () => {
      if (pending || stopped) return; pending = true;
      try { await refresh(); } catch { /* 传输失联保留未知结果，不能伪报写失败。 */ }
      finally { pending = false; }
    }, 250);
    return () => { stopped = true; clearInterval(timer); };
  }, [connected,state.status]);
  async function select(locale: Locale) {
    if (!descriptor || !service.current) throw new Error("NATIVE_HOST_REQUIRED");
    seq.current += 1n;
    try {
      const receipt = await call("ux.locale.select", { serviceInstanceId:service.current,
        commandId:crypto.randomUUID(),selectionChannelId:descriptor.locale.selectionChannelId,
        selectionSeq:seq.current.toString(),locale });
      apply(receipt.localeState);
    } catch (error) {
      if((error as {authoritative?:boolean}).authoritative)return;
      // 已接收但未返回的写入需要重查；有效语言始终来自真实snapshot。
      apply({ ...current.current,status:"reconciling",lastError:String(error) }); await refresh().catch(() => {});
    }
  }
  function t(key: keyof typeof en, parameters: Record<string,string|number> = {}): string {
    const dictionary = messages[state.effectiveLocale] ?? messages.en;
    const message = dictionary[key] ?? messages.en[key] ?? messages.en.unavailable;
    if (!dictionary[key]) missing.current.add(state.effectiveLocale + ":" + key);
    return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name: string) => String(parameters[name] ?? ""));
  }
  return <Context.Provider value={{ state,descriptor,ready,select,refresh,t }}>{children}</Context.Provider>;
}
