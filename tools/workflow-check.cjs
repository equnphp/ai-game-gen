/* 基于真实浏览器事件验证图编辑；复用既有CDP工具，所有断言仅针对HTML原型。 */
"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const q = require('./verify-prototype.cjs');
const root = process.argv[3];
const checks = [];

// 仅点击界面实际存在的控件，不用直接改图替代用户操作。
async function click(selector) {
  await q.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
}

// 参数经输入与提交事件进入编辑器，检查持久化的实际模型。
async function input(selector, value, change = false) {
  await q.evaluate('(()=>{const input=document.querySelector(' + JSON.stringify(selector) + ');input.value='
    + JSON.stringify(String(value)) + ';input.dispatchEvent(new Event(' + JSON.stringify(change ? 'change' : 'input') + ',{bubbles:true}));})()');
}

// 每项断言保存实际值，失败中止而不宣称后续检查通过。
async function check(name, expression, expected) {
  q.assert(checks, name, await q.evaluate(expression), expected);
}

// 点选端口是桌面和手机相同的连线方式。
async function connect(from, output, to, pin) {
  await click('[data-wf-node="' + from + '"][data-wf-direction=out][data-wf-port="' + output + '"]');
  await click('[data-wf-node="' + to + '"][data-wf-direction=in][data-wf-port="' + pin + '"]');
}

// 节点从搜索目录添加，记录新ID供后续连接与删除验证。
async function add(type) {
  await click('[data-action=wf-palette]');
  await click('#wf-library-dialog [data-wf-add="' + type + '"]');
  return q.evaluate('GameGenPrototype.model.selectedNode');
}

// 验证图编辑、非法连线和撤销，状态不能只停留在提示文字。
async function graphChecks() {
  await q.navigate('desktop', 'workflow', 'normal');
  await check('默认示例图通过实际校验', 'GameGenPrototype.workflow.validate().length', 0);
  await click('[data-action=wf-palette]');
  await input('#wf-modal-search', '没有这个节点');
  await check('节点搜索空结果可见', 'document.querySelector("#wf-library-dialog .wf-search-empty").hidden', false);
  await click('[data-action=wf-palette-close]');
  const number = await add('number');
  await check('添加节点确实写入工程', 'GameGenPrototype.workflow.current().nodes.length', 8);
  await connect(number, 'value', 'score', 'amount');
  await check('数值端口连接成功', 'GameGenPrototype.workflow.current().edges.length', 6);
  const revision = await q.evaluate('GameGenPrototype.model.revision');
  await connect(number, 'value', 'score', 'amount');
  await check('重复连接不重复提交', 'GameGenPrototype.model.revision', revision);
  await connect('custom', 'value', 'explode', 'audio');
  await check('不兼容类型拒绝连接', 'GameGenPrototype.workflow.ui.error.includes("类型不兼容")', true);
  await check('非法连线不改变图', 'GameGenPrototype.workflow.current().edges.length', 6);
  await click('[data-action=wf-cancel-connect]');
  await click('[data-wf-select="' + number + '"]');
  await input('#wf-value', 37); await click('[data-action=wf-save]');
  await click('[data-action=wf-duplicate]');
  await check('复制不复制连线', '[GameGenPrototype.workflow.current().nodes.length,GameGenPrototype.workflow.current().edges.length]', [9, 6]);
  await click('[data-action=wf-delete]');
  await check('删除节点写入图', 'GameGenPrototype.workflow.current().nodes.length', 8);
  await click('[data-action=undo]');
  await check('撤销恢复节点', 'GameGenPrototype.workflow.current().nodes.length', 9);
  await click('[data-action=wf-redo]');
  await check('重做再次删除节点', 'GameGenPrototype.workflow.current().nodes.length', 8);
  await click('[data-wf-select=score]');
  await click('[data-wf-edge-button=edge-4]');
  await click('[data-action=wf-insert]');
  await click('#wf-library-dialog [data-wf-add=wait]');
  await check('在线间插入动作自动接好两端', '[GameGenPrototype.workflow.current().nodes.length,GameGenPrototype.workflow.current().edges.length]', [9, 7]);
  await check('插入后当前图仍然合法', 'GameGenPrototype.workflow.validate().length', 0);
  await click('[data-wf-select=health]');
  await click('[data-action=wf-delete]');
  await click('[data-action=validate-graph]');
  await check('删除中间节点能发现断链', 'GameGenPrototype.workflow.ui.results.some(item=>item.text.includes("没有执行来源"))', true);
  await click('[data-action=undo]');
  await check('撤销恢复节点和关联连线', 'GameGenPrototype.workflow.validate().length', 0);
  await click('[data-action=wf-run]');
  for (let step = 0; step < 9; step += 1) await q.evaluate('document.querySelector("[data-action=wf-step]")?.click()');
  await check('调试使用数值连线覆盖常量', 'GameGenPrototype.workflow.ui.debug.trace.at(-1).points', 37);
  await input('#wf-debug-hp', 3); await input('#wf-debug-damage', 1); await click('[data-action=wf-run]');
  await check('条件不成立不执行加分', 'GameGenPrototype.workflow.ui.debug.trace.some(item=>item.name==="增加得分")', false);
  await click('[data-action=wf-new]'); await input('#wf-new-name', '练习关卡'); await click('[data-action=wf-create]');
  await check('新建独立空图保留原图', '[GameGenPrototype.workflow.current().nodes.length,Object.keys(GameGenPrototype.model.graphs).length]', [0, 2]);
  await click('[data-action=validate-graph]');
  await check('空图有可操作的事件入口提示', 'GameGenPrototype.workflow.ui.results[0].text.includes("事件入口")', true);
  await add('hit');
  await check('空图可添加第一个事件', 'GameGenPrototype.workflow.current().nodes[0].type', 'hit');
}

