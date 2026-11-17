/* 本地交互原型仅模拟项目状态，禁止据此发起模型请求、实际扣费或生成游戏安装包。 */
/* global Studio, Workflow, Creation, Gameplay, Networking, Isometric, I18n, AssistantSetup -- 跨脚本复用编辑模块，所有入口仍使用同一项目数据。 */
/* exported editorToolbar -- 子模块复用此任务切换控件。 */
"use strict";

const pageDefinitions = [
  ["projects", "项目", ["normal", "first_use", "empty", "no_results"]],
  ["workspace", "对话", ["normal", "loading", "clarification", "offline", "error_timeout", "interrupted", "success", "duplicate", "permission", "review", "sessions"]],
  ["scene", "画面", ["normal", "selected", "abilities", "physics", "particles", "skeleton", "physics_advanced", "particles_advanced", "skeleton_advanced", "ability_empty", "ability_error", "ability_missing", "ability_paused"]],
  ["workflow", "工作流", ["normal", "selected", "invalid", "landscape", "landscape_invalid", "server", "server_landscape", "module_rpg", "module_slg", "module_levels", "library", "connecting", "empty", "no_results", "properties", "debug", "guide", "landscape_library"]],
  ["world", "世界与玩法", ["normal", "levels", "rpg", "slg", "empty", "map_editor", "data_tables", "quests", "isometric", "iso_height", "iso_path", "iso_level", "iso_landscape", "iso_invalid", "iso_empty"]],
  ["api", "API与服务端", ["normal", "invalid", "unauthenticated", "protocols", "import", "import_invalid", "import_review", "realtime", "mmorpg"]],
  ["tools", "更多工具", ["normal", "no_results"]],
  ["assets", "资源", ["normal", "empty", "no_results", "permission_denied"]],
  ["generate", "生成资源", ["normal", "loading", "success", "error_timeout", "insufficient"]],
  ["publish", "发布", ["normal", "offline", "loading", "interrupted", "error_timeout", "success"]],
  ["history", "历史", ["normal", "conflict"]],
  ["settings", "设置", ["normal", "unauthenticated", "assistants", "llm_add", "mcp_add", "skill_add", "assist_log", "assist_error", "assist_empty", "assist_offline", "assist_permission"]],
];
const stateLabels = {
  assistants: "AI开发助手", llm_add: "添加模型", mcp_add: "添加MCP", skill_add: "添加Skill", assist_log: "助手活动", assist_error: "配置错误", assist_empty: "扩展空态", assist_offline: "扩展离线", assist_permission: "扩展权限",
  isometric: "斜45°立体地图", iso_height: "高度与桥梁", iso_path: "寻路与试玩", iso_level: "关卡目标", iso_landscape: "地图横屏", iso_invalid: "地图参数错误", iso_empty: "新建地图",
  abilities:"对象能力", physics:"运动与碰撞", particles:"粒子特效", skeleton:"角色动作", physics_advanced:"物理高级参数", particles_advanced:"粒子高级参数", skeleton_advanced:"动作高级参数", ability_empty:"组件空态", ability_error:"组件参数错误", ability_missing:"缺失资源", ability_paused:"暂停预览", map_editor:"画地图", data_tables:"数值与成长", quests:"任务与对白", protocols:"协议能力", import:"导入接口文档", import_invalid:"文档无效", import_review:"生成结果校对", realtime:"实时连接", mmorpg:"RPG网游",
  landscape_library: "横屏节点库", library: "添加节点", connecting: "连接中", properties: "节点属性", debug: "逐步调试", guide: "操作指南",
  permission: "工具权限", review: "节点差异", sessions: "会话列表", landscape: "横屏编辑", landscape_invalid: "横屏错误态",
  module_rpg: "RPG任务工作流", module_slg: "SLG规则工作流", module_levels: "关卡工作流", server: "服务端工作流", server_landscape: "服务端横屏", levels: "关卡地图", rpg: "RPG数据", slg: "SLG规则", normal: "正常", first_use: "首次创建", empty: "空态", no_results: "无搜索结果", loading: "进行中",
  clarification: "待补充选择", offline: "离线", error_timeout: "失败 / 超时", interrupted: "任务中断",
  success: "已完成", duplicate: "重复操作", selected: "选中", invalid: "连线不兼容",
  permission_denied: "文件访问受限", insufficient: "积分不足", conflict: "版本冲突", unauthenticated: "尚未登录",
};
const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>'
    + '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 9h10M7 13h6"/>',
  scene: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/>',
  nodes: '<rect x="2" y="8" width="6" height="8" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/>'
    + '<rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 12h4V5h4M12 12v7h4"/>',
  layers: '<path d="m12 2 10 6-10 6L2 8 12 2Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="m10 2-.7 3-2 .9-2.7-.9L2 9l2.2 2v2L2 15l2.6 4 2.7-1 2 .9.7 3h4l.7-3 2-.9 2.7 1L22 15l-2.2-2v-2L22 9l-2.6-4-2.7.9-2-.9L14 2z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  arrow: '<path d="M4 12h15m-5-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m5-6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="m8 4 13 8-13 8V4Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  send: '<path d="m3 3 19 9-19 9 3-9-3-9Zm3 9h16"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  box: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M3 7l9 5v10M7 5l10 5"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c6 4 6 10 0 14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 4-6 4 6"/>',
  sparkle: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM21 2v4m-2-2h4"/>',
  cloud: '<path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1-1 11H6Z"/>',
  offline: '<path d="M2 2 22 22M5 8a13 13 0 0 1 16 1M2 9l2-1m4 6a7 7 0 0 1 8 0m-5 4 1 1 1-1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  warning: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3V6Z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  mini: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 8h3v8H8m5-8h3v8h-3"/>',
  cursor: '<path d="m4 2 15 12-8 1-4 7L4 2Z"/>',
  move: '<path d="M12 2v20M2 12h20m-14-6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
};

// 对话、工作流和历史共用此模型，以便真实演示跨入口继续修改的关系。
const params = new URLSearchParams(location.search);
const initialMode = params.get("mode") || (innerWidth < 700 ? "android" : "desktop");
const model = {
  name: "星岛冒险", revision: 18, points: 10, hp: 3, x: 168, y: 286, scale: 1,
  messages: [], imported: [], undo: [], history: [], target: "APK", generationType: "image",
  confirmed: true, selected: "player", selectedNode: "score", activeTask: null, lastMessage: "", assetFilter: "全部",
};
const view = { mode: initialMode, page: params.get("page") || "projects", state: params.get("state") || "normal" };
Studio.init();
Creation.init();
Gameplay.init();
Networking.init();
Workflow.init();
AssistantSetup.init();
const app = document.getElementById("app");
let toastTimer;
let previewOffset = 0;
let networkViewKey = "";

