/* 只检查隔离浏览器内的本地原型；截图属于设计证据，不能充当Qt或Android最终构建截图。 */
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const [debugPort, root, baseUrl, mode = "all"] = process.argv.slice(2);
const pending = new Map();
const browserErrors = [];
let socket;
let sequence = 0;

// 每条协议请求有时限，浏览器无响应时不会把检查误报为完成。
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error("协议超时：" + method)), 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

// 仅连接传入端口内的本地原型页面，不选择用户正在浏览的其他页面。
async function connect() {
  const targets = await fetch("http://127.0.0.1:" + debugPort + "/json/list").then((r) => r.json());
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(baseUrl));
  if (!target) throw new Error("未找到当前原型页面");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails);
  };
  await command("Runtime.enable");
  await command("Page.enable");
}

// 异常单独抛出，避免把脚本错误当成空值继续验收。
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

// 有限等待用于页面加载和原型任务，所有等待均远小于一分钟。
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 每个场景重新导航，确保截图不受上一场景的示例编辑影响。
async function navigate(layout, page, state, width, height, locale = "zh-CN") {
  await command("Emulation.setDeviceMetricsOverride", {
    width: width || (layout === "desktop" ? 1440 : 390),
    height: height || (layout === "desktop" ? 960 : 844),
    deviceScaleFactor: 1, mobile: layout === "android",
  });
  const url = baseUrl + "/?" + new URLSearchParams({ mode: layout, page, state, fixture: "1", lang: locale });
  await command("Page.navigate", { url });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(50);
    const ready = await evaluate("document.documentElement.dataset.ready === 'true'"
      + " && location.search.includes('page=" + page + "')");
    if (ready) {
      await evaluate("Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})))");
      return;
    }
  }
  throw new Error("场景未就绪：" + layout + "/" + page + "/" + state);
}

// 浏览器实际界面单独留证，不覆盖旧设计图，也不冒充原生构建截图。
async function capture(id) {
  const image = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(root, "evidence/v3.6/screens", id + ".png"), Buffer.from(image.data, "base64"));
}

// 断言保存实际观测值，失败时保留原始信息供修复。
function assert(checks, name, actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ name, actual, expected, passed });
  if (!passed) throw new Error("交互检查失败：" + name + "，实际 " + JSON.stringify(actual));
}

