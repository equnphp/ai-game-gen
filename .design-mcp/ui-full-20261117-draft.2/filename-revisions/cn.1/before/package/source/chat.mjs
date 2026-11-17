// 对话状态设计：模型回复、工具、提案与持久化分别呈现。
import {D} from './drawing.mjs';
import {frame} from './workbench.mjs';
export const renderChatCard=function renderChatCard(st,platform="desktop"){
 const {C,rect:R,text:T,lines,button:B,icon:I,fit,esc}=D,mobile=platform==="android",W=mobile?358:704;
 const titleLines=D.wrap(st.title,W-70,mobile?18:21,3),contentLines=D.wrap(st.content,W-40,14,20),recLines=D.wrap(st.recovery,W-40,12,20);
 const acts=String(st.actions||"").split(/[、，；。]/).filter(Boolean);
 let y=31+titleLines.length*26+16;
 let body=R(0,0,W,900,"white",14,C.line)+I(17,20,"info",22,C.blue)+titleLines.map((t,i)=>T(49,39+i*26,t,mobile?18:21,C.ink,600)).join("");
 body+=T(20,y,"当前情况",12,C.muted,600);y+=27;contentLines.forEach(t=>{body+=T(20,y,t,14,C.ink);y+=24;});
 y+=16;body+=T(20,y,"可以继续做什么",12,C.muted,600);y+=18;
 acts.forEach((t,i)=>{body+=B(20,y,t,i===0,W-40,44);y+=54;});
 y+=7;body+=T(20,y,"恢复与保留",12,C.muted,600);y+=24;recLines.forEach(t=>{body+=T(20,y,t,12,C.muted);y+=21;});
 const H=y+20;body=body.replace('height="900"','height="'+H+'"');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${esc(st.title)}</title>${body}</svg>`;
 return {svg,width:W,height:H};
};
export const renderChatView=function renderChatView(view,platform,states){
 const {C,rect:R,text:T,line:L,icon:I,pill:P,button:B,circle:O,group:G,fit,lines,esc}=D,mobile=platform==="android",keyboard=mobile&&view.id==="CHAT-VIEW-26";
 const W=mobile?390:1440,H=844+(mobile?0:116),x=mobile?16:432,y=mobile?166:170,cw=mobile?358:618,ch=mobile?594:704;
 const sn={id:view.id,title:"对话创作",parent_page_id:"chat",task:view.title};
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${esc(view.title)} · ${mobile?"Android":"桌面"}</title>${D.defs}`+frame(sn,platform,W,H,view.title);
 if(!mobile){
  svg+=R(208,170,202,704,"white",11,C.line)+T(225,201,"创作会话",15,C.ink,600)+B(224,220,"新会话",false,170,36);
  [["星溪玩法打磨","今天 · 当前会话"],["角色视觉方向","昨天 · 8轮"],["关卡节奏调整","历史 · 6轮"]].forEach((q,i)=>svg+=R(218,278+i*80,182,68,i?C.bg:C.soft,8)+T(231,305+i*80,q[0],13,i?C.ink:C.blue,600)+T(231,330+i*80,q[1],11,C.muted));
 }
 svg+=R(x,y,cw,ch,"white",11,C.line)+T(x+16,y+28,"星溪玩法打磨",mobile?13:14,C.ink,600)+P(x+cw-143,y+12,"讨论  /  执行","blue",127)+L(x,y+47,x+cw,y+47);
 const n=Number(view.id.split("-").pop()),inner=cw-34,fx=x+17,fy=y+68;
 let content="";
 const title=(s,sub)=>T(fx,fy+24,s,mobile?16:19,C.ink,600)+(sub?lines(fx,fy+53,sub,inner,12,C.muted,21,mobile?2:3):"");
 const box=(yy,titleText,sub,tone="blue",hh=116)=>R(fx,yy,inner,hh,tone==="red"?C.rose:tone==="amber"?C.cream:C.soft,10)+T(fx+14,yy+27,fit(titleText,inner-28,14),14,C.ink,600)+lines(fx+14,yy+53,sub,inner-28,12,C.muted,21,3);
 if(n===1){
  content=title("你想做一款怎样的游戏？","可以从一句想法开始，也可以打开已有项目。");
  ["做一个收集星星的小关卡","先看看可玩的模板","继续修改当前项目"].forEach((z,i)=>content+=B(fx,fy+118+i*59,z,false,inner,46));
 }else{
  content+=R(fx+32,fy,inner-32,64,C.soft,10)+T(fx+47,fy+27,"让角色移动慢一点，拾取星星时有反馈。",mobile?11:13,C.ink)+T(fx+47,fy+49,"当前项目：星溪冒险",11,C.muted);
  content+=I(fx,fy+89,"spark",23,C.blue)+T(fx+34,fy+106,"GameGen",13,C.ink,600);
  const sy=fy+128;
  if(n===2){content+=box(sy,"计划已准备好 · 尚未修改项目","1. 检查角色移动参数\n2. 更新拾取反馈工作流\n3. 预览差异后由你采用", "blue",143)+B(fx,sy+159,"按计划提出修改",true,inner,44);}
  else if(n===3){content+=lines(fx+4,sy+10,"我会沿用你手工调整的地图和角色配置，先定位移动参数，再准备可审阅的修改。",inner-8,14,C.ink,26,4)+box(sy+119,"正在准备工具调用","公开活动：查找角色配置 → 检查现有工作流","blue",93)+B(fx,sy+228,"请求停止",false,inner,42);}
  else if(n===4){["✓ 读取当前项目 · 已完成","● 准备反馈资源 · 运行中","○ 校验修改提案 · 等待"].forEach((z,i)=>content+=R(fx,sy+i*62,inner,52,i===1?C.soft:C.bg,8)+T(fx+13,sy+32+i*62,z,12));content+=B(fx,sy+202,"查看任务详情",false,inner,42);}
  else if(n===5){content+=box(sy,"等待你允许本次操作","目标：星溪冒险 / 冒险家\n动作：提出移动与反馈工作流修改\n范围：仅当前项目","amber",153)+B(fx,sy+169,"仅本次允许",true,(inner-10)*.63,44)+B(fx+(inner-10)*.63+10,sy+169,"拒绝",false,(inner-10)*.37,44);}
  else if(n===6){content+=T(fx,sy+17,"拾取反馈的声音，你想用哪一种？",13,C.ink,600);["内置音效 · 可试听","选择本地文件","本机生成候选","暂用占位音效"].forEach((z,i)=>{let ww=(inner-12)/2,xx=fx+i%2*(ww+12),yy=sy+36+Math.floor(i/2)*84;content+=R(xx,yy,ww,72,i?C.bg:C.soft,9,C.line)+I(xx+12,yy+12,"sound",20,C.blue)+T(xx+12,yy+57,fit(z,ww-21,12),12,C.ink);});content+=B(fx,sy+221,"确认选择并继续",true,inner,44);}
  else if(n===7){content+=box(sy,"已回答 1 / 3 个问题","声音来源：内置音效 ✓\n角色风格：等待你选择\n关卡目标：项目已变化，需重新确认","amber",151)+B(fx,sy+168,"继续补充答案",true,inner,44);}
  else if(n===8){content+=box(sy,"修改待审阅 · 尚未应用","移动速度 3.0 → 2.6\n拾取反馈：增加音效与星光\n保持原有地图、碰撞与其他参数","blue",144)+B(fx,sy+161,"审阅修改",true,inner,44);}
  else if(n===9){content+=box(sy,"提案暂时无法应用","拾取音效节点缺少兼容资源。\n现有项目保持原样；可定位问题或选占位资源。","red",132)+B(fx,sy+149,"定位缺失资源",true,inner,44);}
  else if(n===10||n===11||n===23){content+=box(sy,n===11?"与人工修改存在冲突":"项目已变化 · 需要重新比较","生成时基线 r128\n当前手改 r130：移动速度 2.8\nAI 提案：移动速度 2.6","amber",152)+B(fx,sy+168,"打开对应三方比较",true,inner,44);}
  else if(n===12){["☑ 移动速度 · 可独立采用","☑ 拾取反馈 · 包含音效依赖","☐ 粒子分支 · 依赖尚未满足"].forEach((z,i)=>content+=R(fx,sy+i*58,inner,48,C.bg,8)+T(fx+12,sy+30+i*58,z,12));content+=B(fx,sy+192,"校验并采用选中项",true,inner,44);}
  else if(n===13){["✓ 提案校验通过","✓ 提交已受理","✓ 核心确认：r129 已保存"].forEach((z,i)=>content+=R(fx,sy+i*59,inner,49,i===2?C.mint:C.bg,8)+T(fx+13,sy+31+i*59,z,12,i===2?C.green:C.ink,500));content+=B(fx,sy+194,"查看实际保存版本",true,inner,44);}
  else if(n===14){content+=box(sy,"停止请求已发出 · 仍在确认","模型正在停止输出，工具任务可能仍在运行。\n请先查看原任务的实际结果。","amber",126)+B(fx,sy+143,"查询原任务",true,inner,44);}
  else if(n===15){content+=box(sy,"回复已停止 · 已完成内容保留","已保存：移动速度修改\n已停止：尚未执行的反馈步骤\n原项目和输入草稿继续保留","blue",145)+B(fx,sy+162,"查看本轮结果",true,inner,44);}
  else if(n===16){content+=box(sy,"工具超时 · 执行结果未知","没有收到最终结果，不能断言未执行。\n先查询原请求，避免重复写入。","amber",126)+B(fx,sy+143,"查询原请求状态",true,inner,44);}
  else if(n===17){content+=box(sy,"停止到达前，修改已经保存","移动速度已保存到 r129。\n可以查看变化，再通过项目历史决定是否撤销。","amber",129)+B(fx,sy+146,"审阅已保存修改",true,inner,44);}
  else if(n===18){content+=box(sy,"本地内容不能发送到远程目的地","地图、角色素材、迁移报告及自动摘要受本地限制。\n仍可只讨论你自己输入的文字。","red",142)+B(fx,sy+159,"仅发送手动文字",true,inner,44);}
  else if(n===19){content+=box(sy,"当前模型连接需要修正","认证未通过或 API 格式不兼容。\n凭据仅在本设备设置，不随项目分享。","red",129)+B(fx,sy+145,"编辑模型配置",true,inner,44);}
  else if(n===20){content+=box(sy,"本机助手尚未就绪","缺少当前设备所需的运行组件。\n可以继续手工编辑，或查看离线组件。","amber",129)+B(fx,sy+146,"查看缺少的组件",true,inner,44);}
  else if(n===21){content+=T(fx,sy+17,"候选已生成 · 尚未采用",14,C.ink,600);["候选 A · 清脆短音","候选 B · 轻微回响"].forEach((z,i)=>content+=R(fx,sy+36+i*83,inner,70,i?C.bg:C.soft,9,C.line)+I(fx+13,sy+51+i*83,"play",21,C.blue)+T(fx+47,sy+64+i*83,z,12)+T(fx+47,sy+87+i*83,"0.4 s · 本机生成",11,C.muted));content+=B(fx,sy+218,"接收选中候选",true,inner,44);}
  else if(n===22){content+=box(sy,"候选已生成，资源入库失败","产物仍保留在本机任务中。\n修复空间或目录权限后重新入库，无需重新生成。","red",144)+B(fx,sy+161,"修复并重新入库",true,inner,44);}
  else if(n===24){content+=box(sy,"正在阅读较早的消息","阅读位置保持，当前轮次仍在产生新内容。","blue",100)+B(fx,sy+150,"↓ 3 条新消息",false,inner,42);}
  else if(n===25){content+=box(sy,"连接中断后恢复到原轮次","输入与阅读位置已保留。\n工具与提交状态分别查询，不重新发起同一修改。","amber",140)+B(fx,sy+157,"查询并继续原任务",true,inner,44);}
  else if(n===26){content+=box(sy-18,"输入草稿保留","输入法组词期间不发送；返回先收起键盘。","blue",74);}
  else if(n===27){content+=R(fx,sy,inner,180,C.soft,10)+lines(fx+15,sy+35,"文字放大后，问题、授权与主要操作保持可读。焦点会回到触发控件。",inner-30,mobile?19:20,C.ink,31,4)+B(fx,sy+201,"继续本轮任务",true,inner,48);}
  else if(n===28){content+=box(sy,"平台预算与结算 · 后续能力","报价、冻结、实扣、释放和退款分别显示。\n自带账户与平台积分单独记录。","amber",141)+B(fx,sy+159,"后续平台能力",false,inner,44,true);}
 }
 svg+=content;
 const iy=keyboard?427:mobile?653:753,ih=mobile?99:106;
 svg+=R(x+14,iy,cw-28,ih,"white",10,C.line)+T(x+28,iy+30,n===18?"只讨论我自己输入的文字…":"继续描述你想做的修改…",mobile?12:13,C.muted)+I(x+28,iy+64,"plus",20)+P(x+58,iy+54,"自带模型  ▾","blue",116)+R(x+cw-54,iy+53,28,28,C.blue,8)+I(x+cw-49,iy+58,"arrow",18,"white");
 if(!mobile){
  svg+=R(1072,170,344,704,"white",11,C.line)+T(1089,201,"本轮状态",15,C.ink,600);
  const ownStates=view.state_ids.map(id=>states.find(z=>z.id===id)).filter(Boolean);
  let sy=226;
  ownStates.forEach(st=>{svg+=R(1087,sy,314,143,C.bg,9)+T(1101,sy+25,fit(st.title,285,13),13,C.ink,600)+lines(1101,sy+51,st.content,286,11,C.muted,20,3)+T(1101,sy+124,"查看活动与可恢复操作  →",11,C.blue);sy+=157;});
  svg+=P(1088,827,"费用来源：你的服务账户","blue",252);
 }
 if(keyboard){svg+=R(0,535,W,H-535,"#E0E5EE",0)+T(17,560,"shou ji   手机   收集",14,C.ink);
  ["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"].forEach((row,i)=>{const ww=(W-20)/row.length;[...row].forEach((z,j)=>svg+=R(8+j*ww,580+i*48,ww-5,39,"white",5)+T(8+j*ww+(ww-5)/2,606+i*48,z,14,C.ink,400,"middle"));});
  svg+=R(86,728,207,42,"white",5)+T(189,755,"空格",13,C.muted,400,"middle")+R(139,H-9,112,4,C.ink,2);
 }
 if(!mobile)svg+=T(208,943,"当前轮次使用发送时固定的模型、工具与权限；设置变更从下一轮生效。",11,C.muted);
 return {svg:svg+"</svg>",width:W,height:H};
};
