// 显式重新生成未批准的设计草稿；不执行项目构建、测试或业务操作。
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {renderSurface} from './workbench.mjs';
import {renderChatView,renderChatCard} from './chat.mjs';
import {renderGuide,renderGuideLocaleCard} from './guide.mjs';
import {renderComponent} from './components.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv.includes('--regenerate-draft'))throw new Error('请显式传入 --regenerate-draft；不要覆盖已批准基线。');
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require("C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1210-0_26.1116.1210.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/sharp");}
const read=p=>fs.readFile(path.join(base,p),'utf8').then(JSON.parse);
const jobs=await read('source/jobs.json'),surfaces=await read('source/surfaces.json'),chat=await read('source/inputs/chat/chat-state-catalog.json'),guide=await read('source/inputs/guide/onboarding.json'),components=await read('source/inputs/full/shared-components.json');
for(const j of jobs){let r;const s=surfaces.find(s=>s.id===j.surface_id);if(['surface','fields','domain-state'].includes(j.category))r=renderSurface(s,j.platform,j.mode,j.category==='domain-state'?s.states.find(x=>x.id===j.domain_state_id):null);else if(j.category==='chat-view')r=renderChatView(chat.composed_views.find(v=>v.id===j.view_id),j.platform,chat.states);else if(j.category==='chat-state-component')r=renderChatCard(chat.states.find(v=>v.id===j.state_id),j.platform);else if(j.category==='guide')r=renderGuide(guide.views.find(v=>v.id===j.guide_view_id)||{id:j.id,title:j.title},j.platform,j.options||{});else if(j.category==='locale-component')r=renderGuideLocaleCard(j.locale);else if(j.category==='shared-component')r=renderComponent(components.components.find(x=>x.id===j.component_id));await fs.writeFile(path.join(base,j.svg_path),r.svg);await sharp(Buffer.from(r.svg)).png().toFile(path.join(base,j.png_path));}
console.log('设计草稿导出完成；此过程不是产品验证。重新生成后需更新哈希与交接清单。');
