/* 使用Chrome触控输入和命中检查验证手机流程，不以DOM.click代替实际点按。 */
"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const q = require('./verify-prototype.cjs');
const root = process.argv[3];
const checks = [];

// 触控前检查实际可见区域与遮挡，避免操作到屏幕外或遮罩后的控件。
async function tap(selector) {
  const result = await q.evaluate('(()=>{const e=document.querySelector(' + JSON.stringify(selector)
    + ');if(!e)throw new Error("控件不存在");e.scrollIntoView({block:"center",inline:"center",behavior:"instant"});'
    + 'const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);'
    + 'return {x,y,visible:r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight,hit:!!hit&&(e===hit||e.contains(hit))}})()');
  q.assert(checks, '触控命中 ' + selector, result.visible && result.hit, true);
  await q.command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: result.x, y: result.y, radiusX: 3, radiusY: 3, force: 1 }] });
  await q.delay(80);
  await q.command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await q.delay(80);
}

// 输入经过浏览器原生文本输入通道，保留失焦校验路径。
async function fill(selector, value) {
  await tap(selector);
  await q.evaluate('document.querySelector(' + JSON.stringify(selector) + ').select()');
  await q.command('Input.insertText', { text: String(value) });
}

// 行为断言记录实际值，不把命中成功等同于业务成功。
async function check(name, expression, expected) {
  q.assert(checks, name, await q.evaluate(expression), expected);
}

