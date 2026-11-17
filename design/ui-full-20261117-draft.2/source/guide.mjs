// 引导设计只观察正常工具与任务；跳过随时可达，不代用户执行业务。
import {D} from './drawing.mjs';
import {frame} from './workbench.mjs';
import {drawVisual} from './visuals-current.mjs';
export const renderGuide=function renderGuide(item,platform,options={}){
 const {C,rect:R,text:T,line:L,icon:I,pill:P,button:B,group:G,fit,lines,esc}=D;
 const mobile=platform==="android",land=mobile&&options.mode==="landscape",keyboard=mobile&&options.mode==="keyboard";
 const W=land?844:mobile?390:1440;
 let H=land?390:mobile?844:960;
 const mode=options.kind||({1:"welcome",2:"learn",3:"step",4:"skipped",5:"finished",6:"preferences"}[Number(item.id.split("-").pop())]||"step");
 if(mode==="learn")H=options.mode==="no_results"?(mobile?844:960):(mobile?1550:1100);
 const step=options.step||{id:"G02",title:"改一个外观"};
 const ss={id:item.id,title:mode==="learn"?"帮助与学习":mode==="preferences"?"引导偏好":"新手引导",parent_page_id:mode==="step"?"scene":"projects",task:"离线练习 · 随时可以跳过"};
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${esc(item.title)} · ${esc(options.mode||mode)}</title>${D.defs}`;
 if(!land)svg+=frame(ss,platform,W,H,ss.task);
 else svg+=R(0,0,W,H,C.bg,0)+R(0,0,W,48,"white",0)+I(16,13,"back",22)+T(49,31,"新手引导 / 工作流",16,C.ink,600)+B(700,5,"返回竖屏",false,128,38);
 const x=mobile?16:208,w=mobile?358:1208,y=mobile?167:170;
 const guideButtons=(xx,yy,ww)=>B(xx,yy,"跳过本步",false,(ww-10)/2,42)+B(xx+(ww+10)/2,yy,"结束引导",false,(ww-10)/2,42);
 if(mode==="welcome"){
  svg+=R(x,y,w,mobile?304:247,"url(#hero)",14)+I(x+22,y+24,"spark",35,C.blue)+T(x+22,y+92,mobile?"先做一个可以玩的小关卡":"把第一个想法，做成可以玩的关卡",mobile?21:30,C.ink,600);
  svg+=lines(x+22,y+126,"用内置示例认识工作区、改外观和行为，再保存试玩。\n基础引导离线可用，不需要模型、Key 或积分。",w-44,12,C.muted,24,3);
  if(mobile)svg+=B(x+20,y+184,"开始引导",true,318,44)+B(x+20,y+238,"跳过，直接创作",false,318,44);
  else svg+=B(x+22,y+175,"开始引导",true,202,44)+B(x+239,y+175,"跳过，直接创作",false,236,44)+I(x+w-72,y+26,"close",24);
  const yy=mobile?y+337:y+286;
  svg+=T(x,yy,"你的项目",17,C.ink,600)+R(x,yy+20,mobile?w:588,mobile?116:175,"white",11,C.line)+I(x+18,yy+40,"folder",28,C.blue)+T(x+62,yy+61,"星溪冒险",16,C.ink,600)+T(x+18,yy+94,"正常的新建、打开和编辑入口始终可用。",12,C.muted);
 }else if(mode==="learn"){
  svg+=R(x,y,w,42,"white",8,C.line)+I(x+12,y+12,"search",18)+T(x+40,y+27,"搜索课程或想完成的任务",12,C.muted);
  const courses=[["入门：第一个可玩的关卡","进行中 · 实际完成 2 / 6"],["对话与工作流","可选 · 未开始"],["地图与关卡","可选 · 未开始"],["角色、技能与任务","可选 · 已跳过"],["骨骼、动画与音效","可选 · 未开始"],["设备接力与导出","可选 · 未开始"],["SLG 经营与生产","可选 · 未开始"],["物理与粒子特效","可选 · 未开始"],["接口与联网配置","可选 · 后续运行按能力"],["模型、MCP 与 Skill","可选 · 未开始"]];
  const cols=mobile?1:2,cw=(w-(cols-1)*18)/cols;
  (options.mode==="no_results"?[]:courses).forEach(([z,sub],i)=>{let xx=x+i%cols*(cw+18),yy=y+62+Math.floor(i/cols)*113;svg+=R(xx,yy,cw,97,"white",10,C.line)+I(xx+16,yy+17,"layers",25,C.blue)+T(xx+55,yy+32,fit(z,cw-70,14),14,C.ink,600)+T(xx+16,yy+64,sub,12,C.muted)+T(xx+cw-68,yy+64,i?"打开  →":"继续  →",12,C.blue);});
  if(options.mode==="no_results")svg+=R(x,y+70,w,292,"white",11,C.line)+I(x+w/2-22,y+113,"search",44,C.blue)+T(x+w/2,y+207,"没有匹配的课程",mobile?18:24,C.ink,600,"middle")+B(x+20,y+250,"清除筛选",true,mobile?w-40:220,44);
  if(!mobile&&options.mode!=="no_results")svg+=R(x,y+660,w,123,C.soft,10)+T(x+21,y+693,"从头重看只重置课程进度",16,C.ink,600)+T(x+21,y+725,"已有项目与已保存修改继续保留。重新练习时，由你选择新建独立副本。",13,C.muted);
 }else if(mode==="preferences"){
  const items=[["首次操作时显示简短提示","只在你打开对应工具时提供一条帮助",options.mode!=="hints_off"],["显示学习进度","仅在当前设备保存，不随项目同步",true],["本功能不再提示","只影响当前工具，可随时重新开启",false]];
  let yy=y;items.forEach(([a,b,on])=>{svg+=R(x,yy,w,mobile?105:102,"white",10,C.line)+T(x+17,yy+31,a,mobile?14:17,C.ink,600)+lines(x+17,yy+59,b,w-(mobile?48:160),12,C.muted,21,2)+R(x+w-58,yy+23,36,22,on?C.blue:"#C5D1E1",11)+D.circle(x+w-(on?32:46),yy+34,8,"white");yy+=mobile?119:118;});
  svg+=B(x,yy+7,"关闭所有自动操作提示",false,mobile?w:282,44)+B(x,mobile?yy+61:yy+68,"重看新手引导",true,mobile?w:282,44)+B(x,mobile?yy+115:yy+121,"重置本机引导记录",false,mobile?w:282,44)+T(x,yy+174,"重置只清本机学习记录，不改游戏。",12,C.muted);
 }else if(mode==="finished"){
  const complete=options.mode==="completed";
  svg+=R(x,y,w,mobile?571:573,"white",13,C.line)+I(x+24,y+26,complete?"check":"info",38,complete?C.green:C.blue)+T(x+24,y+112,complete?"已完成入门操作":"本次引导已结束",mobile?23:31,C.ink,600)+lines(x+24,y+147,complete?"你已通过正常工具完成修改、保存并进入试玩。":"部分步骤已完成，其他步骤可以以后继续。",w-48,13,C.muted,23,2);
  const rows=complete?[["认识工作区","已了解"],["修改外观与行为","实际操作完成"],["保存并试玩","实际操作完成"]]:[["认识工作区","已了解"],["修改角色外观","实际操作完成"],["对话修改","已跳过"],["保存并试玩","待处理 · 缺少运行组件"]];
  rows.forEach(([a,b],i)=>svg+=R(x+20,y+197+i*54,w-40,44,C.bg,7)+T(x+33,y+225+i*54,a,12)+T(x+w-34,y+225+i*54,b,11,/完成/.test(b)?C.green:C.muted,500,"end"));
  svg+=B(x+20,y+(mobile?436:467),"继续创作",true,mobile?w-40:220,44);
  if(!mobile)svg+=B(x+255,y+467,"重看某一步",false,190,44)+B(x+460,y+467,"了解导出",false,170,44)+B(x+645,y+467,"更多课程",false,170,44);
 else svg+=B(x+20,y+491,"重看某一步",false,154,42)+B(x+184,y+491,"了解导出",false,154,42)+T(x+20,y+558,"更多课程  →",12,C.blue);
 }else{
  const isSkip=mode==="skipped",vx=land?12:x,vy=land?58:y,vw=land?492:mobile?w:872,vh=land?320:mobile?281:649;
  const vk=["runtime_missing","offline"].includes(options.mode)?"scene":step.id==="G03"?"graph":step.id==="G04"?"chat":step.id==="G05"?"preview":"scene";
  svg+=G(vx,vy,drawVisual(vk,vw,vh,{...ss,title:step.title}));
  if(isSkip){
   const nx=mobile?16:232,ny=mobile?501:780,nw=mobile?358:823;
   svg+=R(nx,ny,nw,mobile?164:74,C.soft,10,C.line)+I(nx+14,ny+16,"check",21,C.blue)+T(nx+43,ny+31,"已跳过，可在帮助与学习中重新打开",mobile?12:14,C.ink,600)+lines(nx+16,ny+60,"你的修改和草稿会保留，正在运行的业务任务仍由原任务界面管理。",nw-32,12,C.muted,21,mobile?3:1);
   if(mobile)svg+=B(nx+16,ny+106,"重新打开引导",false,nw-32,42);
  }else{
   const cx=land?520:mobile?16:1100,cy=land?58:keyboard?300:mobile?478:170,ww=land?312:mobile?358:316,hh=land?320:keyboard?211:mobile?272:584;
   svg+=R(cx,cy,ww,hh,"white",13,C.line)+T(cx+17,cy+29,"步骤 "+step.id.replace("G0","")+" / 6",12,C.blue,600)+I(cx+ww-37,cy+14,"close",20)+T(cx+17,cy+62,step.title,mobile?18:20,C.ink,600);
   let description=step.id==="G01"?"这里是场景、属性和试玩入口。你可以随时自由探索。":step.id==="G02"?"选中角色，使用当前能力支持的外观字段完成一次修改。":step.id==="G03"?"在“碰到星星 → 分数 +1”中调整分数，保存后继续。":step.id==="G04"?"先看本地教学示例，了解变化预览与采用的关系。":step.id==="G05"?"保存当前合法修改，确认后用固定版本试玩。":"回到原对象继续创作，学习入口会一直保留。";
   if(options.mode==="target_missing")description="当前找不到适用对象。可以选择对象、使用练习副本，或跳过本步。";
   if(options.mode==="model_missing")description="没有配置模型也能看本地教学示例。不会调用服务或扣积分。";
   if(options.mode==="readonly")description="当前工程只读。可另选练习位置，或已了解/跳过本步。";
   if(options.mode==="offline")description="内置说明离线可读。缺运行组件时可跳过操作，不会记为已试玩。";
   if(options.mode==="unknown")description="保存结果尚未确认。先查询原请求，不重复提交。";
   if(options.mode==="resume")description="继续上次步骤，保留选区与草稿。恢复不会重发业务请求。";
   if(options.mode==="duplicate")description="已有引导正在另一个窗口进行。可以激活它，不重复创建练习或发送请求。";
   if(options.mode==="progress_unsaved")description="操作已完成，但学习记录尚未保存。本次可继续；不要重复执行已经完成的操作。";
   if(options.mode==="runtime_missing")description="当前缺少 Graph 或试玩运行能力。本步暂不能实操，可以阅读说明或跳过。";
   if(options.mode==="tasks_running")description="保存任务正在运行。结束引导会保留任务，不重复提交或取消。";
   if(step.id==="G04")svg+=P(cx+16,cy+77,"教学示例 · 不调用真实模型","amber",ww-32);
   if(keyboard)description="先完成输入，返回可以收起键盘。";
   const ty=cy+(step.id==="G04"?123:93);
   svg+=lines(cx+17,ty,description,ww-34,13,C.ink,23,keyboard?1:mobile&&step.id==="G04"?2:mobile?3:4);
   if(!mobile)svg+=R(cx+16,cy+185,ww-32,54,C.bg,8)+T(cx+28,cy+207,options.mode==="target_missing"?"等待你选择去向":options.mode==="progress_unsaved"?"操作完成 · 学习记录未记住":options.mode==="runtime_missing"?"此步受阻 · 其他工具仍可使用":"完成依据来自正常操作",12,C.muted)+T(cx+28,cy+228,"看过说明会记为“已了解”",11,C.muted);
   const by=cy+hh-(mobile&&!land&&!keyboard?118:land?112:keyboard?108:182);
   svg+=B(cx+16,by,options.mode==="target_missing"?"选择适用对象":options.mode==="unknown"?"查询原请求":options.mode==="resume"?"继续上次引导":options.mode==="duplicate"?"激活已有引导":options.mode==="progress_unsaved"?"查看学习记录保存状态":options.mode==="runtime_missing"?"查看所缺能力":options.mode==="readonly"?"另选练习位置":options.mode==="offline"?"阅读内置说明":step.id==="G01"?"明白了":"定位操作",true,ww-32,42);
   svg+=guideButtons(cx+16,by+53,ww-32);
   if(!mobile)svg+=B(cx+16,cy+hh-58,"上一步 / 已了解",false,ww-32,38);
  }
  if(keyboard){
   svg+=R(0,535,390,309,"#DFE5EF",0)+T(18,562,"名称   角色   冒险家",14);
   ["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"].forEach((row,i)=>[...row].forEach((z,j)=>{let cw=370/row.length;svg+=R(9+j*cw,582+i*48,cw-5,39,"white",5)+T(9+j*cw+(cw-5)/2,608+i*48,z,14,C.ink,400,"middle");}));
  }
 }
 return {svg:svg+"</svg>",width:W,height:H};
};
export const renderGuideLocaleCard=function renderGuideLocaleCard(locale,kind="welcome"){
 const {C,rect:R,text:T,lines,button:B,icon:I,esc}=D;
 const texts={
  "zh-CN":{title:"做出第一个可玩的关卡",body:"用内置示例改外观、改行为，再保存试玩。基础引导离线可用，无需先配置模型。",start:"开始引导",skip:"跳过，直接创作",resume:"帮助与学习",exit:"结束引导",note:"随时可以跳过，稍后从帮助与学习继续。"},
  "en-US":{title:"Create your first playable level",body:"Change the look and behavior of a built-in example, then save and play. The basic tutorial works offline without a model.",start:"Start tutorial",skip:"Skip and start creating",resume:"Help and learning",exit:"End tutorial",note:"Skip at any time. Resume later from Help and learning."},
  "ja-JP":{title:"最初の遊べるステージを作ろう",body:"内蔵サンプルの見た目と動きを変え、保存してプレイします。基本ガイドはモデルの設定なしでオフラインでも使えます。",start:"チュートリアルを始める",skip:"スキップして制作を始める",resume:"ヘルプと学習",exit:"チュートリアルを終了",note:"いつでもスキップでき、ヘルプと学習から再開できます。"},
  "ko-KR":{title:"첫 번째 플레이 가능한 레벨 만들기",body:"내장 예제의 모습과 동작을 바꾼 뒤 저장하고 플레이하세요. 기본 안내는 모델 설정 없이 오프라인에서 사용할 수 있습니다.",start:"튜토리얼 시작",skip:"건너뛰고 제작 시작",resume:"도움말 및 학습",exit:"튜토리얼 종료",note:"언제든 건너뛸 수 있으며 도움말 및 학습에서 다시 시작할 수 있습니다."}
 };
 const q=texts[locale],W=430,H=500;
 let s=R(0,0,W,H,"white",16,C.line)+I(26,27,"spark",34,C.blue)+lines(26,108,q.title,W-52,23,C.ink,31,2)+lines(26,183,q.body,W-52,14,C.muted,24,4)+B(26,300,q.start,true,W-52,47)+B(26,359,q.skip,false,W-52,47)+lines(26,446,q.note,W-52,12,C.muted,21,2);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${esc(locale)} · onboarding copy layout draft</title>${s}</svg>`,width:W,height:H};
};
