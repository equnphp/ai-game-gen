// GameGen 可编辑 UI 设计渲染源。仅用于生成 SVG / PNG 设计资产。
export const renderDesign = function renderDesign(spec, platform="desktop", state="normal", sceneAsset="") {
  // 该渲染器只生成可编辑设计画板，不连接业务接口，也不写入产品工程数据。
  if(state==="skill_add")spec={...spec,title:"添加 Skill 技能"};
  const mobile=platform==="android", landscape=state.includes("landscape");
  if(state.includes("landscape_invalid")) state="landscape_invalid";
  const W=mobile?(landscape?844:390):1440,H=mobile?(landscape?390:844):960;
  const C={ink:"#172B4D",muted:"#6A7B93",blue:"#246BEE",soft:"#EDF4FF",bg:"#F5F7FB",line:"#E3E9F2",green:"#16816B",mint:"#E9F6F1",red:"#C84454",rose:"#FFF1F2",amber:"#9D641D",cream:"#FFF7E8",white:"#FFFFFF"};
  const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const R=(x,y,w,h,fill=C.white,r=12,stroke="none")=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
  const fitText=(s,maxPx,size)=>{let a="",n=0;for(const ch of String(s)){const dx=(/[\x00-\x7F]/.test(ch)?0.56:1)*size;if(n+dx>maxPx)return a+"…";a+=ch;n+=dx;}return a;};
  const T=(x,y,s,size=14,fill=C.ink,weight=400,anchor="start")=>{size=mobile?Math.max(12,size):size;return `<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;};
  const L=(x1,y1,x2,y2,color=C.line,width=1,dash="")=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" ${dash?`stroke-dasharray="${dash}"`:""}/>`;
  const paths={
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    chat:'<path d="M20 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 17 0Z"/><path d="M7 9h9M7 13h6"/>',
    scene:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/>',
    nodes:'<rect x="2" y="8" width="6" height="8" rx="2"/><rect x="16" y="2" width="6" height="6" rx="2"/><rect x="16" y="16" width="6" height="6" rx="2"/><path d="M8 12h4V5h4M12 12v7h4"/>',
    box:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M3 7l9 5v10"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',arrow:'<path d="M4 12h15m-5-6 6 6-6 6"/>',
    check:'<path d="m5 12 4 4L20 5"/>',back:'<path d="M20 12H5m5-6-6 6 6 6"/>',
    settings:'<circle cx="12" cy="12" r="4"/><path d="m10 2-1 3-3 1-3 4 2 2-1 3 3 4 3-1 2 3 3-1 1-3 3-1 2-4-2-2 1-3-3-4-3 1-2-3Z"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    history:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2"/>',
    sound:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c6 4 6 10 0 14"/>',
    spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM21 2v4m-2-2h4"/>',
    sync:'<path d="M4 8a8 8 0 0 1 14-2l3 3M21 3v6h-6M20 16a8 8 0 0 1-14 2l-3-3M3 21v-6h6"/>',
    folder:'<path d="M3 6h7l2 3h9v11H3Z"/>',
    shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    layers:'<path d="m12 2 10 6-10 6L2 8Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>'
  };
  const I=(x,y,name,size=20,color=C.muted)=>`<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.box}</g>`;
  const pill=(x,y,label,tone="blue",width)=>{const w=width||label.length*12+22;return R(x,y,w,26,tone==="green"?C.mint:tone==="red"?C.rose:tone==="amber"?C.cream:C.soft,7)+T(x+11,y+18,label,11,tone==="green"?C.green:tone==="red"?C.red:tone==="amber"?C.amber:C.blue,500)};
  const btn=(x,y,label,primary=false,width,ico)=>{const w=width||label.length*14+30+(ico?24:0);return R(x,y,w,mobile?44:38,primary?C.blue:C.white,8,primary?"none":C.line)+(ico?I(x+12,y+11,ico,17,primary?C.white:C.muted):"")+T(x+(ico?37:w/2),y+(mobile?28:25),label,13,primary?C.white:C.ink,500,ico?"start":"middle");};
  const textLines=(x,y,lines,size=13,color=C.muted,gap=23)=>lines.map((s,i)=>T(x,y+i*gap,s,size,color)).join("");
  const field=(x,y,w,label,value,desc)=>T(x,y,label,12,C.muted,500)+R(x,y+12,w,42,C.white,8,C.line)+T(x+12,y+39,value,13)+ (desc?T(x,y+73,desc,11,C.muted):"");
  const toggle=(x,y,on=true)=>R(x,y,34,20,on?C.blue:"#CBD5E2",10)+`<circle cx="${x+(on?24:10)}" cy="${y+10}" r="7" fill="white"/>`;
  const card=(x,y,w,h,title,sub,ico)=>R(x,y,w,h,C.white,12,C.line)+(ico?R(x+16,y+16,38,38,C.soft,10)+I(x+24,y+24,ico,22,C.blue):"")+T(x+(ico?68:20),y+34,mobile?fitText(title,w-(ico?83:40),14):title,14,C.ink,600)+(sub?T(x+20,y+65,mobile?fitText(sub,w-40,12):sub,12,C.muted):"");
  const fmtId=id=>id.replace(/^REQ-/,"");
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">${esc(spec.title)} · ${mobile?"Android":"桌面"} · ${esc(state)}</title><desc id="desc">GameGen 全量 UI 设计草案。可编辑矢量画板，示例内容。${esc(spec.actions.join("，"))}</desc><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#D9E3F0"/></pattern><linearGradient id="hero" x2="1" y2=".4"><stop stop-color="#EDF4FF"/><stop offset="1" stop-color="#E8F6F4"/></linearGradient></defs>`;
  svg+=R(0,0,W,H,C.bg,0);
  const nav=[["项目","grid"],["对话","chat"],["画面","scene"],["工作流","nodes"],["资源","box"],["发布","globe"],["更多工具","grid"]];
  let active=spec.group==="创作"?"对话":spec.group==="画面"||spec.group==="世界"||spec.group==="玩法"?"画面":spec.group==="工作流"?"工作流":spec.group==="资源"?"资源":spec.group==="发布"?"发布":spec.group==="项目"?"项目":"更多工具";
  if(!mobile){
    svg+=R(0,0,192,H,C.white,0)+L(192,0,192,H);
    svg+=R(20,22,34,34,C.blue,9)+I(27,29,"nodes",20,C.white)+T(64,43,"GameGen",21,C.ink,700)+T(20,86,"AIMETA · GAME STUDIO",10,C.muted,600);
    nav.forEach(([label,ico],n)=>{let y=114+n*51;svg+=(label===active?R(12,y,168,42,C.soft,8):"")+I(26,y+11,ico,20,label===active?C.blue:C.muted)+T(57,y+27,label,14,label===active?C.blue:C.ink,label===active?600:400);});
    svg+=L(20,493,172,493)+T(26,522,"本地工作区",11,C.muted,600);
    [["星岛冒险","folder"],["附近设备","sync"],["版本历史","history"]].forEach(([label,ico],n)=>svg+=I(26,541+n*42,ico,18)+T(57,556+n*42,label,13));
    svg+=R(16,H-152,160,72,C.bg,10)+I(28,H-138,"shield",18,C.green)+T(54,H-124,"项目保存在本机",12,C.ink,500)+T(28,H-100,"资源与改动随时可带走",10,C.muted);
    svg+=I(26,H-54,"settings",20)+T(57,H-39,"偏好与扩展",13)+R(151,H-59,28,28,C.soft,14)+T(165,H-40,"A",12,C.blue,600,"middle");
    svg+=R(193,0,W-193,72,C.white,0)+L(193,72,W,72)+I(216,25,"folder",20)+T(246,40,"星岛冒险",14,C.ink,600)+T(345,40,"/  "+spec.group,12,C.muted);
    svg+=`<circle cx="1031" cy="36" r="4" fill="${C.green}"/>`+T(1044,40,"已保存到本机",11,C.muted)+btn(1160,17,"试玩",false,96,"play")+btn(1270,17,"导出游戏",true,144,"globe");
    svg+=T(216,118,spec.title,24,C.ink,600)+T(216,146,spec.id==="projects"?"让灵感，成为可以玩的世界。":spec.id==="chat"?"描述你的想法，每次修改都可以查看和继续编辑。":spec.group==="同步"?"在局域网中继续创作，保留每台设备的本地副本。":spec.group==="迁移"?"把已有作品带进 GameGen，保留来源和手工修改。":"星岛冒险  /  "+spec.group+"  /  "+spec.actions.slice(0,3).join(" · "),12,C.muted);
    svg+=btn(1286,100,spec.actions[0],false,128);
  }else if(!landscape){
    svg+=R(0,0,W,94,C.white,0)+T(22,21,"9:41",12,C.ink,600)+T(368,21,"▰  ▮",11,C.ink,500,"end");
    svg+=I(18,49,spec.id==="projects"?"grid":"back",23,C.ink)+T(54,66,spec.id==="projects"?"GameGen":"星岛冒险",17,C.ink,600)+I(302,49,"history",21)+I(346,49,"more",22)+L(0,94,W,94);
    svg+=T(20,126,spec.title,21,C.ink,600);
    svg+=R(0,772,W,72,C.white,0)+L(0,772,W,772);
    [["对话","chat"],["画面","scene"],["工作流","nodes"],["资源","box"],["更多","grid"]].forEach(([label,ico],i)=>{const col=(label===active||(label==="更多"&&active==="更多工具"))?C.blue:C.muted;svg+=I(27+i*78,783,ico,22,col)+T(39+i*78,821,label,10,col,500,"middle");});
    svg+=R(139,835,112,4,C.ink,2);
  }else{
    svg+=R(0,0,W,54,C.white,0)+I(18,16,"back",22)+T(52,35,spec.title,17,C.ink,600)+btn(690,7,"返回竖屏",false,132);
  }
  const bx=mobile?20:216,by=mobile?(landscape?66:148):176,bw=mobile?(landscape?804:350):1200,bh=mobile?(landscape?304:604):744;
  const label=spec.title,id=spec.id;
  let body="";
  const tabs=(items,selected=0,y=0)=>items.map((t,i)=>{const width=Math.min(mobile?108:130,t.length*14+30);const x=items.slice(0,i).reduce((a,b)=>a+Math.min(mobile?108:130,b.length*14+30)+8,0);return R(x,y,width,34,i===selected?C.soft:C.white,8,i===selected?"none":C.line)+T(x+width/2,y+23,t,12,i===selected?C.blue:C.muted,i===selected?600:400,"middle")}).join("");
  const notice=(title,sub,tone="blue",y=0)=>R(0,y,bw,sub?76:48,tone==="red"?C.rose:tone==="amber"?C.cream:C.soft,10)+I(14,y+15,"info",18,tone==="red"?C.red:tone==="amber"?C.amber:C.blue)+T(42,y+28,title,13,tone==="red"?C.red:C.ink,600)+(sub?T(42,y+54,sub,11,C.muted):"");
  const listRows=(items,y=52,w=bw)=>items.map((a,i)=>{const yy=y+i*(mobile?82:72);return R(0,yy,w,mobile?72:62,C.white,10,C.line)+R(14,yy+14,34,34,C.soft,9)+I(21,yy+21,a[2]||"box",20,C.blue)+T(61,yy+28,a[0],13,C.ink,600)+T(61,yy+49,mobile?fitText(a[1],w-92,12):a[1],11,C.muted)+I(w-34,yy+23,"arrow",18)}).join("");
  const table=(headers,data,y=52,width=bw)=>{
    const cw=width/headers.length;
    let s=R(0,y,width,44+data.length*52,C.white,10,C.line)+R(1,y+1,width-2,42,C.bg,9);
    headers.forEach((h,i)=>s+=T(16+i*cw,y+27,h,11,C.muted,500));
    data.forEach((row,r)=>{let yy=y+44+r*52;s+=L(0,yy,width,yy);row.forEach((v,c)=>s+=T(16+c*cw,yy+31,v,mobile?11:12,c===0?C.ink:C.muted,c===0?500:400));});
    return s;
  };
  const assetArt=(x,y,w,h,type=0)=>{
    let s=R(x,y,w,h,["#E8F2FF","#E7F5EF","#FFF3E1","#F0EBFB"][type%4],9);
    if(type%4===0) s+=`<g transform="translate(${x+w/2} ${y+h/2})"><path d="M-20 -17 0 -32 20 -17 13 15 0 29-13 15Z" fill="#69A6EE"/><path d="M0 -32v61L20-17Z" fill="#3674CE"/><path d="m-20-17 20 8 20-8" fill="none" stroke="#C7E3FF" stroke-width="3"/></g>`;
    if(type%4===1) s+=`<g transform="translate(${x+w/2} ${y+h/2})"><path d="M-6 13h12v25H-6Z" fill="#92724D"/><path d="m0-39 31 46H-31Zm0-21 25 37H-25Z" fill="#48A989"/><path d="m0-39 31 46H0Z" fill="#218773"/></g>`;
    if(type%4===2) s+=I(x+w/2-26,y+h/2-26,"sound",52,"#C38A3C");
    if(type%4===3) s+=`<g transform="translate(${x+w/2} ${y+h/2})"><ellipse cy="32" rx="29" ry="6" fill="#DDD5F2"/><path d="M-18-2h36l7 29H-25Z" fill="#7965C4"/><circle cy="-20" r="17" fill="#F8D1B1"/><path d="M-19-21q19-33 38 0v-8q-19-26-38 8" fill="#38486C"/><path d="m-12 27-5 14m29-14 5 14" stroke="#38486C" stroke-width="9" stroke-linecap="round"/></g>`;
    return s;
  };
  const worldArt=(x,y,w,h,mode="map")=>{
    let s=R(x,y,w,h,"#E7F1F4",12)+`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 800 580" preserveAspectRatio="xMidYMid meet">`;
    s+=`<ellipse cx="406" cy="414" rx="302" ry="116" fill="#CFDFE7"/><g transform="translate(400 105)">`;
    const tw=62,th=31;
    for(let a=0;a<7;a++)for(let b=0;b<7;b++){
      let xx=(a-b)*tw/2,yy=(a+b)*th/2;
      let water=(a===0||b===6||(a===5&&b===1)),elev=mode==="map-height"&&(a===4||a===5)&&b>2?25:0;
      let fc=water?"#8AC8DC":(a+b)%2?"#A9D7BB":"#B6DEC2";
      s+=`<path d="M${xx} ${yy-elev}l31 15.5-31 15.5-31-15.5Z" fill="${fc}" stroke="${water?"#73BACC":"#97C9AC"}" stroke-width=".8"/>`;
      if(a===6||b===6)s+=`<path d="M${xx-31} ${yy+15.5-elev}l31 15.5 31-15.5v27l-31 15.5-31-15.5Z" fill="#749C8D" stroke="#638C81" stroke-width=".5"/>`;
      if((a===1&&b===2)||(a===5&&b===4)||(a===2&&b===5))s+=`<g transform="translate(${xx} ${yy-15-elev})"><path d="M-4 13h8v24h-8" fill="#8F775B"/><path d="m0-38 21 40h-42Zm0-13 17 32h-34Z" fill="#3B9D7C"/><path d="m0-38 21 40H0Z" fill="#2A886C"/></g>`;
      if(a===3&&b===2)s+=`<g transform="translate(${xx} ${yy-elev})"><path d="m-25-15 25-14 25 14v34L0 33-25 19Z" fill="#E9D1A7"/><path d="m0-55 37 30L0-5-37-25Z" fill="#6E8BB4"/><path d="M0-5v38l25-14v-34Z" fill="#CCB48C"/><path d="M8 11h11v14H8Z" fill="#547297"/></g>`;
    }
    if(mode==="map-path")s+=`<path d="M-93 78 0 124 62 155 93 171" fill="none" stroke="#246BEE" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 12"/><circle cx="-93" cy="78" r="9" fill="#246BEE"/><circle cx="93" cy="171" r="9" fill="#16816B"/>`;
    s+=`<path d="M0 124l31 15.5-31 15.5-31-15.5Z" fill="#246BEE" fill-opacity=".16" stroke="#246BEE" stroke-width="3"/><g transform="translate(0 111)"><circle cy="-22" r="8" fill="#F3C5A3"/><path d="M-9-14h18l4 22h-26Z" fill="#5877D0"/><path d="m-5 8-4 10m14-10 4 10" stroke="#304D78" stroke-width="5"/></g></g></svg>`;
    return s;
  };
  const sceneArt=(x,y,w,h)=>{
    if(sceneAsset)return R(x,y,w,h,"#0D234C",12)+`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice">${sceneAsset}</svg>`;
    return worldArt(x,y,w,h);
  };
  const steps=(items,chosen=0,y=0)=>items.map((t,i)=>{let col=i<=chosen?C.blue:"#BCC8D8",x=mobile?i*87:i*(bw/items.length);return (i<items.length-1?L(x+30,y+16,x+(mobile?83:bw/items.length)-8,y+16,C.line,2):"")+R(x,y+2,28,28,i<=chosen?C.soft:C.white,14,C.line)+T(x+14,y+21,i<chosen?"✓":i+1,11,col,600,"middle")+T(x,y+52,t,mobile?10:12,i===chosen?C.ink:C.muted,i===chosen?600:400)}).join("");
  const inspector=(x,y,w,fields,title="属性")=>{
    let s=R(x,y,w,mobile?292:bh-46,C.white,11,C.line)+T(x+16,y+30,title,14,C.ink,600)+I(x+w-34,y+16,"more",18)+L(x,y+46,x+w,y+46);
    fields.slice(0,mobile?3:6).forEach(([key,value],i)=>s+=field(x+16,y+73+i*81,w-32,key,value));
    return s;
  };
  const editLayouts=["scene","inspector","ui-editor","physics","particles","timeline","skeleton","map","map-height","map-path","preview"];
  if(id==="projects"){
    body+=R(0,0,bw,mobile?172:198,"url(#hero)",14)+T(22,38,mobile?"你的下一款游戏，从这里开始":"把一个想法，变成你的下一款游戏",mobile?20:28,C.ink,600);
    body+=textLines(22,mobile?70:75,mobile?["通过对话创作，也能亲手调整每个细节。"]:["通过对话搭建玩法，在画面和工作流中随时精修。","从一个简单的跳跃关卡开始，也可以带入已有工程。"],12,C.muted,25);
    body+=btn(22,mobile?112:129,"新建游戏",true,132,"plus")+(!mobile?btn(168,129,"从引擎导入",false,155,"folder")+worldArt(820,4,330,188):"");
    let y=mobile?205:232;body+=T(0,y,"最近项目",17,C.ink,600)+T(bw,y,"全部项目  →",12,C.blue,500,"end");
    if(mobile){body+=sceneArt(0,y+22,bw,146)+R(0,y+168,bw,79,C.white,0)+T(16,y+197,"星岛冒险",16,C.ink,600)+pill(236,y+181,"2.5D","blue",96)+T(16,y+226,"3 张地图  ·  今天 14:32 保存",11,C.muted)+card(0,y+267,bw,87,"像素小农场","经营模拟 · 昨天编辑","folder");}
    else {["星岛冒险","像素小农场","最后一道防线"].forEach((t,i)=>{let x=i*408;body+=R(x,y+25,384,288,C.white,12,C.line)+(i===0?sceneArt(x+10,y+35,364,176):worldArt(x+10,y+35,364,176,i===2?"map-height":"map"))+T(x+18,y+244,t,17,C.ink,600)+T(x+18,y+275,["动作冒险 · 3 张地图","经营模拟 · 1 个世界","塔防策略 · 8 个关卡"][i],12,C.muted)+I(x+344,y+236,"more",20);});body+=T(0,610,"继续你的创作",16,C.ink,600)+card(0,632,588,90,"在手机上接着做","通过附近设备发送项目，离线也能独立编辑。","sync")+card(612,632,588,90,"从熟悉的玩法出发","浏览玩法模板，规则和工作流都可以修改。","nodes");}
  }else if(["create","templates"].includes(spec.layout)){
    body+=tabs(mobile?["推荐玩法","全部类型","我的模板"]:["推荐玩法","动作与冒险","角色扮演","经营与策略","休闲与益智"]);
    let types=["平台跳跃","斜45°冒险","RPG 角色扮演","经营农场","塔防策略","解谜探索","回合策略","音游节奏"];
    const cols=mobile?2:4,cw=(bw-(cols-1)*16)/cols;
    types.slice(0,mobile?4:8).forEach((t,i)=>{let x=i%cols*(cw+16),y=54+Math.floor(i/cols)*(mobile?150:200);body+=R(x,y,cw,mobile?134:184,i===1?C.soft:C.white,12,i===1?C.blue:C.line)+assetArt(x+12,y+12,cw-24,mobile?75:117,i)+T(x+14,y+(mobile?111:149),t,mobile?12:14,C.ink,600)+(!mobile?T(x+14,y+172,"规则与素材均可继续编辑",11,C.muted):"");});
    let fy=mobile?400:514;body+=field(0,fy,mobile?350:586,"游戏名称","我的星岛冒险")+(!mobile?field(614,fy,586,"存放位置","本机 / GameGen / Projects"):"")+btn(0,mobile?511:627,"创建并开始",true,mobile?350:180);
  }else if(spec.layout==="chat"){
    const left=mobile?bw:430;
    if(!mobile){body+=R(0,0,left,bh,C.white,12,C.line)+sceneArt(450,0,750,428)+R(450,446,750,298,C.white,12,C.line)+T(470,479,"当前项目",15,C.ink,600)+pill(1064,459,"可继续编辑","green",116)+`<g transform="translate(470 495)">${table(["内容","本次变化","状态"],[["拾取水晶","奖励 + 10 金币","待应用"],["角色跳跃","高度 2.4 → 2.8","待应用"],["碰撞工作流","新增条件节点","待应用"]],0,710)}</g>`;}
    const xx=mobile?0:18,ww=mobile?bw:left-36;
    body+=pill(xx,14,"创作会话","blue",88)+T(xx+100,32,"星岛玩法打磨",12,C.muted)+I(left-38,16,"more",18);
    body+=R(xx+38,65,ww-38,72,C.soft,11)+textLines(xx+54,93,mobile?["给水晶添加拾取反馈，","再让角色跳得高一点。"]:["给水晶添加拾取音效和粒子，","再让角色跳得高一点。"],13,C.ink,23);
    body+=R(xx,160,30,30,C.blue,9)+I(xx+6,166,"spark",18,C.white)+T(xx+42,180,"GameGen",13,C.ink,600)+textLines(xx+42,210,mobile?["我会修改三个地方，","确认后会一起应用到项目。"]:["我会沿用现有工作流，修改以下内容。","你可以先预览，再决定是否应用。"],12,C.ink,24);
    body+=R(xx+42,260,ww-42,mobile?152:174,C.white,10,C.line)+T(xx+57,288,"本次修改 · 3 项",13,C.ink,600);
    ["拾取水晶 → 播放音效","添加 0.4 秒闪光粒子","跳跃高度调整为 2.8"].forEach((s,i)=>body+=I(xx+57,304+i*28,"check",16,C.green)+T(xx+81,317+i*28,s,11));
    body+=btn(xx+42,mobile?431:451,"查看修改并应用",true,ww-42);
    const yy=mobile?505:578;
    body+=R(xx,yy,ww,mobile?95:140,C.white,12,C.line)+T(xx+14,yy+29,"继续描述你想修改的地方…",12,C.muted)+I(xx+14,yy+61,"plus",20)+pill(xx+46,yy+50,"自带模型  ▾","blue",121)+R(xx+ww-40,yy+51,28,28,C.blue,8)+I(xx+ww-35,yy+56,"arrow",18,C.white);
    if(!mobile)body+=T(xx+14,yy+118,"本轮费用：由你的模型服务账户结算",10,C.muted);
  }else if(editLayouts.includes(spec.layout)){
    const isMap=spec.layout.startsWith("map"),isTimeline=["timeline","skeleton"].includes(spec.layout);
    const panelFields=state.includes("physics_advanced")?[["积分步长","固定 1/60 秒"],["碰撞检测","连续检测 CCD"],["摩擦 / 弹性","0.2 / 0.0"],["单向平台","从上方碰撞"],["分组掩码","Player × World"],["睡眠策略","静止后休眠"]]:state.includes("particles_advanced")?[["发射形状","圆锥 · 45°"],["颜色曲线","白色 → 蓝色 → 透明"],["最大粒子数","128"],["随机种子","20261117"],["模拟空间","世界空间"],["对象销毁","随对象停止并清除"]]:state.includes("skeleton_advanced")?[["混合与权重","Run 0.8 / Idle 0.2"],["动画事件","footstep · 0.2s"],["挂点规则","hand_right"],["插值","线性"],["资源版本","adventurer v2"],["越界处理","循环片段内采样"]]:isMap?[["地块类型",spec.layout==="map-height"?"桥面 · 高度 2":"草地"],["通行面",spec.layout==="map-path"?"桥面 / 地面独立":"地面"],["碰撞","可通行"],["遮挡","角色进入时淡出"],["所属关卡","星岛 · 初次出发"],["高级设置","展开  ▾"]]:
      spec.layout==="physics"?[["运动预设","平台角色"],["碰撞体","胶囊 · 28 × 56"],["重力比例","1.0"],["跳跃高度","2.8"],["碰撞分组","Player → World"],["高级参数","展开  ▾"]]:
      spec.layout==="particles"?[["特效预设","拾取闪光"],["发射数量","24"],["生命周期","0.4 秒"],["起始速度","80 px/s"],["混合方式","叠加"],["高级参数","展开  ▾"]]:
      spec.layout==="skeleton"?[["当前动作","跑步 · Run"],["骨骼","hand_right"],["旋转","24°"],["蒙皮","冒险家 · 默认"],["挂点","武器 · 右手"],["混合时长","0.15 秒"]]:
      spec.layout==="ui-editor"?[["控件","金币文本"],["锚点","左上角"],["文本绑定","player.coins"],["布局方向","自动"],["字体大小","24"],["点击事件","打开背包"]]:
      id==="camera"?[["相机","主摄像机"],["投影","2D 正交"],["跟随目标","冒险家"],["边界","当前地图"],["缩放","1.0"],["安全区域","显示"]]:
      id==="controls"?[["操作方式","虚拟摇杆 + 跳跃"],["键盘映射","WASD / Space"],["触控映射","左摇杆 / 右按钮"],["冲突处理","UI 优先"],["取消输入","清除按压状态"],["高级设置","展开  ▾"]]:
      id==="prefab"?[["源预制体","冒险家"],["实例覆盖","跳跃高度 · 已修改"],["覆盖值","2.8"],["模板值","2.4"],["引用实例","4 个"],["应用范围","仅当前实例"]]:
      [["名称","冒险家"],["位置 X / Y","320  /  180"],["缩放 X / Y","1.0  /  1.0"],["旋转","0°"],["所在图层","角色与交互"],["组件","运动 · 碰撞 · 动作"]];
    body+=tabs(isMap?["画地面","放物体","寻路试玩"]:["选择","移动","旋转",...(mobile?[]:["缩放"])]);
    if(mobile&&!landscape){
      body+=(isMap?worldArt(0,48,bw,244,spec.layout):sceneArt(0,48,bw,244));
      body+=R(8,57,104,28,C.white,6)+T(19,76,isMap?"地面 · 高度 0":"主场景 · 100%",10,C.muted)+btn(218,296,"横屏编辑",false,132);
      body+=inspector(0,353,bw,panelFields.slice(0,2),isMap?"所选地块 · (4, 3)":"所选对象 · 冒险家");
    }else{
      const lw=landscape?0:174,rw=landscape?224:266,cx=lw?lw+16:0,cw=bw-cx-rw-16,cy=48,ch=bh-48-(isTimeline?178:0);
      if(lw){body+=R(0,cy,lw,bh-cy,C.white,10,C.line)+T(16,cy+30,isMap?"地图图层":"场景对象",13,C.ink,600);
        (isMap?["地面","桥面与坡道","建筑","装饰","碰撞与通行"]:["主场景","  冒险家","  水晶 × 8","  岛屿与平台","  背景","  游戏 UI"]).forEach((s,i)=>body+=(i===1?R(8,cy+51+i*40,lw-16,34,C.soft,6):"")+I(16,cy+59+i*40,"layers",15,i===1?C.blue:C.muted)+T(40,cy+72+i*40,s,11,i===1?C.blue:C.ink));}
      body+=(isMap?worldArt(cx,cy,cw,ch,spec.layout):sceneArt(cx,cy,cw,ch));
      body+=R(cx+12,cy+12,135,30,C.white,7)+T(cx+24,cy+33,isMap?"等距视图  ·  100%":"主相机  ·  100%",11,C.muted);
      body+=inspector(bw-rw,cy,rw,panelFields,isMap?"地块与通行面":"对象属性");
      if(isTimeline){let ty=bh-164;body+=R(cx,ty,cw,164,C.white,10,C.line)+T(cx+14,ty+27,"时间轴 · 跑步",12,C.ink,600)+I(cx+cw-35,ty+13,"play",18,C.blue);
        for(let i=0;i<7;i++)body+=T(cx+125+i*70,ty+26,(i*.2).toFixed(1),9,C.muted)+L(cx+132+i*70,ty+39,cx+132+i*70,ty+150);
        ["身体 / position","右手 / rotation","事件 / footstep"].forEach((s,i)=>{body+=T(cx+12,ty+62+i*33,s,10);for(let j=0;j<5;j++)body+=R(cx+130+j*78,ty+49+i*33,10,10,C.blue,2);});}
    }
  }else if(["graph","debug","world"].includes(spec.layout)){
    const gw=mobile?bw:(landscape?bw-220:910),gh=mobile?(landscape?bh:370):bh-110;
    body+=tabs(id==="dialogue"?["分支对白","变量","预览"]:id==="animation-graph"?["状态","过渡","参数"]:id==="server-graph"?["服务端","客户端","契约"]:["事件动作图","校验","调试"]);
    body+=R(0,48,gw,gh,"#F0F4FA",11,C.line)+R(0,48,gw,gh,"url(#dots)",11);
    const nodes=state==="module_rpg"?[["接受任务","NPC · 村长"],["目标完成？","水晶数量 ≥ 3"],["提交并领奖","一次性奖励"],["继续任务","保持进度"]]:state==="module_slg"?[["开始建造","选定建筑"],["校验空间与资源","可放置 / 金币足够"],["创建生产队列","扣除资源一次"],["返回失败原因","保留玩家输入"]]:state==="module_levels"?[["进入关卡","固定地图版本"],["通关目标完成？","组合目标 AND"],["结算与保存","解锁下一关"],["失败后重试","恢复检查点"]]:id==="dialogue"?[["开始对白","村长 · 初次见面"],["是否拥有水晶","数量 ≥ 3"],["完成任务","发放奖励"],["继续探索","提示寻找水晶"]]:
      id==="animation-graph"?[["待机 · Idle","默认状态"],["速度 > 0","过渡条件"],["跑步 · Run","循环播放"],["跳跃 · Jump","空中状态"]]:
      id==="world"?[["星岛营地","出生点 · 01"],["穿过传送门","玩家交互"],["遗迹外缘","地图 · 02"],["森林深处","地图 · 03"]]:
      id==="server-graph"?[["收到移动意图","服务端事件"],["校验归属与速度","可信检查"],["更新位置","权威状态"],["拒绝并纠正","失败分支"]]:
      [["碰到水晶","对象事件"],["还未被拾取？","条件判断"],["增加金币","数量：10"],["音效与粒子","拾取反馈"]];
    const nodeW=mobile?150:215,nodeH=92;
    const ps=mobile?[[14,75],[174,195],[14,315],[174,435]]:[[28,120],[300,120],[594,70],[594,270]];
    const shown=mobile&&!landscape?ps.slice(0,3):ps;
    shown.forEach((p,i)=>{if(i>0){let prev=ps[i===3?1:i-1];body+=`<path d="M${prev[0]+nodeW} ${prev[1]+44} C${prev[0]+nodeW+44} ${prev[1]+44} ${p[0]-44} ${p[1]+44} ${p[0]} ${p[1]+44}" fill="none" stroke="${i===3?"#D29A44":C.blue}" stroke-width="2.5"/>`;}
      body+=R(p[0],p[1],nodeW,nodeH,C.white,10,i===1?C.blue:C.line)+R(p[0],p[1],nodeW,5,i===0?"#43A28D":i===1?"#D59A46":C.blue,2)+T(p[0]+14,p[1]+31,nodes[i][0],12,C.ink,600)+T(p[0]+14,p[1]+59,nodes[i][1],10,C.muted)+`<circle cx="${p[0]}" cy="${p[1]+44}" r="5" fill="${C.white}" stroke="${C.blue}" stroke-width="2"/><circle cx="${p[0]+nodeW}" cy="${p[1]+44}" r="5" fill="${C.blue}"/>`;});
    body+=btn(12,gh+62,"添加节点",true,128,"plus");
    if(mobile&&!landscape)body+=inspector(0,473,bw,[["条件","水晶.collected = false"]],"所选节点 · 条件判断");
    else if(!landscape)body+=inspector(930,48,270,[["节点","还未被拾取？"],["输入类型","水晶对象"],["条件","collected = false"],["成立时","增加金币"],["不成立时","结束"],["执行域",id==="server-graph"?"服务端":"客户端"]],"节点属性");
  }else if(["assets","nodes","tools","rpg","skills","models","mcp","templates"].includes(spec.layout)){
    body+=R(0,0,bw,42,C.white,8,C.line)+I(13,11,"search",19)+T(42,27,"搜索"+(spec.layout==="assets"?"名称、类型或标签":spec.title),12,C.muted);
    body+=tabs(spec.layout==="assets"?["全部","图片","音频","预制体"]:spec.layout==="tools"?["推荐","画面","玩法","联网"]:["全部","当前项目","内置"],0,56);
    const items=spec.layout==="assets"?[["能量水晶","图片 · 72 × 88"],["森林地块","地图素材 · 8 张"],["拾取音效","音频 · 0.4 s"],["冒险家","角色 · 6 个动作"],["星岛背景","图片 · 1920 × 1080"],["关卡完成","音频 · 1.2 s"]]:
      spec.layout==="nodes"?[["对象事件","碰撞、点击、创建与销毁"],["条件与分支","比较、组合、空值与范围"],["数值与数据","表格、公式、对象参数"],["异步与 API","成功、超时、取消与重试"],["地图与移动","通行面、路径、传送"],["子工作流","参数与版本化接口"]]:
      spec.layout==="tools"?[["地图与关卡","画地面、放物体、配置目标"],["数值与成长","表格、公式与平衡模拟"],["任务与对白","分支剧情与任务进度"],["物理与运动","角色控制与碰撞"],["骨骼与动作","蒙皮、挂点与状态图"],["API 与服务端","契约与网络工作流"]]:
      spec.layout==="rpg"?[["冒险家","等级 5 · 生命 120"],["火焰冲击","主动技能 · 冷却 4 秒"],["恢复药水","物品 · 回复 40"],["灼烧","Buff · 每秒 5 伤害"],["村长","NPC · 2 条任务"],["背包规则","20 格 · 叠加上限 99"]]:
      spec.layout==="skills"?[["游戏策划","内置 · 手动或自动匹配"],["地图与关卡","内置 · 当前项目启用"],["RPG 任务设计","内置 · 当前项目启用"],["数值与经济","内置 · 未启用"],["接口契约","内置 · 需要 API 工具"],["我的关卡规范","本机导入 · v1"]]:
      spec.layout==="models"?[["我的模型服务","自带 Key · 当前项目默认"],["本机模型","本地地址 · 待连接"],["OpenCode Go","自带账户 · 按供应商额度"]]:
      [["项目工具","受限项目查询 · 只读"],["素材目录","远程 HTTP · 需授权"],["本机工具","stdio · 检查依赖"]];
    if(["models","mcp"].includes(spec.layout)){body+=listRows(items.map(a=>[...a,spec.layout==="models"?"spark":"nodes"]),110);let y=mobile?400:400;body+=notice("配置变更从下一轮会话生效","凭据保存在当前设备，项目只记录配置与引用。","blue",y);}
    else {
      const cols=mobile?2:3,cw=(bw-16*(cols-1))/cols;
      items.slice(0,mobile?4:6).forEach((a,i)=>{let x=(i%cols)*(cw+16),y=108+Math.floor(i/cols)*(mobile?199:260);body+=R(x,y,cw,mobile?183:242,C.white,11,C.line)+assetArt(x+10,y+10,cw-20,mobile?111:164,i)+T(x+14,y+(mobile?144:196),a[0],mobile?12:15,C.ink,600)+T(x+14,y+(mobile?166:222),mobile?fitText(a[1],cw-28,12):a[1],mobile?12:11,C.muted);});
    }
  }else if(["model-form","mcp-form","form","settings","realtime","scope","future"].includes(spec.layout)){
    const maxW=mobile?bw:740;
    let fields=spec.layout==="model-form"?[["显示名称","我的模型服务"],["服务来源","自带 API Key"],["API 格式","OpenAI Responses  ▾"],["Base URL","https://api.example.com/v1"],["模型 ID","输入供应商提供的模型 ID"],["API Key","••••••••••••  仅保存在本设备"]]:
      spec.layout==="mcp-form"?[["名称","项目资料工具"],["连接方式","远程 Streamable HTTP  ▾"],["服务地址","https://tools.example.com/mcp"],["授权方式","OAuth / 凭据引用"],["允许的项目","仅星岛冒险"],["动作权限","查询与提出修改建议"]]:
      spec.layout==="settings"?[["界面语言","简体中文  ▾"],["主题","浅色 · 跟随当前设计"],["项目默认目录","本机 / GameGen / Projects"],["自动恢复点","每 10 分钟 / 高影响操作前"],["辅助使用","字号跟随系统"],["凭据保存","系统安全存储"]]:
      spec.layout==="scope"?[["已配对设备","我的 Android · D7K2"],["允许的项目","星岛冒险"],["允许操作","发送项目 / 接收修改"],["资源库范围","仅手动选择的资源"],["自动同步","关闭 · 需要单独开启"],["信任管理","断开 / 取消信任"]]:
      spec.layout==="realtime"?[["连接协议","WebSocket over TLS"],["连接地址","wss://game.example.com/session"],["心跳间隔","15 秒"],["重连上限","5 次 · 指数退避"],["消息去重","commandId + sequence"],["凭据","当前测试环境引用"]]:
      spec.layout==="future"?[["目标引擎","Cocos Creator / LayaAir / Godot"],["写出版本","按能力表选择"],["输入","固定项目快照"],["输出目录","选择新目录"],["不支持的语义","保留差异与待处理项"],["可用状态","后续增量 · 尚未实现"]]:
      [["应用名称","星岛冒险"],["包名","com.example.starland"],["版本名称 / 版本号","1.0.0  /  1"],["屏幕方向","横屏"],["目标","Android APK · 离线生成"],["签名凭据","本设备安全引用"]];
    if(mobile){fields.slice(0,5).forEach(([k,v],i)=>body+=field(0,14+i*96,maxW,k,v));body+=btn(0,526,spec.layout==="scope"?"保存授权范围":"保存配置",true,bw);}
    else {body+=R(0,0,788,bh,C.white,12,C.line);fields.forEach(([k,v],i)=>body+=field(24,35+i*91,740,k,v));body+=btn(24,636,"保存配置",true,150)+btn(188,636,"取消",false,100)+card(812,0,388,144,"当前生效范围","项目：星岛冒险 · 当前设备","shield")+textLines(834,194,["项目设置优先于全局默认。","正在运行的任务继续使用原轮次快照。","凭据不会进入项目、历史或导出包。"],12,C.muted,29);}
  }else if(["devices","pair","network-diagnostics"].includes(spec.layout)){
    if(spec.layout==="devices"){
      body+=notice("与创作设备连接","设备需要处于可互通的同一局域网。无需平台登录。");
      body+=T(0,117,"允许附近设备发现",14,C.ink,600)+toggle(bw-35,100,true)+T(0,144,"本机名称：我的电脑 · A3F8",11,C.muted);
      body+=listRows([["我的 Android · D7K2","Android · 可配对","phone"],["工作室笔记本 · M4P9","Windows · 已配对","folder"]],172);
      let yy=mobile?369:376;body+=btn(0,yy,"扫描二维码",true,mobile?167:180)+btn(mobile?183:196,yy,"输入本地地址",false,mobile?167:180)+T(0,yy+82,"找不到设备？查看局域网连接说明  →",12,C.blue);
    }else if(spec.layout==="pair"){
      body+=R(0,0,bw,mobile?522:600,C.white,12,C.line)+I(bw/2-28,30,"shield",56,C.blue)+T(bw/2,126,"核对两台设备上的短码",mobile?18:23,C.ink,600,"middle")+T(bw/2,161,"我的电脑 A3F8  ↔  我的 Android D7K2",mobile?10:14,C.muted,400,"middle");
      ["7","4","2","9","1","6"].forEach((s,i)=>{let sz=mobile?42:62,gap=mobile?8:13,x=(bw-6*sz-5*gap)/2+i*(sz+gap);body+=R(x,202,sz,72,C.soft,9)+T(x+sz/2,249,s,28,C.blue,600,"middle");});
      body+=T(bw/2,316,"只有两端显示一致时才确认配对",12,C.muted,400,"middle")+T(bw/2,347,"短码 01:45 后过期",11,C.muted,400,"middle")+btn((bw-(mobile?306:356))/2,394,"拒绝",false,mobile?108:128)+btn((bw-(mobile?306:356))/2+(mobile?122:142),394,"确认一致",true,mobile?184:214);
    }else{
      body+=notice("没有发现附近设备","保留本地创作，连接恢复后可以继续。","amber");
      body+=listRows([["局域网权限","检查应用的本地网络访问权限","shield"],["网络是否互通","访客网络或 AP 隔离可能阻断连接","globe"],["网卡与防火墙","选择可达的本地网卡和应用规则","settings"],["扫码或本地地址","替代自动发现，仍需身份核对","sync"]],106);
    }
  }else if(["transfer","build","task"].includes(spec.layout)){
    body+=steps(id.startsWith("engine")?["检查来源","转换内容","验证引用","生成报告"]:spec.layout==="transfer"?["协商","传输","校验","提交"]:["固定版本","项目校验","处理资源","生成产物"],2);
    body+=R(0,83,bw,mobile?214:242,C.white,12,C.line)+I(22,107,spec.layout==="transfer"?"sync":"box",30,C.blue)+T(66,130,spec.layout==="transfer"?"正在接收「星岛冒险」":"正在处理资源与工作流",mobile?16:21,C.ink,600)+T(22,169,spec.layout==="transfer"?"固定快照 8F2A · 仅传输缺失内容":"固定版本 r128 · 本地任务",12,C.muted)+R(22,195,bw-44,8,C.soft,4)+R(22,195,(bw-44)*.68,8,C.blue,4)+T(22,233,"68% · 136 / 200 MB",12,C.ink,600)+T(bw-22,233,"约剩余 24 秒",11,C.muted,400,"end");
    body+=btn(22,mobile?252:270,spec.layout==="transfer"?"暂停传输":"请求取消",false,128);
    body+=listRows([["资源传输","已校验 42 / 61 个分块","check"],["工作流与依赖","等待校验完成后提交","nodes"],["接收项目","完整提交后才显示可打开","folder"]],mobile?324:360);
  }else if(["result","report","recovery"].includes(spec.layout)){
    let rec=spec.layout==="recovery",engine=id==="engine-report",sync=id==="lan-received";
    body+=R(0,0,bw,mobile?206:224,rec?C.cream:C.mint,12)+I(24,23,rec?"history":"check",40,rec?C.amber:C.green)+T(24,103,rec?"发现一个可恢复的工作副本":engine?"项目已创建，仍有待补逻辑":sync?"项目已完整接收":"游戏安装包已生成",mobile?20:27,C.ink,600);
    body+=textLines(24,138,rec?["上次完整恢复点：今天 14:30","可以先恢复为新副本，再查看差异。"]:engine?["迁移报告保留每项来源和转换结果。","处理阻塞项后，再判断是否可以试玩。"]:sync?["版本 r128 · 来自我的电脑","断开连接后，仍可在本机继续编辑。"]:["星岛冒险 · Android APK · r128","输出内容对应当前固定快照。"],12,C.muted,25);
    body+=btn(0,mobile?229:249,rec?"恢复为新副本":engine?"查看待补工作流":sync?"打开项目":"打开输出目录",true,mobile?350:210);
    body+=listRows(engine?[["已转换","场景 12 · 资源 48 · 工作流 6","check"],["替代实现","2 个行为使用受支持的等价工作流","nodes"],["待补 / 排除","4 项待补 · 1 项排除，可逐项定位","info"]]:rec?[["最近完整版本","r127 · 今天 14:30 · 可另存","history"],["未完成修改","r128 · 需要检查完整性","info"],["旧项目","保留原文件与恢复点","shield"]]:[["文件与校验","安装包 / 项目清单 / SHA-256","box"],["对应版本","固定快照 r128 · 当前分支","history"],["继续编辑","修改后可重新生成或同步","nodes"]],mobile?303:327);
  }else if(["conflict","diff","sync-diff"].includes(spec.layout)){
    const conflict=spec.layout==="conflict";
    body+=notice(conflict?"有 2 项修改需要你决定":spec.layout==="sync-diff"?"将同步 12 项变化":"本次修改包含 3 项变化",conflict?"两侧修改都已保留。选择方案后会生成新的项目版本。":"先查看影响范围，确认后再应用。",conflict?"amber":"blue");
    body+=tabs(["对象属性","工作流","资源"],0,94);
    const ys=144,cw=mobile?bw:(bw-16)/2;
    if(mobile){body+=card(0,ys,bw,102,"我的电脑 · 跳跃高度 2.8","修改来源：人工编辑","folder")+card(0,ys+118,bw,102,"我的 Android · 跳跃高度 3.0","共同祖先值：2.4","phone")+btn(0,ys+250,"保留电脑版本",false,167)+btn(183,ys+250,"保留手机版本",false,167)+btn(0,ys+316,"保留双方为独立版本",true,bw);}
    else {["我的电脑 · 当前项目","我的 Android · 待合并修改"].forEach((t,i)=>{let x=i*(cw+16);body+=R(x,ys,cw,361,C.white,11,C.line)+T(x+20,ys+34,t,15,C.ink,600)+pill(x+20,ys+56,"共同祖先 r122","blue",130)+L(x,ys+100,x+cw,ys+100)+T(x+20,ys+137,"冒险家 / 运动组件 / 跳跃高度",12,C.muted)+R(x+20,ys+159,cw-40,72,i?C.mint:C.soft,8)+T(x+38,ys+205,i?"3.0":"2.8",26,i?C.green:C.blue,600)+T(x+20,ys+269,"保留人工修改 · 引用与稳定对象 ID 不变",12,C.muted)+btn(x+20,ys+296,i?"采用手机值":"采用电脑值",i,160);});body+=btn(0,558,"保留双方为独立版本",false,232)+btn(986,558,"确认并提交",true,214)+T(0,644,"资源、图拓扑与删除冲突按各自类型处理，可定位到具体对象。",12,C.muted);}
  }else if(["generate","generate-audio","audio","asset-detail"].includes(spec.layout)){
    const sound=["generate-audio","audio"].includes(spec.layout),aw=mobile?bw:686;
    body+=tabs(sound?["本地文件","本机音效模型",...(mobile?[]:["历史候选"])]:["候选预览","参数","来源与许可"],sound?1:0);
    if(sound){body+=R(0,54,aw,168,C.white,12,C.line)+T(18,84,"水晶拾取 · 清脆、短促、有轻微回响",mobile?12:16,C.ink,600);for(let i=0;i<60;i++){let h=10+Math.abs(Math.sin(i*2.7)*Math.cos(i*.19))*61;body+=R(18+i*(aw-36)/60,143-h/2,3,h,i<38?C.blue:"#D8E3F3",1);}body+=I(20,182,"play",18,C.blue)+T(49,197,"00:00 / 00:00.4",11,C.muted);}
    else body+=assetArt(0,54,aw,mobile?225:365,id==="asset-detail"?0:3);
    const fy=mobile?335:460;
    body+=field(0,fy,aw,sound?"声音描述":"图片描述",sound?"清脆的水晶拾取声，0.4 秒":"可爱冒险家，正面，透明背景");
    body+=btn(0,fy+86,id==="asset-detail"?"替换资源版本":sound?"生成候选并试听":"生成候选",true,mobile?bw:210);
    if(!mobile){body+=inspector(710,54,490,[["来源",sound?"本机音效模型":"自带模型服务"],["费用",sound?"本地运行 · 不使用平台积分":"供应商账户 · 生成前确认"],["输出",sound?"WAV · 44.1 kHz · 0.4 s":"PNG · 1024 × 1024"],["引用位置","水晶 / 拾取反馈工作流"],["许可","记录模型与素材来源"],["接收方式","先选候选，再入库替换"]],"资源参数");}
  }else if(["upload","engine-import","analysis","mapping","api-review"].includes(spec.layout)){
    body+=steps(spec.group==="迁移"?["选择来源","分析内容","确认映射","转换结果"]:["选择文档","识别内容","校对字段","应用"],spec.layout==="engine-import"||spec.layout==="upload"?0:spec.layout==="analysis"?1:2);
    if(spec.layout==="engine-import"){
      ["Cocos Creator","LayaAir","Godot"].forEach((t,i)=>{let w=(bw-32)/3,x=i*(w+16);body+=card(x,88,w,112,t,["2.4.x / 3.x","2.x / 3.x","3.x / 4.x"][i],"folder");});
      body+=field(0,246,740,"源工程 · 只读","选择编辑器源工程目录")+field(0,351,740,"新 GameGen 项目位置","选择一个新的空目录")+btn(0,466,"分析工程",true,180)+card(772,246,428,180,"迁移结果可逐项追溯","支持版本以实际能力表为准。","shield");
    }else if(spec.layout==="upload"){
      body+=R(0,88,bw,mobile?218:282,C.white,12,C.line)+I(bw/2-24,118,"folder",48,C.blue)+T(bw/2,199,id==="import-assets"?"添加图片、音频或资源包":"添加接口文档，或粘贴结构化内容",mobile?13:18,C.ink,600,"middle")+T(bw/2,232,id==="import-assets"?"导入前检查重名、依赖与许可":"保留来源、页码和原文引用",12,C.muted,400,"middle")+btn(bw/2-76,258,"选择文件",true,152);
      body+=listRows([["选择后先校对","不会自动覆盖已有对象或执行附带脚本","shield"],["保留未完成输入","失败后可修正来源并重新分析","history"]],mobile?338:408);
    }else {
      const headers=spec.layout==="api-review"?(mobile?["字段","校对结果"]:["接口 / 字段","文档来源","识别结果","需要确认"]):mobile?["内容","结果"]:["内容类型","源对象","GameGen 映射","迁移结果"];
      const data=spec.layout==="api-review"?(mobile?[["获取角色","GET /players/{id}"],["认证方式","Bearer · 凭据引用"],["commandId","幂等键 · 必填"],["超时规则","原文缺失 · 待确认"]]:[["获取角色","api.yaml #/paths","GET /players/{id}","名称与参数"],["认证方式","#/securitySchemes","Bearer 凭据引用","当前设备授权"],["commandId","#/schemas/Claim","幂等键 · 必填","工作流映射"],["response.coins","#/schemas/Player","integer ≥ 0","保留校验"],["超时与重试","文档未提供","待确认","不能自动猜测"]]):mobile?[["场景与预制体","12 / 已转换"],["资源与动画","48 / 已转换"],["业务逻辑","4 / 待补"],["许可与依赖","1 / 待确认"]]:[["场景与预制体","12","稳定对象 ID","已转换"],["图片 / 动画 / 音频","48","资源与内容哈希","已转换"],["可识别逻辑","6","受限工作流","已转换"],["未知脚本行为","4","待补工作流任务","需处理"],["受限素材","1","保留来源与许可","需确认"]];
      body+=table(headers,data,96);
      body+=notice(spec.layout==="api-review"?"缺失字段需要确认，保留文档来源":"项目创建与可运行就绪分别记录",spec.layout==="api-review"?(mobile?"补齐超时与认证配置，再应用。":"按文档来源逐项校对；缺失行为不自动猜测，重导入保留人工修改。"):mobile?"先处理阻塞项，再继续转换。":"待补与排除项不会隐藏。源目录保持只读，原脚本不进入运行时。","amber",mobile?383:468)+btn(0,mobile?489:590,spec.layout==="api-review"?"确认并应用到配置":"确认映射并继续",true,mobile?bw:220);
    }
  }else if(["publish"].includes(spec.layout)){
    body+=T(0,22,"选择一个发行目标",17,C.ink,600);
    const targets=[["Android APK","断网也能本地生成","phone"],["H5 网页","WASM + 静态资源","globe"],["微信小游戏","专用平台适配","grid"],["抖音小游戏","专用平台适配","play"]];
    targets.forEach((a,i)=>{let cols=mobile?2:4,cw=(bw-(cols-1)*16)/cols,x=i%cols*(cw+16),y=46+Math.floor(i/cols)*145;body+=(mobile?R(x,y,cw,129,C.white,12,C.line)+R(x+14,y+12,32,32,C.soft,9)+I(x+21,y+19,a[2],18,C.blue)+T(x+14,y+66,a[0],14,C.ink,600)+T(x+14,y+89,fitText(a[1],cw-28,12),12,C.muted):card(x,y,cw,129,a[0],a[1],a[2]))+(i===0?pill(x+16,y+(mobile?99:85),"当前目标","blue",88):"");});
    const y=mobile?330:228;
    body+=T(0,y,"导出前检查",16,C.ink,600)+listRows((mobile?[["项目与资源","固定快照 r128 · 离线依赖完整","check"],["版本与签名","本设备管理应用身份与密钥","shield"]]:[["项目与工作流","固定快照 r128 · 无阻塞项","check"],["资源与离线依赖","目标所需资源已包含","check"],["版本与签名","应用身份和密钥由本设备管理","shield"]]),y+20);
    body+=btn(0,mobile?548:536,"生成游戏",true,mobile?350:210);
  }else if(["history","list","log","diagnostics","network-diagnostics","quests","slg","levels","multiplayer","protocol"].includes(spec.layout)){
    body+=tabs(["全部",spec.layout==="diagnostics"?"阻塞问题":"当前项目",spec.layout==="history"?"恢复点":"详细记录"]);
    const items=spec.layout==="history"?[["r128 · 调整水晶拾取反馈","今天 14:32 · 对话修改 · 3 项变化","chat"],["r127 · 调整桥面通行","今天 14:30 · 手工编辑 · 自动恢复点","layers"],["r126 · 创建关卡目标","今天 14:22 · 手工编辑 · 已锁定","shield"],["r125 · 接收手机修改","今天 14:15 · LAN 合并 · 共同祖先 r122","sync"]]:
      spec.layout==="diagnostics"?[["缺少拾取音效","水晶 / 拾取反馈 / 播放音效节点","sound"],["奖励公式引用未定义字段","关卡 02 / reward.coins","nodes"],["目标平台能力提示","检查小游戏平台的资源与协议支持","info"]]:
      spec.layout==="quests"?[["初次出发","收集 3 个水晶 · 奖励 30 金币","layers"],["修复传送门","前置：初次出发 · 组合目标 AND","nodes"],["森林来信","对白分支 · 奖励只发放一次","chat"]]:
      spec.layout==="slg"?[["伐木场","生产队列 · 木材 +10 / 分钟","box"],["防御塔","范围 120 · 冷却 1.5 秒","layers"],["科技：精炼","前置与资源检查 · 生产 +15%","nodes"],["敌人波次","第 1 波 · 8 个单位 · 间隔 0.8 秒","play"]]:
      spec.layout==="levels"?[["01 · 初次出发","星岛营地 · 收集 3 水晶并到达传送门","layers"],["02 · 跨越遗迹","遗迹外缘 · 计时 / 奖励 / 失败重试","layers"],["03 · 林间回响","森林深处 · 前置与存档检查点","layers"]]:
      spec.layout==="protocol"?[["HTTPS / WSS","传输与安全层 · 当前推荐闭环","globe"],["JSON / Protobuf","消息编码与 Schema 单独配置","nodes"],["各目标能力","H5 / APK / 微信 / 抖音分别声明","grid"],["其他协议","TCP / UDP / gRPC / MQTT 按目标声明","info"]]:
      spec.layout==="multiplayer"?[["测试房间 · 星岛 01","状态：本地配置草稿 · 容量 8","globe"],["地图实例与区域","唯一归属 / 版本固定 / 容量","layers"],["重连策略","会话 / 序号 / 快照 / 数据版本","sync"],["奖励与交易","幂等 / 可信校验 / 审计","shield"]]:
      spec.layout==="list"?[["星岛玩法打磨","今天 14:32 · 12 轮 · 当前会话","chat"],["角色与美术方向","昨天 · 8 轮 · 可新建分支","spark"],["关卡节奏调整","11 月 15 日 · 6 轮 · 已归档","history"]]:
      [["第 12 轮 · 水晶拾取反馈","模型配置 v3 · Skill 关卡设计 v1","chat"],["读取当前工作流","project.read · 只读 · 已完成","nodes"],["提出项目修改","proposal p128 · 等待应用","history"],["费用来源","自带账户 · 实际用量待供应商返回","info"]];
    body+=listRows(items,54);
    if(!mobile){body+=card(0,400,586,188,"当前选择",items[0][0],"layers")+textLines(22,501,["变化、来源和处理入口在同一上下文中保留。","详细参数和高级规则按需展开。"],12,C.muted,28)+card(610,400,590,188,"关联工作流","从这里继续编辑规则与失败路径。","nodes")+btn(632,516,"打开关联工作流",true,196);}
  }else if(["permission"].includes(spec.layout)){
    body+=notice("项目工具请求使用一项能力","请查看目标与影响范围，再选择允许方式。","amber");
    body+=card(0,103,bw,mobile?221:250,"修改当前项目的工作流","工具：project.propose_patch","nodes")+textLines(20,196,["项目：星岛冒险","目标：水晶 / 拾取反馈","动作：提出 3 项修改，应用前仍会显示差异","不包含其他目录或外部发布动作"],mobile?11:14,C.muted,32);
    body+=btn(0,mobile?356:386,"仅本次允许",true,mobile?350:180)+btn(0,mobile?414:444,"设置限定范围",false,mobile?350:180)+btn(0,mobile?472:502,"拒绝",false,mobile?350:180);
  }else if(["table","localization","api","chart"].includes(spec.layout)){
    body+=tabs(spec.layout==="localization"?["游戏内容","缺失翻译","预览"]:spec.layout==="api"?["接口","请求","响应","认证"]:["角色成长","战斗参数","经济规则"]);
    if(spec.layout==="chart"){
      body+=R(0,54,bw,mobile?300:420,C.white,12,C.line)+T(20,89,"成长曲线对比 · 固定种子 20261117",mobile?12:16,C.ink,600);
      let plotW=bw-90,plotH=mobile?186:285,py=136;for(let i=0;i<5;i++)body+=L(50,py+i*plotH/4,bw-20,py+i*plotH/4)+T(38,py+i*plotH/4+4,100-i*25,9,C.muted,400,"end");
      for(let line=0;line<2;line++){let points=[];for(let k=0;k<10;k++)points.push(`${50+k*plotW/9},${py+plotH-(Math.pow(k/9,line?1.2:1.6)*.9+.02)*plotH}`);body+=`<polyline points="${points.join(" ")}" fill="none" stroke="${line?C.green:C.blue}" stroke-width="3"/>`;}body+=pill(20,mobile?378:500,"方案 A · 当前","blue",126)+pill(158,mobile?378:500,"方案 B · 草稿","green",126);
    }else{
      let headers=spec.layout==="localization"?(mobile?["键 / 原文","翻译"]:["内容键","简体中文","English","日本語","한국어"]):spec.layout==="api"?(mobile?["接口","定义"]:["名称","方法 / 通道","路径","工作流"]):(mobile?["角色 / 等级","生命 / 攻击"]:["角色 ID","等级","生命","攻击","成长公式"]);
      let data=spec.layout==="localization"?(mobile?[["start_game","开始游戏"],["quest.collect","收集水晶"],["level.complete","缺少韩语翻译"]]:[["start_game","开始游戏","Start game","ゲーム開始","게임 시작"],["quest.collect","收集水晶","Collect crystals","水晶を集める","수정 수집"],["level.complete","关卡完成","Level complete","クリア","待翻译"]]):spec.layout==="api"?(mobile?[["获取角色","GET /players/{id}"],["拾取奖励","POST /rewards"],["世界快照","WSS /world"]]:[["获取角色","GET","/players/{id}","读取 → 绑定"],["领取奖励","POST","/rewards/claim","校验 → 提交"],["世界快照","WSS","/world","连接 → 消息"]]):(mobile?[["adventurer · 1","100 / 12"],["adventurer · 2","110 / 14"],["adventurer · 3","120 / 16"],["slime · 1","30 / 6"]]:[["adventurer","1","100","12","base + level × 10"],["adventurer","2","110","14","base + level × 10"],["adventurer","3","120","16","base + level × 10"],["slime","1","30","6","固定值"],["guard","1","160","8","base + level × 15"]]);
      body+=table(headers,data,56);
      const yy=mobile?363:416;body+=notice(spec.layout==="api"?"认证使用本设备凭据引用":spec.layout==="localization"?"用户填写的名称和历史消息保留原文":"数据表修改会关联到实际角色与关卡",spec.layout==="api"?"模拟请求与真实请求记录分开。":spec.layout==="localization"?"缺失翻译按可见回退规则处理。":"主键与稳定 ID 保持，错误公式定位到字段。","blue",yy);
    }
  }else if(spec.layout==="skill-detail"&&state==="skill_add"){
    const fw=mobile?bw:760;
    body+=field(0,16,fw,"技能名称","我的关卡规范")+field(0,110,fw,"何时使用","设计新关卡或调整路线与奖励时")+field(0,204,fw,"来源 / 许可证","本机创作 / 填写授权说明");
    body+=T(0,310,"技能正文 · Markdown",12,C.muted,500)+R(0,326,fw,mobile?132:202,C.white,8,C.line)+textLines(14,354,["# 关卡设计规范","先确认玩家目标，再规划挑战与奖励。","输出地图与工作流提案，不运行附件脚本。"],12,C.ink,27);
    body+=btn(0,mobile?488:566,"保存并预览",true,mobile?bw:180)+(!mobile?btn(196,566,"导入 SKILL.md",false,180):"");
  }else if(["skill-detail"].includes(spec.layout)){
    body+=pill(0,0,"内置 Skill","blue",95)+T(110,19,"v1 · 当前项目",12,C.muted)+T(0,66,"地图与关卡设计",mobile?20:28,C.ink,600);
    body+=R(0,90,bw,mobile?340:480,C.white,12,C.line)+textLines(20,128,["何时使用","当你需要搭建关卡节奏、路线和通关目标时。","","工作方式","先确认玩家目标，再规划路径、奖励和失败恢复。","修改以工作流与地图提案呈现，保持手工编辑。","","依赖与权限","可读取当前地图；修改仍需项目事务校验。","","来源：GameGen 内置 · 本文仅为设计示例"],mobile?11:15,C.ink,mobile?26:32);
    body+=btn(0,mobile?465:606,"为当前项目启用",true,mobile?bw:220);
  }
  // 原型各状态沿用同一业务上下文；状态提示必须给出可执行的恢复入口。
  const stateSpec={
landscape_invalid:["节点连接类型不兼容","请检查输入输出类型，草稿和原连线保留。","red","定位节点"],
pair_expired:["配对短码已过期","重新生成短码，再在两台设备上确认。","amber","重新配对"],
pair_rejected:["对方未同意配对","没有建立访问授权，可以稍后重试。","amber","返回设备列表"],
unreachable:["设备当前不可达","检查可互通的局域网与应用网络权限。","amber","查看连接说明"],
version_incompatible:["项目格式或能力不兼容","保留当前版本，先查看双方支持的格式。","red","查看版本差异"],
insufficient_space:["接收空间不足","旧项目保留，清理空间后可重新继续。","amber","选择其他位置"],
source_changed:["源快照已经变化","当前任务仍绑定原快照，不能拼接新内容。","amber","重新预览变化"],
checksum_failed:["资源校验未通过","接收内容尚未提交，旧项目仍保留。","red","重传缺失内容"],
cancelled:["任务已取消","原项目和完整版本保留，可重新开始。","blue","返回任务"],
revoked:["设备信任已撤销","后续访问停止；对方已接收的副本仍保留。","amber","查看信任设备"],
missing_runtime:["缺少本机运行依赖","选择兼容的运行环境，或使用远程连接。","amber","查看依赖"],
credential_missing:["需要在当前设备重新授权","项目中只有凭据引用，没有同步密钥。","amber","设置凭据"],
unsupported_source:["源工程格式未受支持","仅接收能力表中的三类引擎源工程。","red","查看支持范围"],
required_missing:["缺少必需依赖","定位缺失内容后修复，或保留原件取消。","red","查看缺失清单"],
permission:["需要限定操作范围","核对当前项目、工具目标和允许动作。","amber","查看授权"],
conflict:["两侧修改发生冲突","根据共同祖先比较，决定保留哪些修改。","amber","处理冲突"],
    loading:["正在处理中","可以保留当前草稿，稍后继续。","blue","查看任务"],
    offline:["当前无法连接远程服务","本机编辑与已保存的项目仍可继续。","amber","保留草稿"],
    error_timeout:["任务未完成","查看失败原因后重试，不重复提交已完成的修改。","red","查看原因"],
    interrupted:["任务已中断","已完成的内容与原项目保留，确认后继续。","amber","继续任务"],
    success:["操作已完成","结果已记录，可查看本次修改与对应版本。","green","查看结果"],
    duplicate:["已存在相同请求","查看原任务的处理结果，避免重复操作。","amber","打开原任务"],
    invalid:["参数需要修正","不兼容字段已标注，修改后再提交。","red","定位问题"],
    iso_invalid:["通行面连接不完整","为高度差补充坡道，再检查路径。","red","定位地块"],
    import_invalid:["文档暂时无法识别","检查格式与来源，已输入的内容保留。","red","重新选择"],
    ability_error:["组件参数不合法","检查寿命、数量与引用边界。","red","定位参数"],
    ability_missing:["缺少引用资源","选择替代资源或保留占位后继续编辑。","red","选择资源"],
    ability_paused:["预览已暂停","场景数据不变，继续预览可查看效果。","blue","继续预览"],
    permission_denied:["无法访问所选目录","重新选择目录并授予访问范围。","amber","重新授权"],
    unauthenticated:["需要重新授权该服务","本地功能仍可继续，授权后恢复远程操作。","amber","查看授权"],
    insufficient:["可用额度不足","本次生成尚未开始，可以调整预算或使用本地资源。","amber","调整预算"],
    assist_error:["连接配置需要修正","检查 API 格式、地址和凭据引用。","red","编辑配置"],
    assist_offline:["远程扩展当前离线","保留配置，本机可用功能继续使用。","amber","查看连接"],
    connecting:["正在连接","取消后保留节点和当前草稿。","blue","取消连接"]
  };
  const empty=["empty","iso_empty","assist_empty","ability_empty","no_results"].includes(state);
  if(empty){
    body=R(0,0,bw,bh-12,C.white,12,C.line)+R(bw/2-34,mobile?90:160,68,68,C.soft,18)+I(bw/2-20,mobile?104:174,state==="no_results"?"search":"plus",40,C.blue)+T(bw/2,mobile?214:288,state==="no_results"?"没有找到匹配内容":"从第一个"+(id==="assets"?"资源":id==="workflow"?"节点":id.includes("map")?"地块":"内容")+"开始",mobile?18:24,C.ink,600,"middle")+T(bw/2,mobile?248:325,state==="no_results"?"换一个关键词，或清除当前筛选。":"可以使用推荐预设，随后继续修改。",mobile?11:14,C.muted,400,"middle")+btn(bw/2-(mobile?140:105),mobile?282:366,state==="no_results"?"清除筛选":"添加"+(id==="assets"?"资源":id==="workflow"?"节点":"内容"),true,mobile?280:210);
  }
  if(stateSpec[state]) {
    const [st,sub,tone,action]=stateSpec[state],yy=mobile?(!landscape?0:0):0,hh=mobile?98:72;
    let banner=R(0,yy,bw,hh,tone==="red"?C.rose:tone==="amber"?C.cream:tone==="green"?C.mint:C.soft,10,C.line)+I(14,yy+16,"info",18,tone==="red"?C.red:C.amber)+T(42,yy+29,st,13,C.ink,600)+T(42,yy+52,mobile?sub.slice(0,23):sub,11,C.muted)+(!mobile?btn(bw-150,yy+17,action,false,132):T(42,yy+79,action+"  →",11,C.blue,600));
    body=`<g transform="translate(0 ${hh+14})">${body}</g>`+banner;
  }
  if(state==="clarification")body=notice("先确认一个创作选择","声音可以使用本地文件，也可以用本机模型生成。")+card(0,100,bw,108,"使用本地音效","挑选已有文件，保留声音来源。","folder")+card(0,226,bw,108,"用本机模型生成","先试听候选，确认后再替换引用。","sound")+btn(0,364,"确认选择并继续",true,mobile?bw:220);
  if(state==="first_use")body=R(0,0,bw,bh,C.white,12,C.line)+I(bw/2-32,55,"spark",64,C.blue)+T(bw/2,174,"欢迎来到 GameGen",mobile?24:34,C.ink,600,"middle")+textLines(mobile?24:bw/2-230,222,mobile?["用对话描述游戏，在画面中微调，","再用工作流掌握每个规则。"]:["从简单的玩法出发，试着做一个真正可以玩的关卡。","对话、画面和工作流始终修改同一个项目。"],mobile?13:17,C.muted,30)+btn(bw/2-(mobile?150:130),324,"创建第一个游戏",true,mobile?300:260);
  svg+=`<defs><clipPath id="bodyClip">${R(bx,by,bw,bh,"white",0)}</clipPath></defs><g clip-path="url(#bodyClip)"><g transform="translate(${bx} ${by})">${body}</g></g>`;
  if(!mobile)svg+=L(216,931,1416,931)+T(216,950,"星岛冒险  ·  主分支",10,C.muted)+T(1416,950,"本机项目  ·  所有修改可查看历史",10,C.muted,400,"end");
  return svg+"</svg>";
};
