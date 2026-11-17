// 将本包SVG整理为独立命名图层，保留真实文本；不伪造任何平台原生组件。
export function prepareImportSvg(xml,job,xmljs){
 const doc=xmljs.xml2js(xml,{compact:false});const root=doc.elements.find(e=>e.name==='svg');let count=0;const seen=new Set(),refs=new Map();
 const clean=v=>String(v||'').replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g,'_').slice(0,105);
 const textOf=n=>(n.elements||[]).map(x=>x.type==='text'?x.text:textOf(x)).join('');
 function walk(n){if(n.type!=='element')return;n.attributes||={};const old=n.attributes.id;let label=n.attributes['data-name']||n.attributes['data-field-id']||old||(n.name==='text'?'文字_'+textOf(n).slice(0,28):({rect:'形状',path:'路径',circle:'圆形',ellipse:'椭圆',line:'线条',g:'分组',svg:'画板',defs:'定义',pattern:'纹理',linearGradient:'渐变',stop:'色标'}[n.name]||n.name));let id=clean(job.id)+'__'+String(++count).padStart(4,'0')+'__'+clean(label);n.attributes.id=id;n.attributes['data-name']=label;if(old&&!refs.has(old))refs.set(old,id);seen.add(id);for(const c of n.elements||[])walk(c);}
 walk(root);function rewrite(n){if(n.attributes)for(const [k,v]of Object.entries(n.attributes)){if(typeof v==='string'){n.attributes[k]=v.replace(/url\(#([^)]*)\)/g,(s,id)=>'url(#'+(refs.get(id)||id)+')');if(['href','xlink:href'].includes(k)&&v.startsWith('#'))n.attributes[k]='#'+(refs.get(v.slice(1))||v.slice(1));}}for(const c of n.elements||[])rewrite(c);}rewrite(root);root.attributes['data-design-version']='ui-full-20261117-draft.2';return {svg:xmljs.js2xml(doc,{compact:false,spaces:0}),named_elements:count};
}
