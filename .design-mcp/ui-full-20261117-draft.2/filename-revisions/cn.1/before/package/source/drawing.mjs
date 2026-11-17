// 设计绘制基础：仅生成矢量资产；数值是隔离的虚构设计夹具。
export const D=(function makeDrawing(){
  const C={ink:"#172B4D",muted:"#6A7B93",blue:"#246BEE",soft:"#EDF4FF",bg:"#F5F7FB",line:"#E2E9F2",green:"#16816B",mint:"#E8F6F0",amber:"#9D641D",cream:"#FFF6E5",red:"#C64555",rose:"#FFF0F2",purple:"#7966C5"};
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
  const rect=(x,y,w,h,fill="#FFFFFF",r=10,stroke="none",sw=1)=>`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const line=(x,y,x2,y2,c=C.line,sw=1,dash="")=>`<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${c}" stroke-width="${sw}" ${dash?`stroke-dasharray="${dash}"`:""}/>`;
  const text=(x,y,s,size=14,c=C.ink,weight=400,anchor="start")=>`<text x="${x}" y="${y}" fill="${c}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`;
  const len=(s,size)=>[...String(s)].reduce((a,c)=>a+(/[^\x00-\xff]/.test(c)?1:.57)*size,0);
  function fit(s,w,size=14){let a="";for(const c of String(s??"")){if(len(a+c,size)>w-size)return a+"…";a+=c;}return a;}
  function wrap(s,w,size=13,maxLines=5){const out=[];for(const seg of String(s??"").split(/\n/)){let a="";for(const c of seg){if(a&&len(a+c,size)>w){out.push(a);a=c;}else a+=c;}if(a)out.push(a);}return out.slice(0,maxLines).map((x,i)=>i===maxLines-1&&out.length>maxLines?fit(x,w-size,size)+"…":x);}
  const lines=(x,y,s,w,size=13,c=C.muted,gap=22,max=5)=>wrap(s,w,size,max).map((a,i)=>text(x,y+i*gap,a,size,c)).join("");
  const paths={
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M7 9h10M7 13h6"/>',
    nodes:'<rect x="2" y="8" width="6" height="8" rx="2"/><rect x="16" y="2" width="6" height="6" rx="2"/><rect x="16" y="16" width="6" height="6" rx="2"/><path d="M8 12h4V5h4M12 12v7h4"/>',
    scene:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/>',
    box:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M3 7l9 5v10"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',check:'<path d="m5 12 4 4L20 5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
    arrow:'<path d="M4 12h15m-5-6 6 6-6 6"/>',back:'<path d="M20 12H5m5-6-6 6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',play:'<path d="m8 4 12 8-12 8Z"/>',
    pause:'<path d="M8 4v16M16 4v16"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',
    sound:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c6 4 6 10 0 14"/>',
    history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    sync:'<path d="M4 8a8 8 0 0 1 14-2l3 3M21 3v6h-6M20 16a8 8 0 0 1-14 2l-3-3M3 21v-6h6"/>',
    folder:'<path d="M3 6h7l2 3h9v11H3Z"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    layers:'<path d="m12 2 10 6-10 6L2 8Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
    shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM21 2v4m-2-2h4"/>',
    settings:'<circle cx="12" cy="12" r="4"/><path d="m10 2-1 3-3 1-3 4 2 2-1 3 3 4 3-1 2 3 3-1 1-3 3-1 2-4-2-2 1-3-3-4-3 1-2-3Z"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    branch:'<circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 6v12M6 15c7 0 12-3 12-7"/>'
  };
  const icon=(x,y,n,size=20,c=C.muted)=>`<g id="icon_${esc(n)}_${x}_${y}" data-name="图标-${esc(n)}" transform="translate(${x} ${y}) scale(${size/24})" stroke="${c}" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[n]||paths.box}</g>`;
  const pill=(x,y,s,tone="blue",w)=>{const c=tone==="green"?C.green:tone==="amber"?C.amber:tone==="red"?C.red:C.blue,bg=tone==="green"?C.mint:tone==="amber"?C.cream:tone==="red"?C.rose:C.soft,ww=w||len(s,11)+22;return rect(x,y,ww,26,bg,6)+text(x+11,y+18,fit(s,ww-16,11),11,c,500);};
  const button=(x,y,s,primary=false,w=140,h=40,disabled=false)=>`<g id="button_${esc(String(s).replace(/[^\w\u4e00-\u9fff-]/g,"_"))}_${x}_${y}" data-name="按钮-${esc(s)}"><title>${esc(s)}</title>`+rect(x,y,w,h,disabled?"#E5EAF1":primary?C.blue:"#FFFFFF",8,primary&&!disabled?"none":C.line)+text(x+w/2,y+h/2+5,fit(s,w-20,13),13,disabled?C.muted:primary?"#FFFFFF":C.ink,500,"middle")+"</g>";
  const circle=(x,y,r,fill,stroke="none",sw=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const group=(x,y,s)=>`<g transform="translate(${x} ${y})">${s}</g>`;
  function value(f){
    const q=(f.label+" "+f.control).toLowerCase(),def=String(f.default??"");
    if(f.mock_value!==undefined)return String(f.mock_value);
    if(/key|token|secret|密钥|口令|密码/.test(q)&&!/keyboard|关键帧|键名|文本键/.test(q))return "••••••••  ·  本设备";
    if(/url|地址|endpoint/.test(q))return /最终/.test(q)?"由格式与地址生成":"https://api.example.com/v1";
    if(/包名/.test(q))return "com.example.startrail";
    if(/appid|app id/.test(q))return "待填写平台应用标识";
    if(/文件|目录|路径|位置.*存放/.test(q)&&!/寻路|路径诊断|节点路径/.test(q))return "本机 / GameGen / 星溪营地";
    if(/超时|并发|重试/.test(q))return "继承当前服务配置";
    if(/模型.?id/.test(q))return "填写供应商模型 ID";
    if(/格式.*api|api.*格式/.test(q))return "Responses";
    if(/base url/.test(q))return "https://api.example.com/v1";
    if(/名称|片段名/.test(q)&&/model|models|模型/.test(f.parent_page_id||f.surface_title||""))return "我的模型服务";
    if(/名称/.test(q)&&/slg/.test(f.parent_page_id||""))return "林间工坊";
    if(/名称/.test(q)&&/api/.test(f.parent_page_id||""))return "角色数据服务";
    if(/图种类/.test(q))return "事件动作图";
    if(/执行范围/.test(q))return "客户端";
    if(/名称|片段名/.test(q))return /图/.test(q)?"星星拾取反馈":/技能/.test(q)?"星芒冲击":/物品/.test(q)?"恢复药剂":/项目/.test(q)?"星溪冒险":/片段|动作/.test(q)?"轻快跑步":"冒险家";
    if(/高级|只读|readonly|read-only|capability|诊断|摘要|结果|实际|引用.*id/.test(q))return /版本/.test(q)?"r128 · 本机示例":/未知|能力/.test(q)?"由当前能力表提供":"查看当前项目";
    if(/高度.*单位|高度基准|基准通行面|垂直.*基准|有效逻辑/.test(q))return "继承地图的空间定义";
    if(/垂直.*最|高度.*区间/.test(q))return "待按当前面校准";
    if(/默认|disabled/.test(q))return def.length<15?def:"沿当前预设";
    if(/颜色|color/.test(q))return "#6A9FE8";
    if(/比例|权重|摩擦|密度|质量/.test(q))return /摩擦/.test(q)?"0.20":"1.00";
    if(/时长|duration|时间偏移|延迟/.test(q))return "0.25 s";
    if(/数量|次数|上限|count|amount|numeric|数值|半径|大小|尺寸|速度|角度|攻击|生命|金币|宽|高|坐标/.test(q))return /坐标|双轴|x.?y/i.test(q)?"320   /   180":/角/.test(q)?"24°":/生命/.test(q)?"120":/数量|次数/.test(q)?"3":"1.0";
    if(/公式/.test(q))return "基础攻击 × 1.2";
    if(/资源|asset|骨骼|bone|reference|引用|选择器|选择.*对象/.test(q))return /骨骼|bone/.test(q)?"hand_right":/音效|声音/.test(q)?"星星拾取 · 0.4 s":"选择兼容内容";
    if(/bool|toggle|开关|启用|是否/.test(q))return "开启";
    if(/文本|正文|text|说明|描述|prompt/.test(q))return /对白/.test(q)?"去森林里收集三颗星星吧。":"输入或编辑内容";
    if(/许可/.test(q))return "查看来源与使用范围";
    if(def&&def.length<18&&!/当前|沿|现有|模板|能力|读取|无或/.test(def))return def;
    if(/select|enum|choice|策略|模式|规则|类型|单选|下拉/.test(q))return "沿用当前预设";
    return "查看 / 编辑";
  }
  function control(f,x,y,w,opts={}){
    const name=String(f.label??f.id),c=String(f.control??""),key=(name+" "+c).toLowerCase(),size=opts.mobile?13:12,v=value(f);
    if(!opts.skipCompound&&c.includes("+")){
      const parts=c.split("+").filter(Boolean),names=name.split(/[\/／]/),cols=w>420&&parts.length>1?2:1,cw=(w-(cols-1)*14)/cols,ys=Array(cols).fill(y+30);
      let svg=text(x,y+14,name,size,C.muted,500);
      parts.forEach((part,i)=>{const col=i%cols;const sub={...f,id:f.id+"-part"+i,coverage_id:(f.coverage_id||f.id)+"-part"+i,label:names[i]||(/mode|select|enum/.test(part)?"选择方式":/numeric|number|duration/.test(part)?"数值":/toggle/.test(part)?"启用规则":/preview|read/.test(part)?"当前结果":"附加参数"),control:part,subfields:undefined};const rr=control(sub,x+col*(cw+14),ys[col],cw,{...opts,skipCompound:true});svg+=rr.svg;ys[col]+=rr.height+9;});
      return {svg:`<g id="field_${esc(String(f.coverage_id||f.id).replace(/[^\w-]/g,"_"))}_${esc(name.replace(/[^\w\u4e00-\u9fff-]/g,"_"))}" data-name="${esc(name)}"><title>${esc(name)}</title>${svg}</g>`,height:Math.max(...ys)-y+8,id:f.coverage_id||f.id,label:name};
    }
    let s=`<g id="field_${esc(String(f.coverage_id||f.id).replace(/[^\w-]/g,"_"))}_${esc(name.replace(/[^\w\u4e00-\u9fff-]/g,"_"))}" data-name="${esc(name)}" data-field-id="${esc(f.coverage_id||f.id)}"><title>${esc(name)}</title>`,h=84;
    const ls=wrap(name,w-14,size,2);s+=ls.map((a,i)=>text(x,y+14+i*18,a,size,C.muted,500)).join("");
    const yy=y+(ls.length>1?44:28);
    if(/switch|toggle|开关|是否|boolean/.test(key)&&!/switch.*reference/.test(key)){
      s+=rect(x,yy,w,38,"#FFFFFF",8,C.line)+text(x+12,yy+25,v,13)+rect(x+w-48,yy+9,34,20,C.blue,10)+circle(x+w-23,yy+19,7,"white");
    }else if(/color|颜色/.test(key)){
      s+=rect(x,yy,w,38,"#FFFFFF",8,C.line)+rect(x+10,yy+8,23,23,"#6A9FE8",5)+text(x+43,yy+25,"#6A9FE8",12)+text(x+w-20,yy+25,"▾",12,C.muted);
    }else if(/curve|曲线|gradient|渐变/.test(key)){
      h=122;s+=rect(x,yy,w,73,"#FFFFFF",8,C.line)+line(x+14,yy+56,x+w-12,yy+56)+line(x+14,yy+12,x+14,yy+56)+`<path d="M${x+16} ${yy+54} C${x+w*.45} ${yy+54} ${x+w*.45} ${yy+14} ${x+w-16} ${yy+14}" fill="none" stroke="${C.blue}" stroke-width="2.5"/>`+circle(x+16,yy+54,4,"white",C.blue,2)+circle(x+w-16,yy+14,4,"white",C.blue,2);
    }else if(/timeline|时间轴|阶段时长|timing|range-editor/.test(key)){
      h=112;s+=rect(x,yy,w,62,"#FFFFFF",8,C.line);
      for(let i=0;i<5;i++)s+=line(x+12+i*(w-24)/4,yy+13,x+12+i*(w-24)/4,yy+47)+text(x+12+i*(w-24)/4,yy+12,(i*.2).toFixed(1),9,C.muted);
      s+=rect(x+13,yy+29,w*.35,15,C.soft,3)+rect(x+w*.4,yy+29,w*.25,15,C.mint,3)+rect(x+w*.7,yy+29,w*.2,15,"#F0EBFB",3);
    }else if(/matrix|矩阵|方向.*grid|邻接/.test(key)){
      h=144;s+=rect(x,yy,w,97,"white",8,C.line);
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)s+=rect(x+15+b*27,yy+12+a*19,12,12,a===b||a+b===3?C.blue:C.bg,3,C.line);
      s+=text(x+135,yy+37,"分组关系",11,C.muted)+text(x+135,yy+62,"可逐格选择",11,C.muted);
    }else if(/list|tree|表|列表|参数数组|array|mapping|集合|schema/.test(key)&&!/textId|文本键/.test(key)){
      h=134;s+=rect(x,yy,w,84,"#FFFFFF",8,C.line);
      [0,1].forEach(i=>{s+=text(x+12,yy+24+i*29,/顶点/.test(key)?(i?"顶点 15 / 16 · 已选择":"顶点 14 · 权重可编辑"):/总线/.test(key)?(i?"语音 / 环境":"主音量 / 音乐 / 音效"):/参数|array/.test(key)?(i?"project-tools":"--service"):/依赖/.test(key)?(i?"拾取音效 · 必需":"角色图集 · 已选择"):/字段|schema/.test(key)?(i?"coins · integer":"id · string · 必填"):/轨道/.test(key)?(i?"脚步 / 事件":"身体 / 位置"):/对象|树|tree/.test(key)?(i?"角色 / 冒险家":"星溪营地 / 主场景"):i?"附加项":"当前选项",12)+text(x+w-18,yy+24+i*29,"⋮",14,C.muted);if(!i)s+=line(x+10,yy+35,x+w-10,yy+35);});
      s+=text(x+12,yy+76,"＋ 添加一项",11,C.blue);
    }else if(/slider|滑杆|权重|音量|opacity|透明度/.test(key)){
      h=96;s+=line(x+4,yy+22,x+w-65,yy+22,"#D6E2F3",5)+line(x+4,yy+22,x+w*.58,yy+22,C.blue,5)+circle(x+w*.58,yy+22,6,"white",C.blue,2)+rect(x+w-55,yy+4,55,34,"white",7,C.line)+text(x+w-29,yy+26,/权重/.test(key)?"0.80":"80%",12,C.ink,400,"middle");
    }else if(/textarea|markdown|正文|description|multiline|段落/.test(key)){
      h=134;s+=rect(x,yy,w,84,"#FFFFFF",8,C.line)+lines(x+12,yy+25,/skill/i.test(key)?"先确认目标，再调整路线与奖励。\n以可审阅提案呈现修改。":v,w-24,12,C.ink,22,3);
    }else{
      const ro=/readonly|read-only|只读|preview|摘要|诊断/.test(key);
      s+=rect(x,yy,w,40,ro?C.bg:"#FFFFFF",8,C.line);
      s+=text(x+12,yy+26,fit(v,w-43,opts.mobile?13:12),opts.mobile?13:12,ro?C.muted:C.ink);
      if(/select|enum|picker|choice|引用|策略|类型|模式|坐标|双轴|基准|格式|scope/.test(key))s+=icon(x+w-28,yy+12,"down",16);
      else if(/numeric|数值|number|amount|duration|数量|次数|时长/.test(key))s+=text(x+w-23,yy+25,"↕",13,C.muted);
      else if(/密钥|secret|token|key/.test(key))s+=icon(x+w-28,yy+12,"lock",16);
    }
    const unit=f.unit&&!/无|跟随|当前|^ID$/.test(f.unit)?String(f.unit):"";
    if(unit&&h<100){s+=text(x+w,y+h-1,fit(unit,w-4,10),10,C.muted,400,"end");h+=8;}
    s+="</g>";return {svg:s,height:Math.max(h,yy-y+54),id:f.coverage_id||f.id,label:name};
  }
  const defs='<defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".85" fill="#D3DEED"/></pattern><linearGradient id="hero" x2="1" y2=".4"><stop stop-color="#E9F1FF"/><stop offset="1" stop-color="#E8F6F1"/></linearGradient></defs>';
  return {C,esc,rect,line,text,len,fit,wrap,lines,icon,pill,button,circle,group,value,control,defs};
})();
