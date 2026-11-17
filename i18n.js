/* 四语只作用于展示文案；输入值和项目文档不参与翻译，语言切换不产生项目事务。 */
/* exported I18n -- 各编辑模块复用同一本地语言目录。 */
'use strict';
const I18n = (() => {
  const supported = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'];
  const names = ['简体中文', 'English', '日本語', '한국어'];
  const storageKey = 'gamegen-ui-language-v1';
  const catalogs = new Map();
  const sources = new Map();
  const sourceById = new Map();
  const textRecords = new WeakMap();
  const attrRecords = new WeakMap();
  const missing = new Set();
  const listeners = new Set();
  const unmapped = new Set();
  const skip = 'script,style,textarea,pre,code,[translate="no"],[data-i18n-skip],[contenteditable="true"]';
  let segments;
  let numberTemplates = [];
  let observer;
  let preference = 'system';
  let titleSource = '';
  let titleLast = '';
  // 只存独立的界面偏好；存储不可用时仍允许本次会话切换。
  try { preference = localStorage.getItem(storageKey) || 'system'; } catch { /* 隐私模式下使用内存偏好。 */ }
  const requested = new URLSearchParams(location.search).get('lang');
  if (requested && (requested === 'system' || supported.includes(requested))) preference = requested;
  if (preference !== 'system' && !supported.includes(preference)) preference = 'system';
  function systemLocale(language = navigator.language) {
    if (/^ja(?:-|$)/i.test(language)) return 'ja-JP';
    if (/^ko(?:-|$)/i.test(language)) return 'ko-KR';
    if (/^en(?:-|$)/i.test(language)) return 'en-US';
    return 'zh-CN';
  }
  function locale() { return preference === 'system' ? systemLocale() : preference; }
  function escapePattern(value) { return [...value].map(c => [92,46,42,43,63,94,36,123,125,40,41,124,91,93].includes(c.charCodeAt(0)) ? String.fromCharCode(92) + c : c).join(''); }
  // 目录ID独立于翻译结果；数字模板只替换数值，不改变变量名、路径或项目参数。
  function define(entries) {
    for (const entry of entries) { sources.set(entry.source, entry.id); sourceById.set(entry.id, entry.source); }
    const keys = [...sources.keys()].sort((a, b) => b.length - a.length);
    segments = new RegExp(keys.map(escapePattern).join('|'), 'g');
    numberTemplates = keys.filter(s => s.length > 6 && /[0-9]/.test(s)).map(source => ({
      source, id: sources.get(source), pattern: new RegExp('^' + source.split(/([0-9]+)/).map((p, i) =>
        i % 2 ? '([0-9]+)' : escapePattern(p)).join('') + '$'),
    }));
  }
  function register(language, messages) { if (supported.includes(language)) catalogs.set(language, messages); }
  function message(id) {
    if (locale() === 'zh-CN') return sourceById.get(id);
    const translated = catalogs.get(locale())?.[id];
    if (typeof translated === 'string' && translated.length) return translated;
    missing.add(locale() + ':' + id);
    return sourceById.get(id);
  }
  function translate(value, protectedTerms = []) {
    if (protectedTerms.length) {
      let masked = String(value);
      const tokens = [];
      for (const term of protectedTerms) {
        if (!term) continue;
        const token = String.fromCharCode(0xe100 + tokens.length);
        tokens.push([token, term]);
        masked = masked.split(term).join(token);
      }
      let result = translate(masked);
      for (const [token, term] of tokens) result = result.split(token).join(term);
      return result;
    }
    const original = String(value);
    if (locale() === 'zh-CN' || !segments) return original;
    const body = original.trim();
    if (!body) return original;
    const exact = sources.get(body);
    if (exact) return original.replace(body, message(exact));
    for (const template of numberTemplates) {
      const matched = body.match(template.pattern);
      if (!matched) continue;
      let index = 0;
      const output = message(template.id).replace(/[0-9]+/g, n => matched[++index] ?? n);
      return original.replace(body, output);
    }
    const result = original.replace(segments, source => message(sources.get(source)));
    if (result === original && /[\u3400-\u9fff]/.test(original)) unmapped.add(original);
    return result;
  }
  // 受保护文本以独立元素标注，既避免HTML注入，也避免静态术语匹配改写用户内容。
  function user(value) {
    const safe = String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return '<span translate="no" data-i18n-user>' + safe + '</span>';
  }
  function picker(id = 'ui-language') {
    return '<label class="language-picker">' + '<span>界面语言</span><select id="' + id + '" data-ui-language aria-label="界面语言">'
      + '<option value="system"' + (preference === 'system' ? ' selected' : '') + '>跟随系统</option>'
      + supported.map((language, i) => '<option translate="no" value="' + language + '"'
        + (preference === language ? ' selected' : '') + '>' + names[i] + '</option>').join('') + '</select></label>';
  }
  // 属性中只记录需要保留的名称，不参与业务逻辑或项目序列化。
  function terms(value) {
    const safe = JSON.stringify([String(value)]).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return ' data-i18n-terms="' + safe + '"';
  }
  function protectedTerms(element) {
    try { const data = JSON.parse(element.closest('[data-i18n-terms]')?.dataset.i18nTerms || '[]');
      return Array.isArray(data) ? data.filter(t => typeof t === 'string').slice(0,80) : [];
    } catch { return []; }
  }
  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const record = textRecords.get(node);
    const source = record && record.last === node.nodeValue ? record.source : node.nodeValue;
    const last = translate(source, protectedTerms(node.parentElement));
    textRecords.set(node, {source, last});
    if (node.nodeValue !== last) node.nodeValue = last;
  }
  function translateAttributes(element) {
    if (element.closest(skip.replace("textarea,", ""))) return;
    const records = attrRecords.get(element) || {};
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (!element.hasAttribute(name)) continue;
      const value = element.getAttribute(name);
      const prior = records[name];
      const source = prior && prior.last === value ? prior.source : value;
      const last = translate(source, protectedTerms(element));
      records[name] = {source, last};
      if (last !== value) element.setAttribute(name, last);
    }
    attrRecords.set(element, records);
  }
  function watch() {
    observer?.observe(document.body, {subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt']});
  }
  // 原位更新文本保留DOM、焦点、草稿和滚动位置；不重新渲染工作流或表单。
  function apply() {
    observer?.disconnect();
    document.documentElement.lang = locale();
    document.documentElement.dataset.locale = locale();
    for (const option of document.querySelectorAll('option:not([value])')) option.value = option.textContent;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateText(node);
    for (const element of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) translateAttributes(element);
    if (document.title !== titleLast) titleSource = document.title;
    titleLast = translate(titleSource);
    document.title = titleLast;
    document.querySelectorAll('[data-ui-language]').forEach(select => { select.value = preference; });
    watch();
  }
  function setLocale(value, persist = true) {
    preference = value === 'system' || supported.includes(value) ? value : 'system';
    if (persist) { try { localStorage.setItem(storageKey, preference); } catch { /* 本次选择仍立即生效。 */ } }
    const query = new URLSearchParams(location.search);
    query.set('lang', preference);
    history.replaceState(null, '', '?' + query);
    apply();
    listeners.forEach(listener => listener());
  }
  function start() {
    if (observer) return;
    observer = new MutationObserver(() => apply());
    document.addEventListener('change', event => {
      if (event.target.matches('[data-ui-language]')) setLocale(event.target.value);
    }, true);
    window.addEventListener('languagechange', () => { if (preference === 'system') { apply(); listeners.forEach(listener => listener()); } });
    apply();
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function diagnostics() { return { locale: locale(), preference, missing: [...missing], unmapped: [...unmapped], sourceCount: sources.size }; }
  return { define, register, translate, user, terms, subscribe, picker, apply, setLocale, start, locale, systemLocale,
    preference: () => preference, diagnostics, supported: [...supported] };
})();
