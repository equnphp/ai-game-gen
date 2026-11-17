// 各专业工作台的可编辑示例图形；无模型/设备/业务调用。
import {D} from './drawing.mjs';
export const inferVisual=function inferVisual(s){
 const n=Number(s.id?.match(/(\d+)$/)?.[1]||0),family=s.id?.split("-")[1];
 if(family==="GL")return ["","tasks","preferences","tools","host","inbox","history-diff","files","save-preview"][n]||"table";
 if(family==="CH")return ["","chat","chat-input","questions","model-list","skill-list","context","plan","sessions","run-result","activity"][n]||"chat";
 const st={1:"projects",2:"create",3:"templates",4:"project-settings",5:"project-menu",6:"package",7:"package",8:"history",9:"recovery",10:"preferences",11:"scene",12:"scene",13:"components",14:"references",15:"prefab",16:"prefab",17:"prefab-diff",18:"scene",19:"camera",20:"inputs",21:"controls",22:"game-ui",23:"game-ui",24:"assets",25:"asset-detail",26:"asset-picker",27:"asset-import",28:"slicer",29:"tileset",30:"font",31:"resource-diff",32:"budget",33:"physics",34:"collision",35:"collision-matrix",36:"joint",37:"particles",38:"particle-curve",39:"timeline",40:"curves",41:"timeline",42:"skeleton",43:"weights",44:"ik",45:"skeleton-import",46:"animation-graph",47:"wave",48:"mixer",49:"sound-candidates",50:"preview",51:"diagnostics",52:"save-preview",53:"localization",54:"localization-import"};
 const gm={1:"maps",2:"map-create",3:"map",4:"projection-diff",5:"map-brush",6:"tileset",7:"map-layers",8:"map-height",9:"map-path",10:"footprint",11:"building",12:"occlusion",13:"directions",14:"region",15:"map-path",16:"minimap",17:"world-graph",18:"map-generate",19:"map-diff",20:"map",21:"levels",22:"level",23:"goals",24:"waves",25:"checkpoint",26:"rewards",27:"campaign",28:"world-graph",29:"schema",30:"table",31:"table-import",32:"formula",33:"growth",34:"simulation",35:"chart",36:"character",37:"skill",38:"buff",39:"item",40:"inventory",41:"loot",42:"behavior",43:"quests",44:"dialogue",45:"quest-progress",46:"building",47:"recipe",48:"queue",49:"technology",50:"army",51:"territory",52:"idle",53:"turn",54:"match",55:"puzzle",56:"cards",57:"card-zones",58:"rhythm",59:"race",60:"sport",61:"tactics",62:"rogue",63:"idle",64:"templates",65:"runner",66:"combat"};
 const wn={1:"graph",2:"nodes",3:"graph",4:"graph-connect",5:"variables",6:"subgraph",7:"graph-diff",8:"parallel",9:"debug",10:"debug",11:"event-log",12:"ai-diff",13:"changes",14:"model-list",15:"model-form",16:"model-auth",17:"diagnostics",18:"activity",19:"mcp-type",20:"stdio",21:"oauth",22:"tool-catalog",23:"permission",24:"skill-import",25:"skill-editor",26:"skill-diff",27:"api",28:"http",29:"message",30:"schema",31:"api-import",32:"api-review",33:"api-diff",34:"protocol",35:"compatibility",36:"api-sim",37:"connection",38:"devices",39:"pair",40:"grant",41:"content",42:"shared-assets",43:"sync-plan",44:"transfer",45:"lan-diff",46:"network",47:"received",48:"engine-import",49:"engine-analysis",50:"engine-mapping",51:"migration",52:"pipeline",53:"engine-diff",54:"migration-report",55:"offline",56:"signature",57:"apk",58:"h5",59:"wechat",60:"douyin",61:"preflight",62:"pipeline",63:"operations",64:"ledger",65:"future",66:"server-graph",67:"database",68:"aoi",69:"rooms",70:"zones",71:"deployment",72:"audit",73:"ledger",74:"image-candidates",75:"inbox"};
 return (family==="ST"?st:family==="GM"?gm:wn)[n]||"table";
};
export const drawVisual=function drawVisual(kind,w,h,s){
 const {C,rect:R,text:T,line:L,icon:I,pill:P,button:B,circle:O,group:G,fit,lines,esc}=D;
 const mobile=w<500,pad=mobile?14:22;
 let a=R(0,0,w,h,"#FFFFFF",11,C.line);
 const top=(title,sub)=>T(pad,29,title,mobile?14:16,C.ink,600)+(sub?T(pad,53,fit(sub,w-pad*2,11),11,C.muted):"");
 const list=(items,y=66,ico="box")=>items.map((r,i)=>{let yy=y+i*66;return R(pad,yy,w-pad*2,57,i===0?C.soft:"#FFFFFF",8,C.line)+I(pad+12,yy+14,ico,20,i===0?C.blue:C.muted)+T(pad+43,yy+24,fit(r[0],w-pad*2-75,12),12,C.ink,600)+T(pad+43,yy+45,fit(r[1]||"",w-pad*2-75,11),11,C.muted)+I(w-pad-26,yy+19,"arrow",15);}).join("");
 const table=(heads,data,y=67)=>{const hh=mobile?heads.slice(0,2):heads,ww=(w-pad*2)/hh.length;let q=R(pad,y,w-pad*2,38,C.bg,6);hh.forEach((x,i)=>q+=T(pad+12+i*ww,y+24,fit(x,ww-20,11),11,C.muted,500));data.slice(0,Math.floor((h-y-42)/46)).forEach((r,i)=>{let yy=y+38+i*46;q+=L(pad,yy,w-pad,yy);hh.forEach((_,j)=>q+=T(pad+12+j*ww,yy+29,fit(String(r[j]??""),ww-18,12),12,j?C.muted:C.ink,j?400:500));});return q;};
 const avatar=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="80" rx="38" ry="8" fill="#C9D5E7"/><path d="M-25-10h50l11 58-36 18-36-18Z" fill="#6489D5"/><circle cy="-39" r="25" fill="#F2C6A8"/><path d="M-27-38q27-49 54 0v-17q-28-31-54 17" fill="#3E5275"/><path d="m-20 47-7 27m47-27 7 27" stroke="#354F72" stroke-width="14" stroke-linecap="round"/><path d="M-25 0-43 30M25 0l38 22" stroke="#F2C6A8" stroke-width="12" stroke-linecap="round"/></g>`;
 const diamond=(x,y,ww=27,c="#6BA3E9")=>`<path d="M${x} ${y-ww}l${ww*.7} ${ww*.5}-${ww*.2} ${ww}- ${ww*.5} ${ww*.5}-${ww*.5}-${ww*.5}-${ww*.2}-${ww}Z" fill="${c}"/>`.replace(/- /g,"-");
 function tilemap(mode="map"){
  let q=R(0,0,w,h,"#EAF2F4",11);
  const unit=Math.min(w/11.4,h/7.6),cx=w*.5,cy=h*.19,th=unit*.5;
  q+=`<ellipse cx="${cx}" cy="${h*.78}" rx="${unit*3.7}" ry="${unit*1.45}" fill="#D3E1E6"/>`;
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
   const x=cx+(i-j)*unit*.5,y=cy+(i+j)*th*.5,water=i===0||j===7,z=/height|occlusion/.test(mode)&&i>3&&j>2&&j<5?unit*.32:0;
   q+=`<path d="M${x} ${y-z}l${unit*.5} ${th*.5}-${unit*.5} ${th*.5}-${unit*.5}-${th*.5}Z" fill="${water?"#95CEDF":(i+j)%2?"#BADFC7":"#ACD5BC"}" stroke="${water?"#7CBECE":"#99C6AB"}" stroke-width=".7"/>`;
   if(i===7||j===7)q+=`<path d="M${x-unit*.5} ${y+th*.5-z}l${unit*.5} ${th*.5} ${unit*.5}-${th*.5}v${unit*.35}l-${unit*.5} ${th*.5}-${unit*.5}-${th*.5}Z" fill="#759D8F"/>`;
   if([[1,3],[5,2],[2,5],[6,5]].some(z=>z[0]===i&&z[1]===j))q+=`<g transform="translate(${x} ${y-z-unit*.15})"><path d="M-3 3h6v20h-6Z" fill="#967959"/><path d="m0-30 19 34h-38Zm0-13 16 29h-32Z" fill="#3C9F7F"/></g>`;
   if(i===4&&j===3)q+=`<g transform="translate(${x} ${y-z})"><path d="M-22-10 0-22 22-10v29L0 31-22 19Z" fill="#DBC6A2"/><path d="m0-45 32 26L0-2-32-19Z" fill="#6E8DB7"/><path d="M6 8h10v17H6Z" fill="#4C6E9C"/></g>`;
  }
  const px=cx,py=cy+6*th*.5;
  q+=`<path d="M${px} ${py}l${unit*.5} ${th*.5}-${unit*.5} ${th*.5}-${unit*.5}-${th*.5}Z" fill="#246BEE" fill-opacity=".16" stroke="${C.blue}" stroke-width="2"/>`;
  if(/path|checkpoint|territory/.test(mode))q+=`<path d="M${cx-unit*1.5} ${cy+th*1.8}l${unit*1.5} ${th*1.5} ${unit*1.5}-${th*1.5}" fill="none" stroke="${C.blue}" stroke-width="4" stroke-dasharray="5 7"/>`;
  if(/footprint|building|region/.test(mode))q+=`<path d="M${cx-unit*1.5} ${cy+th*1.5}l${unit*2} ${th*2}-${unit*2} ${th*2}-${unit*2}-${th*2}Z" fill="${C.blue}" fill-opacity=".13" stroke="${C.blue}" stroke-width="2" stroke-dasharray="5 4"/>`;
  if(mode==="minimap")q+=R(w-112,65,94,104,"#FFFFFF",8,C.line)+T(w-101,86,"第 1 层",11,C.muted)+`<path d="M${w-99} 104h63v45h-63Z" fill="#87AFB7"/>`+O(w-67,123,5,C.blue);
  q+=R(12,12,mobile?150:194,30,"white",7)+T(22,32,fit(mode==="map-height"?"桥面 / 地面 · 独立通行":"当前面：地面 · 等距视图",mobile?134:180,11),11,C.muted);
  q+=R(12,h-43,mobile?191:238,29,"white",7)+T(23,h-24,/path/.test(mode)?"路径长度 8 · 本地示例":"选择  /  绘制  /  可走区",11,C.ink);
  return q;
 }
 const mapKinds=["map","map-create","map-brush","map-layers","map-height","map-path","footprint","building","occlusion","directions","region","minimap","checkpoint","territory","aoi"];
 const graphKinds=["graph","graph-connect","subgraph","parallel","debug","animation-graph","world-graph","campaign","behavior","dialogue","technology","recipe","server-graph","goals","quests","quest-progress"];
 if(mapKinds.includes(kind)){a=tilemap(kind);
  if(kind==="directions"){for(let i=0;i<8;i++){let ang=i*Math.PI/4;a+=O(w/2+Math.cos(ang)*w*.32,h/2+Math.sin(ang)*h*.3,13,i===0?C.blue:"white",C.line)+T(w/2+Math.cos(ang)*w*.32,h/2+Math.sin(ang)*h*.3+4,["E","SE","S","SW","W","NW","N","NE"][i],10,i===0?"white":C.muted,500,"middle");}}
 }else if(["skeleton","weights","ik"].includes(kind)){
  a=R(0,0,w,h,"#EFF3FA",11)+R(0,0,w,h,"url(#dots)",11)+top(kind==="weights"?"蒙皮网格 · 权重编辑":kind==="ik"?"挂点与 IK 约束":"骨架 · 绑定姿态","冒险家 / 右臂 · 不改变动画片段");
  const cx=w*.49,cy=h*.51,sc=Math.min(w/250,h/300);
  a+=avatar(cx,cy,sc);
  const pts=[[-20,-26],[2,-52],[22,-26],[29,14],[18,48],[-20,48],[-34,5]];
  if(kind==="weights"){
    pts.forEach((p,i)=>{let nx=pts[(i+1)%pts.length];a+=`<path d="M${cx} ${cy}L${cx+p[0]*sc} ${cy+p[1]*sc}L${cx+nx[0]*sc} ${cy+nx[1]*sc}Z" fill="${i%2?"#DF9555":"#EFCC62"}" fill-opacity=".42" stroke="#B58B58" stroke-width="1"/>`;});
    pts.forEach(p=>a+=O(cx+p[0]*sc,cy+p[1]*sc,3,C.white,C.blue,1.5));
    a+=O(cx+26*sc,cy+6*sc,26,"none",C.blue,1.5);
  }
  const bones=[[0,-42,0,-5],[0,-5,-23,12],[0,-5,28,15],[0,-5,0,45],[0,45,-20,72],[0,45,23,72]];
  bones.forEach(([x,y,x2,y2],i)=>{a+=L(cx+x*sc,cy+y*sc,cx+x2*sc,cy+y2*sc,i===2?C.blue:"#FFFFFF",i===2?5:3)+O(cx+x2*sc,cy+y2*sc,5,C.white,C.blue,2);});
  if(kind==="ik")a+=L(cx+28*sc,cy+15*sc,cx+76*sc,cy-11*sc,C.amber,2,"5 4")+O(cx+76*sc,cy-11*sc,11,"none",C.amber,2)+T(cx+64*sc,cy-30*sc,"目标点",11,C.amber);
  a+=P(14,h-40,kind==="weights"?"右臂 0.80 · 已选择顶点 6":"绑定姿态 · 可撤销","blue",mobile?238:270);
 }else if(["scene","camera","controls","inputs","components","preview","runner"].includes(kind)){
  a=R(0,0,w,h,"#DCECF0",11)+R(0,0,w,h,"url(#dots)",11);
  a+=R(0,h*.74,w,h*.26,"#A7C8B9",0)+R(w*.06,h*.67,w*.26,14,"#87B79D",3)+R(w*.45,h*.54,w*.3,14,"#87B79D",3)+R(w*.73,h*.72,w*.3,14,"#87B79D",3);
  a+=avatar(w*.33,h*.57,Math.min(h/420,w/460));
  for(let i=0;i<5;i++)a+=diamond(w*.47+i*w*.065,h*.39+(i%2)*13,11);
  if(kind!=="preview"){
    a+=R(w*.22,h*.3,w*.22,h*.43,"none",2,C.blue,1.5);
    [[.22,.3],[.44,.3],[.22,.73],[.44,.73]].forEach(([x,y])=>a+=R(w*x-3,h*y-3,6,6,"white",1,C.blue));
    a+=L(w*.33,h*.6,w*.52,h*.6,C.red,2)+L(w*.33,h*.6,w*.33,h*.33,C.green,2);
  }else{a+=P(14,14,"试玩 r128 · 独立进度","green",190)+R(14,h-73,86,54,"#FFFFFF",12)+T(27,h-40,"◁   ▷",21,C.blue)+O(w-45,h-47,24,"#FFFFFF",C.line)+T(w-45,h-40,"↑",24,C.blue,400,"middle");}
  if(kind==="camera")a+=R(w*.1,h*.13,w*.8,h*.7,"none",0,C.blue,2)+R(w*.23,h*.25,w*.48,h*.43,"none",0,C.amber,1.5);
  a+=P(14,kind==="preview"?51:14,kind==="preview"?"不包含未保存草稿":"主场景 · 当前对象：冒险家",kind==="preview"?"amber":"blue",mobile?244:275);
 }else if(kind==="game-ui"){
  a=R(0,0,w,h,"#EEF2F8",11)+top("游戏 UI · HUD 布局","组件树与数据绑定共用同一界面定义");
  const fx=mobile?28:70,fy=82,fw=w-fx*2,fh=h-120;
  a+=R(fx,fy,fw,fh,"#CFE2E3",8,C.line)+R(fx+8,fy+9,fw-16,fh-18,"none",0,"#A7B4C9",1);
  a+=R(fx+16,fy+19,Math.min(170,fw*.55),39,C.white,8)+T(fx+28,fy+45,"★  120",18,C.ink,600);
  a+=R(fx+16,fy+74,Math.min(190,fw*.62),14,"#DCE6F2",7)+R(fx+16,fy+74,Math.min(190,fw*.62)*.72,14,"#55A88D",7);
  a+=R(fx+fw-58,fy+19,39,39,C.white,8)+I(fx+fw-49,fy+28,"pause",21,C.blue);
  a+=R(fx+11,fy+14,Math.min(180,fw*.58),50,"none",1,C.blue,2)+L(fx,fy+39,fx+80,fy+39,C.blue,1,"4 3");
  a+=R(fx+fw*.25,fy+fh*.69,fw*.5,42,C.blue,9)+T(fx+fw*.5,fy+fh*.69+27,"继续冒险",14,"white",600,"middle");
  a+=P(14,h-36,"已选中：金币文本 / player.coins","blue",mobile?300:315);
 }else if(["physics","collision","collision-matrix","joint","skill","combat"].includes(kind)){
  a=R(0,0,w,h,"#EFF4F9",11)+R(0,0,w,h,"url(#dots)",11)+top(kind==="skill"?"命中形状与阶段":kind==="collision-matrix"?"碰撞分组矩阵":"碰撞与运动编辑","逻辑形状与美术外观分别显示");
  if(kind==="collision-matrix"){
    const ns=["玩家","地形","敌人","道具"],cell=Math.min(48,(w-110)/4),x=80,y=102;
    ns.forEach((v,i)=>{a+=T(16,y+24+i*cell,v,12)+T(x+12+i*cell,y-18,v,11);});
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)a+=R(x+j*cell,y+i*cell,cell-4,cell-4,i===j?C.bg:C.soft,7,C.line)+(i!==j?I(x+cell*j+11,y+cell*i+11,"check",20,C.blue):"");
  }else{
    const cx=w*.44,cy=h*.5;
    a+=avatar(cx,cy,.95)+R(cx-35,cy-77,70,147,"none",22,C.blue,2);
    const pts=[[cx-40,cy+25],[cx+11,cy-9],[cx+65,cy+21],[cx+43,cy+83],[cx-34,cy+73]];
    if(kind==="collision")a+=`<polygon points="${pts.map(p=>p.join(",")).join(" ")}" fill="${C.blue}" fill-opacity=".12" stroke="${C.blue}" stroke-width="2"/>`+pts.map(p=>R(p[0]-4,p[1]-4,8,8,"white",1,C.blue,2)).join("");
    if(kind==="joint"){a+=R(w*.68,h*.35,44,80,"#B1C7E8",6)+O(cx,cy+15,9,"white",C.amber,3)+`<path d="M${cx} ${cy+15}l15-10 15 20 15-20 15 20 15-10H${w*.7}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;}
    if(kind==="skill"||kind==="combat")a+=`<path d="M${cx} ${cy+22}l${w*.34} -70a${w*.37} ${w*.37} 0 0 1 0 140Z" fill="#F5B279" fill-opacity=".3" stroke="#D18D4C" stroke-width="2"/>`+P(16,h-86,"前摇 0.15s → 生效 0.20s → 后摇","amber",mobile?315:365);
    a+=L(14,h*.79,w-14,h*.79,"#799B8E",4)+P(14,h-37,"通行面：地面 · 高度区间按地图定义","blue",mobile?319:344);
  }
 }else if(["particles","particle-curve"].includes(kind)){
  a=R(0,0,w,h,"#152B50",11)+T(18,29,"拾取星光 · 发射器预览",15,"#E9F1FF",600);
  const cx=w*.48,cy=h*.47;
  for(let i=0;i<70;i++){let ang=i*2.399,rr=Math.sqrt(i/70)*Math.min(w,h)*.31,xx=cx+Math.cos(ang)*rr,yy=cy+Math.sin(ang)*rr*.8;a+=O(xx,yy,2+(i%4),["#8BC8F1","#F3D27B","#DCECF9"][i%3]);}
  a+=I(cx-18,cy-18,"spark",36,"#FFF1B4")+P(15,h-40,"预览暂停 · 24 / 128 粒子","blue",245);
  if(kind==="particle-curve"){a+=R(w*.06,h*.68,w*.85,h*.19,"#203A63",7)+`<path d="M${w*.09} ${h*.82}C${w*.3} ${h*.72} ${w*.45} ${h*.77} ${w*.84} ${h*.7}" fill="none" stroke="#91BFF8" stroke-width="2"/>`;}
 }else if(["timeline","curves","growth","chart","simulation","idle"].includes(kind)){
  a+=top(/chart|simulation/.test(kind)?"方案比较 · 示例数据":kind==="timeline"?"跑步 · 帧片段与事件":kind==="idle"?"收益与时间规则":"数值与曲线编辑","拖动只修改当前草稿，应用后形成一次修改");
  if(kind==="timeline"){
    a+=avatar(w*.3,h*.34,Math.min(.65,h/500));
    let yy=h*.56;a+=R(13,yy,w-26,h-yy-18,C.bg,7);
    for(let i=0;i<7;i++)a+=T(78+i*(w-100)/7,yy+24,(i*.1).toFixed(1),9,C.muted)+L(83+i*(w-100)/7,yy+35,83+i*(w-100)/7,h-28);
    ["身体","脚步","事件"].forEach((v,i)=>{a+=T(23,yy+54+i*32,v,11);for(let k=0;k<5;k++)a+=R(81+k*(w-110)/5,yy+42+i*32,10,10,i===2?C.amber:C.blue,2);});
    a+=L(w*.52,yy+8,w*.52,h-24,C.red,2);
  }else{
    const x=45,y=94,ww=w-72,hh=h-166;
    for(let i=0;i<5;i++)a+=L(x,y+i*hh/4,x+ww,y+i*hh/4)+T(x-8,y+i*hh/4+4,100-i*25,9,C.muted,400,"end");
    [C.blue,C.green].forEach((c,n)=>{let pts=[];for(let i=0;i<10;i++)pts.push([x+i*ww/9,y+hh-Math.pow(i/9,n?1.2:1.7)*hh*.88]);a+=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="3"/>`;pts.filter((_,i)=>i%3===0).forEach(p=>a+=O(p[0],p[1],4,"white",c,2));});
    a+=P(16,h-41,"方案 A · 当前","blue",130)+P(156,h-41,"方案 B · 草稿","green",136);
  }
 }else if(["wave","mixer","sound-candidates"].includes(kind)){
  a+=top(kind==="mixer"?"混音 · 音乐 / 音效 / 语音":kind==="wave"?"星星拾取 · 音频剪辑":"本机音效候选","先试听，再接收或替换当前资源");
  if(kind==="mixer"){
    const names=["主音量","音乐","音效","语音","环境"],cw=(w-30)/5;
    names.forEach((v,i)=>{let x=16+i*cw;a+=R(x,78,cw-8,h-102,C.bg,7)+T(x+(cw-8)/2,105,v,11,C.ink,500,"middle");
      const yy=133,hh=h-240;for(let k=0;k<16;k++)a+=R(x+10,yy+k*hh/16,7,hh/20,k>6?"#64B29A":"#D6E2DF",1);
      a+=L(x+cw*.57,yy+6,x+cw*.57,yy+hh,"#C5D2E4",4)+R(x+cw*.57-9,yy+hh*(.18+i*.1),18,24,"white",4,C.blue)+T(x+cw/2,h-78,["80%","65%","72%","90%","48%"][i],11,C.muted,400,"middle")+R(x+8,h-61,cw-24,25,i===2?C.soft:"white",5,C.line)+T(x+cw/2-4,h-44,i===2?"S":"M",11,i===2?C.blue:C.muted,500,"middle");
    });
  }else{
    const yy=h*.43;a+=R(18,83,w-36,h*.53,C.bg,8);
    for(let i=0;i<80;i++){let hh=8+Math.abs(Math.sin(i*1.71)*Math.cos(i*.117))*h*.24;a+=R(25+i*(w-50)/80,yy-hh/2,2.5,hh,i<60?C.blue:"#BDCEE6",1);}
    a+=R(w*.23,90,w*.5,h*.5,C.blue,0).replace('fill="#246BEE"','fill="#246BEE" fill-opacity=".08"')+L(w*.23,88,w*.23,h*.62,C.blue,2)+L(w*.73,88,w*.73,h*.62,C.blue,2)+I(20,h-62,"play",22,C.blue)+T(54,h-44,"00:00.0 / 00:00.4",12,C.muted)+P(w-131,h-66,"WAV · 44.1 kHz","blue",117);
  }
 }else if(["slicer","tileset","directions","font","assets","asset-detail","asset-picker","image-candidates","skeleton-import"].includes(kind)){
  a+=top(kind==="font"?"字体与字形回退":kind==="slicer"?"精灵切片 · 锚点":kind==="tileset"?"瓦片集 · 边缘规则":"资源预览与来源","当前选择在属性区继续编辑");
  if(kind==="font"){a+=T(22,145,"星溪冒险  Star Trail",mobile?22:31,C.ink,600)+T(22,201,"日本語のテキスト",mobile?22:28)+T(22,250,"한국어 예시",mobile?22:28)+P(22,h-53,"回退字体 · 系统字体","blue",210);}
  else{
    const cols=mobile?3:4,rows=Math.min(3,Math.floor((h-95)/96)),cw=(w-40)/cols;
    for(let i=0;i<cols*rows;i++){let x=20+i%cols*cw,y=83+Math.floor(i/cols)*96;a+=R(x+3,y,cw-10,83,i===2?C.soft:C.bg,6,i===2?C.blue:C.line);
      if(kind==="slicer"||kind==="skeleton-import")a+=avatar(x+cw*.5,y+46,.35);
      else if(i%3===1)a+=`<path d="m${x+cw/2} ${y+12} 23 43h-46Z" fill="#4BA58C"/>`+R(x+cw/2-3,y+50,6,18,"#967B5B",1);
      else a+=diamond(x+cw/2,y+43,18,["#6EA8E8","#8FB8B2","#9A86C8"][i%3]);
      if(kind==="slicer"){a+=L(x+8,y+66,x+cw-16,y+66,C.red,1)+L(x+cw*.5,y+15,x+cw*.5,y+76,C.blue,1);}
    }
  }
 }else if(graphKinds.includes(kind)){
  a=R(0,0,w,h,"#EFF3FA",11)+R(0,0,w,h,"url(#dots)",11);
  let nodes=kind==="animation-graph"?[["待机 Idle","默认动作"],["移动 Run","速度 > 0"],["跳跃 Jump","离开地面"],["受击 Hit","优先级 20"]]:
   kind==="dialogue"?[["村长","欢迎来到星溪营地。"],["玩家选择","我愿意帮忙 / 再等等"],["接受任务","收集三颗星星"],["继续对白","保留当前任务进度"]]:
   kind==="technology"?[["采集 I","初始可用"],["精炼","木材 20 · 采集 I"],["工具升级","精炼 + 工坊"],["自动生产","工具升级 II"]]:
   kind==="recipe"?[["木材 × 2","仓库资源"],["工坊制作","耗时 12 秒"],["木板 × 1","输出到仓库"],["缺料等待","不预扣资源"]]:
   /campaign|world/.test(kind)?[["01 · 营地","起点 / 未解锁条件"],["02 · 林间","通过第一关"],["03 · 遗迹","收集 3 星"],["奖励支线","评分 ≥ 2 星"]]:
   kind==="behavior"?[["发现目标","NPC 感知"],["是否可达","检查距离与视线"],["移动与交互","巡逻 / 接近"],["回到巡逻","目标失效"]]:
   kind==="goals"||kind==="quests"||kind==="quest-progress"?[["全部满足 AND","关卡目标"],["收集星星","数量 ≥ 3"],["到达出口","营地传送门"],["结算奖励","仅发放一次"]]:
   kind==="parallel"?[["关卡开始","对象事件"],["并行等待","全部完成"],["播放动画","完成 / 取消"],["显示对白","完成 / 超时"]]:
   [["碰到星星","对象事件"],["尚未收集？","条件判断"],["分数增加","数量：1"],["音效与星光","成功 / 失败"]];
  const nw=mobile?137:Math.min(205,w*.27),nh=82,ps=mobile?[[15,63],[w-nw-15,63],[15,187],[w-nw-15,187]]:[[25,h*.31],[w*.37,h*.31],[w-nw-24,h*.15],[w-nw-24,h*.57]];
  ps.forEach((p,i)=>{if(i){let prev=ps[i===3?1:i-1];a+=`<path d="M${prev[0]+nw} ${prev[1]+40}C${prev[0]+nw+25} ${prev[1]+40} ${p[0]-25} ${p[1]+40} ${p[0]} ${p[1]+40}" stroke="${i===3?C.amber:C.blue}" stroke-width="2" fill="none"/>`;}
   a+=R(p[0],p[1],nw,nh,"#FFFFFF",9,i===1?C.blue:C.line)+R(p[0],p[1],nw,4,i===0?C.green:i===1?C.amber:C.blue,2)+T(p[0]+12,p[1]+29,fit(nodes[i][0],nw-21,12),12,C.ink,600)+T(p[0]+12,p[1]+54,fit(nodes[i][1],nw-21,11),11,C.muted)+O(p[0],p[1]+40,4,"white",C.blue,1.5)+O(p[0]+nw,p[1]+40,4,C.blue);
  });
  a+=P(14,14,kind==="debug"?"已暂停 · 断点：条件判断":fit(s.title,w-60,11),"blue",Math.min(w-28,330));
  if(kind==="debug")a+=O(ps[1][0]+nw-14,ps[1][1]+17,5,C.red)+R(15,h-73,w-30,56,"#FFFFFF",8,C.line)+I(27,h-57,"play",20,C.blue)+T(62,h-43,"单步   ·   player.score = 2",12,C.ink);
 }else if(/diff$|^changes$/.test(kind)){
  const two=kind==="history-diff"||kind==="resource-diff";
  const labels=two?["选定版本 r124","选定版本 r128"]:kind==="engine-diff"?["上次导入基线","当前 GameGen","新源工程"]:kind==="lan-diff"?["共同祖先","我的电脑","我的 Android"]:kind==="api-diff"?["上次来源","当前人工修订","新接口文档"]:kind==="skill-diff"?["已安装版本","本机手改","可用更新"]:["生成时的基线","当前人工修改","AI 提案"];
  a+=top(two?"比较选定的两个版本":"逐项比较 · 保留修改来源","每项变更确认后再应用，依赖冲突可定位");
  const cols=mobile?1:labels.length,cw=(w-pad*2-(cols-1)*12)/cols;
  labels.forEach((v,i)=>{let x=mobile?pad:pad+i*(cw+12),y=mobile?79+i*96:85,hh=mobile?82:h-125;a+=R(x,y,cw,hh,i===1?C.soft:"#FFFFFF",8,C.line)+T(x+12,y+25,v,12,C.ink,600)+T(x+12,y+52,two?["生命 100","生命 120"][i]:["移动速度：3.0","移动速度：2.8","移动速度：2.6"][i],12,i===1?C.blue:C.muted);
   if(!mobile)a+=T(x+12,y+89,"引用对象：冒险家",11,C.muted)+T(x+12,y+118,"动作图 / 移动组件",11,C.muted)+P(x+12,y+145,i===1?"保留手工编辑":"可审阅","blue",Math.min(142,cw-24));
  });
 }else if(["cards","card-zones"].includes(kind)){
  a+=top(kind==="card-zones"?"卡牌区域与效果时序":"卡牌定义与牌组","牌库、手牌、场上与弃牌区分别保存实例");
  a+=R(16,79,w-32,h-110,"#EAF2EF",9);
  ["牌库","手牌","场上","弃牌"].forEach((z,i)=>{let ww=(w-62)/4,x=25+i*(ww+5);a+=R(x,100,ww,h*.38,"none",6,"#B9CDCA",1)+T(x+ww/2,124,z,11,C.muted,500,"middle");if(i!==3)a+=R(x+8,148,ww-16,76,"white",6,C.line)+T(x+16,174,["星芒","守护","治疗"][i],11,C.ink,600)+O(x+ww-22,160,9,C.blue)+T(x+ww-22,164,i+1,10,"white",500,"middle");});
  a+=P(24,h-54,"抽牌 → 选择目标 → 支付费用 → 结算","blue",Math.min(w-48,376));
 }else if(["match","puzzle","tactics","turn","sport"].includes(kind)){
  a+=top(kind==="tactics"?"移动与合法行动":kind==="puzzle"?"棋盘与机关规则":kind==="sport"?"场地与得分区域":"棋盘编辑","选择地块后配置目标、阻挡和事件");
  const cell=Math.min(46,(w-40)/7,(h-105)/6),ox=(w-cell*7)/2,oy=78;
  for(let y=0;y<6;y++)for(let x=0;x<7;x++){let xx=ox+x*cell,yy=oy+y*cell;a+=R(xx,yy,cell-3,cell-3,/tactics|turn/.test(kind)?(x+y)%2?"#C4DEC9":"#D5E5D6":C.bg,5,C.line);
   if(kind==="match")a+=O(xx+cell*.47,yy+cell*.47,cell*.24,["#79A9E4","#C4A0DD","#E6BC70","#76BBA0"][(x*3+y)%4]);
   if(kind==="puzzle"&&((x+y)%3===0))a+=R(xx+7,yy+7,cell-17,cell-17,"#B99870",3);
   if((kind==="tactics"||kind==="turn")&&(x===2&&y===3||x===5&&y===2))a+=O(xx+cell*.46,yy+cell*.46,cell*.25,x===2?C.blue:C.red);
  }
  if(kind==="tactics"||kind==="turn")a+=`<path d="M${ox+2.5*cell} ${oy+3.5*cell}h${cell}v-${cell}h${cell}" fill="none" stroke="${C.blue}" stroke-width="3" stroke-dasharray="5 5"/>`+P(16,h-40,"行动点 4 · 移动 2 · 高差规则已启用","blue",Math.min(w-32,343));
 }else if(kind==="rhythm"){
  a+=top("谱面编辑 · 星溪之歌","BPM 120  /  偏移 +0 ms  /  4 条轨道");
  const yy=89,hh=h-130,ww=(w-54)/4;
  for(let i=0;i<4;i++)a+=R(28+i*ww,yy,ww-6,hh,i%2?C.bg:C.soft,6)+T(28+i*ww+ww/2,yy+hh-12,["D","F","J","K"][i],12,C.muted,500,"middle");
  for(let i=0;i<9;i++){let x=34+(i%4)*ww,y=yy+25+(i*37)%(hh-60);a+=R(x,y,ww-19,i%3===0?44:12,i%3===0?C.purple:C.blue,4);}
  a+=L(22,h-79,w-22,h-79,C.amber,3)+T(23,h-34,"判定线  ·  00:12.500",11,C.muted);
 }else if(kind==="race"){
  a+=top("赛道与检查点","圈数 3 · 顺序检查点 · 出界安全重置");
  a+=`<path d="M${w*.22} ${h*.65}C${w*.02} ${h*.27} ${w*.35} ${h*.08} ${w*.55} ${h*.3}S${w*.96} ${h*.73} ${w*.69} ${h*.79}S${w*.41} ${h*.4} ${w*.22} ${h*.65}Z" fill="none" stroke="#B0BEBF" stroke-width="48"/><path d="M${w*.22} ${h*.65}C${w*.02} ${h*.27} ${w*.35} ${h*.08} ${w*.55} ${h*.3}S${w*.96} ${h*.73} ${w*.69} ${h*.79}S${w*.41} ${h*.4} ${w*.22} ${h*.65}Z" fill="none" stroke="white" stroke-width="2" stroke-dasharray="9 8"/>`;
  [[.22,.65],[.27,.29],[.55,.3],[.76,.61]].forEach(([x,y],i)=>a+=O(w*x,h*y,13,C.blue)+T(w*x,h*y+4,i+1,11,"white",600,"middle"));
 }else if(["character","inventory","item","buff","loot","rewards","army","rogue"].includes(kind)){
  a+=top(kind==="inventory"?"背包与装备槽":kind==="buff"?"状态叠加与生命周期":kind==="rogue"?"本轮挑战与升级候选":"角色与规则预览","冒险家 · 设计示例");
  if(kind==="character"||kind==="item"){a+=avatar(w*.36,h*.46,.9)+R(w*.58,90,w*.32,h*.55,C.bg,8)+T(w*.61,120,"等级 5",13,C.ink,600)+T(w*.61,157,"生命 120",12)+T(w*.61,190,"攻击 18",12)+T(w*.61,223,"防御 12",12);}
  else if(kind==="inventory"){for(let i=0;i<20;i++){let cw=Math.min(55,(w-44)/5),x=22+i%5*cw,y=90+Math.floor(i/5)*cw;a+=R(x,y,cw-5,cw-5,i<6?C.soft:C.bg,7,C.line)+(i<4?diamond(x+cw*.45,y+cw*.45,12,i===2?"#C8A1D7":"#6BA3E9"):"");}}
  else if(kind==="rogue"){["迅捷步伐","星光护盾","回响攻击"].forEach((z,i)=>{let ww=(w-48)/3,x=16+i*(ww+8);a+=R(x,97,ww,h*.58,"white",10,C.line)+I(x+ww/2-14,124,"spark",28,[C.blue,C.green,C.purple][i])+T(x+ww/2,184,z,12,C.ink,600,"middle")+T(x+ww/2,215,"本轮效果",11,C.muted,400,"middle");});}
  else a+=table(["规则","当前值","来源"],kind==="buff"?[["灼烧","每秒 5","状态定义"],["持续","4 秒","模板"],["叠加","刷新时长","自定义"],["移除","离开战斗","生命周期"]]:[["恢复药剂","60%","掉落表"],["星芒石","30%","掉落表"],["稀有徽章","10%","掉落表"],["结算","每业务号一次","规则"]]);
 }else if(["pair","devices","content","grant","sync-plan","transfer","received","network","shared-assets","engine-import","engine-analysis","engine-mapping","migration","migration-report","offline","pipeline","preflight","files","package","signature","deployment"].includes(kind)){
  a+=top(kind==="pair"?"双端确认 · 本地配对":kind==="offline"?"离线组件与本机依赖":kind.startsWith("engine")||kind.startsWith("migration")?"源工程迁移 · 逐项可追溯":kind==="transfer"?"同步任务 · 固定快照":kind==="content"?"选择发送的内容与依赖":kind==="pipeline"?"本机生成 · 固定版本 r128":"本地工作区","所有进度与数值为设计示例");
  if(kind==="pair"){
    a+=I(w/2-25,87,"shield",50,C.blue)+T(w/2,164,"我的电脑 A3F8  ↔  Android D7K2",mobile?11:14,C.muted,400,"middle");
    const cw=mobile?39:57,g=9,xx=(w-cw*6-g*5)/2;
    [7,4,2,9,1,6].forEach((n,i)=>a+=R(xx+i*(cw+g),203,cw,62,C.soft,8)+T(xx+i*(cw+g)+cw/2,245,n,25,C.blue,600,"middle"));
    a+=T(w/2,302,"两台设备短码一致后确认",12,C.muted,400,"middle");
  }else if(kind==="transfer"||kind==="pipeline"||kind==="deployment"){
    const stages=kind==="transfer"?["确认内容","传输分块","完整校验","原子提交"]:["固定版本","项目校验","处理资源","生成产物"];
    stages.forEach((z,i)=>{let y=90+i*63;a+=O(30,y+12,13,i<2?C.blue:C.bg,i<2?"none":C.line)+T(30,y+16,i<2?"✓":i+1,11,i<2?"white":C.muted,500,"middle")+T(55,y+17,z,13,C.ink,600)+T(55,y+38,["已完成","已完成","进行中 · 可查看详情","等待前置阶段"][i],11,C.muted);if(i<3)a+=L(30,y+27,30,y+60);});
    a+=R(20,h-50,w-40,7,C.soft,3)+R(20,h-50,(w-40)*.68,7,C.blue,3);
  }else if(kind==="engine-import"){a+=list([["Cocos Creator","2.4.x / 3.x · 源工程"],["LayaAir","2.x / 3.x · 源工程"],["Godot","3.x / 4.x · 源工程"]],78,"folder");}
  else if(/engine-analysis|engine-mapping|migration/.test(kind)){
    a+=table(["源内容","目标 / 处置","结果"],[["场景：营地","Scene / 稳定映射","候选可转换"],["角色精灵","资源 / 来源许可","待校对"],["拾取行为","受限工作流","待确认"],["未知脚本","待补任务 #04","需处理"],["引用位置","定位到源对象","可查看"]]);
  }else if(kind==="offline"){a+=list([["APK 离线生成组件","版本 / 许可 / 安装状态"],["本机音效模型","未安装 · 可导入离线包"],["本机助手运行依赖","按设备能力显示"],["平台适配组件","选择目标后检查"]],77,"box");}
  else if(kind==="devices"){a+=list([["我的 Android · D7K2","局域网设备 · 等待配对"],["工作室笔记本 · M4P9","已信任 · 限定项目"],["本机发现状态","仅可信局域网接口"]],77,"phone");}
  else if(kind==="files"){a+=list([["星溪冒险.apk","生成的文件 · 对应 r128"],["构建清单.json","目标配置与依赖摘要"],["资源清单","来源与许可信息"],["运行验证","尚未验证 · 独立记录"]],77,"box");}
  else{a+=list([["星溪冒险","项目副本 · 固定快照"],["角色与地图资源","包含 12 个必需依赖"],["目标位置","本机授权目录"],["接收权限","本次明确同意后接收"]],77,"folder");}
 }else if(["projects","templates","create","maps","levels","tools","sessions","model-list","skill-list","tool-catalog","assets","inbox"].includes(kind)){
  a+=top(kind==="templates"?"24 类玩法 · 按需启用":kind==="projects"?"最近项目":s.title,"搜索、筛选和最近使用");
  if(kind==="projects"||kind==="templates"||kind==="tools"){
    const names=kind==="templates"?["平台跳跃","等距冒险","RPG","农场经营","塔防","消除","卡牌","音乐节奏"]:kind==="projects"?["星溪冒险","像素农场","塔楼守卫"]:["地图与关卡","角色与数值","工作流","资源制作","动画与骨骼","帮助与学习"];
    const cols=mobile?2:3,cw=(w-36-(cols-1)*12)/cols;
    names.slice(0,mobile?4:6).forEach((z,i)=>{let x=18+i%cols*(cw+12),y=77+Math.floor(i/cols)*130;a+=R(x,y,cw,118,"white",9,C.line)+R(x+8,y+8,cw-16,66,["#DFEDF0","#E5F0E7","#EDF0FA"][i%3],5)+I(x+cw/2-17,y+24,["scene","layers","nodes"][i%3],34,[C.blue,C.green,C.purple][i%3])+T(x+12,y+100,z,12,C.ink,600);});
  }else a+=list(kind==="model-list"?[["我的模型服务","自带 Key · 凭据仅本机"],["本机模型","本地地址 · 按能力显示"],["OpenCode Go","自带账户 · 独立结算"]]:kind==="sessions"?[["星溪玩法打磨","今天 · 当前项目"],["角色视觉方向","昨天 · 可新建会话分支"],["关卡节奏","11月15日 · 历史记录"]]:kind==="levels"?[["初次出发","营地 · 收集三颗星星"],["林间回响","复用地图 · 独立目标"],["遗迹挑战","前置与检查点"]]:[["当前内容","查看定义与来源"],["最近修改","保留人工编辑"],["可用条目","选择后打开详情"]],76,kind==="sessions"?"chat":"box");
 }else if(["http","api","message","schema","protocol","compatibility","api-import","api-review","api-sim","model-form","model-auth","stdio","oauth","skill-editor","skill-import","permission","context","ledger","operations","database","connection","future","rooms","zones","audit","mcp-type"].includes(kind)){
  a+=top(kind==="stdio"?"本机 MCP · 参数数组":kind==="skill-editor"?"Skill 正文与附件":kind==="http"?"HTTP 操作与字段":kind==="model-auth"?"鉴权与设备凭据":kind==="protocol"?"协议与四目标能力":kind==="context"?"本轮内容与发送目的地":s.title,"来源、权限和业务状态分别记录");
  if(kind==="stdio"){a+=R(18,83,w-36,h-112,"#1D304D",8)+T(31,113,"可执行文件",12,"#AFC1DD")+T(31,145,"已授权的本机运行时",13,"#E7EFF9")+T(31,190,"参数（每行一个，不作为 shell 执行）",11,"#AFC1DD")+T(31,225,'[ "--service", "project-tools" ]',12,"#9CCFAC")+T(31,272,"环境变量：引用设备安全凭据",11,"#AFC1DD");}
  else if(kind==="skill-editor"){a+=R(18,82,w-36,h-111,C.bg,8)+T(31,117,"# 关卡与节奏",16,C.ink,600)+lines(31,153,"先确认玩家目标，再规划挑战、奖励和恢复点。\n\n所有修改都以地图和工作流提案呈现。\n附件只按授权范围读取，不自动运行。",w-62,12,C.ink,25,9);}
  else if(kind==="context"){a+=P(18,77,"目的地：远程模型","amber",197)+list([["你手动输入的文字","可以发送 · 不自动附带项目"],["地图与资源 · 仅本地","阻止发送 · localOnly"],["自动摘要与报告","继承本地限制，不能发送"]],123,"lock");}
  else if(kind==="oauth"){a+=I(w/2-28,104,"shield",56,C.blue)+T(w/2,198,"仅授权已选服务与项目范围",mobile?13:17,C.ink,600,"middle")+T(w/2,235,"取消后保留原配置，等待重新授权",11,C.muted,400,"middle")+B(w/2-100,275,"打开服务授权",true,200);}
  else a+=table(mobile?["字段 / 内容","定义"]:["字段 / 内容","类型 / 规则","来源"],kind==="http"||kind==="api"||kind==="schema"?[["GET /players/{id}","请求 / 响应","契约"],["id","string · 必填","path"],["name","string · 可空","response"],["coins","integer ≥ 0","response"],["错误与重试","按业务声明","人工校对"]]:kind==="protocol"||kind==="compatibility"?[["H5","查看能力","目标配置"],["APK","查看桥接依赖","目标配置"],["微信小游戏","独立能力表","待冻结"],["抖音小游戏","独立能力表","待冻结"]]:[["当前配置","保留原输入","本设备"],["作用范围","仅当前项目","用户选择"],["凭据","设备安全引用","不随项目分享"],["状态","按实际结果","不使用示例替代"]]);
 }else{
  a+=top(s.title,fit(s.task||"在当前上下文中编辑并查看影响",w-40,11));
  a+=table(["内容","当前值","来源"],(s.fields||[]).slice(0,6).map(f=>[f.label,D.value(f),f.advanced?"高级":"当前定义"]));
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${a}</svg>`;
};
