/* 检查等距原型的真实控件与同源数据；独立Chrome和fixture不会覆盖用户草稿。 */
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const q = require("./verify-prototype.cjs");
const [, root] = process.argv.slice(2);
const checks = [];
const run = expression => q.evaluate(expression);
const expect = async (name, expression, value) => q.assert(checks, name, await run(expression), value);
const click = value => run("document.querySelector('[data-iso-action=\"" + value + "\"]').click()");
const type = (id, value) => run("document.getElementById(" + JSON.stringify(id) + ").value=" + JSON.stringify(String(value)));
/* 地图视图与旧入口共用地块，编辑、无效输入和撤销要验证实际数据。 */
async function editing() {
  await q.navigate("desktop", "world", "isometric");
  await expect("地图60格可选中", "document.querySelectorAll('[data-iso-cell]').length", 60);
  await expect("默认高级折叠", "document.querySelector('.iso-advanced').open", false);
  await run("GameGenPrototype.isometric.ui.cell=20;GameGenPrototype.render()");
  const original = await run("GameGenPrototype.isometric.config().heights[20]");
  await click("raise");
  await expect("高度真实提交", "GameGenPrototype.model.gameplay.maps[0].iso.heights[20]", original + 1);
  await expect("扩展地图通过恢复校验", "GameGenPrototype.gameplay.valid(GameGenPrototype.model.gameplay)", true);
  await click("undo");
  await expect("高度撤销回原值", "GameGenPrototype.isometric.config().heights[20]", original);
  await click("redo");
  await expect("高度重做恢复", "GameGenPrototype.isometric.config().heights[20]", original + 1);
  await click("brush-water");
  await run("document.querySelector('[data-iso-cell=\"20\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  await expect("笔刷改共享地形", "GameGenPrototype.model.gameplay.maps[0].cells[20].terrain", "water");
  await run("GameGenPrototype.go('world','map_editor')");
  await expect("旧方格入口显示同一水格", "document.querySelector('[data-gp-cell=\"20\"]').classList.contains('water')", true);
  await run("GameGenPrototype.go('world','iso_height')");
  const revision = await run("GameGenPrototype.model.revision");
  await type("iso-opacity", 125); await click("opacity");
  await expect("错误不提交项目", "GameGenPrototype.model.revision", revision);
  await expect("错误保留输入", "document.getElementById('iso-opacity').value", "125");
  await expect("错误原位可见", "document.getElementById('iso-feedback').hidden", false);
  await type("iso-opacity", 42); await click("opacity");
  await expect("遮挡参数保存", "GameGenPrototype.isometric.config().occlusion", 42);
  const beforeVisual = await run("JSON.stringify(GameGenPrototype.snapshot())");
  await click("occlusion"); await click("top");
  await expect("表现切换不改项目", "JSON.stringify(GameGenPrototype.snapshot())", beforeVisual);
}
/* 桥面为独立节点；只有显式坡道才能把地面连接到桥面。 */
async function paths() {
  await q.navigate("desktop", "world", "iso_path");
  await run("window.isoTestMap={width:3,height:1,cells:[0,1,2].map(()=>({terrain:'grass',blocked:false,event:''}))};window.isoTestConfig={version:1,occlusion:35,heights:[0,0,0],objects:['','',''],bridges:[false,true,false],ramps:[false,false,false]}");
  await expect("重叠地面与桥面不直接连通", "GameGenPrototype.isometric.findPath({index:1,surface:'ground'},{index:1,surface:'bridge'},isoTestMap,isoTestConfig).length", 0);
  await run("isoTestConfig.ramps[0]=true");
  await expect("显式坡道连接桥面", "GameGenPrototype.isometric.findPath({index:1,surface:'ground'},{index:1,surface:'bridge'},isoTestMap,isoTestConfig).map(p=>p.surface)", ["ground","ground","bridge"]);
  await run("isoTestMap.cells[1].terrain='water'");
  await expect("水下地面不可通行", "GameGenPrototype.isometric.allowed({index:1,surface:'ground'},isoTestMap,isoTestConfig)", false);
  await expect("水上桥面独立可用", "GameGenPrototype.isometric.allowed({index:1,surface:'bridge'},isoTestMap,isoTestConfig)", true);
  await run("isoTestMap.cells[1].blocked=true");
  await expect("阻挡参与路径", "GameGenPrototype.isometric.findPath({index:0,surface:'ground'},{index:2,surface:'ground'},isoTestMap,isoTestConfig).length", 0);
  await click("path");
  await expect("关卡路径实际计算", "GameGenPrototype.isometric.ui.route.length>1", true);
  const snapshot = await run("JSON.stringify(GameGenPrototype.snapshot())");
  await click("play"); await q.delay(650);
  await expect("试玩沿路径前进", "GameGenPrototype.isometric.ui.step>0", true);
  await click("play");
  await expect("暂停试玩", "GameGenPrototype.isometric.ui.playing", false);
  await expect("试玩不写编辑状态", "JSON.stringify(GameGenPrototype.snapshot())", snapshot);
}
/* 名称和目标沿用原数据，旋转与切语言保留尚未提交的表单。 */
async function context() {
  await q.navigate("android", "world", "iso_level");
  await type("iso-map-name", "用户手工地图");
  await type("iso-goal-reward", 222);
  await click("rotate");
  await expect("一键打开地图横屏", "document.querySelector('.iso-landscape')!==null", true);
  await expect("横屏保留未提交名称", "GameGenPrototype.isometric.ui.draft['iso-map-name']", "用户手工地图");
  await click("rotate");
  await click("level");
  await expect("返回关卡保留输入", "document.getElementById('iso-map-name').value", "用户手工地图");
  const revision = await run("GameGenPrototype.model.revision");
  await run("GameGenPrototype.i18n.setLocale('en-US')");
  await expect("切语言保留输入", "document.getElementById('iso-map-name').value", "用户手工地图");
  await expect("切语言不提交", "GameGenPrototype.model.revision", revision);
  await click("save-level");
  await expect("关卡目标保存同一份", "[GameGenPrototype.model.gameplay.maps[0].name,GameGenPrototype.model.gameplay.maps[0].goal.reward,GameGenPrototype.studio.level().name]", ["用户手工地图",222,"用户手工地图"]);
  await click("workflow");
  await expect("工作流携带当前关卡", "GameGenPrototype.model.activeLevel", "level-01");
  await expect("关联入口打开关卡图", "GameGenPrototype.view.page", "workflow");
  await run("GameGenPrototype.go('world','isometric')");
  await click("map-level-02");
  await expect("切地图同步关卡上下文", "GameGenPrototype.model.activeLevel", "level-02");
  await run("GameGenPrototype.go('world','map_editor')");
  await expect("旧入口也选中第二关", "document.querySelector('[data-gp-level=\"level-02\"]').getAttribute('aria-pressed')", "true");
}
/* 四语的主操作和移动端布局分别检查，不能只验证字典有键。 */
async function languages() {
  const expected = {"zh-CN":"地图","en-US":"Map","ja-JP":"マップ","ko-KR":"지도"};
  for (const [locale, label] of Object.entries(expected)) {
    await q.navigate("android","world","isometric",390,844,locale);
    await expect("地图主按钮语言 "+locale, "document.querySelector('[data-iso-action=\"tab-isometric\"]').textContent.trim()", label);
    await expect("手机无页面横向溢出 "+locale, "document.documentElement.scrollWidth<=document.documentElement.clientWidth", true);
    await expect("语言键无缺失 "+locale, "GameGenPrototype.i18n.diagnostics().missing.length", 0);
    await q.navigate("android","world","iso_landscape",844,390,locale);
    await expect("横屏布局无溢出 "+locale, "document.documentElement.scrollWidth<=document.documentElement.clientWidth", true);
    await expect("横屏画布直接可见 "+locale, "document.querySelector('.iso-canvas-scroll').getBoundingClientRect().bottom<=innerHeight+2", true);
    await expect("横屏画笔保留触控尺寸 "+locale, "[...document.querySelectorAll('.iso-brushes .btn')].every(x=>x.getBoundingClientRect().height>=44)", true);
  }
}
/* 独立测试profile验证真实落盘与重开，不使用用户浏览器的存储。 */
async function persistence() {
  await q.command("Page.navigate", {url:"http://127.0.0.1:54375/?mode=desktop&page=world&state=isometric&lang=zh-CN"});
  await q.delay(200);
  await run("GameGenPrototype.isometric.ui.cell=20;GameGenPrototype.render()");
  const oldHeight = await run("GameGenPrototype.isometric.config().heights[20]");
  await click("raise");
  await expect("等距字段真实写入本机存储", "JSON.parse(localStorage.getItem('gamegen-workflow-v3.3')).gameplay.maps[0].iso.heights[20]", oldHeight+1);
  await q.command("Page.reload"); await q.delay(200);
  await expect("重开恢复等距地图编辑", "GameGenPrototype.model.gameplay.maps[0].iso.heights[20]", oldHeight+1);
  await run("localStorage.removeItem('gamegen-workflow-v3.3')");
}

/* 运行报告带最终源码摘要，只对本地浏览器原型作结论。 */
(async () => {
  await q.connect();
  await editing(); await paths(); await context(); await languages(); await persistence();
  const report = {build_id:"gamegen-prototype-v3.6-20261114-01",source_sha256:await q.sourceDigest(),
    environment:"独立Windows Chrome；桌面/手机与横屏浏览器布局",checks,browser_errors:q.browserErrors,
    passed:checks.every(c=>c.passed)&&q.browserErrors.length===0,
    limitations:["不证明原生Qt/Android编辑器","不证明完整引擎/真实模型/计费/导出","有限逻辑格路径与内置SVG美术"]};
  await fs.writeFile(path.join(root,"evidence/v3.6/isometric-check.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,errors:q.browserErrors.length}));
  q.close();
})().catch(error => {console.error(error.stack);q.close();process.exitCode=1;});