// 手机竖屏完成节点添加、真实端口连接、参数错误恢复和横屏切换。
async function touchFlow() {
  await q.navigate('android', 'workflow', 'normal', 390, 844);
  await tap('[data-action=wf-palette]');
  await fill('#wf-modal-search', '数值常量');
  await tap('#wf-library-dialog [data-wf-add=number]');
  const id = await q.evaluate('GameGenPrototype.model.selectedNode');
  await check('触控添加写入节点', 'GameGenPrototype.workflow.current().nodes.length', 8);
  await tap('[data-wf-node="' + id + '"][data-wf-direction=out][data-wf-port=value]');
  await tap('[data-wf-node=score][data-wf-direction=in][data-wf-port=amount]');
  await check('触控建立数值连接', 'GameGenPrototype.workflow.current().edges.some(e=>e.to==="score"&&e.input==="amount")', true);
  await tap('[data-wf-select=score]');
  await check('属性抽屉隔离背景焦点', 'document.querySelector(".wf-inspector").getAttribute("aria-modal")==="true"&&document.querySelector(".graph-center").inert', true);
  await fill('#score-value', '-2'); await tap('[data-action=wf-save]');
  await check('非法输入保留并显示原位错误', 'document.querySelector("#score-value").value==="-2"&&!document.querySelector(".wf-form-error").hidden', true);
  await check('错误字段保持焦点', 'document.activeElement.id', 'score-value');
  await fill('#score-value', '44'); await tap('[data-action=wf-save]');
  await check('触控保存合法参数', 'GameGenPrototype.model.points', 44);
  for (let index = 0; index < 18; index += 1) {
    await q.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await q.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await check('抽屉Tab焦点隔离 ' + index, '!!document.activeElement.closest(".wf-inspector")', true);
  }
  await tap('[data-action=wf-inspector-close]');
  await tap('[data-action=toggle-orientation]');
  await q.command('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await tap('[data-action=wf-palette]');
  await check('真正横屏节点库完整位于视口', '(()=>{const r=document.querySelector("#wf-library-dialog").getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight})()', true);
  await tap('[data-action=wf-palette-close]');
  await check('关闭节点库焦点返回入口', 'document.activeElement.dataset.action', 'wf-palette');
  await tap('[data-action=toggle-orientation]');
  await q.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await check('真实触控横竖屏保留参数', 'GameGenPrototype.model.points', 44);
  await check('返回后页面无横向溢出', 'document.documentElement.scrollWidth<=innerWidth', true);
}

// 标题手势只在释放时提交一次，系统取消不能留下半次修改。
async function touchDrag(label) {
  const before = await q.evaluate('(()=>{const n=GameGenPrototype.workflow.current().nodes.find(n=>n.id==="health");return {x:n.x,y:n.y,revision:GameGenPrototype.model.revision}})()');
  const start = await q.evaluate('(()=>{const e=document.querySelector("[data-wf-select=health].wf-node-title");e.scrollIntoView({block:"center",inline:"center",behavior:"instant"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await q.command('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{id:1,...start}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{id:1,x:start.x+16,y:start.y+12}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{id:1,x:start.x+32,y:start.y+24}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]}); await q.delay(350);
  await check(label+'标题拖动释放只提交一次', 'GameGenPrototype.model.revision', before.revision+1);
  await check(label+'标题拖动改变图坐标', '(()=>{const n=GameGenPrototype.workflow.current().nodes.find(n=>n.id==="health");return n.x!=='+before.x+'||n.y!=='+before.y+'})()', true);
  await tap('[data-action=undo]:not(.desktop-only)');
  await check(label+'拖动撤销恢复坐标', '(()=>{const n=GameGenPrototype.workflow.current().nodes.find(n=>n.id==="health");return [n.x,n.y]})()', [before.x,before.y]);
  const revision = await q.evaluate('GameGenPrototype.model.revision');
  await q.command('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{id:1,...start}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{id:1,x:start.x+16,y:start.y+12}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{id:1,x:start.x+32,y:start.y+24}]});
  await q.delay(100);
  await q.command('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]}); await q.delay(50);
  await check(label+'系统取消恢复图且不提交版本', '(()=>{const n=GameGenPrototype.workflow.current().nodes.find(n=>n.id==="health");return [n.x,n.y,GameGenPrototype.model.revision]})()', [before.x,before.y,revision]);
}

// 表单提交走真实触控，原生选择框通过键盘选择首个可用目标。
async function touchConnectionForm() {
  await q.navigate('android', 'workflow', 'normal', 390, 844);
  await tap('[data-action=wf-palette]'); await tap('#wf-library-dialog [data-wf-add=number]');
  const id = await q.evaluate('GameGenPrototype.model.selectedNode');
  await tap('[data-wf-select="'+id+'"]'); await tap('[data-action=wf-connect-dialog]');
  await tap('#wf-target-port');
  for (const [key,code,num] of [['ArrowDown','ArrowDown',40],['Enter','Enter',13]]) {
    await q.command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:num});
    await q.command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:num});
  }
  await check('连接表单原生选择目标', 'document.querySelector("#wf-target-port").value', 'score|amount');
  await tap('[data-action=wf-connect-save]');
  await check('触控连接表单端点准确', '(()=>{const e=GameGenPrototype.workflow.current().edges.at(-1);return [e.from,e.output,e.to,e.input]})()', [id,'value','score','amount']);
  await touchDrag('竖屏');
  await tap('[data-action=toggle-orientation]');
  await q.command('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  await touchDrag('横屏');
}

// 仅浏览器模拟输入，报告不扩展为Android系统或物理设备结论。
async function main() {
  await q.connect(); let error = '';
  try { await touchFlow(); await touchConnectionForm(); } catch (failure) { error = failure.stack; }
  const report = { build_id: 'gamegen-prototype-v3.6-20261114-01', source_sha256: await q.sourceDigest(),
    method: 'CDP Input.dispatchTouchEvent + elementFromPoint命中；Input.insertText与Tab键',
    environment: '隔离Chrome移动视口390×844和844×390；不是物理Android设备', checks,
    browser_errors: q.browserErrors, error, passed: !error && !q.browserErrors.length && checks.every((item) => item.passed) };
  await fs.writeFile(path.join(root, 'evidence/v3.6/workflow-touch-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, error })); q.close();
  if (!report.passed) process.exitCode = 1;
}

// 失败保留实际堆栈，不把部分执行记录当成全部通过。
main().catch((error) => { console.error(error.stack); q.close(); process.exitCode = 1; });