// 使用真实鼠标协议检查标题拖动，而非直接设置坐标。
async function dragChecks() {
  await q.navigate('desktop', 'workflow', 'normal');
  const before = await q.evaluate('({...GameGenPrototype.workflow.current().nodes.find(n=>n.id==="hit")})');
  const rect = await q.evaluate('(()=>{const r=document.querySelector("[data-wf-select=hit]").getBoundingClientRect();return {x:r.x+60,y:r.y+20}})()');
  await q.command('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: rect.x, y: rect.y });
  await q.command('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: rect.x + 48, y: rect.y + 32 });
  await q.command('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: rect.x + 48, y: rect.y + 32 });
  await check('真实鼠标拖动更新坐标', 'GameGenPrototype.workflow.current().nodes.find(n=>n.id==="hit").x > ' + before.x, true);
  await click('[data-action=undo]');
  await check('一次撤销恢复拖动坐标', 'GameGenPrototype.workflow.current().nodes.find(n=>n.id==="hit").x', before.x);
}

// 手机入口、横屏切换与参数同源；原型布局验证不代表系统方向锁定。
async function mobileChecks() {
  await q.navigate('android', 'workflow', 'normal', 390, 844);
  await check('手机有添加入口且无横向页面溢出', '!!document.querySelector("[data-action=wf-palette]") && document.documentElement.scrollWidth<=innerWidth', true);
  await click('[data-action=wf-palette]');
  await check('手机节点库为模态对话框', 'document.querySelector("#wf-library-dialog").open', true);
  await click('[data-action=wf-palette-close]');
  await click('[data-action=wf-properties]');
  await check('手机可打开属性抽屉', 'document.querySelector(".wf-inspector").classList.contains("mobile-open")', true);
  await input('#score-value', 45, true);
  await click('[data-action=wf-inspector-close]');
  await click('[data-action=toggle-orientation]');
  await check('横屏切换保留图参数', '[document.body.classList.contains("workflow-wide"),GameGenPrototype.model.points]', [true, 45]);
  await q.command('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await check('横屏图和属性并排', 'getComputedStyle(document.querySelector(".wf-grid")).gridTemplateColumns.split(" ").length', 2);
  await click('[data-wf-select=score]'); await input('#score-value', 55, true);
  await click('[data-action=toggle-orientation]');
  await q.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await check('返回竖屏保留新参数', 'GameGenPrototype.model.points', 55);
  await q.capture('android-workflow-normal');
  await q.navigate('android', 'workflow', 'landscape', 844, 390); await q.capture('android-workflow-landscape');
}

// API规则使用服务端节点库，调整参数后返回接口页仍可继续对话。
async function serverChecks() {
  await q.navigate('desktop', 'workflow', 'server');
  await check('服务端图通过校验', 'GameGenPrototype.workflow.validate().length', 0);
  await click('[data-action=wf-palette]');
  await check('服务端目录不显示客户端动作', 'document.querySelector("#wf-library-dialog [data-wf-add=score]")===null', true);
  await click('[data-action=wf-palette-close]');
  await click('[data-wf-select=business]'); await input('#wf-value', 25); await click('[data-action=wf-save]');
  await check('业务节点保存到当前API参数', 'GameGenPrototype.studio.api().parameters.resourceCost', 25);
  await click('[data-action=continue-chat]');
  await check('API编辑后可以回到项目对话', 'GameGenPrototype.view.page', 'workspace');
  await q.evaluate('GameGenPrototype.go("workflow","server")');
  await check('回到同一API图保留参数', 'document.querySelector("#wf-value").value', '25');
}

// 覆盖独立审查发现的模块、数据边、上限和跨图对话问题。
async function reviewRegressionChecks() {
  await q.navigate('desktop', 'workflow', 'normal');
  const audio = await add('audio');
  await click('[data-wf-select="' + audio + '"]');
  await input('#wf-audio', '静音'); await click('[data-action=wf-save]');
  await connect(audio, 'asset', 'explode', 'audio');
  await click('[data-action=validate-graph]'); await click('[data-action=wf-run]');
  await check('音频数据连线覆盖默认音效', 'GameGenPrototype.workflow.ui.debug.trace.find(n=>n.id==="explode").message.includes("静音")', true);
  await q.navigate('desktop', 'workflow', 'module_rpg');
  await click('[data-action=validate-graph]'); await click('[data-action=wf-run]');
  await check('RPG条件不再判断敌人生命', 'GameGenPrototype.workflow.ui.debug.trace.find(n=>n.id==="condition").message', '模块条件 → 成立（模拟输入）');
  await check('RPG完成节点具有独立语义', 'GameGenPrototype.workflow.current().nodes.at(-1).type', 'finish');
  await q.evaluate('document.querySelector("#wf-debug-module").checked=false'); await click('[data-action=wf-run]');
  await check('RPG条件不成立不发奖励', 'GameGenPrototype.workflow.ui.debug.trace.some(n=>n.id==="reward")', false);
  await q.evaluate('GameGenPrototype.go("workflow","debug")');
  await check('模块进入调试场景不会越界崩溃', '!!document.querySelector(".wf-debug-outcome")', true);
  await q.navigate('desktop', 'workflow', 'server');
  await click('[data-wf-select=business]'); await input('#wf-value', 25); await click('[data-action=wf-save]');
  await click('[data-action=wf-duplicate]'); await input('#wf-value', 50); await click('[data-action=wf-save]');
  await click('[data-wf-select=business]');
  await check('服务端复制节点独立保存参数', 'document.querySelector("#wf-value").value', '25');
  await click('[data-wf-select=response]'); await click('[data-action=wf-delete]'); await click('[data-action=validate-graph]');
  await check('服务端缺少返回响应会报错', 'GameGenPrototype.workflow.ui.results.some(item=>item.text.includes("返回响应"))', true);
  await q.navigate('desktop', 'workflow', 'normal');
  await click('[data-wf-select=custom]');
  await q.evaluate('for(let i=0;i<73;i++)GameGenPrototype.workflow.action("wf-duplicate")');
  const revision = await q.evaluate('GameGenPrototype.model.revision');
  await click('[data-action=wf-duplicate]');
  await check('第81个节点被拒绝且不提交版本', '[GameGenPrototype.workflow.current().nodes.length,GameGenPrototype.model.revision]', [80, revision]);
  await q.navigate('desktop', 'workflow', 'normal');
  await click('[data-action=wf-new]'); await input('#wf-new-name', '独立图'); await click('[data-action=wf-create]');
  const draft = await q.evaluate('GameGenPrototype.workflow.current().id');
  await q.evaluate('GameGenPrototype.go("workspace")');
  await input('#chat-input', '把得分改成99分'); await click('[data-action=send-chat]'); await q.delay(1300);
  await check('空图对话不误改敌人图', 'GameGenPrototype.model.points', 10);
  await check('不支持的指令明确未提交', 'document.body.textContent.includes("没有提交变更")', true);
  await q.evaluate('GameGenPrototype.go("workflow")');
  await input('#wf-document', 'client:enemy', true);
  await q.evaluate('GameGenPrototype.go("workspace")');
  await input('#chat-input', '把得分改成66分'); await click('[data-action=send-chat]');
  await q.evaluate('GameGenPrototype.go("workflow")'); await input('#wf-document', draft, true); await q.delay(1300);
  await check('对话执行中切图仍修改捕获目标', '[GameGenPrototype.model.points,GameGenPrototype.model.graphs[' + JSON.stringify(draft) + '].nodes.length]', [66, 0]);
}

// 列表连接与端口点按使用同一校验，并检查分支切换、失败反馈和撤销重做。
async function connectionFormChecks() {
  await q.navigate('desktop', 'workflow', 'normal');
  const id = await add('number');
  await click('[data-action=wf-connect-dialog]');
  const revision = await q.evaluate('GameGenPrototype.model.revision');
  await click('[data-action=wf-connect-save]');
  await check('连接表单空目标原位报错且不提交', 'GameGenPrototype.model.revision===' + revision + '&&!document.querySelector("#wf-link-error").hidden&&document.querySelector("#wf-connect-dialog").open', true);
  await input('#wf-target-port', 'score|amount', true); await click('[data-action=wf-connect-save]');
  await check('连接表单保存准确的四个端点', '(()=>{const e=GameGenPrototype.workflow.current().edges.at(-1);return [e.from,e.output,e.to,e.input]})()', [id,'value','score','amount']);
  await click('[data-action=undo]');
  await check('表单连线可撤销', 'GameGenPrototype.workflow.current().edges.length', 5);
  await click('[data-action=wf-redo]');
  await check('表单连线可重做', 'GameGenPrototype.workflow.current().edges.length', 6);
  await click('[data-action=wf-connect-dialog]');
  await check('表单禁用已占用的输入', '[...document.getElementById("wf-target-port").options].find(o=>o.value==="score|amount").disabled', true);
  await click('[data-action=wf-connect-close]');
  const wait = await add('wait');
  await click('[data-wf-select=condition]'); await click('[data-action=wf-connect-dialog]');
  await input('#wf-source-port', 'no', true); await input('#wf-target-port', wait + '|in', true); await click('[data-action=wf-connect-save]');
  await check('连接表单保留选定的否分支', '(()=>{const e=GameGenPrototype.workflow.current().edges.at(-1);return [e.from,e.output,e.to,e.input]})()', ['condition','no',wait,'in']);
  const other = await add('wait');
  await click('[data-wf-select=health]'); await click('[data-action=wf-connect-dialog]');
  const unchanged = await q.evaluate('GameGenPrototype.model.revision');
  await input('#wf-target-port', other + '|in', true); await click('[data-action=wf-connect-save]');
  await check('执行输出已占用时表单保留可见错误且不提交', 'GameGenPrototype.model.revision===' + unchanged + '&&document.querySelector("#wf-connect-dialog").open&&!document.querySelector("#wf-link-error").hidden', true);
  await click('[data-action=wf-connect-close]');
}

// 容量边界不能把新上下文静默回退为可写的敌人图。
async function documentLimitChecks() {
  await q.navigate('desktop','workflow','normal');
  await q.evaluate('(()=>{const m=GameGenPrototype.model;for(let i=1;i<80;i++){const id="client:draft-"+i; m.graphs[id]={...structuredClone(m.graphs["client:enemy"]),id,context:id}}m.workflowScope="server";GameGenPrototype.go("workspace")})()');
  const revision = await q.evaluate('GameGenPrototype.model.revision');
  await input('#chat-input','把得分改为25分');await click('[data-action=send-chat]');await q.delay(1300);
  await check('80张图时对话阻止回退图误写', '[GameGenPrototype.model.points,GameGenPrototype.model.revision,GameGenPrototype.model.activeTask,Object.keys(GameGenPrototype.model.graphs).length]', [10,revision,null,80]);
  await check('达到图上限保留用户输入', 'document.querySelector("#chat-input").value', '把得分改为25分');
}

// 真正刷新验证本机草稿，不把内存回显当成持久化证明；保留原始测试存储。
async function persistenceChecks() {
  const base = process.argv[4];
  await q.command('Page.navigate', { url: base + '/?mode=desktop&page=workflow&state=server' }); await q.delay(200);
  const previous = await q.evaluate('localStorage.getItem("gamegen-workflow-v3.3")');
  try {
    await q.evaluate('localStorage.removeItem("gamegen-workflow-v3.3")');
    await q.command('Page.reload', { ignoreCache: true }); await q.delay(200);
    await click('[data-wf-select=business]'); await input('#wf-value', 31); await click('[data-action=wf-save]');
    await q.command('Page.reload', { ignoreCache: true }); await q.delay(200);
    await click('[data-wf-select=business]');
    await check('API节点刷新后保留实际参数', 'document.querySelector("#wf-value").value', '31');
    await q.evaluate('GameGenPrototype.go("world","levels")');
    await click('[data-action=add-level]');await input('#module-name','测试第四关');await input('#module-value',250);await click('[data-action=save-module]');
    await q.command('Page.reload',{ignoreCache:true});await q.delay(200);
    await check('新增关卡定义名称与选择刷新恢复', '[GameGenPrototype.model.levels.length,GameGenPrototype.model.activeLevel,document.querySelector("#module-name").value,document.querySelector("#module-value").value]', [4,'level-04','测试第四关','250']);
    await click('[data-action=client-workflow]');await click('[data-wf-select=rule]');
    await check('世界表单参数回写关联图', 'document.querySelector("#wf-value").value', '250');
    await input('#wf-value',450);await click('[data-action=wf-save]');
    await q.evaluate('GameGenPrototype.go("world","levels")');
    await check('图参数回写世界表单', 'document.querySelector("#module-value").value', '450');
    await click('[data-action=undo]');
    await check('表单与图共享撤销事务', 'document.querySelector("#module-value").value', '250');
    await q.evaluate('GameGenPrototype.model.activeLevel="level-01"');
    await q.evaluate('GameGenPrototype.go("workflow","module_slg")');
    await click('[data-wf-select=rule]'); await input('#wf-value', 432); await click('[data-action=wf-save]');
    await q.evaluate('GameGenPrototype.model.activeLevel="level-02";GameGenPrototype.go("workflow","module_slg")');
    await click('[data-wf-select=rule]');
    await check('不同关卡模块参数独立', 'document.querySelector("#wf-value").value', '100');
    await input('#wf-value', 234); await click('[data-action=wf-save]');
    await q.evaluate('GameGenPrototype.model.activeLevel="level-01";GameGenPrototype.go("workflow","module_slg")');
    await click('[data-wf-select=rule]');
    await check('切回原关卡保留模块参数', 'document.querySelector("#wf-value").value', '432');
    await q.command('Page.reload', { ignoreCache: true }); await q.delay(200);
    await click('[data-wf-select=rule]');
    await check('模块参数刷新后保留实际值', 'document.querySelector("#wf-value").value', '432');
    await q.evaluate('GameGenPrototype.studio.ui.moduleEditing=false;GameGenPrototype.model.moduleEditing=false;GameGenPrototype.model.workflowScope="client";GameGenPrototype.go("workflow","normal")');
    await q.evaluate('for(let i=0;i<73;i++)GameGenPrototype.workflow.click({dataset:{wfAdd:"custom"}})');
    await check('正常添加80节点坐标符合草稿边界', 'GameGenPrototype.workflow.current().nodes.length===80&&GameGenPrototype.workflow.current().nodes.every(n=>n.x<=2200&&n.y<=2200)', true);
    const dense = await q.evaluate('JSON.stringify(GameGenPrototype.workflow.current())');
    await q.command('Page.reload', { ignoreCache: true }); await q.delay(200);
    await check('80节点图刷新后节点坐标和边完全恢复', 'JSON.stringify(GameGenPrototype.workflow.current())', dense);
    const good = await q.evaluate('localStorage.getItem("gamegen-workflow-v3.3")');
    const damaged = ['{broken', JSON.stringify({schema:9,graphs:{}}), JSON.stringify({schema:1,graphs:{}})];
    const malformed = JSON.parse(good); malformed.graphs['client:enemy'].edges=[null]; damaged.push(JSON.stringify(malformed));
    for (let index=0;index<damaged.length;index+=1) {
      await q.evaluate('localStorage.setItem("gamegen-workflow-v3.3",'+JSON.stringify(damaged[index])+')');
      await q.command('Page.reload', { ignoreCache: true }); await q.delay(200);
      await q.evaluate('GameGenPrototype.workflow.persist()');
      await check('损坏草稿保留原文且禁止覆盖 '+index, 'GameGenPrototype.workflow.ui.blockPersist&&localStorage.getItem("gamegen-workflow-v3.3")==='+JSON.stringify(damaged[index]), true);
    }
  } finally {
    await q.evaluate(previous === null ? 'localStorage.removeItem("gamegen-workflow-v3.3")'
      : 'localStorage.setItem("gamegen-workflow-v3.3",' + JSON.stringify(previous) + ')');
  }
}

// 运行结束保留原始报告；失败也写出已执行断言，便于审查缺口。
async function main() {
  await q.connect(); let error = '';
  try { await graphChecks(); await dragChecks(); await mobileChecks(); await serverChecks(); await reviewRegressionChecks(); await connectionFormChecks(); await documentLimitChecks(); await persistenceChecks(); }
  catch (failure) { error = failure.stack; }
  const report = { build_id: 'gamegen-prototype-v3.6-20261114-01', source_sha256: await q.sourceDigest(),
    environment: '隔离Chrome浏览器原型；桌面1440×960、手机390×844与844×390',
    checks, browser_errors: q.browserErrors, error, passed: !error && !q.browserErrors.length && checks.every((item) => item.passed),
    limitations: ['未连接真实OpenCode、模型、账务、C++引擎或服务器', '未完成原生客户端和真机验收'] };
  await fs.writeFile(path.join(root, 'evidence/v3.6/workflow-browser-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, error })); q.close();
  if (!report.passed) process.exitCode = 1;
}

// 异常保留堆栈并退出，禁止只报告部分成功。
main().catch((error) => { console.error(error.stack); q.close(); process.exitCode = 1; });
