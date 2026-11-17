/* 只在隔离Chrome验证新增创作数据与实际控件；不发起模型或网络连接。 */
"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const q = require('./verify-prototype.cjs');
const [, root, baseUrl] = process.argv.slice(2);
const checks = [];
const test = async (name, expression, expected) => q.assert(checks, name, await q.evaluate(expression), expected);
const act = (expression) => q.evaluate(expression);
const change = (id, value) => act("(()=>{const input=document.getElementById("+JSON.stringify(id)+");input.value="+JSON.stringify(String(value))+";input.dispatchEvent(new Event('change',{bubbles:true}));})()");
async function creationChecks() {
  await q.navigate('desktop','projects','first_use');
  await test('新手6个模板默认可见', "document.querySelectorAll('[data-cr-template]').length", 6);
  await test('完整类型默认折叠', "document.querySelector('[data-genre]').closest('details').open", false);
  await act("document.querySelector('[data-cr-template=\"动作 RPG\"]').click()");
  await test('模板使用正式类型名称', "GameGenPrototype.model.genres", ['动作 RPG']);
  await act("GameGenPrototype.go('scene');document.querySelector('[data-cr-open=physics]').click();document.querySelector('[data-cr-preset=bounce]').click()");
  await test('物理预设写入主角组件', "GameGenPrototype.model.systems.objects['level-01:player'].physics.bounce", 0.85);
  await test('高级参数默认折叠', "document.getElementById('cr-gravity').closest('details').open", false);
  await act("document.getElementById('cr-gravity').closest('details').open=true");
  const revision = await act('GameGenPrototype.model.revision');
  await change('cr-gravity', 99); await act("document.querySelector('[data-action=cr-save]').click()");
  await test('无效参数不提交', 'GameGenPrototype.model.revision', revision);
  await test('无效输入保留并有错误', "document.getElementById('cr-gravity').value==='99'&&Boolean(document.getElementById('cr-inline-error'))", true);
  await change('cr-gravity', 12); await act("document.querySelector('[data-action=cr-save]').click()");
  await test('高级字段同源且标自定义', "(()=>{const d=GameGenPrototype.model.systems.objects['level-01:player'].physics;return [d.gravity,d.bounce,d.preset]})()", [12,0.85,'custom']);
  await act("document.querySelector('[data-cr-pause]').click()"); await q.delay(100);
  const held = await act("document.getElementById('cr-canvas').dataset.time");
  await q.delay(150); await test('暂停后示意时间不前进', "document.getElementById('cr-canvas').dataset.time", held);
  await act("document.querySelector('[data-cr-restart]').click()"); await q.delay(50);
  await test('重启确实回到开始', "Number(document.getElementById('cr-canvas').dataset.time)<0.4", true);
  await act("document.querySelector('[data-cr-object=enemy]').click();GameGenPrototype.go('scene')");
  await test('其他对象没有主角属性误编辑入口', "document.getElementById('player-hp')===null", true);
  await act("document.querySelector('[data-cr-open=particles]').click();document.querySelector('[data-cr-preset=fire]').click();document.getElementById('cr-count').closest('details').open=true");
  await change('cr-count', 33); await act("document.querySelector('[data-action=cr-save]').click()");
  await test('自定义粒子保留火焰类型', "(()=>{const d=GameGenPrototype.model.systems.objects['level-01:enemy'].particles;return [d.preset,d.effectPreset,d.count]})()", ['custom','fire',33]);
  await act("document.querySelector('[data-action=undo]').click()");
  await test('组件修改可以撤销', "GameGenPrototype.model.systems.objects['level-01:enemy'].particles.count", 120);
  await act("document.querySelector('[data-cr-object=player]').click()");
  await test('对象组件互不污染', "GameGenPrototype.model.systems.objects['level-01:player'].particles===undefined", true);
  await act("GameGenPrototype.go('scene','skeleton');document.querySelector('[data-cr-preset=run]').click();document.querySelector('[data-action=cr-ask]').click();document.querySelector('[data-action=send-chat]').click()");
  await q.delay(1400);
  await test('组件对话修改同一份数据', "GameGenPrototype.model.systems.objects['level-01:player'].skeleton.clip", 'run');
  await test('组件对话成功标明原型边界', "document.body.textContent.includes('未连接模型')", true);
  await act("GameGenPrototype.go('scene','physics');document.querySelector('[data-action=cr-workflow]').click()");
  await test('能力入口明确打开敌人示例图', "GameGenPrototype.workflow.current().id", 'client:enemy');
}
async function gameplayChecks() {
  await q.navigate('desktop','world','map_editor');
  await act("document.querySelector('[data-gp-brush=forest]').click();document.querySelector('[data-gp-cell=\"2\"]').click()");
  await test('地图笔刷真实保存格子数据', "GameGenPrototype.model.gameplay.maps[0].cells[2].terrain", 'forest');
  await act("document.querySelector('[data-action=undo]').click()");
  await test('地图笔刷可撤销', "GameGenPrototype.model.gameplay.maps[0].cells[2].terrain", 'grass');
  await change('gp-map-name','改名后的星岛'); await act("document.querySelector('[data-action=gp-save-map]').click()");
  await test('改地图名后旧入口同名', 'GameGenPrototype.studio.level().name', '改名后的星岛');
  await act("GameGenPrototype.go('world','data_tables')");
  const revision = await act('GameGenPrototype.model.revision');
  await change('gp-actor-ref','missing-item'); await act("document.querySelector('[data-action=gp-save-actor]').click()");
  await test('数据表拒绝坏外键', 'GameGenPrototype.model.revision', revision);
  await test('坏外键保留输入', "document.getElementById('gp-actor-ref').value", 'missing-item');
  await change('gp-actor-ref','potion'); await change('gp-actor-hp','123'); await act("document.querySelector('[data-action=gp-save-actor]').click()");
  await test('角色表保存类型数值', 'GameGenPrototype.model.gameplay.actors[0].hp', 123);
  await act("GameGenPrototype.go('world','quests')");
  await change('gp-quest-line','测试对白：找回森林的星光。'); await change('gp-quest-count',4);
  await act("document.querySelector('[data-action=gp-save-quest]').click()");
  await test('任务和对白原子保存', "[GameGenPrototype.model.gameplay.quests[0].count,GameGenPrototype.model.gameplay.quests[0].line]", [4,'测试对白：找回森林的星光。']);
  await test('坏恢复数据不通过地图校验', "(()=>{const d=JSON.parse(JSON.stringify(GameGenPrototype.model.gameplay));d.maps[0].spawn=d.maps[0].exit;return GameGenPrototype.gameplay.valid(d)})()", false);
}
async function networkChecks() {
  await q.navigate('desktop','api','realtime');
  await test('WSS场景显示真实连接表单', "document.getElementById('nw-endpoint').value.startsWith('wss://')", true);
  await change('nw-heartbeat',30); await act("document.querySelector('[data-nw-action=save]').click()");
  await test('心跳保存到服务配置', "GameGenPrototype.model.networking.services.find(s=>s.id==='net-world').heartbeatSeconds", 30);
  const revision = await act('GameGenPrototype.model.revision');
  await change('nw-endpoint','tcp://bad.invalid:9000'); await act("document.querySelector('[data-nw-action=save]').click()");
  await test('协议地址不匹配拒绝提交', 'GameGenPrototype.model.revision', revision);
  await test('协议错误保留输入', "document.getElementById('nw-endpoint').value", 'tcp://bad.invalid:9000');
  await act("GameGenPrototype.go('api','import_review')");
  await test('接口预览来自真实两操作', "document.querySelectorAll('[data-nw-op=name]').length", 2);
  await act("const name=document.querySelector('[data-nw-op=name]');name.value='人工修改的读角色';name.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-nw-action=apply]').click()");
  await test('接口人工修订可应用', "GameGenPrototype.model.networking.services.some(s=>s.operations.some(o=>o.name==='人工修改的读角色'))", true);
  await test('接口草案不冒充已执行工作流', "GameGenPrototype.model.networking.services.flatMap(s=>s.workflowDrafts).every(g=>g.interpreterCompatible===false)", true);
  await test('生成接口草案参与同一快照', 'GameGenPrototype.snapshot().networking.services.length', 3);
  await act("document.querySelector('[data-action=undo]').click()");
  await test('导入也可撤销', 'GameGenPrototype.model.networking.services.length', 2);
  await act("GameGenPrototype.go('api','import_invalid')");
  await test('坏文档态明确且无旧操作', "document.body.textContent.includes('不是有效JSON')&&document.querySelectorAll('[data-nw-op=name]').length===0", true);
}
async function persistenceChecks() {
  await q.command('Page.navigate',{url:baseUrl+'/?mode=desktop&page=scene&state=physics'});
  await q.delay(400);
  const prior = await act("localStorage.getItem('gamegen-workflow-v3.3')");
  try {
    await act("document.querySelector('[data-cr-preset=bounce]').click();GameGenPrototype.go('world','map_editor');document.querySelector('[data-gp-brush=forest]').click();document.querySelector('[data-gp-cell=\"3\"]').click()");
    await q.command('Page.reload'); await q.delay(450);
    await test('重开恢复组件和地图', "[GameGenPrototype.model.systems.objects['level-01:player'].physics.bounce,GameGenPrototype.model.gameplay.maps[0].cells[3].terrain]", [0.85,'forest']);
    await test('恢复后的新增数据仍通过校验', "GameGenPrototype.creation.valid(GameGenPrototype.model.systems)&&GameGenPrototype.gameplay.valid(GameGenPrototype.model.gameplay)&&GameGenPrototype.networking.valid(GameGenPrototype.model.networking)", true);
  } finally {
    await act(prior===null?"localStorage.removeItem('gamegen-workflow-v3.3')":"localStorage.setItem('gamegen-workflow-v3.3',"+JSON.stringify(prior)+")");
  }
}
async function main() {
  let error='';
  await q.connect();
  try { await creationChecks(); await gameplayChecks(); await networkChecks(); await persistenceChecks(); }
  catch (cause) { error=cause.stack; }
  const report={build_id:'gamegen-prototype-v3.6-20261114-01',source_sha256:await q.sourceDigest(),checks,error,browser_errors:q.browserErrors,
    passed:!error&&!q.browserErrors.length&&checks.every(c=>c.passed),limitations:['仅隔离Chrome原型，非新手研究或真机','不含真实引擎、联网、AI、计费、导出']};
  await fs.writeFile(path.join(root,'evidence/v3.6/creation-browser-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,error}));q.close();if(!report.passed)process.exitCode=1;
}
// 失败保存已执行断言和原始堆栈，不能将部分成功当作全量成功。
main().catch(error=>{console.error(error.stack);q.close();process.exitCode=1;});