// 所有用户输入先编码，再进入静态模板，避免对话文本或文件名被解释成页面内容。
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

// 图标仅使用本地矢量路径，界面与导出设计图可离线打开。
function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + (iconPaths[name] || iconPaths.sparkle) + "</svg>";
}

// 主按钮保留明确文案，图标只是辅助信息。
function button(label, action, style = "", glyph = "", extra = "") {
  return `<button type="button" class="btn ${style}" data-action="${action}" ${extra}>`
    + (glyph ? icon(glyph) : "") + esc(label) + "</button>";
}

// 页面标题用于任务定位；评审器信息位于产品外框，避免混入正式产品流程。
function heading(title, subtitle, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;
}

// 状态必须同时包含文字与恢复操作，不能仅用颜色表示成败。
function notice(title, text, kind = "", action = "", actionLabel = "重试") {
  const glyph = kind === "error" || kind === "warning" ? "warning" : kind === "success" ? "checkCircle" : "info";
  return `<div class="notice ${kind}" ${kind === "error" ? 'role="alert"' : ""}>${icon(glyph)}`
    + `<div><b>${title}</b><p>${text}</p>${action ? button(actionLabel, action, "soft") : ""}</div></div>`;
}

// 统一空态承接新建、清除搜索和导入任务，保留清楚的下一步。
function emptyState(title, text, label, action) {
  return `<div class="empty-state">${icon("folder")}<h3>${title}</h3><p>${text}</p>`
    + button(label, action, "primary", "plus") + "</div>";
}

// 预览只是界面操作示意，角色移动不代表已经实现游戏引擎。
function gameStage(selected = false, interactive = false) {
  return `<div class="game-stage${interactive ? " interactive" : ""}">`
    + '<img class="world" src="assets/island-world.svg" alt="星岛冒险蓝紫色漂浮岛关卡">'
    + `<div class="game-hud"><span>♥ ♥ ♥</span><span>✦ 得分 ${model.points}</span></div>`
    + `<button class="game-player${selected ? " selected" : ""}" data-action="select-player" aria-label="选择主角"`
    + ` style="left:${Math.min(82, model.x / 9.6)}%;top:${Math.min(75, model.y / 5.4)}%">`
    + '<img src="assets/player.svg" alt="主角宇航员"></button>'
    + (selected ? '<span class="selection-label">主角 · Player</span>' : "") + "</div>";
}

// 外壳共享导航语义，桌面使用侧栏，手机使用底部任务入口。
function shell(content, flush = false) {
  const isHome = view.page === "projects";
  const nav = [["projects", "项目", "grid"], ["workspace", "对话", "chat"], ["scene", "画面", "scene"]];
  const navButtons = nav.map(([id, label, glyph]) => `<button type="button" data-page="${id}"`
    + ` class="${view.page === id ? "active" : ""}" ${view.page === id ? 'aria-current="page"' : ""}>`
    + icon(glyph) + `<span>${label}</span></button>`).join("");
  const more = '<details class="cr-more-nav"><summary>' + icon('grid') + '<span>更多工具</span></summary><div class="cr-more-menu">'
    + [['workflow','编辑工作流'],['world','地图与关卡'],['api','联网与接口'],['assets','资源库'],['tools','全部工具与能力'],['history','修改记录'],['settings','设置']].map(([id,label]) => '<button data-page="'+id+'">'+label+'</button>').join('') + '</div></details>';
  const primaryNav = navButtons + '<button data-action="preview">' + icon('play') + '<span>试玩</span></button>' + more;
  const back = view.mode === "android" && !isHome
    ? button("", "home", "icon ghost", "back", 'aria-label="返回项目"') : "";
  const brand = isHome || view.mode === "desktop"
    ? '<div class="brand"><div class="brand-mark">G</div><div><b>GameGen</b><small>AIMETA STUDIO</small></div></div>' : "";
  const project = !isHome ? `<button class="project-switch" data-page="history"><b>${I18n.user(model.name)}</b>`
    + '<span class="desktop-only">　⌄</span></button>' : '<span class="top-meta desktop-only">让想法成为可玩的游戏</span>';
  return '<div class="titlebar"><div class="window-dots"><i></i><i></i><i></i></div>'
    + '<p>Aimeta GameGen Studio · 桌面编辑器原型</p></div>'
    + `<header class="app-top">${back}${brand}${project}`
    + (!isHome ? `<span class="save-status">已保存 · r${model.revision}</span>` : "")
    + '<div class="top-actions">'
    + (!isHome ? button("", "undo", "icon ghost desktop-only", "undo", 'aria-label="撤销修改"') : "")
    + (!isHome ? button(view.mode === "android" ? "" : "试玩", "preview", "icon-mobile", "play", 'aria-label="预览游戏"') : "")
    + (!isHome ? button("发布", "publish", "primary", view.mode === "desktop" ? "upload" : "") : "")
    + '<button type="button" class="avatar" data-page="settings" aria-label="账户与设置">A</button></div></header>'
    + '<div class="locale-strip">' + I18n.picker() + '</div>'
    + `<div class="app-body"><nav class="rail" aria-label="主导航">${primaryNav}`
    + `<button data-page="history" class="${view.page === "history" ? "active" : ""}">${icon("history")}历史</button>`
    + `<button data-page="settings" class="rail-bottom ${view.page === "settings" ? "active" : ""}">`
    + `${icon("settings")}设置</button></nav><main class="page-area${flush ? " flush" : ""}" id="page-content">`
    + content + `</main></div><nav class="mobile-nav" aria-label="手机主导航">${primaryNav}</nav>`;
}

// 项目封面和资源缩略图分离，普通控件保持可编辑和可点击。
function projectCard(title, cover, subtitle, tag) {
  const art = cover === "world"
    ? '<img src="assets/island-world.svg" alt="星岛冒险关卡">'
      + '<img class="player-small" src="assets/player.svg" alt="">'
    : `<div class="cover-${cover}"></div>`;
  return '<button type="button" class="project-card" data-action="open-project">'
    + `<div class="project-cover${cover === "world" ? "" : " pastel"}">${art}</div>`
    + `<div class="project-info"><h3>${title}</h3><div class="row between">`
    + `<small class="muted">${subtitle}</small><span class="pill blue">${tag}</span></div></div></button>`;
}

