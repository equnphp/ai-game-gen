// 仅重新导出本设计包的 SVG/PNG；不构建、不调用产品服务、不操作设备。
// 修改画板后必须重新冻结设计摘要；本脚本不代签审批，也不更新真实验收记录。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { renderDesign } from "./render.mjs";
import { renderOverlay } from "./overlays.mjs";
const designDir = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const depDir = process.env.GAMEGEN_DESIGN_NODE_MODULES;
const sharp = depDir ? require(path.join(depDir,"sharp")) : require("sharp");
const pages = JSON.parse(await fs.readFile(path.join(designDir,"source/screens.json"),"utf8"));
const scenarios = JSON.parse(await fs.readFile(path.join(designDir,"source/scenarios.json"),"utf8"));
const overlays = JSON.parse(await fs.readFile(path.join(designDir,"source/overlays.json"),"utf8"));
const scene = (await fs.readFile(path.join(designDir,"source/island-world.svg"),"utf8"))
  .replace(/^[\s\S]*?<svg[^>]*>/,"").replace(/<\/svg>\s*$/,"")
  .replaceAll('id="','id="scene-').replaceAll('url(#','url(#scene-');
const queue = [...scenarios];
await Promise.all(Array.from({length:6},async()=>{
  while(queue.length){
    const s=queue.shift(),p=pages.find(x=>x.id===s.screen_id);
    const svg = p.id==="overlays"
      ? renderOverlay(renderDesign(pages.find(x=>x.id==="chat"),s.platform,"normal",scene),overlays.find(x=>x[0]===s.state),s.platform==="android")
      : renderDesign(p,s.platform,s.visual_state,scene);
    await fs.writeFile(path.join(designDir,s.design_image),svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(designDir,s.preview_image));
  }
}));
console.log("Exported design artboards: "+scenarios.length);
