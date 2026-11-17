/* 使用隔离Chrome检查配置、凭据边界和真实控件；不向模型/MCP发请求，不触碰用户浏览器存储。 */
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const q = require("./verify-prototype.cjs");
const [, root, base] = process.argv.slice(2);
const checks = [];
const run = value => q.evaluate(value);
const expect = async (name, expression, expected) => q.assert(checks, name, await run(expression), expected);
const click = action => run("document.querySelector('[data-action=" + JSON.stringify("assistant-" + action) + "]').click()");
const type = (id, value) => run("document.getElementById(" + JSON.stringify("assistant-" + id) + ").value=" + JSON.stringify(value));
const choose = (id, value) => run("(()=>{const e=document.getElementById(" + JSON.stringify("assistant-" + id) + ");e.value=" + JSON.stringify(value) + ";e.dispatchEvent(new Event('change',{bubbles:true}));})()");
const cfg = "GameGenPrototype.assistant.configuration()";
// 配置保存与模型选择通过实际按钮检查；测试字符串不是有效供应商密钥。
async function models() {
  await q.navigate("desktop", "settings", "normal");
  await click("open");
  await expect("设置入口打开助手", "GameGenPrototype.view.state", "assistants");
  await expect("默认不启用扩展", cfg + ".tools.some(x=>x.enabled)||" + cfg + ".skills.some(x=>x.enabled)", false);
  await click("add:llm");
  await type("name", "我的网关"); await type("model", "mock-model"); await type("address", "https://gateway.example.invalid/v1");
  await type("key", "demo-not-real-secret-37"); await click("save");
  await expect("保存模型记录", cfg + ".models.length", 1);
  await expect("新模型可选择", cfg + ".models[0].enabled", true);
  await expect("配置不含明文Key", "JSON.stringify(" + cfg + ").includes('demo-not-real-secret-37')", false);
  await expect("会话凭据单独存在", "GameGenPrototype.assistant.hasSessionCredential(" + cfg + ".models[0].id)", true);
  const id = await run(cfg + ".models[0].id");
  await click("choose:" + id); await click("chat");
  await expect("对话下拉选中自带模型", "document.getElementById('assistant-model-choice').value", id);
  await expect("显示供应商结算", "document.querySelector('.assistant-chat-bar').textContent.includes('供应商结算')", true);
  await run("document.getElementById('chat-input').value='保留这个草稿';document.getElementById('chat-input').dispatchEvent(new Event('input',{bubbles:true}))");
  await choose("model-choice", "platform");
  await expect("模型切换保留对话草稿", "document.getElementById('chat-input').value", "保留这个草稿");
  await expect("模型切换立即更新费用来源", "document.querySelector('.assistant-chat-bar').textContent.includes('平台服务')", true);
  await click("open"); await click("edit:llm:" + id);
  await type("address", "https://gateway.example.invalid/v1/messages"); await click("save");
  await expect("不兼容路径阻断保存", cfg + ".models[0].address", "https://gateway.example.invalid/v1");
  await expect("无效地址保留输入", "document.getElementById('assistant-address').value", "https://gateway.example.invalid/v1/messages");
  await click("cancel");
  const formats = [
    ["openai_chat", "/v1/chat/completions", "Authorization: Bearer"],
    ["openai_responses", "/v1/responses", "Authorization: Bearer"],
    ["claude_key", "/v1/messages", "x-api-key"],
    ["claude_bearer", "/v1/messages", "Authorization: Bearer"],
  ];
  for (const [preset, suffix, header] of formats) {
    await click("edit:llm:" + id); await choose("preset", preset);
    await type("address", "https://gateway.example.invalid/v1");
    await choose("address", "https://gateway.example.invalid/v1");
    await expect("请求预览 " + preset, "document.querySelector('.assistant-route code').textContent", "https://gateway.example.invalid" + suffix);
    await expect("鉴权预设 " + preset, "document.querySelector('.assistant-route small').textContent", header);
    await click("save");
  }
  await click("edit:llm:" + id); await type("address", "https://api.example.invalid/v1"); await choose("preset", "go");
  for (const [format, part] of [["chat", "/openai/v1/chat/completions"], ["responses", "/openai/v1/responses"], ["messages", "/anthropic/v1/messages"], ["google", "/google/v1beta/models/mock-model:streamGenerateContent?alt=sse"]]) {
    await choose("goFormat", format);
    await expect("Go按格式路由 " + format, "document.querySelector('.assistant-route code').textContent", "https://opencode.ai/inference/go" + part);
  }
  await choose("goFormat", "chat"); await click("save");
  await expect("无重复v1", "GameGenPrototype.assistant.endpoint(" + cfg + ".models[0]).includes('/v1/v1')", false);
  await expect("URL禁止嵌入Key查询", "GameGenPrototype.assistant.endpoint({..."+cfg+".models[0],address:'https://gateway.example.invalid/v1?api_key=demo'})", "");
}
// 远程/本机仅配置；非法命令和无效导入必须保留上一份完整数据。
async function extensions() {
  await click("add:mcp"); await type("name", "本机资料");
  await choose("type", "local"); await type("command", "node server.js"); await click("save");
  await expect("非数组启动命令阻断", cfg + ".tools.length", 1);
  await type("command", '["node","server.js"]'); await choose("policy", "review"); await click("save");
  const tool = await run(cfg + ".tools.at(-1).id");
  await click("toggle:mcp:" + tool); await click("check:" + tool);
  await expect("格式检查不冒充真实连接", "document.querySelector('.assistant-feedback').textContent.includes('没有连接真实')", true);
  await expect("MCP策略保存", cfg + ".tools.at(-1).policy", "review");
  await click("add:skill");
  await type("name", "手工技能"); await type("description", "设计测试关卡"); await type("body", "保留的草稿");
  const imported = "---\nname: 我的关卡技能\ndescription: 规划目标与奖励\n---\n只提出工作流变更。\nglobalThis.SKILL_EXECUTED=true";
  await run("(()=>{const d=new DataTransfer();d.items.add(new File([" + JSON.stringify(imported) + "],'SKILL.md',{type:'text/markdown'}));const e=document.getElementById('assistant-skill-file');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await q.delay(150);
  await expect("导入预览名称", "document.getElementById('assistant-name').value", "我的关卡技能");
  await expect("正文只作为文本", "typeof globalThis.SKILL_EXECUTED", "undefined");
  await expect("导入前不自动保存", cfg + ".skills.length", 1);
  await click("save");
  const skill = await run(cfg + ".skills.at(-1).id");
  await click("toggle:skill:" + skill);
  await expect("Skill正文保留", cfg + ".skills.at(-1).body.endsWith('globalThis.SKILL_EXECUTED=true')", true);
  const profile = await run(cfg + ".models[0].id");
  await click("choose:" + profile); await click("chat");
  await run("document.getElementById('chat-input').value='把击败得分改成24分';document.querySelector('[data-action=send-chat]').click()");
  await expect("任务固定模型配置", "GameGenPrototype.model.activeTask.assistantContext.provider.id", profile);
  await expect("任务固定工具配置", "GameGenPrototype.model.activeTask.assistantContext.tools.some(x=>x.id===" + JSON.stringify(tool) + ")", true);
  await expect("任务固定Skill版本", "GameGenPrototype.model.activeTask.assistantContext.skills.some(x=>x.id===" + JSON.stringify(skill) + "&&x.version===1)", true);
  await expect("任务只允许工作流", "GameGenPrototype.model.activeTask.assistantContext.output", "workflow-only");
  await expect("任务不含Key", "JSON.stringify(GameGenPrototype.model.activeTask).includes('demo-not-real-secret-37')", false);
  await click("open"); await click("toggle:llm:" + profile);
  await expect("停用模型保留在途快照", "GameGenPrototype.model.activeTask.assistantContext.provider.id", profile);
  await q.delay(1500);
  await expect("原有工作流修改仍可执行", "GameGenPrototype.model.points", 24);
  await expect("设置不影响项目积分", "GameGenPrototype.model.confirmed", true);
  await run("GameGenPrototype.go('settings','assistants')"); await click("logs");
  await expect("真实配置活动可查看", "document.querySelectorAll('.assistant-log').length>0", true);
  await expect("日志不含Key", "document.getElementById('page-content').textContent.includes('demo-not-real-secret-37')", false);
}
// 四语与手机布局检查固定文案，不翻译地址、模型ID、用户技能和输入草稿。
async function layouts() {
  for (const locale of ["zh-CN", "en-US", "ja-JP", "ko-KR"]) {
    for (const state of ["assistants", "llm_add", "mcp_add", "skill_add"]) {
      await q.navigate("android", "settings", state, 390, 844, locale);
      await expect("手机无溢出 "+locale+" "+state, "document.documentElement.scrollWidth<=document.documentElement.clientWidth", true);
      await expect("四语目录完整 "+locale+" "+state, "GameGenPrototype.i18n.diagnostics().missing.length", 0);
    }
  }
  await q.navigate("desktop", "settings", "skill_add");
  await type("name", "用户自定义技能"); await type("description", "保持原文"); await type("body", "不要翻译我的正文");
  await run("document.querySelector('[data-mode=android]').click()");
  await expect("手机切换保留名称", "document.getElementById('assistant-name').value", "用户自定义技能");
  await run("document.getElementById('ui-language').value='en-US';document.getElementById('ui-language').dispatchEvent(new Event('change',{bubbles:true}))");
  await expect("切语言保留技能正文", "document.getElementById('assistant-body').value", "不要翻译我的正文");
}
// 真实重开测试在专用QA档案中备份并还原本模块存储；Key只活在当前页面内存。
async function persistence() {
  await q.navigate("desktop", "settings", "llm_add");
  const old = await run("localStorage.getItem('gamegen-assistant-v1')");
  try {
    await q.command("Page.navigate", { url: base + "/?mode=desktop&page=settings&state=llm_add&lang=zh-CN" });
    for (let i = 0; i < 40; i++) { await q.delay(50); if (await run("document.documentElement.dataset.ready==='true'&&!location.search.includes('fixture')")) break; }
    await type("name", "持久化模型"); await type("model", "persist-model"); await type("key", "demo-secret-not-persisted"); await click("save");
    await expect("配置真实写入本机存储", "localStorage.getItem('gamegen-assistant-v1').includes('persist-model')", true);
    await expect("Key未写入本机存储", "localStorage.getItem('gamegen-assistant-v1').includes('demo-secret-not-persisted')", false);
    await q.command("Page.reload");
    for (let i = 0; i < 40; i++) { await q.delay(50); if (await run("document.documentElement.dataset.ready==='true'")) break; }
    await expect("重开恢复模型", cfg + ".models.some(x=>x.model==='persist-model')", true);
    await expect("重开没有密钥内存", cfg + ".models.filter(x=>x.model==='persist-model').every(x=>!GameGenPrototype.assistant.hasSessionCredential(x.id))", true);
  } finally {
    await run(old === null ? "localStorage.removeItem('gamegen-assistant-v1')" : "localStorage.setItem('gamegen-assistant-v1'," + JSON.stringify(old) + ")");
  }
}
(async () => {
  let error = "";
  await q.connect();
  try { await models(); await extensions(); await layouts(); await persistence(); } catch (cause) { error = cause.stack; }
  const report = { build_id: "gamegen-prototype-v3.6-20261114-01", source_sha256: await q.sourceDigest(),
    environment: "隔离Windows Chrome浏览器原型；手机390×844与桌面1440×960；假密钥、无外部请求",
    checks, error, browser_errors: q.browserErrors, passed: !error && !q.browserErrors.length && checks.every(x=>x.passed),
    limitations: ["未执行真实LLM/MCP请求或Skill脚本", "不是系统安全存储、原生权限、母语审校或供应商兼容验收"] };
  await fs.writeFile(path.join(root, "evidence/v3.6/assistant-browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, error, browserErrors: q.browserErrors.length }));
  q.close(); if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); q.close(); process.exitCode = 1; });