// 首次创建提供可编辑需求，创建后仍停留在同一个项目中持续对话。
function newProjectForm() {
  return heading("创建你的游戏", "选一个例子，写下想法，接着边看边改。") + Creation.templates()
    + '<div class="form-grid creation-form"><section class="panel panel-pad"><label class="field">游戏名称'
    + '<input id="new-name" value="星岛冒险" maxlength="40"></label><label class="field">描述你的游戏'
    + '<textarea id="new-prompt">描述玩法、关卡、角色和目标。AI只生成可编辑的工作流。</textarea></label>'
    + Creation.options() + '<div class="summary-footer">类型决定初始模块；所有玩法与API最终均为工作流。</div>'
    + button("创建并开始对话", "create-project", "primary full", "sparkle") + '</section>'
    + '<aside class="panel panel-pad"><div class="eyebrow">YOUR GAME, YOUR RULES</div><h2>从一种类型开始，也能混合创新</h2>'
    + '<div class="generated-preview"><img src="assets/player.svg" alt="示例宇航员"></div>'
    + '<p class="summary-footer">支持关卡、RPG、SLG等模块。类型列表是创作配置，当前原型未实现这些游戏引擎和服务器。</p></aside></div>';
}

// 搜索空结果与项目为空分开，恢复按钮只改变当前任务的局部状态。
function projectsPage() {
  if (view.state === "first_use") return newProjectForm();
  const intro = heading("我的游戏", "每个想法，都有一个可以继续的地方。",
    button("新建游戏", "new-project", "primary", "plus"));
  const hero = '<section class="hero"><div class="hero-copy"><div class="eyebrow">CREATE SOMETHING PLAYABLE</div>'
    + '<h2>一句想法，<br>开启你的游戏世界。</h2><p>从对话开始，在场景和工作流里打磨，随时预览你的下一次改变。</p>'
    + button("开始创作", "new-project", "primary", "sparkle")
    + '</div><img class="hero-art" src="assets/island-world.svg" alt="漂浮岛游戏场景"></section>';
  const search = '<label class="search">' + icon("search")
    + '<input id="project-search" aria-label="搜索项目" placeholder="搜索项目" value="'
    + (view.state === "no_results" ? "赛车" : "") + '"></label>';
  let projects = '<div class="project-grid">'
    + projectCard(I18n.user(model.name), "world", "刚刚编辑 · 本机已保存", "创作中")
    + projectCard("轨道小球", "orbits", "昨天编辑 · 本机", "草稿")
    + projectCard("方块漫游", "bricks", "3 天前编辑 · 本机", "已导出") + '</div>';
  if (view.state === "empty") projects = emptyState("你的第一个游戏，从这里开始", "用自己的想法创建，或从示例项目了解编辑流程。", "创建游戏", "new-project");
  if (view.state === "no_results") projects = emptyState("没有找到“赛车”", "换个关键词，或查看全部项目。", "清除搜索", "clear-search");
  return intro + hero + '<div class="section-title"><h2>最近项目 <span class="muted small"> / 本机</span></h2>'
    + search + '</div>' + projects + '<div class="quick-strip">'
    + '<button class="quick-item" data-action="import-project">' + icon("folder")
    + '<span><b>导入项目</b><small>继续来自其他设备的创作</small></span></button>'
    + '<button class="quick-item" data-page="workflow">' + icon("nodes")
    + '<span><b>看看工作流</b><small>从事件与动作理解游戏逻辑</small></span></button>'
    + '<button class="quick-item" data-page="settings">' + icon("offline")
    + '<span><b>本地创作能力</b><small>离线编辑、预览和导出</small></span></button></div>';
}

// 编辑器的子任务切换保留项目与修改历史，便于从对话跳到具体内容。
function editorToolbar(active, label, right = "") {
  const tabs = [["workspace", "对话"], ["scene", "画面"], ["tools", "更多工具"]]
    .map(([id, text]) => `<button data-page="${id}" class="${active === id ? "active" : ""}">${text}</button>`).join("");
  return `<div class="content-toolbar"><div class="segmented">${tabs}</div>`
    + `<span class="small muted desktop-only">${label}</span><div class="grow"></div>${right}</div>`;
}

// 对话状态包含中断和失败恢复，原型中的任务明确标记为模拟执行。
function workspacePage() {
  return Studio.workspace();
}

// 数值字段带明确单位与范围，修改结果在对话摘要中继续可见。
function field(label, id, value, type = "text", hint = "") {
  return `<label class="field">${label}<input id="${id}" type="${type}" value="${esc(value)}"`
    + (type === "number" ? ' step="1" min="0" max="9999"' : "") + `>${hint ? `<small>${hint}</small>` : ""}</label>`;
}

// 工作流编辑器持有结构化图，所有操作与对话共享项目事务。
function workflowPage() { return Workflow.page(); }

// 音频缩略图使用静态波形，点击试听时才合成短提示音，不自动播放。
function wave() {
  return '<div class="wave" aria-label="音频波形示意">' + '<i></i>'.repeat(22) + '</div>';
}

// 资源卡通过类型和来源标签帮助区分本机文件与生成结果。
function assetCard(name, kind, image, tag = "已使用") {
  const preview = image === "sound" ? wave() : `<img class="${image === "player" ? "sprite" : ""}"`
    + ` src="assets/${image === "player" ? "player" : "island-world"}.svg" alt="${esc(name)}">`;
  return `<button class="asset-card" data-asset="${esc(name)}"><div class="asset-preview ${image === "player" ? "checker" : ""}">`
    + preview + `<span class="pill blue">${tag}</span></div><div class="asset-info"><b>${model.imported.includes(name) ? I18n.user(name) : esc(name)}</b>`
    + `<small>${kind}</small></div></button>`;
}

