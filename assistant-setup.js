/* AI开发助手原型只管理配置与会话快照；不连接供应商、不执行MCP命令或Skill脚本，密钥仅存闭包内存。 */
/* global button, heading, esc, I18n, view, go, render, toast -- 复用既有界面与导航，设置不进入游戏文档。 */
/* exported AssistantSetup -- 对话与设置共用唯一配置源。 */
"use strict";
const AssistantSetup = (() => {
  const states = ["assistants", "llm_add", "mcp_add", "skill_add", "assist_log", "assist_error", "assist_empty", "assist_offline", "assist_permission"];
  const storageKey = "gamegen-assistant-v1";
  const secrets = new Map();
  const keyDraft = {};
  const drafts = {};
  const editing = {};
  const presets = [
    ["openai_chat", "OpenAI · Chat Completions"], ["openai_responses", "OpenAI · Responses"],
    ["claude_key", "Claude / Claude Code · API Key"], ["claude_bearer", "Claude / Claude Code · Bearer"],
    ["go", "OpenCode Go"],
  ];
  let db;
  let lastSaved = "";
  let error = "";
  let feedback = "";
  let skipRemember = false;
  // 配置独立于游戏项目和导出；样例服务默认停用，不宣称真实可用。
  function seed() {
    return { version: 1, revision: 1, current: "platform", models: [], tools: [
      { id: "sample-library", name: "项目资料库（样例）", type: "remote", address: "https://mcp.example.invalid/mcp",
        command: '["node","server.js"]', scope: "project", policy: "read", enabled: false },
    ], skills: [
      { id: "sample-level", name: "关卡策划（样例）", description: "规划目标、路线、奖励和难度曲线。",
        body: "先明确玩家目标，再规划安全区、挑战区与奖励。逻辑修改只能提交工作流提案。", scope: "project",
        mode: "manual", enabled: false, source: "内置样例", version: 1 },
    ], logs: [] };
  }
  function cleanName(value, max = 60) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
  // URL不接收内嵌凭据或查询串；本地模型保留回环HTTP，其余地址使用HTTPS。
  function safeUrl(value) {
    try {
      const url = new window.URL(value);
      return !url.username && !url.password && !url.search && !url.hash
        && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
    } catch { return false; }
  }
  function format(record) {
    if (record.preset === "go") return record.goFormat || "chat";
    return ({ openai_chat: "chat", openai_responses: "responses", claude_key: "messages", claude_bearer: "messages" })[record.preset];
  }
  // 请求预览只计算地址，不发送数据；完整路径不能被拼接成重复的/v1或其他协议路径。
  function endpoint(record) {
    const type = format(record);
    if (!type || !safeUrl(record.address) || !cleanName(record.model, 120)) return "";
    const url = new window.URL(record.address);
    let base = url.href.replace(/\/+$/, "");
    const suffixes = { chat: "/chat/completions", responses: "/responses", messages: "/messages" };
    const terminal = /\/(chat\/completions|responses|messages)$/;
    if (terminal.test(base)) return base.endsWith(suffixes[type] || "NO_MATCH") ? base : "";
    if (type === "google") {
      if (!base.endsWith("/v1beta")) base += "/v1beta";
      return base + "/models/" + encodeURIComponent(record.model) + ":streamGenerateContent?alt=sse";
    }
    if (!base.endsWith("/v1")) base += "/v1";
    return base + suffixes[type];
  }
  function validModel(item) {
    return (!item.id || /^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) && cleanName(item.name) && presets.some(([id]) => id === item.preset) && !!endpoint(item)
      && ["project", "global"].includes(item.scope) && ["chat", "responses", "messages", "google"].includes(format(item));
  }
  function validTool(item) {
    if ((item.id && !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) || !cleanName(item.name) || !["project", "global"].includes(item.scope) || !["read", "review"].includes(item.policy)) return false;
    if (item.type === "remote") return safeUrl(item.address);
    if (item.type !== "local") return false;
    try { const command = JSON.parse(item.command); return Array.isArray(command) && command.length > 0
      && command.length <= 20 && command.every(x => cleanName(x, 240)); } catch { return false; }
  }
  function validSkill(item) {
    return (!item.id || /^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) && cleanName(item.name) && cleanName(item.description, 200) && cleanName(item.body, 16000)
      && ["project", "global"].includes(item.scope) && ["manual", "auto"].includes(item.mode);
  }
  // 仅读取本模块定义的字段，持久化数据不能为运行时注入额外能力或密钥。
  function normalize(kind, input) {
    const keys = { models: ["id", "name", "preset", "goFormat", "address", "model", "scope", "enabled", "credentialRef"],
      tools: ["id", "name", "type", "address", "command", "scope", "policy", "enabled", "credentialRef"],
      skills: ["id", "name", "description", "body", "scope", "mode", "enabled", "source", "version"] }[kind];
    return Object.fromEntries(keys.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
  }
  function init() {
    db = seed();
    try {
      if (!new URLSearchParams(location.search).get("fixture")) {
        const raw = localStorage.getItem(storageKey);
        if (raw && raw.length < 256000) {
          const saved = JSON.parse(raw);
          if (saved.version === 1 && ["models", "tools", "skills"].every(k => Array.isArray(saved[k]) && saved[k].length <= 30)
            && saved.models.every(validModel) && saved.tools.every(validTool) && saved.skills.every(validSkill)) {
            db = { version: 1, revision: Number.isSafeInteger(saved.revision) ? saved.revision : 1,
              current: typeof saved.current === "string" ? saved.current : "platform",
              models: saved.models.map(x => normalize("models", x)), tools: saved.tools.map(x => normalize("tools", x)),
              skills: saved.skills.map(x => normalize("skills", x)), logs: [] };
          }
        }
      }
    } catch { feedback = "本机配置无法读取，已保留默认助手。"; }
    lastSaved = JSON.stringify(db);
  }
  // 活动记录只保存动作摘要，不记录输入原文、Key或供应商响应。
  function log(label) {
    db.logs.unshift({ at: new Date().toISOString(), label });
    db.logs = db.logs.slice(0, 30);
  }
  function persist() {
    const next = JSON.stringify({ ...db, logs: [] });
    if (next === lastSaved) return;
    lastSaved = next;
    if (new URLSearchParams(location.search).get("fixture")) return;
    try { localStorage.setItem(storageKey, next); }
    catch { feedback = "本机存储不可用，配置仅保留在本次会话。"; }
  }
  function currentKind() { return view.state === "assist_error" ? "llm" : ({ llm_add: "llm", mcp_add: "mcp", skill_add: "skill" })[view.state]; }
  function list(kind) { return db[({ llm: "models", mcp: "tools", skill: "skills" })[kind]]; }
  // 重绘前仅保存当前表单；密码草稿留在内存，绝不并入可序列化配置。
  function beforeRender() {
    if (skipRemember) { skipRemember = false; return; }
    const form = document.getElementById("assistant-form");
    if (!form) return;
    const kind = form.dataset.kind;
    drafts[kind] = { ...drafts[kind], ...Object.fromEntries([...form.querySelectorAll("[data-assistant-field]")].map(node =>
      [node.dataset.assistantField, node.type === "checkbox" ? node.checked : node.value])) };
    const secret = form.querySelector("#assistant-key");
    if (secret) keyDraft[kind] = secret.value;
  }
  function defaults(kind) {
    return kind === "llm" ? { name: "", preset: "openai_chat", goFormat: "chat", address: "https://api.example.invalid/v1", model: "", scope: "project", enabled: true }
      : kind === "mcp" ? { name: "", type: "remote", address: "https://mcp.example.invalid/mcp", command: '["node","server.js"]', scope: "project", policy: "read", enabled: false }
        : { name: "", description: "", body: "", scope: "project", mode: "manual", enabled: false, source: "用户编写", version: 1 };
  }
  function open(kind, id = "") {
    beforeRender();
    editing[kind] = id;
    drafts[kind] = id ? { ...list(kind).find(x => x.id === id) } : defaults(kind);
    keyDraft[kind] = "";
    error = ""; feedback = ""; skipRemember = true;
    go("settings", ({ llm: "llm_add", mcp: "mcp_add", skill: "skill_add" })[kind]);
  }
  function action(label, value, primary = false) { return button(label, "assistant-" + value, primary ? "primary" : "soft"); }
  function user(value) { return I18n.user(String(value || "")); }
  function control(label, key, value, options, type = "text") {
    const id = "assistant-" + key;
    return '<label class="field">' + label + (options
      ? '<select id="' + id + '" data-assistant-field="' + key + '">' + options.map(([k, text]) => '<option value="' + k + '"'
        + (String(k) === String(value) ? " selected" : "") + '>' + esc(text) + '</option>').join("") + '</select>'
      : '<input id="' + id + '" data-assistant-field="' + key + '" type="' + type + '" value="' + esc(value || "") + '" maxlength="240">') + '</label>';
  }
  function scopeControl(data) { return control("作用范围", "scope", data.scope, [["project", "当前项目"], ["global", "全部项目"]]); }
  // Key输入可显式显示，但保存、导航和日志均不包含明文；刷新后必须重新填写。
  function keyControl(kind) {
    return '<label class="field">API Key / Token<input id="assistant-key" type="password" autocomplete="off" value="'
      + esc(keyDraft[kind] || "") + '" placeholder="仅本次会话暂存"></label><div class="assistant-inline">'
      + action("显示或隐藏", "reveal") + '<small>原型仅在内存暂存，刷新后重新填写。</small></div>';
  }
  function llmFields(data) {
    const type = format(data);
    const auth = data.preset === "claude_key" || (data.preset === "go" && type === "messages") ? "x-api-key"
      : type === "google" ? "Go API Key" : "Authorization: Bearer";
    return '<div class="assistant-fields">' + control("配置名称", "name", data.name)
      + control("接入预设", "preset", data.preset, presets)
      + (data.preset === "go" ? control("Go API 格式", "goFormat", data.goFormat, [["chat", "Chat Completions"], ["responses", "Responses"], ["messages", "Anthropic Messages"], ["google", "Google generateContent"]]) : "")
      + control("服务地址 Base URL", "address", data.address) + control("模型 ID", "model", data.model) + scopeControl(data) + '</div>'
      + keyControl("llm") + '<div class="assistant-route"><b>请求地址预览</b><code translate="no">' + esc(endpoint(data) || "—")
      + '</code><small translate="no">' + esc(auth) + '</small></div>'
      + '<p class="small muted">自带账户由供应商结算，不扣平台模型积分；不会自动切换付费来源。</p>';
  }
  function mcpFields(data) {
    return '<div class="assistant-fields">' + control("配置名称", "name", data.name)
      + control("连接方式", "type", data.type, [["remote", "远程 MCP"], ["local", "本机 stdio"]])
      + (data.type === "remote" ? control("MCP 服务地址", "address", data.address)
        : '<label class="field">启动参数数组<textarea data-assistant-field="command" id="assistant-command" rows="3" spellcheck="false">'
          + esc(data.command) + '</textarea></label>') + scopeControl(data)
      + control("允许的动作", "policy", data.policy, [["read", "仅读取资料"], ["review", "读取与工作流提案"]]) + '</div>' + keyControl("mcp")
      + '<details class="assistant-advanced"><summary>高级与运行边界</summary><p>本机服务需要兼容运行时；手机使用应用授权的目录。原型不启动命令，不连接远程工具。</p>'
      + '<p>工具提案必须经过工作流校验，不能直接改写游戏文件。</p></details>';
  }
  function skillFields(data) {
    return '<div class="assistant-fields">' + control("技能名称", "name", data.name)
      + control("何时使用", "description", data.description) + scopeControl(data)
      + control("使用方式", "mode", data.mode, [["manual", "由用户选择"], ["auto", "按描述匹配"]]) + '</div>'
      + '<label class="field">技能说明<textarea id="assistant-body" data-assistant-field="body" rows="8" maxlength="16000">'
      + esc(data.body || "") + '</textarea></label><div class="assistant-inline">'
      + '<label class="btn soft assistant-file">导入 SKILL.md<input id="assistant-skill-file" type="file" accept=".md,text/markdown,text/plain"></label>'
      + '<small>' + user(data.source) + '</small></div><p class="small muted">先预览再保存；说明和附件不自动执行脚本。</p>';
  }
  function formPage(kind) {
    const data = drafts[kind] || (drafts[kind] = defaults(kind));
    const title = ({ llm: "添加或编辑模型", mcp: "添加或编辑 MCP", skill: "添加或编辑 Skill" })[kind];
    return heading(title, "保存后回到助手设置；已有项目内容保持不变。", action("返回开发助手", "open"))
      + '<section id="assistant-form" data-kind="' + kind + '" class="assistant-form panel panel-pad">'
      + feedbackBox() + (kind === "llm" ? llmFields(data) : kind === "mcp" ? mcpFields(data) : skillFields(data))
      + '<div class="assistant-form-footer">' + action("保存配置", "save", true) + action("取消编辑", "cancel") + '</div></section>';
  }
  function feedbackBox() {
    const message = error || feedback || (view.state === "assist_error" ? "配置不合法，请检查地址、名称与模型 ID；输入已保留。" : "");
    return '<div class="assistant-feedback' + (error || view.state === "assist_error" ? " error" : "") + '" role="status"'
      + (message ? "" : " hidden") + '>' + esc(message) + '</div>';
  }
  function summary(kind, record) {
    if (kind === "llm") return I18n.translate(presets.find(([id]) => id === record.preset)?.[1] || "") + " · " + record.model;
    if (kind === "mcp") return record.type === "local" ? I18n.translate("本机 stdio") : record.address;
    return record.description;
  }
  function card(kind, record) {
    return '<article class="assistant-card"><div class="assistant-card-title"><b>' + user(record.name) + '</b><span class="pill">'
      + (record.enabled ? "已选择" : "未启用") + '</span></div><p>' + user(summary(kind, record)) + '</p>'
      + '<div class="assistant-card-meta"><span>' + (record.scope === "global" ? "全部项目" : "当前项目") + '</span><span>'
      + (kind === "skill" ? "技能说明" : "仅配置，未连接") + '</span></div><div class="assistant-card-actions">'
      + action("编辑", "edit:" + kind + ":" + record.id) + action(record.enabled ? "停用" : "启用", "toggle:" + kind + ":" + record.id)
      + (kind === "llm" ? action(db.current === record.id ? "当前模型" : "用于对话", "choose:" + record.id)
        : kind === "mcp" ? action("检查配置", "check:" + record.id) : "")
      + action("移除", "remove:" + kind + ":" + record.id) + '</div></article>';
  }
  function section(kind, title, subtitle) {
    const items = view.state === "assist_empty" ? [] : list(kind);
    return '<section class="assistant-section"><div class="assistant-section-heading"><div><h2>' + title + '</h2><p>' + subtitle
      + '</p></div>' + action(({ llm: "添加模型", mcp: "添加 MCP", skill: "添加 Skill" })[kind], "add:" + kind) + '</div>'
      + (items.length ? '<div class="assistant-cards">' + items.map(x => card(kind, x)).join("") + '</div>'
        : '<div class="assistant-empty">还没有配置，可以继续使用默认助手。</div>') + '</section>';
  }
  function logsPage() {
    return heading("开发助手活动", "只记录本原型的配置操作与对话配置快照。", action("返回开发助手", "open"))
      + '<section class="panel panel-pad">' + (db.logs.length ? db.logs.map(item => '<div class="assistant-log"><time translate="no">'
        + esc(item.at.slice(11, 19)) + '</time><p>' + esc(item.label) + '</p></div>').join("")
        : '<p class="muted">还没有活动。保存配置或发送一轮对话后再来查看。</p>') + '</section>';
  }
  function page() {
    if (!db) init();
    const kind = currentKind();
    if (kind) return '<div class="assistant-page">' + formPage(kind) + '</div>';
    if (view.state === "assist_log") return '<div class="assistant-page">' + logsPage() + '</div>';
    const stateMessage = view.state === "assist_offline" ? "当前离线：可以编辑本机配置，远程模型和工具需要联网。"
      : view.state === "assist_permission" ? "工具权限不足：请调整授权范围，仍可继续手工编辑工作流。" : "";
    return '<div class="assistant-page">' + heading("AI 开发助手", "给对话选择模型、工具和游戏开发技能；不配置也能开始。", action("返回对话", "chat", true))
      + '<div class="assistant-intro panel panel-pad"><div><span class="assistant-kicker">AI WORKSPACE</span><h2>按需要，给助手增加能力</h2>'
      + '<p>模型负责理解，MCP 连接资料与工具，Skill 提供做事方法。最终玩法和服务端逻辑始终是工作流。</p></div>'
      + action("查看活动", "logs") + '</div>' + (stateMessage ? '<p class="assistant-feedback" role="status">' + stateMessage + '</p>' : "")
      + feedbackBox() + section("llm", "模型服务", "默认使用平台助手；也可以连接自己的模型账户。")
      + section("mcp", "MCP 工具", "让助手读取指定资料，或提出经过审阅的工作流修改。")
      + section("skill", "Skill 技能", "把游戏策划、数值和关卡设计方法交给助手参考。")
      + '<p class="assistant-boundary">浏览器交互原型 · 配置可保存，服务连接与模型请求不在这里执行。</p></div>';
  }
  function fail(message) { error = message; render(); return true; }
  // 新增和编辑共用验证；错误不会覆盖上一份完整配置。
  function save() {
    beforeRender();
    const kind = currentKind();
    const data = { ...drafts[kind] };
    const valid = kind === "llm" ? validModel(data) : kind === "mcp" ? validTool(data) : validSkill(data);
    if (!valid) return fail(kind === "skill" ? "请填写技能名称、使用描述与说明正文。"
      : "配置不合法，请检查地址、名称与模型 ID；输入已保留。");
    const items = list(kind);
    if (!editing[kind] && items.length >= 30) return fail("本原型每类最多保存30项配置。");
    const id = editing[kind] || kind + "-" + Date.now() + "-" + db.revision;
    const index = items.findIndex(x => x.id === id);
    data.id = id;
    if (keyDraft[kind]) secrets.set(id, keyDraft[kind]);
    if (kind !== "skill") data.credentialRef = "session:" + id;
    if (kind === "skill") data.version = (index >= 0 ? items[index].version : 0) + 1;
    if (index >= 0) items[index] = normalize(({ llm: "models", mcp: "tools", skill: "skills" })[kind], data);
    else items.push(normalize(({ llm: "models", mcp: "tools", skill: "skills" })[kind], data));
    db.revision += 1; error = ""; feedback = "配置已保存；不会发出服务请求。";
    log("保存开发助手配置"); persist(); go("settings", "assistants"); return true;
  }
  // 更换预设时只替换未由用户自定义的示例地址，避免无意改掉三方网关。
  function change(input) {
    if (input.id === "assistant-model-choice") {
      db.current = input.value; log("切换对话模型配置"); persist(); render(); return true;
    }
    if (!input.dataset.assistantField) return false;
    beforeRender();
    const kind = currentKind();
    if (kind === "llm" && ["preset", "goFormat"].includes(input.dataset.assistantField)) {
      const data = drafts.llm;
      const url = data.address;
      // 切换预设时同步示例和官方地址，保留用户填写的第三方地址。
      if (["https://api.example.invalid/", "https://opencode.ai/"].some(prefix => url.startsWith(prefix))) {
        data.address = data.preset === "go" ? "https://opencode.ai/inference/go/"
          + (format(data) === "messages" ? "anthropic/v1" : format(data) === "google" ? "google/v1beta" : "openai/v1")
          : "https://api.example.invalid/v1";
      }
    }
    if (["preset", "goFormat", "type", "address", "model"].includes(input.dataset.assistantField)) { skipRemember = true; render(); }
    return true;
  }
  // Skill导入只读取纯文本并预览；不存在脚本求值或自动执行附件的路径。
  async function importSkill(file) {
    if (!file || file.size > 65536 || !/\.md$/i.test(file.name)) return fail("请选择不超过64 KB的 Markdown 技能文件。");
    const text = await file.text();
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return fail("SKILL.md需要name、description和说明正文，原输入已保留。");
    const value = key => match[1].match(new RegExp("^" + key + ":\\s*(.+)$", "m"))?.[1].trim().replace(/^["']|["']$/g, "") || "";
    const candidate = { ...(drafts.skill || defaults("skill")), name: value("name"), description: value("description"), body: match[2].trim(), source: file.name };
    if (!validSkill(candidate)) return fail("SKILL.md需要name、description和说明正文，原输入已保留。");
    beforeRender(); drafts.skill = candidate; error = ""; feedback = "已读取技能文件，请预览后保存。"; skipRemember = true; render();
  }
  function modelPicker() {
    const options = db.models.filter(x => x.enabled);
    if (db.current !== "platform" && !options.some(x => x.id === db.current)) db.current = "platform";
    return '<label>模型 <select id="assistant-model-choice" aria-label="对话模型"><option value="platform"'
      + (db.current === "platform" ? " selected" : "") + '>平台默认 · 示例</option>' + options.map(x => '<option value="' + esc(x.id) + '"'
        + (db.current === x.id ? " selected" : "") + ' data-i18n-skip>' + esc(x.name) + '</option>').join("") + '</select></label>';
  }
  function chatBar() {
    return '<div class="assistant-chat-bar">' + action("模型与扩展", "open") + '<span>MCP ' + db.tools.filter(x => x.enabled).length
      + ' · Skill ' + db.skills.filter(x => x.enabled).length + '</span><small>'
      + (db.current === "platform" ? "平台服务 · 示例" : "自带账户 · 供应商结算") + '</small></div>';
  }
  // 对话仅记录配置ID和版本；供应商Key不进入任务、工作流或测试接口。
  function context() {
    const profile = db.models.find(x => x.id === db.current && x.enabled);
    const snapshot = { revision: db.revision, provider: profile ? { id: profile.id, format: format(profile), endpoint: endpoint(profile) } : { id: "platform" },
      tools: db.tools.filter(x => x.enabled).map(x => ({ id: x.id, policy: x.policy })),
      skills: db.skills.filter(x => x.enabled).map(x => ({ id: x.id, version: x.version })),
      output: "workflow-only", billing: profile ? "user-provider" : "platform" };
    log("发送对话配置快照；未执行真实模型或工具请求"); return snapshot;
  }
  function click(target) {
    const actionName = target.dataset.action || "";
    if (!actionName.startsWith("assistant-")) return false;
    const [op, kind, id] = actionName.slice(10).split(":");
    if (op === "save") return save();
    if (op === "add") { open(kind); return true; }
    if (op === "edit") { open(kind, id); return true; }
    if (op === "reveal") { const input = document.getElementById("assistant-key"); input.type = input.type === "password" ? "text" : "password"; return true; }
    if (op === "choose") {
      const item = db.models.find(x => x.id === kind);
      if (!item?.enabled) { toast("请先启用这项模型配置。"); return true; }
      db.current = kind; log("选择自带模型用于后续对话"); persist(); render(); return true;
    }
    if (op === "toggle" || op === "remove") {
      const items = list(kind); const index = items.findIndex(x => x.id === id);
      if (index < 0) return true;
      if (op === "toggle") items[index].enabled = !items[index].enabled;
      else { items.splice(index, 1); secrets.delete(id); }
      if (!db.models.some(x => x.id === db.current && x.enabled)) db.current = "platform";
      db.revision += 1; log(op === "toggle" ? "更改扩展启用状态" : "移除扩展配置"); persist(); render(); return true;
    }
    if (op === "check") { feedback = "配置格式已检查；没有连接真实 MCP 服务。"; log("检查MCP配置格式；非真实连接"); go("settings", "assistants"); return true; }
    if (op === "cancel") { const k = currentKind(); keyDraft[k] = ""; error = ""; feedback = "已取消编辑，原配置保持不变。"; }
    if (op === "chat") go("workspace");
    else go("settings", op === "logs" ? "assist_log" : "assistants");
    return true;
  }
  document.addEventListener("change", event => {
    if (event.target.id === "assistant-skill-file") importSkill(event.target.files[0]).catch(() => fail("技能文件无法读取，原输入已保留。"));
  });
  return { init, states, page, beforeRender, click, change, modelPicker, chatBar, context, endpoint,
    configuration: () => JSON.parse(JSON.stringify(db)), hasSessionCredential: id => secrets.has(id) };
})();