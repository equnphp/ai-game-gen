/* 工作流是唯一玩法逻辑来源；本文件只演示界面和图参数，不连接OpenCode或执行服务器请求。 */
/* global I18n, AssistantSetup, Creation, Workflow, model, view, button, icon, esc, heading, field, notice, gameStage, editorToolbar, go, render, commit, toast -- 复用主界面的数据和控件。 */
/* exported Studio -- 按脚本顺序加载，供主界面调用。 */
"use strict";
const Studio = (() => {
  const genres = [
    ["动作与射击", "横版闯关", "动作冒险", "格斗", "射击", "弹幕", "潜行"],
    ["角色扮演", "回合制 RPG", "动作 RPG", "战棋 RPG", "Roguelike", "生存冒险"],
    ["策略与经营", "回合制 SLG", "即时策略 RTS", "大地图 SLG", "塔防", "自走棋", "模拟经营", "城市建设"],
    ["休闲与益智", "解谜", "三消", "物理解谜", "跑酷", "放置养成", "派对小游戏"],
    ["卡牌与棋盘", "卡牌构筑", "集换式卡牌", "棋类", "桌游", "掷骰与大富翁"],
    ["叙事与模拟", "视觉小说", "互动叙事", "生活模拟", "种田", "沙盒创造", "音乐节奏", "体育", "2D 竞速"],
  ];
  const ui = { group: "全部", agent: "build", session: "s1", panel: "preview", menu: "", worldTab: "levels",
    module: "关卡", wideReturn: "selected", graphPosition: null, apiResult: null, serverNode: 0,
    sessions: [{ id: "s1", title: "敌人受击与爆炸", draft: "", turns: [] },
      { id: "s2", title: "关卡与任务规划", draft: "", turns: [] }] };

  // 游戏类型是起始配置，后续可混合模块，不能把一类游戏永久锁进固定模板。
  function init() {
    Object.assign(ui, { group: "全部", agent: "build", session: "s1", panel: "preview", menu: "", worldTab: "levels",
      module: "关卡", wideReturn: "selected", graphPosition: null, apiResult: null, serverNode: 0,
      sessions: [{ id: "s1", title: "敌人受击与爆炸", draft: "", turns: [] }, { id: "s2", title: "关卡与任务规划", draft: "", turns: [] }] });
    Object.assign(model, { genres: ["横版闯关"], structure: "分关卡", timing: "即时", network: "单机",
      gameOrientation: "横屏", moduleEditing: false, moduleRecords: {}, workflowScope: "client", activeLevel: "level-01", moduleValue: 100,
      levels: [{ id: "level-01", name: "星岛 · 起点", next: "level-02" },
        { id: "level-02", name: "月光森林", next: "level-03" }, { id: "level-03", name: "遗迹守卫", next: "" }],
      apis: [{ id: "api-save", name: "同步存档", method: "POST", path: "/v1/saves/sync", auth: true },
        { id: "api-stage", name: "领取关卡奖励", method: "POST", path: "/v1/stages/claim", auth: true },
        { id: "api-march", name: "提交行军指令", method: "POST", path: "/v1/orders/march", auth: true }],
      activeApi: "api-march" });
  }

  // 每个会话独立保存输入和消息，项目工作流仍由所有会话共享。
  function session() { return ui.sessions.find((item) => item.id === ui.session); }
  // 地图配置是名称的来源，旧模块仅保留关联和流转字段。
  function level() {
    const selected = model.levels.find((item) => item.id === model.activeLevel) || model.levels[0];
    const map = model.gameplay?.maps.find((item) => item.id === selected.id);
    return map ? { ...selected, name: map.name } : selected;
  }
  function api() { return model.apis.find((item) => item.id === model.activeApi) || model.apis[0]; }

  // 模块参数按关卡稳定ID隔离，未配置的新关卡使用明确默认值。
  function moduleKey() { return ui.worldTab + ':' + ui.module + ':' + model.activeLevel; }

  // 参数属于具体接口，切换接口不会复用另一个接口的业务数值。
  function serverParameters() {
    return api().parameters || { bodyLimit: 256, resourceCost: 10, idempotent: true, status: 200 };
  }

  // 类型选择保留复选语义，选中RPG或SLG不会覆盖用户此前选择的其他类型。
  function genrePicker() {
    const groups = ["全部", ...genres.map((item) => item[0])];
    return '<section class="genre-picker panel panel-pad"><div class="row between"><div><h2>先选择游戏类型</h2>'
      + '<p class="small muted">可多选，也可以从自定义玩法开始。</p></div><span class="pill blue">可组合</span></div>'
      + '<div class="genre-groups">' + groups.map((name) => `<button type="button" data-genre-group="${name}"`
        + ` class="${ui.group === name ? "active" : ""}">${name}</button>`).join("") + '</div>'
      + '<div class="genre-grid">' + genres.filter((g) => ui.group === "全部" || g[0] === ui.group)
        .flatMap((g) => g.slice(1)).concat("自定义 / 混合玩法").map((name) => `<button type="button" data-genre="${name}"`
          + ` class="genre-card ${model.genres.includes(name) ? "active" : ""}" aria-pressed="${model.genres.includes(name)}">`
          + icon(model.genres.includes(name) ? "checkCircle" : "grid") + esc(name) + '</button>').join("")
      + '</div><p class="genre-summary">已选：' + esc(model.genres.join(" + ") || "请选择至少一种类型") + '</p></section>';
  }

  // 视角、组织方式和联网方式独立于类型，避免“RPG只能回合制”等隐含限制。
  function creationSettings() {
    const selects = [["世界结构", "structure", ["分关卡", "连续大地图", "章节 / 房间", "单场对局"]],
      ["时间规则", "timing", ["即时", "回合制", "混合"]], ["游玩方式", "network", ["单机", "本地多人", "联网合作", "联网对战", "联网大世界"]],
      ["游戏方向", "gameOrientation", ["横屏", "竖屏", "自适应"]]];
    return '<div class="creation-options">' + selects.map(([label, key, choices]) => `<label class="field">${label}`
      + `<select data-project-option="${key}">` + choices.map((value) => `<option${model[key] === value ? " selected" : ""}>`
        + value + '</option>').join("") + '</select></label>').join("") + '</div>'
      + '<p class="small muted">' + (model.network.startsWith("联网")
        ? '联网项目包含客户端与 API 工作流；需要部署服务器后才能提供真实联网服务。'
        : '可先制作本地游戏，后续增加联网模块。') + '</p>';
  }

  // OpenCode式会话入口与消息流分开，手机通过抽屉访问同一组会话。
  function sessionsPane() {
    return '<aside class="session-list' + (view.state === "sessions" ? ' open' : '') + '"><div class="row between">'
      + '<b>项目会话</b>' + button("", "new-session", "icon ghost", "plus", 'aria-label="新建会话"') + '</div>'
      + '<p class="small muted">' + I18n.user(model.name) + '</p><div class="session-items">'
      + ui.sessions.map((item) => `<button type="button" data-session="${item.id}" class="session-item ${ui.session === item.id ? "active" : ""}">`
        + icon("chat") + `<span>${I18n.user(item.title)}<small>${item.turns.length ? "刚刚更新" : "项目内会话"}</small></span></button>`).join("")
      + '</div><div class="session-footer"><span class="status-dot"></span>OpenCode 接入预留 · 演示</div></aside>';
  }

  // 工具活动只显示可审阅的输入、结果和状态，不把模型内部推理暴露成日志。
  function toolActivity() {
    if (ui.agent === "plan") return notice("规划模式", "本轮只读取项目并提出工作流方案，没有提交节点修改。");
    const busy = view.state === "loading";
    return '<div class="task-progress"><b>' + (busy ? "正在执行 · 2 / 3" : "执行完成 · 3 / 3") + '</b>'
      + '<span>工作流事务 · r' + model.revision + '</span></div>'
      + [['读取项目上下文', 'game_project_read', '当前关卡、选中节点及最新项目版本。'],
        ['修改工作流节点', 'game_graph_patch', model.workflowScope === 'server' ? '当前API：' + api().name + '；保留已保存的服务端参数。'
          : model.moduleEditing ? '当前模块：' + ui.module + '；保留已保存的模块参数。' : '节点 score：增加 ' + model.points + ' 分；保留手动参数。'],
        ['校验工作流', 'game_graph_validate', busy ? '正在检查引脚类型、资源引用和执行域…' : '通过 · 无未连接的必需输入。']]
        .map(([title, tool, detail], index) => '<details class="tool-activity"' + (busy && index === 2 ? ' open' : '') + '><summary>'
          + icon(busy && index === 2 ? "bolt" : "checkCircle") + '<span>' + title + '</span><small>'
          + (busy && index === 2 ? "执行中" : "完成") + '</small></summary><div><code>' + tool + '</code><p>'
          + detail + '</p><small>工具事件示例 · 未连接真实服务</small></div></details>').join("");
  }

  // 权限和业务追问采用不同卡片；普通图修改无需每次打断，付费仍走独立报价确认。
  function turnStatus() {
    if (view.state === "permission") return '<div class="permission-card"><b>允许执行本地工作流验证？</b>'
      + '<p>工具：game_graph_validate<br>范围：当前项目；不会上传资源或扣除积分。</p><div class="row wrap">'
      + button("允许本次", "allow-tool", "primary") + button("拒绝", "deny-tool", "") + '</div></div>';
    if (view.state === "clarification") return '<div class="message-card"><b>爆炸音效使用哪一种？</b>'
      + '<p class="small muted">这是资源选择，不是工具权限。选择后绑定到同一个工作流节点。</p><div class="stack gap8">'
      + button("从本机选择文件", "import-asset", "", "folder") + button("本地生成音效 · 0 云端积分", "local-sound", "soft", "sound")
      + button("先用现有音效", "use-existing", "ghost") + '</div></div>';
    if (view.state === "offline") return notice("对话连接已断开", "当前输入保留。可以继续编辑工作流，恢复连接后重新读取项目版本。", "warning", "workflow", "手动编辑");
    if (view.state === "error_timeout") return notice("执行未完成", "未完成的工作流事务没有提交，可以重试。", "error", "retry-chat", "重试");
    if (view.state === "interrupted") return notice("执行已停止", "尚未提交的节点修改已丢弃，已有项目版本保留。", "warning", "retry-chat", "重新执行");
    if (view.state === "duplicate") return notice("同一任务正在执行", "不会重复提交工作流事务。", "", "show-loading", "查看执行过程");
    return toolActivity() + (view.state === "loading" ? '' : '<div class="graph-change-summary">'
      + '<b>工作流变更</b><span>节点、连线和参数可继续手动编辑</span><div class="row wrap">'
      + button("查看节点差异", "review-changes", "soft", "nodes") + button("打开工作流", "workflow", "", "arrow") + '</div></div>');
  }

  // 输入框直接引用游戏对象和工作流；附件是上下文，不是生成一份独立代码的入口。
  function composer() {
    const busy = view.state === "loading";
    const menu = ui.menu ? '<div class="composer-menu">' + (ui.menu === "context"
      ? button("@当前关卡", "reference-level", "ghost") + button("@选中节点", "reference-node", "ghost") + button("@当前 API", "reference-api", "ghost")
      : button("/plan 规划玩法", "command-plan", "ghost") + button("/build 修改工作流", "command-build", "ghost")
        + button("/preview 预览", "preview", "ghost")) + '</div>' : '';
    return '<div class="composer-wrap agent-composer">' + menu + '<div class="context-chips"><span>'
      + icon("nodes") + (model.workflowScope === "server" ? '服务端 · ' + I18n.user(api().name) : I18n.user(level().name) + ' · 当前工作流')
      + '</span><small>r' + model.revision + ' · 最新项目</small></div><div class="composer">'
      + '<label class="sr-only" for="chat-input">描述工作流修改</label><textarea id="chat-input" rows="2"'
      + ' placeholder="描述要改的玩法，输入 @ 引用对象、/ 选择命令…">' + esc(session().draft) + '</textarea>'
      + '<div class="composer-footer"><div class="row gap8">'
      + button("", "attach-reference", "icon ghost", "plus", 'aria-label="附加参考文件"')
      + button("@", "context-menu", "ghost", "", 'aria-label="引用项目对象"')
      + button("/", "command-menu", "ghost", "", 'aria-label="选择命令"')
      + '</div>' + button(busy ? "停止" : "发送", busy ? "stop-chat" : "send-chat", "primary", busy ? "stop" : "send")
      + '</div></div><div class="agent-options"><label>模式 <select id="agent-mode"><option value="build"'
      + (ui.agent === "build" ? ' selected' : '') + '>执行 Build</option><option value="plan"' + (ui.agent === "plan" ? ' selected' : '')
      + '>规划 Plan</option></select></label>' + AssistantSetup.modelPicker()
      + '<span>仅生成工作流</span></div>' + AssistantSetup.chatBar() + '</div>';
  }

  // 桌面把会话、执行流、变更审阅并列；手机保留单列消息与可展开的审阅区。
  function workspace() {
    const current = session();
    const turns = current.turns.length ? current.turns : [{ user: current.id === 's1' ? model.lastMessage || '敌人被击中三次后爆炸，并给玩家加 ' + model.points + ' 分。' : '请规划当前项目的工作流。',
      assistant: '已读取当前工作流。接下来只调整节点、连线和参数，保留已有的手动修改。' }];
    const timeline = turns.map((turn, index) => '<div class="agent-user">' + I18n.user(turn.user) + '</div><div class="agent-answer">'
      + '<div class="ai-header"><span class="ai-mark">' + icon("sparkle") + '</span><b>GameGen</b><small>工作流助手</small></div>'
      + '<p>' + I18n.user(turn.assistant) + '</p>' + (index === turns.length - 1 ? turnStatus() : '') + '</div>').join("");
    const chat = '<section class="agent-thread"><header class="agent-thread-title"><div><h2>' + I18n.user(current.title)
      + '</h2><small>项目会话 / ' + (model.workflowScope === "server" ? 'API 工作流' : '玩法工作流') + '</small></div>'
      + button("会话", "session-menu", "ghost mobile-only", "chat") + '</header><div class="agent-timeline">'
      + timeline + '</div>' + composer() + '</section>';
    return editorToolbar("workspace", "项目内会话", button("关卡与玩法", "world", "ghost", "globe")
      + button("API", "api", "ghost", "nodes")) + '<div class="agent-layout">' + sessionsPane() + chat + reviewPanel() + '</div>';
  }

  // 变更采用节点语义差异，面板中的数据用于审阅，不允许嵌入或执行任意脚本。
  function reviewPanel() {
    const diff = ui.panel === "changes" || view.state === "review";
    const server = model.workflowScope === 'server';
    const previousPoints = model.undo.at(-1)?.points ?? model.points;
    const moduleView = !server && model.moduleEditing;
    const currentValue = moduleView ? model.moduleRecords[moduleKey()]?.value ?? 100 : model.points;
    const content = diff ? '<div class="semantic-diff"><span class="pill green">已校验 · 当前版本</span>'
      + '<h3>工作流 / ' + (model.workflowScope === "server" ? I18n.user(api().name) : moduleView ? esc(ui.module) : '敌人受击与爆炸') + '</h3>'
      + '<div class="diff-item"><span class="diff-kind">参数</span><b>' + (server ? '接口入口 · ' + I18n.user(api().name) : moduleView ? esc(ui.module) + ' · 数值参数' : 'score · 增加得分') + '</b><div class="diff-values">'
      + '<del>' + (server ? '历史版本见项目记录' : moduleView ? '历史参数见项目记录' : previousPoints + ' 分') + '</del><ins>当前：' + (server ? I18n.user(api().method + ' ' + api().path) : currentValue + (moduleView ? '' : ' 分'))
      + '</ins></div></div><div class="diff-item"><span class="diff-kind">连线</span>'
      + '<b>' + (server ? '入口 → 身份 → 校验 → 事务 → 响应' : moduleView ? '事件 → 条件 → 参数更新 → 结果' : '条件成立 → 爆炸 → 得分') + '</b><p>使用已有节点标识，不生成额外脚本文件。</p></div>'
      + button("编辑对应工作流", "workflow", "primary full", "nodes") + button("撤销最近项目修改", "undo", "ghost full", "undo") + '</div>'
      : '<div class="agent-preview">' + gameStage() + '<div class="row between"><span class="small">' + I18n.user(level().name) + '</span>'
        + button("预览", "preview", "soft", "play") + '</div><p class="small muted">' + esc(model.genres.join(" + "))
        + ' · ' + esc(model.structure) + '</p><div class="stack gap8">' + button("关卡 / RPG / SLG", "world", "full", "globe")
        + button("接口与服务端", "api", "full", "nodes") + '</div></div>';
    return '<aside class="agent-review' + (diff ? ' mobile-open' : '') + '"><div class="review-tabs">'
      + '<button data-review-panel="preview" class="' + (!diff ? 'active' : '') + '">游戏预览</button>'
      + '<button data-review-panel="changes" class="' + (diff ? 'active' : '') + '">工作流变更</button></div>' + content + '</aside>';
  }

  // 原型异步执行以任务身份防止串台；Plan不写项目，Build只提交可检查的图参数。
  function send() {
    if (model.activeTask) { view.state = "duplicate"; render(); return; }
    if (view.state === "offline") { toast("对话需要恢复连接；工作流仍可手动修改。"); return; }
    const text = document.getElementById("chat-input").value.trim();
    if (!text) { toast("请描述需要调整的工作流。"); return; }
    const graph = Workflow.current();
    // 达到文档上限时不能把无关默认图当成当前上下文提交。
    if (Workflow.ui.contextBlocked) { toast('工作流数量已达原型上限，请返回已有工作流继续。'); return; }
    const current = session();
    const planning = ui.agent === "plan";
    model.lastMessage = text;
    current.draft = "";
    current.turns.push({ user: text, assistant: planning ? '正在规划工作流结构…' : '正在读取最新项目版本并调整工作流…' });
    const task = { assistantContext: AssistantSetup.context(), kind: "graph-demo", session: current.id, baseRevision: model.revision, graphId: graph.id, componentTarget: Creation.ui.chatTarget || null };
    model.activeTask = task;
    go("workspace", "loading");
    setTimeout(() => {
      if (model.activeTask !== task) return;
      if (model.revision !== task.baseRevision) {
        current.turns.at(-1).assistant = "项目已有新的手动修改，本轮没有提交旧版本补丁。请在最新版本上重新执行。";
        model.activeTask = null; go("workspace", "review"); return;
      }
      const proposal = Creation.promptPatch(text, task.componentTarget) || Workflow.promptPatch(text, task.graphId);
      Creation.ui.chatTarget = null;
      if (!planning && proposal.patch) commit('对话修改工作流', proposal.patch);
      const context = Workflow.describeGraph(task.graphId);
      const answer = planning ? '规划完成：读取项目 → 调整节点 → 校验执行域和类型 → 提交事务。尚未修改项目。（原型演示）'
        : '我读到了当前工作流：' + context + '。' + proposal.explanation + '（原型演示，未连接模型）';
      current.turns[current.turns.length - 1].assistant = answer;
      model.messages.push(answer);
      model.activeTask = null;
      go("workspace", "success");
    }, 1200);
  }

  // 横屏只改变视图，不重建项目；浏览器原型旋转布局，正式Android由宿主控制屏幕方向。
  function orientation() {
    const wide = view.state.includes("landscape");
    if (!wide) {
      ui.wideReturn = view.state;
      const graph = document.querySelector(".graph-scroll");
      ui.graphPosition = graph ? { left: graph.scrollLeft, top: graph.scrollTop } : null;
    }
    view.state = wide ? ui.wideReturn : model.workflowScope === "server" ? "server_landscape"
      : view.state === "invalid" ? "landscape_invalid" : "landscape";
    render();
  }

  // 横屏编辑保留执行域切换和返回入口，服务器节点永远标明执行位置。
  function workflowActions() {
    return '<div class="row gap8">' + button(model.workflowScope === "server" ? "服务端" : "客户端", "toggle-scope", "ghost", "globe")
      + (view.mode === "android" ? button(view.state.includes("landscape") ? "返回竖屏" : "横屏编辑", "toggle-orientation", "soft", "phone") : '')
      + button("验证", "validate-graph", "soft", "checkCircle") + '</div>';
  }

  // API使用与玩法相同的图结构，但节点目录按server执行域隔离。
  function serverBoard() {
    const nodes = [['入口', api().method + ' ' + api().path], ['身份与权限', api().auth ? '登录用户 + 资源归属' : '公开入口 + 限流'], ['校验输入', '必填、类型、边界、幂等键'],
      ['业务规则', api().name + '的条件分支'], ['事务更新', '并发版本 + 原子更新'], ['返回结果', '200 / 错误分支']];
    return '<div class="server-board">' + nodes.map(([name, detail], i) => '<button type="button" class="server-node'
      + (ui.serverNode === i ? ' selected' : '') + '"'
      + ` data-server-node="${i}"><span>${i + 1}</span><div><b>${name}</b><small>${esc(detail)}</small></div>`
      + icon(i === 5 ? "checkCircle" : "arrow") + '</button>').join("")
      + '<p class="server-error-branch">失败分支：401 未登录 / 403 无权限 / 409 资源冲突 / 422 输入无效</p></div>';
  }

  // 服务端节点可直接编辑受约束参数，不能把任意脚本塞入节点替代可视化逻辑。
  function serverInspector() {
    const endpoint = api();
    const config = serverParameters();
    const titles = ['API 入口', '身份与权限', '输入校验', '业务规则', '数据事务', '返回响应'];
    const controls = [field('接口路径', 'node-api-path', endpoint.path),
      '<label class="check-label"><input id="node-api-auth" type="checkbox"' + (endpoint.auth ? ' checked' : '') + '>要求登录及资源归属校验</label>',
      field('请求大小上限（KB）', 'node-body-limit', config.bodyLimit, 'number'),
      field('资源消耗', 'node-resource-cost', config.resourceCost, 'number'),
      '<label class="check-label"><input id="node-idempotent" type="checkbox"' + (config.idempotent ? ' checked' : '') + '>按 requestId 防止重复结算</label>',
      field('成功响应状态码', 'node-status', config.status, 'number')];
    return '<aside class="inspector"><span class="pill orange">服务端执行</span><h3 class="server-inspector-title">'
      + titles[ui.serverNode] + '</h3>' + controls[ui.serverNode]
      + button('保存节点参数', 'save-server-node', 'primary full', 'check')
      + '<div class="inspector-section"><h4>所属接口</h4><p class="small muted">' + I18n.user(endpoint.method + ' ' + endpoint.path) + '</p>'
      + button('返回接口定义', 'api', 'soft full', 'back') + button('用对话调整', 'ask-api', 'full', 'chat') + '</div>'
      + '<div class="inspector-section"><h4>执行边界</h4><p class="small muted">数据库和密钥只存在服务端；客户端通过API调用。节点保存到同一项目事务。</p></div></aside>';
  }

  // 校验失败保留表单，成功后才产生版本，避免出现“已保存”但图参数未更新的状态。
  function saveServerNode() {
    const endpoint = api();
    const config = { ...serverParameters() };
    const pathInput = document.getElementById('node-api-path');
    if (pathInput && (!pathInput.value.startsWith('/') || model.apis.some((item) => item.id !== endpoint.id
      && item.method === endpoint.method && item.path === pathInput.value))) { toast('路径无效或与已有接口重复。'); return; }
    const numeric = [['node-body-limit', 'bodyLimit'], ['node-resource-cost', 'resourceCost'], ['node-status', 'status']];
    for (const [id, key] of numeric) {
      const input = document.getElementById(id);
      if (!input) continue;
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < (key === 'status' ? 200 : 0) || value > (key === 'status' ? 299 : 9999)) {
        toast('请输入允许范围内的整数；成功响应状态码须为200到299。'); return;
      }
      config[key] = value;
    }
    commit('修改服务端工作流节点', {});
    if (pathInput) endpoint.path = pathInput.value.trim();
    const auth = document.getElementById('node-api-auth');
    const idempotent = document.getElementById('node-idempotent');
    if (auth) endpoint.auth = auth.checked;
    if (idempotent) config.idempotent = idempotent.checked;
    endpoint.parameters = config;
    render(); toast('服务端节点参数已保存。');
  }

  // 关卡、RPG和SLG在同一世界编辑器中组合，场景转换由稳定标识关联。
  function world() {
    const tab = ['levels', 'rpg', 'slg'].includes(view.state) ? view.state : ui.worldTab;
    ui.worldTab = tab;
    const tabs = '<div class="world-tabs segmented">' + [['levels', '关卡与地图'], ['rpg', 'RPG 数据'], ['slg', 'SLG 规则']]
      .map(([id, name]) => `<button data-world-tab="${id}" class="${tab === id ? 'active' : ''}">${name}</button>`).join('') + '</div>';
    const header = heading("世界与玩法", "类型可以混合；对话与手动编辑都修改同一份工作流。",
      button("用对话调整", "ask-world", "primary", "chat"));
    if (view.state === 'empty') return header + tabs + notice('还没有关卡', '添加第一个关卡，或通过对话规划地图和连接关系。', '', 'add-level', '添加关卡');
    const modules = tab === 'rpg' ? ['角色与职业', '任务与目标', 'NPC 对话', '物品与装备', '技能与战斗', '存档变量']
      : tab === 'slg' ? ['地形与格子', '阵营与单位', '建筑与资源', '回合 / 时间', '科技与生产', '胜负条件'] : ['关卡', '入口与出生点', '关卡连接', '解锁条件', '胜利与失败', '存档检查点'];
    if (!modules.includes(ui.module)) ui.module = modules[0];
    const record = model.moduleRecords[moduleKey()];
    const list = tab === 'levels' ? model.levels.map((item, i) => `<button data-level="${item.id}" class="world-list-item ${model.activeLevel === item.id ? 'active' : ''}">`
      + `<span>0${i + 1}</span><div><b>${I18n.user(item.name)}</b><small>${item.id} · ${item.next ? '通关后前往下一关' : '当前终点'}</small></div></button>`).join('')
      + button('添加关卡', 'add-level', 'full soft', 'plus') : modules.map((name) => `<button class="world-list-item ${ui.module === name ? 'active' : ''}" data-world-module="${name}">`
        + icon(tab === 'rpg' ? 'box' : 'globe') + `<b>${name}</b></button>`).join('');
    return header + tabs + '<div class="world-layout"><aside class="panel panel-pad"><h3>' + (tab === 'levels' ? '关卡列表' : '可组合模块')
      + '</h3><div class="world-list">' + list + '</div></aside><section class="panel panel-pad world-map-panel"><div class="row between"><h2>'
      + (tab === 'levels' ? I18n.user(level().name) : tab === 'rpg' ? '月光村 · RPG' : '边境争夺 · SLG') + '</h2><span class="pill blue">'
      + (tab === 'slg' ? model.timing : '地图与事件') + '</span></div>' + tileMap(tab) + '<div class="module-chips">'
      + modules.map((name) => `<button data-world-module="${name}">${name}</button>`).join('') + '</div><p class="small muted">'
      + (tab === 'levels' ? '当前关卡 → 通关条件工作流 → 下一关；进度保存到玩家存档。'
        : tab === 'rpg' ? '对话分支 → 接受任务 → 目标进度 → 奖励；全部通过工作流连接。'
          : '地图与地形 → 单位指令 → 资源结算 → 胜负规则；回合制与即时制由项目选择。') + '</p></section>'
      + '<aside class="panel panel-pad module-inspector"><h3>' + esc(ui.module) + '</h3>'
      + field(tab === 'levels' ? '关卡名称' : '数据项名称', 'module-name', tab === 'levels' ? level().name : record?.name || ui.module)
      + field(tab === 'slg' ? '资源消耗' : '奖励数值', 'module-value', record?.value ?? 100, 'number')
      + '<p class="small muted">数值是工作流节点参数，修改后对话可读取。</p>' + button('保存参数', 'save-module', 'soft full', 'check')
      + button('编辑关联工作流', 'client-workflow', 'primary full', 'nodes')
      + button('联网 API', 'api', 'full', 'globe') + '</aside></div>';
  }

  // 地图只展示网格、阻挡和事件位置的设计语义，不冒充可运行的地图引擎。
  function tileMap(tab) {
    return '<div class="tile-map" aria-label="地图与事件编辑示意">' + Array.from({ length: 60 }, (_, i) => {
      const water = [5, 6, 15, 16, 25, 35, 45, 55].includes(i);
      const entity = ({ 12: tab === 'slg' ? '城' : '村', 28: tab === 'rpg' ? 'NPC' : '★', 43: tab === 'slg' ? '兵' : '门' })[i];
      return `<button type="button" class="tile ${water ? 'water' : i % 7 === 0 ? 'forest' : ''}" data-map-cell="${i}" aria-label="格子 ${i + 1}">`
        + (entity ? `<span>${entity}</span>` : '') + '</button>';
    }).join('') + '</div>';
  }

  // 类型模块通过同一种图表达；示例序列按上下文展示，不再跳回无关的敌人爆炸逻辑。
  function moduleBoard() {
    const flow = ui.worldTab === 'rpg' ? ['NPC交互', '读取任务状态', '判断任务目标', '更新任务进度', '发放奖励', '保存进度']
      : ui.worldTab === 'slg' ? ['收到单位指令', '检查阵营与资源', '判断行动条件', '更新行动状态', '结算资源', '检查胜负']
        : ['关卡开始', '读取关卡目标', '判断通关条件', '更新解锁状态', '发放通关奖励', '切换下一关'];
    return '<div class="server-board module-board">' + flow.map((name, i) => '<button type="button" class="server-node"'
      + ` data-module-node="${i}"><span>${i + 1}</span><div><b>${name}</b><small>`
      + (i === 4 ? '数值：' + (model.moduleRecords[moduleKey()]?.value ?? 100) : esc(ui.module))
      + '</small></div>' + icon('arrow') + '</button>').join('') + '</div>';
  }

  // 模块参数仍写入项目事务，原型展示受约束数值和子图，不提供代码输入框。
  function moduleInspector() {
    const record = model.moduleRecords[moduleKey()];
    return '<aside class="inspector"><span class="pill blue">客户端工作流</span><h3 class="server-inspector-title">'
      + esc(ui.module) + '</h3>' + field('节点数值参数', 'module-node-value', record?.value ?? 100, 'number')
      + button('保存节点参数', 'save-module-node', 'primary full', 'check')
      + '<div class="inspector-section"><h4>当前上下文</h4><p class="small muted">' + I18n.user(level().name) + ' / ' + esc(ui.module) + '</p>'
      + button('返回世界与玩法', 'world', 'soft full', 'back') + button('用对话修改', 'ask-world', 'full', 'chat') + '</div></aside>';
  }

  // API定义和处理图分离；测试返回的是本地示例，服务端部署是独立交付物。
  function apiPage() {
    const endpoint = api();
    const error = view.state === 'invalid' ? notice('接口路径无效', '路径必须以 / 开头，且同方法路径不能重复。', 'error') : '';
    const sample = ui.apiResult || { status: view.state === 'unauthenticated' ? 401 : 200,
      data: view.state === 'unauthenticated' ? { error: 'UNAUTHENTICATED' } : { id: 'demo-result-01', accepted: true }, source: '本地模拟；未请求服务器' };
    return heading('接口与服务端', '用对话或工作流定义 API；客户端安装包与服务器分开导出。', button('新建 API', 'add-api', 'primary', 'plus'))
      + '<div class="api-layout"><aside class="panel panel-pad"><h3>项目 API</h3><div class="world-list">'
      + model.apis.map((item) => `<button data-api="${item.id}" class="api-list-item ${item.id === endpoint.id ? 'active' : ''}">`
        + `<b>${I18n.user(item.name)}</b><small><strong>${item.method}</strong> ${esc(item.path)}</small></button>`).join('')
      + '</div><p class="small muted">身份、权限、业务规则和数据访问均在服务端工作流中校验。</p></aside>'
      + '<section class="panel panel-pad">' + error + '<div class="row between"><h2>' + I18n.user(endpoint.name) + '</h2>'
      + '<span class="pill orange">服务端执行</span></div><div class="api-route"><label class="field">方法<select id="api-method">'
      + ['GET', 'POST', 'PUT', 'DELETE'].map((method) => `<option${endpoint.method === method ? ' selected' : ''}>${method}</option>`).join('')
      + '</select></label>' + field('路径', 'api-path', endpoint.path) + '</div><label class="check-label"><input id="api-auth" type="checkbox"'
      + (endpoint.auth ? ' checked' : '') + '>要求登录，并校验资源所属玩家</label><div class="api-schema"><h3>输入与输出</h3>'
      + apiFields(endpoint.id).map(([name, detail]) => '<div><span>输入</span><b>' + name + '</b><small>' + detail + '</small></div>').join('')
      + '<div><span>输出</span><b>result / error</b><small>结果或明确错误</small></div>'
      + '</div><div class="row wrap">' + button('保存 API 定义', 'save-api', 'soft', 'check')
      + button('编辑服务端工作流', 'server-workflow', 'primary', 'nodes') + '</div>'
      + '<p class="summary-footer">后续节点：身份验证 → 输入校验 → 资源 / 规则判断 → 数据事务 → 响应。密钥不保存在游戏客户端。</p></section>'
      + '<aside class="panel panel-pad"><h3>接口测试</h3><p class="small muted">只测试界面和模拟结果，不访问网络。</p>'
      + button('运行模拟请求', 'test-api', 'soft full', 'play') + '<pre class="api-result">' + esc(JSON.stringify(sample, null, 2)) + '</pre>'
      + (view.state === 'unauthenticated' ? notice('401 未登录', '客户端进入登录或重试分支，业务图未执行。', 'warning') : '')
      + '<div class="server-delivery"><b>联网项目的交付</b><p>游戏客户端 + API 定义 + 服务端工作流 + 数据模型。服务器需要另行部署。</p>'
      + button('用对话修改 API', 'ask-api', 'full', 'chat') + '</div></aside></div>';
  }

  // 每个接口声明自己的参数结构，不能把SLG行军输入套到存档或关卡接口。
  function apiFields(id) {
    if (id === 'api-save') return [['slotId', '文本 · 存档槽'], ['saveVersion', '整数 · 并发版本'], ['data', '对象 · 存档内容']];
    if (id === 'api-stage') return [['stageId', '文本 · 关卡标识'], ['completionId', '文本 · 通关凭证'], ['requestId', '文本 · 幂等标识']];
    if (id === 'api-march') return [['unitId', '文本 · 单位标识'], ['targetCell', '坐标 · 目标格子'], ['requestId', '文本 · 幂等标识']];
    return [['payload', '对象 · 按业务定义'], ['requestId', '文本 · 幂等标识']];
  }

  // 输入和选择事件只处理扩展控件，其他旧页面仍使用原有事件分发。
  function change(input) {
    if (input.id === 'agent-mode') { ui.agent = input.value; return true; }
    if (input.dataset.projectOption) { model[input.dataset.projectOption] = input.value; preserveCreation(); return true; }
    return false;
  }
  function preserveCreation() {
    const name = document.getElementById('new-name')?.value;
    const prompt = document.getElementById('new-prompt')?.value;
    render();
    if (name !== undefined) document.getElementById('new-name').value = name;
    if (prompt !== undefined) document.getElementById('new-prompt').value = prompt;
  }

  // 接口定义也作为工作流事务提交；无效输入留在表单中供修正。
  function saveApi() {
    const endpoint = api();
    const route = document.getElementById('api-path').value.trim();
    const method = document.getElementById('api-method').value;
    if (!route.startsWith('/') || model.apis.some((item) => item.id !== endpoint.id && item.path === route && item.method === method)) {
      toast('路径必须以 / 开头，同方法路径不能重复。'); return;
    }
    commit('修改 API 工作流入口', {});
    Object.assign(endpoint, { path: route, method, auth: document.getElementById('api-auth').checked });
    render(); toast('API 定义已保存到当前项目。');
  }

  // 这里的动作只操作本地原型；部署、扣费与真实工具执行均不在此处分发。
  function action(name) {
    const actions = {
      'world': () => go('world'), 'api': () => go('api'), 'send-chat': send,
      'toggle-orientation': orientation,
      'validate-graph': () => { const wide = view.state.includes('landscape'); go('workflow', wide ? 'landscape' : 'selected'); toast('工作流校验通过状态示意。'); },
      'invalid-connection': () => go('workflow', view.state.includes('landscape') ? 'landscape_invalid' : 'invalid'),
      'fix-connection': () => go('workflow', view.state.includes('landscape') ? 'landscape' : 'selected'), 'toggle-scope': () => { model.workflowScope = model.workflowScope === 'server' ? 'client' : 'server'; render(); },
      'session-menu': () => go('workspace', view.state === 'sessions' ? 'normal' : 'sessions'),
      'new-session': () => { if (model.activeTask) { toast('请先停止当前任务，再新建会话。'); return; } const id = 's' + (ui.sessions.length + 1); ui.sessions.push({ id, title: '新的工作流会话', draft: '', turns: [] }); ui.session = id; go('workspace'); },
      'context-menu': () => { ui.menu = ui.menu === 'context' ? '' : 'context'; render(); },
      'command-menu': () => { ui.menu = ui.menu === 'command' ? '' : 'command'; render(); },
      'reference-level': () => reference('@关卡:' + level().id), 'reference-node': () => reference('@节点:' + model.selectedNode),
      'reference-api': () => reference('@接口:' + api().id), 'attach-reference': () => document.getElementById('file-import').click(),
      'command-plan': () => { ui.agent = 'plan'; ui.menu = ''; render(); },
      'command-build': () => { ui.agent = 'build'; ui.menu = ''; render(); },
      'review-changes': () => { ui.panel = 'changes'; go('workspace', 'review'); },
      'allow-tool': () => { go('workspace', 'success'); toast('本地验证通过状态示意；未执行真实工具。'); },
      'deny-tool': () => { model.activeTask = null; go('workspace', 'interrupted'); },
      'add-level': () => { if (model.levels.length >= 80) { toast('原型最多80个关卡。'); return; } const id = 'level-' + String(model.levels.length + 1).padStart(2, '0');
        commit('添加关卡', {}); model.levels.push({ id, name: '新关卡 ' + (model.levels.length + 1), next: '' }); model.activeLevel = id; go('world', 'levels'); },
      'ask-world': () => { reference('@关卡:' + level().id + ' 调整' + ui.module + '工作流'); go('workspace'); },
      'save-module': () => { const value = Number(document.getElementById('module-value').value);
        if (!Number.isFinite(value) || value < 0 || value > 9999) { toast('请输入0到9999之间的数值。'); return; }
        const name = document.getElementById('module-name').value.trim();
        if (!name || name.length > 80) { toast('名称需要1到80个字符。'); return; }
        // 名称、参数和绑定一次提交，撤销与保存使用同一个完整关卡标识。
        const patch = { moduleValue: value, moduleRecords: { ...model.moduleRecords, [moduleKey()]: { name, value } } };
        if (ui.worldTab === 'levels') patch.levels = model.levels.map((item) => item.id === model.activeLevel ? { ...item, name } : item);
        commit('修改' + ui.module + '节点参数', patch); render(); toast('已保存工作流参数。'); },
      'client-workflow': () => { model.workflowScope = 'client'; model.moduleEditing = true; go('workflow', 'selected'); },
      'save-module-node': () => { const value = Number(document.getElementById('module-node-value').value);
        if (!Number.isInteger(value) || value < 0 || value > 9999) { toast('请输入0到9999之间的整数。'); return; }
        commit('修改模块工作流参数', { moduleValue: value,
          moduleRecords: { ...model.moduleRecords, [moduleKey()]: { name: ui.module, value } } });
        render(); toast('模块节点参数已保存。'); },
      'server-workflow': () => { model.workflowScope = 'server'; go('workflow', 'selected'); },
      'add-api': () => { if (model.apis.length >= 80) { toast('原型最多80个接口。'); return; } const id = 'api-' + (model.apis.length + 1); commit('新建 API 工作流', {});
        model.apis.push({ id, name: '新接口', method: 'POST', path: '/v1/custom/' + id, auth: true }); model.activeApi = id; go('api'); },
      'save-api': saveApi,
      'save-server-node': saveServerNode,
      'test-api': () => { ui.apiResult = { status: view.state === 'unauthenticated' ? 401 : 200,
        data: view.state === 'unauthenticated' ? { error: 'UNAUTHENTICATED' } : { orderId: 'demo-order-01', accepted: true }, source: '本地模拟；未请求服务器' }; render(); },
      'ask-api': () => { model.workflowScope = 'server'; reference('@接口:' + api().id + ' 调整服务端工作流'); go('workspace'); },
    };
    if (!actions[name]) return false;
    actions[name](); return true;
  }

  // 引用保存在会话草稿内，切换页面或方向都不丢失已输入内容。
  function reference(text) { session().draft += (session().draft ? ' ' : '') + text; ui.menu = ''; render(); }

  // 数据属性只接受本地枚举值，防止把自由输入解释成路由或可执行逻辑。
  function click(target) {
    const data = target.dataset;
    if (data.genreGroup) { ui.group = data.genreGroup; preserveCreation(); }
    else if (data.genre) { model.genres = model.genres.includes(data.genre) ? model.genres.filter((g) => g !== data.genre) : [...model.genres, data.genre]; preserveCreation(); }
    else if (data.session) {
      if (model.activeTask) { toast('请先停止当前任务，再切换会话。'); return true; }
      ui.session = data.session; go('workspace');
    } else if (data.reviewPanel) { ui.panel = data.reviewPanel; if (view.state === 'review') view.state = 'normal'; render(); }
    else if (data.worldTab) { ui.worldTab = data.worldTab; ui.module = data.worldTab === 'levels' ? '关卡' : data.worldTab === 'rpg' ? '角色与职业' : '地形与格子'; go('world', data.worldTab); }
    else if (data.level) { model.activeLevel = data.level; render(); }
    else if (data.worldModule) { ui.module = data.worldModule; render(); }
    else if (data.mapCell) { toast('已选择地图格子 ' + (Number(data.mapCell) + 1) + '，可绑定事件工作流（示意）。'); }
    else if (data.api) { model.activeApi = data.api; ui.apiResult = null; render(); }
    else if (data.serverNode !== undefined) { ui.serverNode = Number(data.serverNode); render(); }
    else if (data.moduleNode !== undefined) { toast('已选择工作流节点；数值参数可在右侧或下方编辑。'); }
    else return data.action ? action(data.action) : false;
    return true;
  }

  // 宽屏状态显式入地址，便于单独审阅；恢复滚动只作用于同一个工作流画布。
  function beforeRender() {
    if (view.page === 'workflow' && view.state.startsWith('server')) model.workflowScope = 'server';
    if (view.page === 'workflow' && view.state.startsWith('module_')) {
      model.workflowScope = 'client'; model.moduleEditing = true; ui.worldTab = view.state.slice(7);
      ui.module = ui.worldTab === 'rpg' ? '任务与目标' : ui.worldTab === 'slg' ? '建筑与资源' : '胜利与失败';
    }
    document.body.classList.toggle('workflow-wide', view.mode === 'android' && view.page === 'workflow' && view.state.includes('landscape'));
  }
  function afterRender() {
    const graph = document.querySelector('.graph-scroll');
    if (graph && ui.graphPosition) { graph.scrollLeft = ui.graphPosition.left; graph.scrollTop = ui.graphPosition.top; }
  }

  // 草稿更新不触发重绘，保留手机输入法组合输入和当前光标。
  document.addEventListener('input', (event) => { if (event.target.id === 'chat-input') session().draft = event.target.value; });
  return { init, ui, genres, level, api, moduleKey, genrePicker, creationSettings, workspace, composer, send,
    world, apiPage, click, change, beforeRender, afterRender, workflowActions, serverBoard, serverInspector, moduleBoard, moduleInspector };
})();