// 文件授权失败集中在资源导入入口；替代操作不依赖文件权限。
function assetsPage() {
  const intro = heading("项目资源", "角色、场景和声音，都可以随时替换。",
    '<div class="row gap8">' + button("导入", "import-asset", "", "upload") + button("AI 生成", "generate", "primary", "sparkle") + '</div>');
  const tabs = '<div class="section-title" style="margin-top:0"><div class="segmented">'
    + ["全部", "图片", "音频"].map((label) => `<button class="${model.assetFilter === label ? "active" : ""}"`
      + ` data-filter="${label}">${label}</button>`).join("") + '</div><label class="search">' + icon("search")
    + '<input id="asset-search" aria-label="搜索资源" placeholder="搜索资源" value="'
    + (view.state === "no_results" ? "背景音乐2" : "") + '"></label></div>';
  if (view.state === "permission_denied") return intro + notice("还没有获得文件访问权限", "你可以重新选择文件，或使用现有资源继续创作。不会影响已保存的项目。", "warning", "import-asset", "重新选择文件")
    + '<div style="margin-top:18px">' + button("查看现有资源", "clear-search", "soft", "layers") + '</div>';
  if (view.state === "empty") return intro + tabs + emptyState("还没有资源", "先导入一张角色图片，或让 AI 生成你想要的素材。", "生成资源", "generate");
  if (view.state === "no_results") return intro + tabs + emptyState("没有找到对应资源", "可以换个关键词，或查看全部资源。", "清除搜索", "clear-search");
  const pictures = model.assetFilter === "音频" ? "" : assetCard("宇航员 · 主角", "图片 · 透明背景", "player")
    + assetCard("星岛 · 关卡背景", "图片 · 960 × 540", "world")
    + assetCard("宇航员 · 备选", "图片 · AI 生成示例", "player", "未使用");
  const audio = model.assetFilter === "图片" ? "" : assetCard("爆炸 · 轻量", "音效 · 1.2 秒 · 本地", "sound")
    + assetCard("晶体 · 收集", "音效 · 0.8 秒 · 本地", "sound")
    + assetCard("星空 · 氛围", "音乐 · 循环", "sound");
  const imports = model.imported.map((name) => assetCard(name, "本机选择 · 原型仅保留文件名", "player", "本机导入")).join("");
  return intro + tabs + '<div class="asset-grid">' + pictures + audio + imports + '</div>'
    + '<p class="summary-footer">替换资源后，绑定的对象和工作流会继续使用新的素材。原型内的图片与音频均为示例。</p>';
}

// 生成费用先展示后确认；本地音效使用独立入口，不套用云端图片的扣费规则。
function generationForm() {
  const sound = model.generationType === "sound";
  return '<section class="panel panel-pad"><div class="segmented" style="margin-bottom:21px">'
    + `<button data-generation="image" class="${sound ? "" : "active"}">角色图片</button>`
    + `<button data-generation="sound" class="${sound ? "active" : ""}">音效</button></div>`
    + '<label class="field">' + (sound ? "描述声音" : "描述角色")
    + '<textarea id="generation-prompt">' + (sound ? "轻巧的能量爆炸声，带一点科幻感，结尾干净。"
      : "可爱的宇航员，正面站立，蓝白配色，适合2D横版游戏，透明背景。") + '</textarea></label>'
    + '<div class="choice-grid"><button class="choice active"><b>' + (sound ? "本地生成" : "透明背景")
    + '</b><small>' + (sound ? "已准备好本地音效模型" : "方便直接放入场景") + '</small></button>'
    + '<button class="choice"><b>' + (sound ? "时长 1.2 秒" : "角色立绘") + '</b><small>'
    + (sound ? "适合短促的爆炸效果" : "单张图片 · 512 × 512") + '</small></button></div>'
    + '<div class="quote"><div class="row between"><span>本次费用</span><b>' + (sound ? "0 云端积分" : "80 积分")
    + '</b></div><p class="small muted">' + (sound ? "本地执行，无需上传描述。当前仅演示交互。"
      : "费用确认后才开始；生成失败退回预扣积分。当前积分与费用为示例。") + '</p></div>'
    + '<label class="check-label"><input id="confirm-cost" type="checkbox" ' + (model.confirmed ? "checked" : "") + '>'
    + '<span>' + (sound ? "使用本地模型生成（原型模拟）" : "确认使用 80 示例积分生成本次图片") + '</span></label>'
    + button("开始生成", "start-generation", "primary full", "sparkle", model.confirmed ? "" : "disabled") + '</section>';
}

// 成功、失败和余额不足分别展示费用后果，不用成功文案掩盖未完成任务。
function generationStatus() {
  const sound = model.generationType === "sound";
  if (view.state === "loading") return notice(sound ? "正在生成音效" : "正在生成角色",
    sound ? "本地模拟任务 · 不消耗云端积分。" : "模拟任务 · 正在整理生成结果，预计费用 80 示例积分。",
    "", "cancel-generation", "停止任务")
    + '<div class="progress"><span style="width:56%"></span></div><div class="generated-preview">' + icon("sparkle") + '</div>';
  if (view.state === "error_timeout") return notice("本次生成未完成",
    sound ? "本地任务未完成，描述已保留，不消耗云端积分。"
      : "示例服务返回超时，预扣的 80 积分已退回。描述已保留，可重试或选择本机文件。",
    "error", "retry-generation", "重新生成")
    + '<div style="margin-top:15px">' + button("从本机选择", "import-asset", "full", "folder") + '</div>';
  if (view.state === "insufficient") return notice("积分不足", "当前示例余额 20 积分，本次图片需要 80 积分。尚未发起生成，也未扣费。", "warning", "import-asset", "改用本机图片")
    + '<div style="margin-top:15px">' + button("查看积分与账户", "settings", "full") + '</div>';
  if (view.state === "success") return notice("生成结果已就绪",
    sound ? "示例音效已加入项目资源，可以绑定到爆炸事件。" : "示例图片已加入项目资源，还可以选中后替换角色。", "success")
    + '<div class="generated-preview checker">'
    + (sound ? wave() : '<img src="assets/player.svg" alt="生成角色示例">') + '</div>'
    + '<div class="row" style="margin-top:18px">'
    + button(sound ? "绑定到爆炸事件" : "用于当前角色", sound ? "apply-sound" : "apply-generated", "primary grow", "check")
    + button("查看资源", "assets", "") + '</div>';
  if (sound) return '<div class="image-choice">' + wave() + '</div><div class="section-title"><h3>把声音放进游戏</h3></div>'
    + '<p class="small muted">描述音色、时长与使用场景。可以先试听，再决定是否绑定到爆炸事件。</p>';
  return '<div class="image-choice"><img src="assets/player.svg" alt="当前角色示例"></div>'
    + '<div class="section-title"><h3>让角色更贴近你的想法</h3></div>'
    + '<p class="small muted">描述外形、配色和动作。结果会先加入资源库，你可以决定是否替换当前角色。</p>'
    + '<div class="row wrap" style="margin-top:17px"><span class="pill">风格一致</span>'
    + '<span class="pill">透明背景</span><span class="pill">可随时替换</span></div>';
}

// 原型不连接支付系统，账户数字以显式示例标签展示。
function generatePage() {
  return heading("生成游戏资源", "补齐一个角色，或为一次爆炸找到合适的声音。")
    + '<div class="form-grid">' + generationForm() + '<aside class="stack"><div class="credit-card">'
    + '<div class="row between"><b class="small">可用积分</b><span class="pill blue">示例</span></div>'
    + '<div class="row" style="margin-top:9px"><strong>' + (view.state === "insufficient" ? "20" : "1,280")
    + '</strong><span class="small muted">积分</span></div></div><section class="panel panel-pad">'
    + generationStatus() + '</section></aside></div>';
}

