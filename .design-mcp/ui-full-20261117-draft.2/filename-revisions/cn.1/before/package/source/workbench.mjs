// 逐操作面设计；字段都绑定稳定标识，复杂字段另有完整展开稿。
import {D} from './drawing.mjs';
import {inferVisual,drawVisual} from './visuals-current.mjs';
export const flattenControls=function flattenControls(surface){
 const rows=[];
 function walk(f,parent=""){const id=surface.id+"::"+f.id;rows.push({...f,surface_id:surface.id,surface_title:surface.title,parent_page_id:surface.parent_page_id,coverage_id:id,parent_id:parent,record_kind:f.subfields?.length?"group":"control"});for(const sub of f.subfields||[])walk(sub,id);}
 for(const f of surface.fields||[])walk(f);return rows;
};
export const frame=function frame(s,platform,W,H,subtitle="",options={}){
 const {C,rect:R,text:T,line:L,icon:I,pill:P,button:B,fit,esc}=D,mobile=platform==="android";
 let a=R(0,0,W,H,C.bg,0);
 const key=s.parent_page_id||"projects";
 const group=/chat|session|assistant|model|mcp|skill|permission/.test(key)?"创作":/map|world|level|quest|rpg|slg|data|economy|tools/.test(key)?"世界与玩法":/scene|prefab|camera|control|physic|particle|animation|skeleton|game-ui/.test(key)?"画面":/asset|audio|generate/.test(key)?"资源":/workflow|node|graph/.test(key)?"工作流":/publish|target|build/.test(key)?"发布":/lan|engine/.test(key)?"互通":"项目";
 if(!mobile){
  a+=R(0,0,184,H,"white",0)+L(184,0,184,H)+R(20,22,33,33,C.blue,9)+I(26,28,"nodes",21,"white")+T(64,44,"GameGen",20,C.ink,700)+T(20,84,"AIMETA · GAME STUDIO",10,C.muted,600);
  [["项目","grid"],["创作","chat"],["画面","scene"],["工作流","nodes"],["资源","box"],["世界与玩法","layers"],["发布","globe"]].forEach(([z,ic],i)=>{let yy=111+i*47;a+=(z===group?R(12,yy,160,39,C.soft,8):"")+I(25,yy+10,ic,19,z===group?C.blue:C.muted)+T(55,yy+25,z,13,z===group?C.blue:C.ink,z===group?600:400);});
  a+=L(20,458,164,458)+T(24,489,"本地工作区",11,C.muted);
  [["附近设备","sync"],["版本与恢复","history"],["帮助与学习","info"]].forEach(([z,ic],i)=>a+=I(25,508+i*40,ic,18)+T(55,523+i*40,z,12));
  a+=R(14,H-116,156,52,C.bg,9)+I(26,H-102,"shield",18,C.green)+T(52,H-88,"项目仅保存在本机",11,C.muted)+I(25,H-42,"settings",19)+T(55,H-27,"偏好与扩展",12);
  a+=R(185,0,W-185,68,"white",0)+L(185,68,W,68)+I(208,23,"folder",19)+T(237,39,"星溪冒险",13,C.ink,600)+T(334,39,"/  "+group,12,C.muted)+P(W-427,21,"示例项目 · r128","green",151)+B(W-257,15,"试玩",false,94,38)+B(W-150,15,"导出游戏",true,126,38);
  a+=T(208,111,fit(s.title,W-425,23),23,C.ink,600)+T(208,139,fit(subtitle||s.task||"",W-340,12),12,C.muted)+B(W-153,89,"全部属性",false,129,37);
 }else{
  a+=R(0,0,W,94,"white",0)+T(21,22,"9:41",12,C.ink,600)+T(W-21,22,"▰  ▮",11,C.ink,500,"end")+I(17,49,"back",23,C.ink)+T(52,66,"星溪冒险",17,C.ink,600)+I(W-88,49,"history",21)+I(W-45,49,"more",22)+L(0,94,W,94);
  const tt=D.wrap(s.title,W-34,20,2);tt.forEach((z,i)=>a+=T(17,124+i*25,z,20,C.ink,600));
  if(tt.length<2)a+=T(17,146,fit(subtitle||s.task||"",W-34,11),11,C.muted);
  if(!options.noBottom){a+=R(0,H-72,W,72,"white",0)+L(0,H-72,W,H-72);[["对话","chat"],["画面","scene"],["工作流","nodes"],["资源","box"],["更多","grid"]].forEach(([z,ic],i)=>{const col=z===group||z==="对话"&&group==="创作"||z==="更多"&&/项目|世界与玩法|发布|互通/.test(group)?C.blue:C.muted;a+=I(26+i*78,H-60,ic,22,col)+T(38+i*78,H-23,z,11,col,500,"middle");});a+=R(139,H-9,112,4,C.ink,2);}
 }
 return a;
};
export const renderSurface=function renderSurface(s,platform,mode="normal",domainState=null){
 const {C,rect:R,text:T,line:L,icon:I,pill:P,button:B,circle:O,group:G,fit,lines,esc}=D,mobile=platform==="android";
 const W=mobile?390:1440;
 const list=flattenControls(s),leaf=list.filter(f=>f.record_kind==="control"),kind=inferVisual(s);
 const formKinds=new Set(["create","project-settings","preferences","inputs","model-form","model-auth","stdio","oauth","api","http","message","schema","protocol","signature","apk","h5","wechat","douyin","grant"]);
 const blocked=!!domainState&&/只读|权限|拒绝|无权|损坏|非法|不兼容|不支持|缺|未就绪|结果未知|提交中|保存中|运行中|队列满/.test((domainState.name||"")+" "+(domainState.trigger||""));
 const formPage=formKinds.has(kind)&&s.form!=="dialog"&&s.form!=="drawer";
 const full=mode==="fields";
 let positions=[],actionPositions=[],H=mobile?844:960,body="";
 const stateOptions=domainState?String(domainState.actions||"查看并处理").split(/[\/；，、]/).filter(Boolean):[];
 const stateText=domainState?{content:D.wrap(domainState.content||domainState.trigger||"",mobile?322:612,12,30),recovery:D.wrap(domainState.recovery||"",mobile?322:612,11,30)}:null;
 const stateCardH=domainState?110+(stateText.content.length+stateText.recovery.length)*21+stateOptions.length*52:0;
 const top=mobile?169:170,bx=mobile?16:208,bw=mobile?358:1208;
 function makeFields(x,y,w,fields,maxHeight=Infinity,annotate=false){
  let str="",yy=y,drawn=[];
  for(const f of fields){const rr=D.control(f,x,yy,w,{mobile});if(yy+rr.height>y+maxHeight)break;
   str+=blocked?`<g opacity=".58">${rr.svg}</g>`:rr.svg;drawn.push({id:f.coverage_id,x,y:yy,w,h:rr.height});
   yy+=rr.height+10;
   if(annotate){str+=T(x,yy+4,fit(f.validation||"",w,10),10,C.muted);yy+=22;}
  }
  return {svg:str,height:yy-y,positions:drawn};
 }
 if(full){
  const colW=mobile?358:546,gap=28,xx=mobile?16:252,ys=[top+78,top+78];
  body+=R(bx,top,bw,58,C.soft,10)+T(bx+17,top+24,"完整属性 · 含高级字段与展开子控件",mobile?13:16,C.ink,600)+T(bx+17,top+45,"当前操作面全部控件已展开，校验与显示条件见交接索引。",mobile?10:12,C.muted);
  let idx=0;
  for(const f of s.fields||[]){
   const col=mobile?0:idx++%2,x=xx+col*(colW+gap),y=ys[col];
   const children=list.filter(r=>r.coverage_id===s.id+"::"+f.id||r.parent_id===s.id+"::"+f.id);
   if(f.subfields?.length){
    const title=wrapText(f.label,colW-24,14);
    const headH=24+title.length*20;
    body+=R(x-12,y-8,colW+24,headH,C.soft,9)+title.map((a,i)=>T(x,y+14+i*20,a,14,C.blue,600)).join("");
    positions.push({id:s.id+"::"+f.id,x,y,w:colW,h:headH});
    const rr=makeFields(x,y+headH+8,colW,children.filter(z=>z.record_kind==="control"),Infinity,true);
    body+=rr.svg;positions.push(...rr.positions);ys[col]=y+headH+rr.height+34;
   }else{
    const row=list.find(r=>r.coverage_id===s.id+"::"+f.id);
    const rr=makeFields(x,y,colW,[row],Infinity,true);body+=rr.svg;positions.push(...rr.positions);ys[col]=y+rr.height+27;
   }
  }
  const end=Math.max(...ys)+23;
  const actions=s.actions||[];
  actions.forEach((ac,i)=>{const ax=mobile?16:252+(i%3)*370,ay=end+(mobile?i:Math.floor(i/3))*58,aw=mobile?358:346;body+=B(ax,ay,ac.label,i===0,aw,44,s.scope!=="L"||blocked);actionPositions.push({id:s.id+"::"+ac.id,x:ax,y:ay,w:aw,h:44,label:ac.label});});
  H=Math.max(H,end+(mobile?actions.length:Math.ceil(actions.length/3))*58+122);
 }else if(formPage){
  let cols=mobile?1:2,cw=mobile?358:542,xx=mobile?16:234,ys=Array(cols).fill(top+26);
  body+=R(bx,top,bw,mobile?Math.max(508,leaf.length*96+98):Math.max(670,Math.ceil(leaf.length/2)*95+116),"white",12,C.line);
  const fields=leaf.length?leaf:list;
  fields.forEach((f,i)=>{let col=i%cols,x=xx+col*(cw+40),rr=D.control(f,x,ys[col],cw,{mobile});body+=rr.svg;positions.push({id:f.coverage_id,x,y:ys[col],w:cw,h:rr.height});ys[col]+=rr.height+14;});
  const end=Math.max(...ys)+23;H=Math.max(H,end+150);
  body+=B(xx,end,s.actions?.[0]?.label||"保存配置",true,mobile?358:182,44,s.scope!=="L"||blocked);
  if(s.actions?.[1])body+=B(mobile?xx:xx+198,mobile?end+55:end,s.actions[1].label,false,mobile?358:168,44);
 }else{
  const canvasX=mobile?16:208,canvasY=top,canvasW=mobile?358:s.form==="drawer"?746:898,canvasH=mobile?276:620;
  body+=G(canvasX,canvasY,drawVisual(kind,canvasW,canvasH,s));
  if(!mobile){
   const px=s.form==="drawer"?978:1128,pw=s.form==="drawer"?438:288;
   body+=R(px,top,pw,688,"white",12,C.line)+T(px+17,top+28,s.form==="drawer"?"编辑详情":"当前属性",14,C.ink,600)+T(px+17,top+51,fit(s.title,pw-34,11),11,C.muted)+L(px,top+65,px+pw,top+65);
   const rr=makeFields(px+17,top+83,pw-34,leaf,489,false);body+=rr.svg;positions.push(...rr.positions);
   body+=B(px+16,top+598,"查看全部 "+leaf.length+" 项属性",false,pw-32,36)+B(px+16,top+644,s.actions?.[0]?.label||"应用修改",true,pw-32,36,s.scope!=="L"||blocked);
   const yy=817;
   body+=R(208,yy,898,65,"white",10,C.line)+I(224,yy+22,"info",19,C.blue)+T(253,yy+27,fit(s.task||"选择内容后继续编辑",829,12),12,C.ink)+T(253,yy+49,"草稿 → 校验 → 提交 → 已保存；预览与查询不修改工程",11,C.muted);
  }else{
   body+=R(16,top+290,358,36,"white",8,C.line)+T(28,top+314,"属性",13,C.ink,600)+T(360,top+314,"全部 "+leaf.length+" 项  →",12,C.blue,500,"end");
   const rr=makeFields(16,top+339,358,leaf,172,false);body+=rr.svg;positions.push(...rr.positions);
   body+=B(16,top+535,s.actions?.[0]?.label||"应用修改",true,358,44,s.scope!=="L"||blocked);
  }
  if(s.form==="dialog"){
   const dw=mobile?358:756,dx=(W-dw)/2,dy=mobile?167:188;
   body+=R(184*(mobile?0:1),68,W-184*(mobile?0:1),(mobile?772:960)-68,"#163354",0).replace('fill="#163354"','fill="#163354" fill-opacity=".20"');
   const ww=dw-44,rr=makeFields(dx+22,dy+87,ww,leaf,mobile?395:434,false);
   const dh=Math.min(mobile?578:642,rr.height+172);
   body+=R(dx,dy,dw,dh,"white",16)+T(dx+22,dy+37,fit(s.title,dw-70,mobile?17:22),mobile?17:22,C.ink,600)+I(dx+dw-42,dy+21,"close",21)+T(dx+22,dy+65,fit(s.task||"",dw-44,12),12,C.muted)+rr.svg;
   positions.push(...rr.positions);
   body+=B(dx+22,dy+dh-62,s.actions?.[0]?.label||"确认",true,mobile?dw-44:210,44,s.scope!=="L"||blocked);
   if(!mobile)body+=B(dx+246,dy+dh-62,"取消",false,120,44);
  }
 }
 function wrapText(t,w,z){return D.wrap(t,w,z,3);}
 if(domainState)H=Math.max(H,(mobile?456:550)+stateCardH+100);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">${esc(s.title)} · ${mobile?"Android":"桌面"} · ${full?"完整属性":domainState?.name||"默认"}</title><desc id="desc">GameGen 可编辑设计资产，示例数据。${esc(s.id)}。${esc(s.task||"")}</desc>${D.defs}`;
 svg+=frame(s,platform,W,H,full?"展开字段与子控件，保持该操作面上下文":s.task);
 svg+=body;
 if(s.scope!=="L")svg+=P(mobile?18:208,mobile?137:119,s.scope==="R"?"后续联网 / 平台能力设计":"未来扩展 · 设计索引","amber",mobile?264:292);
 if(domainState){
  const sw=mobile?358:648,xx=mobile?16:280,yy=mobile?456:550;
  const hh=stateCardH;
  const tone=/错|失败|非法|拒绝|失效|损坏|冲突/.test(domainState.name)?C.rose:C.cream;
  svg+=R(xx,yy,sw,hh,"white",13,C.line)+R(xx+1,yy+1,sw-2,47,tone,12)+I(xx+15,yy+14,"info",19,/错|失败|非法/.test(domainState.name)?C.red:C.amber)+T(xx+43,yy+31,fit(domainState.name,sw-65,15),15,C.ink,600);
  let sy=yy+74;
  for(const row of stateText.content){svg+=T(xx+18,sy,row,12,C.ink);sy+=21;}
  sy+=14;
  for(const row of stateText.recovery){svg+=T(xx+18,sy,row,11,C.muted);sy+=21;}
  sy+=12;
  for(const [i,label] of stateOptions.entries()){svg+=B(xx+18,sy,label,i===0,sw-36,42);actionPositions.push({id:s.id+"::"+domainState.id+"::action-"+(i+1),label,x:xx+18,y:sy,w:sw-36,h:42});sy+=52;}

 }
 if(!mobile)svg+=L(208,H-27,W-24,H-27)+T(208,H-9,"星溪冒险  ·  主分支  ·  本机项目",10,C.muted)+T(W-24,H-9,full?"完整属性展开稿":"设计夹具 · 状态仅用于排版",10,C.muted,400,"end");
 svg+="</svg>";
 return {svg,width:W,height:H,fields:positions,actions:actionPositions,kind};
};