// 检查核心跨入口行为；这些结果仅证明当前HTML原型，不证明原生产品功能。
async function interactionChecks() {
  const checks = [];
  await navigate("desktop", "workflow", "selected");
  await evaluate("(() => { const input=document.getElementById('score-value'); input.value='20';"
    + " input.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await evaluate("document.querySelector('[data-action=continue-chat]').click()");
  assert(checks, "工作流修改进入对话", await evaluate("GameGenPrototype.model.points"), 20);
  await evaluate("document.getElementById('chat-input').value='保留当前得分，再加一个连击奖励';"
    + "document.querySelector('[data-action=send-chat]').click()");
  await delay(1500);
  assert(checks, "对话继续修改保留手动分值", await evaluate("GameGenPrototype.model.points"), 20);
  assert(checks, "对话明确读取当前工作流", await evaluate("document.body.textContent.includes('增加 20 分')"), true);
  await evaluate("document.querySelector('[data-mode=android]').click()");
  assert(checks, "两种布局切换保留项目", await evaluate("GameGenPrototype.model.points"), 20);
  await evaluate("GameGenPrototype.go('generate'); document.getElementById('confirm-cost').click()");
  assert(checks, "未确认费用时阻止开始生成",
    await evaluate("document.querySelector('[data-action=start-generation]').disabled"), true);
  for (const target of ["APK", "H5", "微信小游戏", "抖音小游戏"]) {
    await evaluate("GameGenPrototype.go('publish');document.querySelector('[data-target=" + target + "]').click()");
    assert(checks, "导出目标：" + target, await evaluate("GameGenPrototype.model.target"), target);
  }
  await evaluate("GameGenPrototype.go('publish','offline')");
  assert(checks, "离线时保留本地导出入口",
    await evaluate("Boolean(document.querySelector('[data-action=start-build]'))"), true);
  await evaluate("document.querySelector('[data-action=start-build]').click();"
    + "document.querySelector('[data-action=stop-build]').click()");
  await delay(1600);
  assert(checks, "停止后旧回调不会覆盖中断状态", await evaluate("GameGenPrototype.view.state"), "interrupted");
  await navigate("android", "workspace", "normal", 360, 800);
  await evaluate("document.documentElement.style.fontSize='125%'");
  assert(checks, "360宽视口无页面横向溢出",
    await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
  await evaluate("document.querySelector('[data-action=preview]').click()");
  assert(checks, "预览弹窗可打开", await evaluate("document.getElementById('preview-dialog').open"), true);
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await delay(80);
  assert(checks, "Escape关闭预览", await evaluate("document.getElementById('preview-dialog').open"), false);
  await navigate("desktop", "projects", "first_use");
  await evaluate("document.getElementById('new-name').value='';"
    + "document.querySelector('[data-action=create-project]').click()");
  assert(checks, "新建项目拒绝空名称", await evaluate("document.activeElement.id"), "new-name");
  await evaluate("document.getElementById('new-name').value='星岛测试';"
    + "document.querySelector('[data-action=create-project]').click()");
  await delay(1550);
  assert(checks, "新建后进入项目内对话", await evaluate("GameGenPrototype.view.page"), "workspace");
  assert(checks, "项目名称持续保留", await evaluate("GameGenPrototype.model.name"), "星岛测试");
  await navigate("desktop", "scene", "selected");
  const before = await evaluate("document.querySelector('.game-player').getBoundingClientRect().left");
  await evaluate("const position=document.getElementById('player-x');position.closest('details').open=true;position.value=String(GameGenPrototype.model.x+10);position.dispatchEvent(new Event('change',{bubbles:true}));");
  assert(checks, "场景位置修改反映到画面",
    await evaluate("document.querySelector('.game-player').getBoundingClientRect().left > " + before), true);
  await evaluate("GameGenPrototype.go('workflow');document.querySelector('[data-wf-select=condition]').click()");
  assert(checks, "选中不同节点显示对应参数",
    await evaluate("document.querySelector('.inspector h3').textContent"), "生命值 ≤ 0");
  await navigate("desktop", "assets", "normal");
  const documentNode = await command("DOM.getDocument");
  const fileInput = await command("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector: "#file-import" });
  await command("DOM.setFileInputFiles", { nodeId: fileInput.nodeId, files: [path.join(root, "assets/player.svg")] });
  assert(checks, "本机文件进入原型资源列表", await evaluate("GameGenPrototype.model.imported.includes('player.svg')"), true);
  await evaluate("GameGenPrototype.go('generate');document.querySelector('[data-generation=sound]').click()");
  assert(checks, "本地音效显示零云端积分",
    await evaluate("document.getElementById('page-content').textContent.includes('0 云端积分')"), true);
  await evaluate("document.querySelector('[data-action=start-generation]').click()");
  await delay(1550);
  assert(checks, "音效完成后提供正确绑定入口",
    await evaluate("Boolean(document.querySelector('[data-action=apply-sound]'))"), true);
  await evaluate("GameGenPrototype.go('history');document.querySelector('[data-action=restore-version]').click()");
  assert(checks, "恢复历史创建新版本", await evaluate("GameGenPrototype.model.revision > 18"), true);
  await evaluate("GameGenPrototype.go('settings','unauthenticated');"
    + "document.querySelector('[data-action=demo-login]').click()");
  assert(checks, "账户登录流程明确示例身份",
    await evaluate("document.getElementById('page-content').textContent.includes('示例账户')"), true);
  return checks;
}

// 构建标识绑定可编辑原型源，后续变更需要重新截图和验证。
async function sourceDigest() {
  const hash = crypto.createHash("sha256");
  for (const file of ["i18n.js", "i18n.css", "locales/source.json", "locales/source.js", "locales/en-US.json", "locales/en-US.js", "locales/ja-JP.json", "locales/ja-JP.js", "locales/ko-KR.json", "locales/ko-KR.js", "index.html", "styles.css", "studio.css", "studio.js", "workflow.js", "workflow.css", "app.js", "creation.js", "creation.css", "effects-preview.js", "gameplay.js", "gameplay.css", "isometric.js", "isometric.css", "assistant-setup.js", "assistant-setup.css", "networking.js", "networking.css", "fixtures.json", "assets/island-world.svg", "assets/player.svg"]) {
    hash.update(file);
    hash.update(await fs.readFile(path.join(root, file)));
  }
  return hash.digest("hex");
}

// 方向切换必须保留参数、节点与画布位置；检查浏览器布局，不声称验证系统方向锁定。
async function orientationChecks() {
  const checks = [];
  await navigate("android", "workflow", "selected", 390, 844);
  await evaluate("document.getElementById('score-value').value='37';document.getElementById('score-value').dispatchEvent(new Event('change',{bubbles:true}));");
  await evaluate("document.querySelector('[data-action=toggle-orientation]').click()");
  assert(checks, "点击横屏进入专用编辑布局", await evaluate("document.body.classList.contains('workflow-wide')"), true);
  assert(checks, "横屏保留节点和分值", await evaluate("[GameGenPrototype.model.selectedNode,GameGenPrototype.model.points]"), ["score", 37]);
  await command("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: false });
  assert(checks, "横屏画布与参数栏并排", await evaluate("getComputedStyle(document.querySelector('.editor-grid')).gridTemplateColumns.split(' ').length"), 2);
  await evaluate("document.getElementById('score-value').value='45';document.getElementById('score-value').dispatchEvent(new Event('change',{bubbles:true}));");
  await evaluate("GameGenPrototype.workflow.action('invalid-connection')");
  assert(checks, "错误连线保持横屏", await evaluate("GameGenPrototype.view.state"), "landscape_invalid");
  await evaluate("document.querySelector('[data-action=fix-connection]').click();document.querySelector('[data-action=toggle-orientation]').click()");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  assert(checks, "切回竖屏保留横屏修改", await evaluate("[document.body.classList.contains('workflow-wide'),GameGenPrototype.model.points]"), [false, 45]);
  return checks;
}

// 会话、规划和权限采用独立状态；验证草稿、项目版本及可审阅结果的边界。
async function agentChecks() {
  const checks = [];
  await navigate("desktop", "workspace", "normal", 1440, 960);
  await evaluate("document.getElementById('chat-input').value='保留这个草稿';document.getElementById('chat-input').dispatchEvent(new Event('input',{bubbles:true}));GameGenPrototype.go('workflow');GameGenPrototype.go('workspace');");
  assert(checks, "切页保留会话草稿", await evaluate("document.getElementById('chat-input').value"), "保留这个草稿");
  await evaluate("document.querySelector('[data-action=new-session]').click()");
  assert(checks, "新会话有独立草稿", await evaluate("document.getElementById('chat-input').value"), "");
  await evaluate("document.querySelector('[data-session=s1]').click()");
  assert(checks, "返回原会话保留草稿", await evaluate("document.getElementById('chat-input').value"), "保留这个草稿");
  const revision = await evaluate("GameGenPrototype.model.revision");
  await evaluate("document.getElementById('agent-mode').value='plan';document.getElementById('agent-mode').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-action=send-chat]').click()");
  await delay(1400);
  assert(checks, "Plan不会修改项目版本", await evaluate("GameGenPrototype.model.revision"), revision);
  await evaluate("GameGenPrototype.go('workspace','permission');document.querySelector('[data-action=deny-tool]').click()");
  assert(checks, "拒绝工具进入停止状态", await evaluate("GameGenPrototype.view.state"), "interrupted");
  await evaluate("GameGenPrototype.go('workspace','permission');document.querySelector('[data-action=allow-tool]').click()");
  assert(checks, "工具允许后可继续会话", await evaluate("GameGenPrototype.view.state"), "success");
  await evaluate("document.querySelector('[data-action=context-menu]').click();document.querySelector('[data-action=reference-level]').click()");
  assert(checks, "对象引用使用稳定关卡标识", await evaluate("document.getElementById('chat-input').value.includes('@关卡:level-01')"), true);
  await evaluate("document.querySelector('[data-action=review-changes]').click()");
  assert(checks, "审阅显示工作流语义差异", await evaluate("Boolean(document.querySelector('.semantic-diff')) && !document.querySelector('[data-code-editor]')"), true);
  return checks;
}

// 类型是可组合配置；关卡与服务端也沿用同一项目事务，模拟测试不发起API请求。
async function authoringChecks() {
  const checks = [];
  await navigate("desktop", "projects", "first_use", 1440, 960);
  assert(checks, "创建前提供完整分类与自定义入口", await evaluate("document.querySelectorAll('[data-genre]').length >= 38"), true);
  await evaluate("document.querySelector('[data-genre=\"回合制 RPG\"]').click();document.querySelector('[data-genre=\"大地图 SLG\"]').click()");
  assert(checks, "RPG与SLG可组合选择", await evaluate("GameGenPrototype.model.genres.includes('回合制 RPG') && GameGenPrototype.model.genres.includes('大地图 SLG')"), true);
  await evaluate("const option=document.querySelector('[data-project-option=network]');option.value='联网大世界';option.dispatchEvent(new Event('change',{bubbles:true}));");
  assert(checks, "联网选择明确服务端部署", await evaluate("document.body.textContent.includes('需要部署服务器')"), true);
  await evaluate("GameGenPrototype.go('world','levels')");
  const count = await evaluate("GameGenPrototype.model.levels.length");
  await evaluate("document.querySelector('[data-action=add-level]').click()");
  assert(checks, "添加关卡保存稳定标识", await evaluate("[GameGenPrototype.model.levels.length,GameGenPrototype.model.activeLevel]"), [count + 1, "level-04"]);
  await evaluate("document.querySelector('[data-world-tab=rpg]').click();document.getElementById('module-value').value='250';document.querySelector('[data-action=save-module]').click();GameGenPrototype.go('workspace');GameGenPrototype.go('world','rpg')");
  assert(checks, "RPG模块参数跨页保留", await evaluate("document.getElementById('module-value').value"), "250");
  await evaluate("document.querySelector('[data-action=client-workflow]').click()");
  assert(checks, "RPG入口打开关联工作流", await evaluate("Boolean(document.querySelector('.wf-board')) && !document.getElementById('score-value')"), true);
  await evaluate("document.querySelector('[data-wf-select=rule]').click();document.getElementById('wf-value').value='555';document.querySelector('[data-action=wf-save]').click();GameGenPrototype.go('world','rpg')");
  assert(checks, "模块节点手改反映到数据编辑页", await evaluate("document.getElementById('module-value').value"), "555");
  await evaluate("GameGenPrototype.go('api','invalid');document.getElementById('api-path').value='bad-route';document.querySelector('[data-action=save-api]').click()");
  assert(checks, "无效API路径不能提交", await evaluate("GameGenPrototype.studio.api().path"), "/v1/orders/march");
  await evaluate("document.getElementById('api-path').value='/v1/orders/move';document.querySelector('[data-action=save-api]').click()");
  assert(checks, "API定义保存在同一项目", await evaluate("GameGenPrototype.studio.api().path"), "/v1/orders/move");
  await evaluate("document.querySelector('[data-action=server-workflow]').click()");
  assert(checks, "服务端工作流隔离执行域", await evaluate("GameGenPrototype.model.workflowScope==='server' && document.querySelectorAll('[data-wf-card]').length===6 && !document.getElementById('score-value')"), true);
  await evaluate("document.querySelector('[data-action=api]').click();GameGenPrototype.go('api','invalid');document.querySelector('[data-action=test-api]').click()");
  assert(checks, "接口测试标明本地模拟", await evaluate("document.querySelector('.api-result').textContent.includes('未请求服务器')"), true);
  await evaluate("GameGenPrototype.go('api','unauthenticated');document.querySelector('[data-action=test-api]').click()");
  assert(checks, "未登录测试返回401示例", await evaluate("document.querySelector('.api-result').textContent.includes('401')"), true);
  await evaluate("GameGenPrototype.go('workspace');document.querySelector('[data-action=undo]').click()");
  assert(checks, "API事务可恢复上一版本", await evaluate("GameGenPrototype.studio.api().path"), "/v1/orders/march");
  await evaluate("GameGenPrototype.go('api','invalid');document.querySelector('[data-action=server-workflow]').click();document.querySelector('[data-wf-select=business]').click();document.getElementById('wf-value').value='25';document.querySelector('[data-action=wf-save]').click()");
  assert(checks, "API业务规则可手动修改节点参数", await evaluate("GameGenPrototype.studio.api().parameters.resourceCost"), 25);
  await evaluate("document.querySelector('[data-action=ask-api]').click()");
  assert(checks, "API对话带入同一接口标识", await evaluate("document.getElementById('chat-input').value.includes('@接口:api-march')"), true);
  await evaluate("GameGenPrototype.go('workflow','server')");
  assert(checks, "返回工作流保留API手改参数", await evaluate("document.getElementById('wf-value').value"), "25");
  return checks;
}

// 对话执行期间的手动编辑必须胜出，旧版本结果不能覆盖更新后的工作流。
async function concurrentEditChecks() {
  const checks = [];
  await navigate("desktop", "workspace", "normal", 1440, 960);
  await evaluate("document.getElementById('chat-input').value='把击败得分改成99分';document.querySelector('[data-action=send-chat]').click();GameGenPrototype.go('workflow','selected');document.getElementById('score-value').value='33';document.getElementById('score-value').dispatchEvent(new Event('change',{bubbles:true}));");
  await delay(1400);
  assert(checks, "并发手改不会被旧对话结果覆盖", await evaluate("GameGenPrototype.model.points"), 33);
  assert(checks, "旧版本补丁提示重新执行", await evaluate("document.body.textContent.includes('没有提交旧版本补丁')"), true);
  return checks;
}

// 全量模式逐个验证声明场景，冒烟模式先导出两张图供视觉检查。
async function main() {
  await connect();
  if (mode === "overview") {
    await command("Emulation.setDeviceMetricsOverride", { width: 1260, height: 990, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: baseUrl + "/design/mobile-overview.html" });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await delay(50);
      if (await evaluate("location.pathname.endsWith('mobile-overview.html') && document.readyState==='complete'")) break;
    }
    await evaluate("Promise.all(Array.from(document.images).map(image=>image.decode()))");
    const overview = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.writeFile(path.join(root, "design/mobile-overview.png"), Buffer.from(overview.data, "base64"));
    console.log(JSON.stringify({ overview: "design/mobile-overview.png" }));
    socket.close();
    return;
  }
  const startedAt = new Date().toISOString();
  const manifest = JSON.parse(await fs.readFile(path.join(root, ".design-mcp.json"), "utf8"));
  const results = [];
  const scenes = mode === "smoke" ? manifest.scenarios.filter((item) =>
    ["desktop-workspace-normal", "android-workflow-selected", "android-projects-normal"].includes(item.id)) : manifest.scenarios;
  for (const scene of scenes) {
    const [layout, page] = scene.page.split("-");
    await navigate(layout, page, scene.state, ...scene.environment.viewport_px, scene.environment.locale);
    const observation = await evaluate("({ready:document.documentElement.dataset.ready,"
      + "overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,"
      + "images:Array.from(document.images).every(image=>image.complete && image.naturalWidth>0),"
      + "text:document.getElementById('page-content').textContent.trim().length,locale:document.documentElement.lang,language:GameGenPrototype.i18n.diagnostics()})");
    const passed = observation.ready === "true" && !observation.overflow && observation.images && observation.text > 20 && observation.locale === scene.environment.locale && observation.language.missing.length === 0;
    results.push({ id: scene.id, passed, observation });
    await capture(scene.id);
    if (!passed) throw new Error("场景检查失败：" + scene.id + " " + JSON.stringify(observation));
  }
  const interactions = mode === "smoke" ? [] : [
    ...await interactionChecks(), ...await orientationChecks(), ...await agentChecks(), ...await authoringChecks(),
    ...await concurrentEditChecks(),
  ];
  const report = { build_id: "gamegen-prototype-v3.6-20261114-01", source_sha256: await sourceDigest(),
    started_at: startedAt, completed_at: new Date().toISOString(), mode,
    environment: "Windows Chrome headless；桌面1440×960，手机390×844及360×800；均为浏览器原型",
    scenes: results, interactions, browser_errors: browserErrors,
    passed: results.every((item) => item.passed) && interactions.every((item) => item.passed) && browserErrors.length === 0,
    limitations: ["未验证Qt/Android原生客户端", "未测试实际模型、扣费、游戏编译或平台发布", "没有真实用户研究、真机与辅助技术验收"] };
  await fs.writeFile(path.join(root, "evidence/v3.6", mode + "-browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, scenes: results.length, interactions: interactions.length,
    browserErrors: browserErrors.length, report: "evidence/v3.6/" + mode + "-browser-check.json" }));
  socket.close();
}

// 失败用非零退出并显示原因，禁止只保留已完成部分却宣布全量通过。
module.exports = { connect, command, evaluate, navigate, delay, assert, capture, sourceDigest, browserErrors,
  close: () => { if (socket) socket.close(); } };

// 命令行入口与可复用检查辅助分开，避免复用时自动执行全部场景。
if (require.main === module) main().catch((error) => {
  console.error(error.stack);
  if (socket) socket.close();
  process.exitCode = 1;
});