// 各发布目标分别说明本地导出与平台上传的边界，小游戏使用“导出工程”措辞。
function platformDetails() {
  const table = {
    APK: { name: "Android 安装包", note: "可在 Android 手机上安装体验", file: "星岛冒险-v1.0.0.apk", size: "18.6 MB", action: "生成 APK" },
    H5: { name: "H5 游戏", note: "导出后可部署到网站，通过链接游玩", file: "星岛冒险-h5.zip", size: "12.4 MB", action: "导出 H5" },
    微信小游戏: { name: "微信小游戏工程", note: "导出工程后，在微信平台工具中上传和审核", file: "星岛冒险-wechat.zip", size: "13.1 MB", action: "导出微信工程" },
    抖音小游戏: { name: "抖音小游戏工程", note: "导出工程后，在抖音平台工具中上传和审核", file: "星岛冒险-douyin.zip", size: "13.3 MB", action: "导出抖音工程" },
  };
  return table[model.target];
}

// 构建状态明确标记演示，不创建伪装成真实APK的文件。
function publishStatus() {
  const details = platformDetails();
  if (view.state === "success") return notice("导出流程演示完成", "这里展示成品就绪时的界面；本次原型没有生成真实游戏文件。", "success")
    + `<div class="file-result"><b>${details.file}</b><p>${details.size} · 大小为示例 · 本机导出</p></div>`
    + '<div class="row wrap" style="margin-top:17px">' + button("查看示例结果", "show-export", "primary", "folder")
    + button("继续修改游戏", "workspace", "") + '</div>';
  if (view.state === "error_timeout") return notice("导出未完成", "示例错误：写入目标目录失败。项目仍在本机，可更换保存位置后重新导出。", "error", "retry-build", "重新导出");
  if (view.state === "interrupted") return notice("上次导出已中断", "项目内容已保存。重新导出会从校验开始，不承诺断点续传。", "warning", "retry-build", "重新导出");
  if (view.state === "loading") return '<h3>正在准备 ' + esc(model.target) + '</h3><p class="small muted">模拟进度 · 本地构建</p>'
    + '<div class="progress"><span style="width:68%"></span></div><ol class="step-list">'
    + '<li class="done">' + icon("checkCircle") + '项目与工作流校验<small>完成</small></li>'
    + '<li class="done">' + icon("checkCircle") + '整理游戏资源<small>完成</small></li>'
    + '<li class="current">' + icon("box") + '生成目标文件<small>进行中</small></li>'
    + '<li>' + icon("lock") + (model.target === "APK" ? "签名与结果验证" : "导出结果验证") + '<small>待执行</small></li></ol>'
    + '<div style="margin-top:18px">' + button("停止导出", "stop-build", "full") + '</div>';
  return '<h3>发布前检查</h3><div style="margin-top:14px">'
    + ["工作流没有阻断错误", "项目资源已在本机", "导出组件已准备好", "项目修改已保存"]
      .map((text) => '<div class="check-line">' + icon("checkCircle") + text + '</div>').join("")
    + '</div><div class="quote"><div class="row between"><span class="small muted">预计大小</span><b>' + details.size + '</b></div>'
    + '<p class="small muted">本地导出不消耗云端积分。实际大小由最终构建决定。</p></div><div style="margin-top:20px">'
    + button(details.action, "start-build", "primary full", "download") + '</div>';
}

// APK签名身份和平台应用标识保留为不同配置，不把平台上传承诺成离线操作。
function publishPage() {
  const details = platformDetails();
  const offline = view.state === "offline" ? notice("当前离线，仍可本地导出", "引擎和资源已准备好。APK、H5及小游戏工程可以在本机生成；上传平台需要恢复网络。", "warning") : "";
  const cards = [["APK", "phone", "Android 安装包"], ["H5", "globe", "浏览器游戏"],
    ["微信小游戏", "mini", "导出平台工程"], ["抖音小游戏", "mini", "导出平台工程"]]
    .map(([name, glyph, note]) => `<button class="platform-card${model.target === name ? " active" : ""}"`
      + ` data-target="${name}">${icon(glyph)}<b>${name}</b><small>${note}</small></button>`).join("");
  const config = '<section class="panel panel-pad"><div class="row between"><h3>' + details.name
    + '</h3><span class="pill green">本地导出</span></div><p class="small muted" style="margin:7px 0 21px">' + details.note + '</p>'
    + field("游戏名称", "export-name", model.name) + '<div class="coordinates">'
    + field("版本名称", "version-name", "1.0.0") + field("版本编号", "version-code", 1, "number") + '</div>'
    + (model.target === "APK" ? field("应用包名", "package-name", "games.aimeta.starisland")
      + '<div class="notice">' + icon("lock") + '<div><b>保持更新身份</b>'
        + '<p>使用此项目已有的签名身份。后续更新沿用相同包名和签名。</p></div></div>'
      : model.target === "H5" ? '<label class="check-label"><input type="checkbox" checked>将运行所需资源包含在导出包中</label>'
        : field("平台 AppID", "platform-appid", "待填写", "text", "可先导出工程，上传前在平台工具中补齐应用信息。"))
    + '</section>';
  const fixedAction = view.state === "loading" ? button("停止导出", "stop-build", "")
    : view.state === "success" ? button("继续修改", "workspace", "primary")
      : button(details.action, "start-build", "primary", "download");
  const mobileAction = '<div class="publish-fixed mobile-only"><div><b>本地导出</b>'
    + '<small>不消耗云端积分 · 原型演示</small></div>' + fixedAction + '</div>';
  return heading("发布你的游戏", "把当前版本带到玩家面前，之后仍可继续修改。") + offline
    + '<div class="platform-grid">' + cards + '</div><div class="publish-layout">' + config
    + '<aside class="panel panel-pad">' + publishStatus() + '</aside></div>'
    + '<p class="summary-footer">本页是发布流程原型。小游戏的上传、审核和上线由对应平台完成；本次不执行实际发布。</p>'
    + mobileAction;
}

