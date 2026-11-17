// 语义控件与稳定testId并用；原生dialog负责焦点范围，Escape不丢弃草稿。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "./localization";
import type { Locale } from "../../host-contract/editor-ux";
export function Icon({ name }: { name: string }) {
  const symbols:Record<string,string>={workflow:"nodes",assets:"box",clock:"history",help:"info"};
  if(name==="play")return <svg className="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5 19 12 8 19Z"/></svg>;
  return <svg className="icon" aria-hidden="true"><use href={"/assets/界面图标集.svg#" + (symbols[name] ?? name)}/></svg>;
}
export function Dialog({ title,onClose,children,id }: { title:string;onClose:()=>void;children:ReactNode;id:string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t }=useLocale();
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog ref={dialog} className="dialog" aria-labelledby={id + "-title"}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-head"><h2 id={id + "-title"}>{title}</h2>
      <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>×</button></div>
    {children}
  </dialog>;
}
export function LanguagePicker({ onClose }: { onClose:()=>void }) {
  const { t,state,descriptor,select,refresh,localeNotice } = useLocale();
  const [last,setLast] = useState<Locale | null>(null);
  const options = descriptor?.locale.supportedLocales ?? [
    {id:"en",nativeName:"English"},{id:"zh-Hans",nativeName:"简体中文"},{id:"zh-Hant",nativeName:"繁體中文"},
    {id:"ja",nativeName:"日本語"},{id:"ko",nativeName:"한국어"},{id:"es",nativeName:"Español"},{id:"fr",nativeName:"Français"},
  ] as const;
  return <Dialog id="language-picker" title={t("language")} onClose={onClose}>
    <p className="muted">{t("languageNote")}</p>
    <div className="language-list" role="group" aria-label={t("language")}>
      {options.map(option => <button type="button" key={option.id} lang={option.id}
        data-testid={"locale-" + option.id} aria-pressed={state.effectiveLocale === option.id}
        disabled={!descriptor || state.status === "read_only" || state.status === "reconciling"}
        className={state.effectiveLocale === option.id ? "language-option selected" : "language-option"}
        onClick={() => { setLast(option.id); void select(option.id); }}>
        <span>{option.nativeName}</span>
        <span aria-hidden="true">{state.pending?.locale === option.id ? "…" : state.effectiveLocale === option.id ? "✓" : ""}</span>
      </button>)}
    </div>
    <div className="locale-status" role="status" aria-live="polite">
      {state.status === "idle" && localeNotice?.locale === state.effectiveLocale && <p key={localeNotice.id}>{t("languageSaved")}</p>}
      {state.status === "saving" && t("savingLanguage")}
      {state.status === "failed" && <><p>{t("languageFailed")}</p><button onClick={() => last && void select(last)}>{t("retry")}</button></>}
      {state.status === "reconciling" && <><p>{t("languageUnknown")}</p><button onClick={() => void refresh()}>{t("refresh")}</button></>}
      {state.status === "read_only" && t("readOnly")}
    </div>
    <button className="button full" onClick={onClose}>{t("close")}</button>
  </Dialog>;
}
