// 公共浮层画板；所有交互均为设计定义。
export const renderOverlay = function renderOverlay(baseSvg,entry,mobile){
 const e=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const [id,title,sub,...tail]=entry,action=tail.pop(),note=tail.pop(),opts=tail;
 const W=mobile?390:1440,H=mobile?844:960,w=mobile?350:568,h=mobile?522:492,x=(W-w)/2,y=mobile?145:220;
 const r=(a,b,c,d,f,rr=10,st="none")=>`<rect x="${a}" y="${b}" width="${c}" height="${d}" rx="${rr}" fill="${f}" stroke="${st}"/>`;
 const t=(a,b,s,size=14,color="#172B4D",weight=400)=>`<text x="${a}" y="${b}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}">${e(s)}</text>`;
 let s=r(0,0,W,H,"#132B4D",0).replace('fill="#132B4D"','fill="#132B4D" fill-opacity=".35"')+r(x,y,w,h,"white",16)+t(x+22,y+39,title,mobile?19:23,"#172B4D",600)+t(x+w-38,y+36,"×",23,"#6A7B93")+t(x+22,y+77,sub,13,"#6A7B93");
 opts.forEach((v,i)=>{let yy=y+103+i*68;s+=r(x+22,yy,w-44,55,i===0?"#EDF4FF":"#FFFFFF",8,i===0?"#246BEE":"#E3E9F2")+`<circle cx="${x+42}" cy="${yy+27}" r="7" fill="white" stroke="${i===0?"#246BEE":"#B7C4D7"}"/>`+(i===0?`<circle cx="${x+42}" cy="${yy+27}" r="3.5" fill="#246BEE"/>`:"")+t(x+60,yy+32,v,mobile?12:14);});
 if(mobile&&note.length>23){s+=t(x+22,y+350,note.slice(0,23),11,"#6A7B93")+t(x+22,y+370,note.slice(23),11,"#6A7B93");}else s+=t(x+22,y+350,note,12,"#6A7B93");
 const fy=y+h-70;s+=r(x+22,fy,mobile?w-44:330,44,"#246BEE",8)+t(x+38,fy+28,action,14,"white",500);
 if(!mobile)s+=r(x+372,fy,174,44,"white",8,"#E3E9F2")+t(x+430,fy+28,"取消",14);
 return baseSvg.slice(0,-6)+s+"</svg>"; // 只覆盖最外层结束标签由调用方在末尾替换。
};