// 冲突恢复使用新版本保留当前内容，避免在原型中表现成静默覆盖。
function historyPage() {
  const conflict = view.state === "conflict" ? notice("发现同一项目的两个版本", "本机修改了分值，另一设备修改了角色。先查看差异，再决定如何合并；当前版本保持不变。", "warning", "resolve-conflict", "查看并合并示例差异") : "";
  const items = [{ revision: model.revision, title: "当前版本", note: "敌人生命 " + model.hp + " · 击败得分 " + model.points, current: true },
    ...model.history.slice().reverse().map((item) => ({ revision: item.revision, title: item.title, note: item.note })),
    { revision: 17, title: "调整受击与爆炸", note: "对话修改 · 新增受击、爆炸和计分工作流" },
    { revision: 16, title: "整理关卡布局", note: "手动修改 · 调整漂浮岛与传送门位置" }];
  return heading("修改记录", "对话与手动编辑，都留在同一条项目历史中。") + conflict
    + '<div class="timeline">' + items.map((item, i) => '<section class="version-card ' + (i === 0 ? "current" : "")
      + '"><div class="row between"><div class="row"><b>r' + item.revision + '　' + I18n.user(item.title)
      + '</b>' + (i === 0 ? '<span class="pill blue">当前</span>' : "") + '</div>'
      + (i === 0 ? button("继续创作", "workspace", "soft") : button("恢复为新版本", "restore-version", "", "history"))
      + '</div><p>' + I18n.user(item.note) + '</p></section>').join("") + '</div>'
    + '<p class="summary-footer">历史与跨设备冲突是示例流程；当前原型没有连接云同步服务。</p>';
}

// 云端账户与离线创作分开说明，不要求用户自行填写模型密钥。
function settingsPage() {
  if (AssistantSetup.states.includes(view.state)) return AssistantSetup.page();
  const guest = view.state === "unauthenticated";
  return heading("账户与设置", "管理创作服务和本机能力。")
    + '<section class="panel panel-pad language-settings">' + I18n.picker('settings-language')
    + '<p class="small muted">语言切换立即生效，项目内容保持原文。</p></section>'
    + '<section class="account-banner"><div class="avatar">A</div><div class="grow"><h2>'
    + (guest ? "登录后使用云端生成" : "Aimeta 创作者") + '</h2><p>'
    + (guest ? "本地编辑、预览和导出仍可继续。" : "服务由平台统一提供 · 示例账户") + '</p></div>'
    + button(guest ? "登录" : "积分记录", guest ? "demo-login" : "credit-history", "soft") + '</section>'
    + '<section class="panel panel-pad"><div class="setting-row"><div><h3>AI 开发助手</h3><p>模型服务、MCP 工具与 Skill 技能</p></div>' + button('配置助手', 'assistant-open', 'soft') + '</div></section>'
    + '<div class="settings-grid"><section class="panel panel-pad"><h3>创作服务</h3>'
    + '<div class="setting-row"><div><h3>对话助手</h3><p>在当前项目中持续修改游戏</p></div><span class="pill '
    + (guest ? "orange" : "green") + '">' + (guest ? "需要登录" : "可用 · 示例") + '</span></div>'
    + '<div class="setting-row"><div><h3>AI 图片生成</h3><p>开始前确认费用，按任务结算</p></div><span class="pill blue">积分</span></div>'
    + '<div class="setting-row"><div><h3>本地音效生成</h3><p>模型已在本机时可以离线使用</p></div><span class="pill green">已准备 · 示例</span></div>'
    + '<div class="setting-row"><div><h3>项目同步</h3><p>本轮原型仅保存在当前浏览器会话</p></div><span class="pill">未接入</span></div></section>'
    + '<section class="panel panel-pad"><h3>本机与项目</h3><div class="setting-row"><div><h3>本地导出组件</h3>'
    + '<p>APK、H5、微信和抖音小游戏工程</p></div><span class="pill green">示例就绪</span></div>'
    + '<div class="setting-row"><div><h3>项目历史</h3><p>查看修改记录或恢复为新版本</p></div>'
    + button("查看", "history", "ghost") + '</div><div class="setting-row"><div><h3>原型数据</h3>'
    + '<p>重置只影响本次原型的示例内容</p></div>' + button("重置", "reset-demo", "ghost") + '</div>'
    + '<p class="summary-footer">GameGen Studio V3 · 产品原型<br>正式客户端支持 Android 和 Qt 桌面端。</p></section></div>';
}

// 每个场景都可通过地址定位，支持逐页截图与后续设计交接。
function render() {
  const base = pageDefinitions.find(([id]) => id === view.page) || pageDefinitions[0];
  const def = [base[0], base[1], base[2].filter((state) => view.mode === "android" || !state.includes("landscape"))];
  view.page = def[0];
  if (!def[2].includes(view.state)) view.state = "normal";
  document.body.classList.toggle("android", view.mode === "android");
  const networkKey = view.page + ":" + view.state;
  if (view.page === "api" && networkViewKey !== networkKey) Networking.enterState(view.state);
  networkViewKey = networkKey;
  AssistantSetup.beforeRender();
  Isometric.beforeRender();
  Creation.beforeRender();
  Studio.beforeRender();
  const renderers = { projects: projectsPage, workspace: workspacePage, scene: Creation.page, workflow: workflowPage,
    assets: assetsPage, generate: generatePage, publish: publishPage, history: historyPage, settings: settingsPage, world: () => Isometric.states.includes(view.state) ? Isometric.page() : ["map_editor", "data_tables", "quests"].includes(view.state) ? Gameplay.page() : Studio.world(), api: Networking.page, tools: Creation.toolsPage };
  const flush = ["workspace", "scene", "workflow"].includes(view.page);
  Workflow.beforeRender();
  app.innerHTML = shell(renderers[view.page](), flush);
  app.dataset.page = view.page;
  document.getElementById("review-page").innerHTML = pageDefinitions.map(([id, label]) =>
    `<option value="${id}" ${view.page === id ? "selected" : ""}>${label}</option>`).join("");
  document.getElementById("review-state").innerHTML = def[2].map((state) =>
    `<option value="${state}" ${view.state === state ? "selected" : ""}>${stateLabels[state]}</option>`).join("");
  document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item.dataset.mode === view.mode));
  document.title = "GameGen V3.6 · " + def[1] + " / " + stateLabels[view.state];
  const query = new URLSearchParams({ mode: view.mode, page: view.page, state: view.state, lang: I18n.preference() });
  if (params.get("fixture")) query.set("fixture", params.get("fixture"));
  history.replaceState(null, "", "?" + query);
  Studio.afterRender();
  Workflow.afterRender();
  Creation.afterRender();
  Gameplay.afterRender();
  Isometric.afterRender();
  Networking.afterRender();
  Workflow.persist();
  I18n.apply();
  document.documentElement.dataset.ready = "true";
}

// 页面切换默认回到正常状态；项目数据不随视图切换重建。
function go(page, state = "normal") {
  view.page = page;
  view.state = state;
  render();
}

// 工程快照覆盖图、接口和模块，撤销重做恢复同一份源数据。
function projectSnapshot() {
  return { points: model.points, hp: model.hp, x: model.x, y: model.y,
    moduleValue: model.moduleValue, activeLevel: model.activeLevel, activeApi: model.activeApi,
    moduleRecords: JSON.parse(JSON.stringify(model.moduleRecords)), graphs: JSON.parse(JSON.stringify(model.graphs)),
    levels: JSON.parse(JSON.stringify(model.levels)), apis: JSON.parse(JSON.stringify(model.apis)),
    systems: JSON.parse(JSON.stringify(model.systems)), gameplay: JSON.parse(JSON.stringify(model.gameplay)), networking: JSON.parse(JSON.stringify(model.networking)) };
}

// 提交前归一化镜像字段；工程版本始终递增，过期对话补丁不能因撤销而重新有效。
function commit(title, patch) {
  model.undo.push(projectSnapshot());
  model.redo = [];
  model.history.push({ revision: model.revision, title, note: '手动或对话修改 · 原型项目记录' });
  Object.assign(model, Workflow.preparePatch(patch));
  model.revision += 1;
  Workflow.persist();
}

// 非阻塞反馈不抢走键盘焦点，重要错误仍在页面中保留。
function toast(text) {
  const element = document.getElementById("toast");
  clearTimeout(toastTimer);
  element.textContent = text;
  I18n.apply();
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, 2800);
}

// 对话修改只解析少量演示指令，界面持续说明并未连接真实模型。
function sendChat() {
  Studio.send();
}

// 隔离演示任务类型，避免生成与构建之间的定时回调串台。
function runDemoTask(kind, page) {
  if (model.activeTask) { toast("已有任务正在进行，请先停止或等待完成。"); return; }
  const task = { kind, page };
  model.activeTask = task;
  go(page, "loading");
  setTimeout(() => {
    if (model.activeTask !== task) return;
    model.activeTask = null;
    go(page, "success");
  }, 1400);
}

// 预览弹窗支持键盘和触摸按钮；展示的移动只用于讨论控件和入口。
function openPreview() {
  const dialog = document.getElementById("preview-dialog");
  previewOffset = 0;
  dialog.innerHTML = '<div class="preview-header"><div><h2 id="preview-title">' + I18n.user(model.name)
    + ' · 交互预览示意</h2><small>示例场景，不代表引擎运行结果</small></div>'
    + button("关闭", "close-preview", "", "close") + '</div>' + gameStage(false, true)
    + '<div class="preview-controls"><span>方向键移动 · 空格跳跃</span><div class="row">'
    + button("向左", "preview-left", "", "back") + button("向右", "preview-right", "", "arrow")
    + button("跳跃", "preview-jump", "") + '</div></div>';
  I18n.apply();
  dialog.showModal();
}

// 移动被限制在可见场景内，避免原型角色跑出画布。
function movePreview(delta, jump = false) {
  const player = document.querySelector("#preview-dialog .game-player");
  if (!player) return;
  previewOffset = Math.max(-40, Math.min(360, previewOffset + delta));
  player.style.transform = `translate(${previewOffset}px, ${jump ? -50 : 0}px)`;
  if (jump) setTimeout(() => { player.style.transform = `translate(${previewOffset}px, 0)`; }, 250);
}

// 音频由用户点击触发，不自动播放，也不声称使用了本地生成模型。
function playDemoSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { toast("此浏览器无法试听，资源仍可继续使用。"); return; }
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(390, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(90, context.currentTime + 0.35);
  gain.gain.setValueAtTime(0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
  oscillator.onended = () => context.close();
  toast("正在试听合成提示音 · 仅用于原型演示");
}

// 所有导航统一从这里分发，避免同名按钮产生不一致的跨页行为。
function handleAction(action) {
  if (Workflow.action(action) || Studio.click({ dataset: { action } })) return;
  const navigation = ["workspace", "scene", "workflow", "assets", "generate", "publish", "history", "settings"];
  if (navigation.includes(action)) { go(action); return; }
  const actions = {
    home: () => go("projects"),
    "new-project": () => go("projects", "first_use"),
    "open-project": () => go("workspace"),
    "clear-search": () => { model.assetFilter = "全部"; go(view.page); },
    "create-project": createProject,
    "send-chat": sendChat,
    "retry-chat": () => { model.activeTask = null; runDemoTask("demo-chat-retry", "workspace"); },
    "show-loading": () => go("workspace", "loading"),
    "stop-chat": () => { model.activeTask = null; go("workspace", "interrupted"); },
    "select-player": () => { if (!document.getElementById("preview-dialog").open) go("scene", "selected"); },
    "move-player": () => { commit("移动主角", { x: model.x + 10 }); render(); toast("主角 X 位置增加 10。"); },
    "add-object": () => { toast("已定位对象创建流程；此版先使用示例主角演示编辑。"); },
    "ask-character": () => { go("workspace"); document.getElementById("chat-input").value = "调整主角的外形和跳跃手感"; },
    "continue-chat": () => { go("workspace"); toast("当前工作流得分为 " + model.points + "，继续对话会保留这个值。"); },
    "validate-graph": () => { go("workflow"); toast("示例工作流验证完成：未发现阻断项。"); },
    "invalid-connection": () => go("workflow", "invalid"),
    "fix-connection": () => go("workflow", "selected"),
    "node-library": () => toast("节点库示意：事件、条件、动作、变量和自定义函数。"),
    "import-asset": () => document.getElementById("file-import").click(),
    "import-project": () => toast("项目导入为后续接入点；可先打开星岛冒险示例。"),
    "local-sound": () => { model.generationType = "sound"; go("generate"); },
    "use-existing": () => { go("workspace", "success"); toast("已选择现有爆炸音效示例。"); },
    "start-generation": startGeneration,
    "retry-generation": () => { model.activeTask = null; runDemoTask("generation", "generate"); },
    "cancel-generation": () => { model.activeTask = null; go("generate"); toast("模拟任务已停止，没有实际扣费。"); },
    "apply-generated": () => { commit("替换角色图片", {}); go("scene", "selected"); toast("已应用示例角色资源。"); },
    "apply-sound": () => { go("workflow", "selected"); toast("已把示例音效绑定到爆炸事件。"); },
    "start-build": () => runDemoTask("build", "publish"),
    "retry-build": () => { model.activeTask = null; runDemoTask("build", "publish"); },
    "stop-build": () => { model.activeTask = null; go("publish", "interrupted"); },
    "show-export": () => toast("原型结果示意：未创建真实 APK、ZIP 或平台工程。"),
    "restore-version": restoreVersion,
    "resolve-conflict": () => { commit("合并另一设备的角色修改（示例）", {}); go("history"); toast("示例差异已合并为新版本，当前得分保留。"); },
    "demo-login": () => { go("settings"); toast("登录成功状态示意；没有连接真实账户服务。"); },
    "credit-history": () => toast("示例账户没有真实积分交易记录。"),
    "reset-demo": resetDemo,
    undo: undoChange,
    preview: openPreview,
    "close-preview": () => document.getElementById("preview-dialog").close(),
    "preview-left": () => movePreview(-20),
    "preview-right": () => movePreview(20),
    "preview-jump": () => movePreview(0, true),
  };
  if (actions[action]) actions[action]();
}

// 新建只保存当前会话的演示需求，真实项目持久化留给共用核心实现。
function createProject() {
  if (!model.genres.length) { toast("请至少选择一种游戏类型。"); return; }
  const name = document.getElementById("new-name").value.trim();
  if (!name) { toast("请给游戏起一个名称。"); document.getElementById("new-name").focus(); return; }
  model.name = name;
  model.lastMessage = document.getElementById("new-prompt").value.trim();
  model.activeTask = null;
  runDemoTask("create", "workspace");
}

// 费用复选框为任务前置条件，客户端演示不产生真实账务变化。
function startGeneration() {
  if (!model.confirmed) { toast("先确认本次生成方式和费用。"); return; }
  if (view.state === "insufficient") { toast("示例积分不足，可改用本机资源。"); return; }
  runDemoTask("generation", "generate");
}

// 恢复始终产生新版本，不删除当前历史。
function restoreVersion() {
  commit("从历史恢复为新版本", { points: 10, hp: 3 });
  go("history");
  toast("已创建恢复版本，后续仍可继续修改。");
}

// 撤销恢复完整编辑字段，避免只回退界面中的一个数字。
function undoChange() {
  const snapshot = model.undo.pop();
  if (!snapshot) { toast('当前没有可以撤销的修改。'); return; }
  model.redo.push(projectSnapshot());
  Object.assign(model, snapshot);
  model.revision += 1;
  model.history.push({ revision: model.revision, title: '撤销最近修改', note: '工程图和参数一并恢复' });
  Workflow.ui.results = null; Workflow.ui.debug = null; Workflow.ui.pending = null;
  Workflow.persist(); render(); toast('已撤销上一次项目修改。');
}

// 重置属于本地原型的可逆演示，不影响工作区或用户设备上的游戏项目。
function resetDemo() {
  Object.assign(model, { name: "星岛冒险", revision: 18, points: 10, hp: 3, x: 168, y: 286,
    messages: [], imported: [], undo: [], history: [], activeTask: null, lastMessage: "", target: "APK", confirmed: true });
  Studio.init();
  Creation.init(true);
  delete model.gameplay; delete model.networking;
  Gameplay.init(); Networking.init();
  Workflow.init(true);
  go("projects");
  toast("示例数据已重置。");
}

// 事件委托使重新渲染后的控件继续可用；只响应本原型定义的动作。
document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || target.disabled) return;
  if (AssistantSetup.click(target) || Isometric.click(target) || Creation.click(target) || Gameplay.click(target) || Networking.click(target) || Workflow.click(target) || Studio.click(target)) return;
  if (target.dataset.mode) { view.mode = target.dataset.mode; render(); }
  else if (target.dataset.page) go(target.dataset.page);
  else if (target.dataset.node) { model.selectedNode = target.dataset.node; view.state = "selected"; render(); }
  else if (target.dataset.target) { model.target = target.dataset.target; view.state = "normal"; render(); }
  else if (target.dataset.filter) { model.assetFilter = target.dataset.filter; render(); }
  else if (target.dataset.generation) { model.generationType = target.dataset.generation; view.state = "normal"; render(); }
  else if (target.dataset.asset) {
    if (/爆炸|晶体|星空/.test(target.dataset.asset)) playDemoSound();
    else { go("scene", "selected"); toast("已定位引用这个资源的角色（示例）。"); }
  } else if (target.dataset.action) handleAction(target.dataset.action);
});

// 数值提交在失焦或确认后进行，输入过程不打断用户编辑。
document.addEventListener("change", (event) => {
  const input = event.target;
  if (AssistantSetup.change(input) || Creation.change(input) || Gameplay.change(input) || Networking.change(input) || Workflow.change(input) || Studio.change(input)) return;
  if (input.id === "review-page") { go(input.value); return; }
  if (input.id === "review-state") { model.activeTask = null; view.state = input.value; render(); return; }
  if (input.id === "confirm-cost") { model.confirmed = input.checked; render(); return; }
  const fields = { "score-value": "points", "player-hp": "hp", "player-x": "x", "player-y": "y" };
  if (fields[input.id]) {
    const number = Number(input.value);
    if (!Number.isFinite(number) || number < 0 || number > 9999) { toast("请输入 0 到 9999 的数值。"); return; }
    commit("修改" + (input.id === "score-value" ? "得分" : "角色属性"), { [fields[input.id]]: number });
    render();
    toast("已保存到当前项目 · r" + model.revision);
  }
  if (input.id === "file-import" && input.files.length) {
    model.imported.push(input.files[0].name);
    go("assets");
    toast("已选择本机文件；原型只保留文件名，不上传内容。");
    input.value = "";
  }
});

// 搜索只影响列表状态；项目源数据与已有输入不会被清空。
document.addEventListener("keydown", (event) => {
  const input = event.target;
  if (event.key === "Enter" && ["project-search", "asset-search"].includes(input.id)) {
    const hasQuery = input.value.trim();
    view.state = hasQuery ? "no_results" : "normal";
    render();
  }
  const dialog = document.getElementById("preview-dialog");
  if (!dialog.open || ["INPUT", "TEXTAREA", "SELECT"].includes(input.tagName)) return;
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
    movePreview(event.key === "ArrowLeft" ? -20 : event.key === "ArrowRight" ? 20 : 0, event.key === " ");
  }
});

// 测试接口只暴露无凭据的原型状态，方便记录实际交互结果。
window.GameGenPrototype = { model, view, go, render, studio: Studio, workflow: Workflow, creation: Creation, gameplay: Gameplay, isometric: Isometric, networking: Networking, assistant: AssistantSetup, i18n: I18n, snapshot: projectSnapshot, buildId: "gamegen-prototype-v3.6-20261114-01" };
render();

// 展示层监听后续错误与状态提示，不把翻译写回项目。
I18n.start();
