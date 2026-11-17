/* 工作流交互使用结构化图；本地调试为受限解释器，不执行任意代码或真实服务请求。 */
/* global I18n, model, view, Studio, Creation, Gameplay, Networking, esc, icon, button, field, editorToolbar, render, commit, toast, undoChange, projectSnapshot -- 复用项目事务与现有控件。 */
/* exported Workflow -- 提供双端共用的图编辑入口。 */
"use strict";
const Workflow = (() => {
  const types = {
    hit: { title: '受到伤害', group: '事件', glyph: 'bolt', out: [['next', '执行', 'flow']] },
    health: { title: '减少生命值', group: '动作', glyph: 'box', input: [['in', '执行', 'flow']], out: [['next', '完成', 'flow']], value: 1 },
    condition: { title: '生命值 ≤ 0', group: '条件', glyph: 'nodes', input: [['in', '执行', 'flow']], out: [['yes', '成立', 'flow'], ['no', '不成立', 'flow']] },
    explode: { title: '播放爆炸效果', group: '动作', glyph: 'sparkle', input: [['in', '执行', 'flow'], ['audio', '音效', 'audio']], out: [['next', '完成', 'flow']] },
    score: { title: '增加得分', group: '动作', glyph: 'plus', input: [['in', '执行', 'flow'], ['amount', '分值', 'number']], out: [['next', '完成', 'flow']], value: 10 },
    destroy: { title: '销毁敌人', group: '动作', glyph: 'box', input: [['in', '执行', 'flow']] },
    wait: { title: '等待', group: '动作', glyph: 'history', input: [['in', '执行', 'flow']], out: [['next', '完成', 'flow']], value: 0.5 },
    number: { title: '数值常量', group: '数据', glyph: 'box', out: [['value', '数值', 'number']], value: 10 },
    audio: { title: '音效资源', group: '数据', glyph: 'sound', out: [['asset', '音频', 'audio']] },
    custom: { title: '计算奖励', group: '数据', glyph: 'nodes', out: [['value', '奖励数值', 'number']], value: 5 },
    request: { title: '收到 API 请求', group: '事件', glyph: 'globe', domain: 'server', out: [['next', '执行', 'flow']] },
    auth: { title: '身份与权限', group: '动作', glyph: 'lock', domain: 'server', input: [['in', '执行', 'flow']], out: [['next', '通过', 'flow']] },
    validate: { title: '校验输入', group: '动作', glyph: 'checkCircle', domain: 'server', input: [['in', '执行', 'flow']], out: [['next', '通过', 'flow']], value: 256 },
    business: { title: '扣除资源', group: '动作', glyph: 'box', domain: 'server', input: [['in', '执行', 'flow']], out: [['next', '成功', 'flow']], value: 10 },
    transaction: { title: '幂等事务', group: '动作', glyph: 'history', domain: 'server', input: [['in', '执行', 'flow']], out: [['next', '提交', 'flow']] },
    response: { title: '返回响应', group: '动作', glyph: 'send', domain: 'server', input: [['in', '执行', 'flow']], value: 200 },
    moduleCondition: { title: '模块条件', group: '条件', glyph: 'nodes', input: [['in', '执行', 'flow']], out: [['yes', '成立', 'flow'], ['no', '不成立', 'flow']] },
    finish: { title: '完成模块', group: '动作', glyph: 'checkCircle', input: [['in', '执行', 'flow']] },
    moduleEvent: { title: '模块事件', group: '事件', glyph: 'bolt', out: [['next', '执行', 'flow']] },
    moduleAction: { title: '修改模块数据', group: '动作', glyph: 'box', input: [['in', '执行', 'flow']], out: [['next', '完成', 'flow']], value: 100 },
  };
  const ui = { context: '', document: '', palette: false, group: '全部', search: '', pending: null,
    edge: '', zoom: 0.85, cameras: {}, error: '', results: null, debug: null, inspector: false,
    scenario: '', help: false, newDialog: false, connectDialog: false, insert: '', drag: null, suppress: false, storage: '', focus: '' };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // 每个编辑入口对应稳定的工作流文档；服务端和各玩法模块互不覆盖。
  function contextKey() {
    if (model.workflowScope === 'server') return 'server:' + Studio.api().id;
    if (model.moduleEditing) return 'module:' + Studio.moduleKey();
    return 'client:enemy';
  }

  // 默认示例提供完整执行链；额外的数据节点用于练习类型化连线。
  function seed(key) {
    const server = key.startsWith('server:');
    const moduleGraph = key.startsWith('module:');
    const labels = moduleGraph ? (Studio.ui.worldTab === 'rpg'
      ? ['接取任务', '设置目标数量', '目标是否完成', '发放任务奖励', '保存任务进度', '完成任务']
      : Studio.ui.worldTab === 'slg' ? ['开始建造', '扣除建造资源', '资源是否足够', '建造计时', '增加建筑等级', '保存领地']
        : ['进入关卡', '设置通关目标', '目标是否完成', '发放关卡奖励', '保存关卡进度', '进入下一关']) : [];
    const list = server ? ['request', 'auth', 'validate', 'business', 'transaction', 'response']
      : moduleGraph ? ['moduleEvent', 'moduleAction', 'moduleCondition', 'moduleAction', 'moduleAction', 'finish']
        : ['hit', 'health', 'condition', 'explode', 'score', 'destroy'];
    const ids = server ? ['request', 'auth', 'validate', 'business', 'transaction', 'response']
      : moduleGraph ? ['start', 'rule', 'condition', 'reward', 'save', 'finish'] : list;
    const coords = [[32, 28], [310, 28], [588, 28], [588, 256], [310, 256], [32, 256]];
    const nodes = list.map((type, i) => ({ id: ids[i], type, x: coords[i][0], y: coords[i][1],
      params: { value: types[type].value ?? 0, label: labels[i] || types[type].title,
        audio: '爆炸 · 轻量', enabled: true } }));
    if (!server && !moduleGraph) nodes.find((n) => n.id === 'score').params.value = model.points;
    const edges = nodes.slice(1).map((node, i) => ({ id: 'edge-' + i, from: nodes[i].id,
      output: ['condition', 'moduleCondition'].includes(nodes[i].type) ? 'yes' : 'next', to: node.id, input: 'in' }));
    if (!server && !moduleGraph) nodes.push({ id: 'custom', type: 'custom', x: 310, y: 482,
      params: { value: 5, label: '计算奖励' } });
    return { id: key, context: key, apiId: server ? Studio.api().id : '',
      moduleBinding: moduleGraph ? Studio.moduleKey() : '', domain: server ? 'server' : 'client', name: server ? Studio.api().name
      : moduleGraph ? Studio.ui.module : '敌人 · 受击与爆炸', owner: 'enemy', nodes, edges };
  }

  // 缓存只恢复本原型的有界图数据；损坏数据不会进入解释器。
  function validSaved(data) {
    if (data?.systems && !Creation.valid(data.systems)) return false;
    if (data?.gameplay && !Gameplay.valid(data.gameplay)) return false;
    if (data?.networking && !Networking.valid(data.networking)) return false;
    if (data?.schema !== 1 || !data.graphs || typeof data.graphs !== 'object' || Array.isArray(data.graphs)) return false;
    if (data.levels !== undefined && (!Array.isArray(data.levels) || !data.levels.length || data.levels.length > 80
      || !data.levels.every((item) => item && typeof item.id === 'string' && /^[a-zA-Z0-9-]+$/.test(item.id)
        && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 80)
      || new Set(data.levels.map((item) => item.id)).size !== data.levels.length)) return false;
    const graphs = Object.entries(data.graphs);
    return Boolean(data.graphs['client:enemy']) && graphs.length > 0 && graphs.length <= 80 && graphs.every(([key, graph]) => {
      if (!graph || graph.id !== key || typeof graph.context !== 'string' || graph.context.length > 350
        || !['client', 'server'].includes(graph.domain) || typeof graph.name !== 'string' || graph.name.length > 80
        || !Array.isArray(graph.nodes) || graph.nodes.length > 80 || !Array.isArray(graph.edges) || graph.edges.length > 160) return false;
      const validNodes = graph.nodes.every((node) => node && types[node.type] && typeof node.id === 'string'
        && /^[a-zA-Z0-9-]+$/.test(node.id) && Number.isFinite(node.x) && Number.isFinite(node.y)
        && node.x >= 0 && node.y >= 0 && node.x <= 2400 && node.y <= 2400 && node.params
        && typeof node.params.label === 'string' && node.params.label.length <= 80
        && (node.params.value === undefined || (Number.isFinite(node.params.value) && node.params.value >= 0 && node.params.value <= 9999)));
      if (!validNodes || new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length
        || new Set(graph.edges.map((edge) => edge?.id)).size !== graph.edges.length) return false;
      return graph.edges.every((edge) => edge && typeof edge.id === 'string' && typeof edge.from === 'string'
        && typeof edge.to === 'string' && typeof edge.output === 'string' && typeof edge.input === 'string'
        && !connectionProblem({ ...graph, edges: graph.edges.filter((item) => item && item.id !== edge.id) }, edge.from, edge.output, edge.to, edge.input));
    });
  }

  // 截图测试使用独立夹具，避免覆盖用户正在编辑的本地草稿。
  function init(reset = false) {
    Object.assign(ui, { context: '', document: '', palette: false, pending: null, edge: '', results: null,
      debug: null, error: '', inspector: false, help: false, newDialog: false, connectDialog: false, insert: '', drag: null, cameras: {} });
    model.graphs = { 'client:enemy': seed('client:enemy') };
    model.redo = [];
    ui.zoom = view.mode === 'android' ? 1 : 0.85;
    if (new URLSearchParams(location.search).has('fixture')) return;
    ui.blockPersist = false;
    try {
      if (reset) localStorage.removeItem('gamegen-workflow-v3.3');
      const saved = JSON.parse(localStorage.getItem('gamegen-workflow-v3.3') || 'null');
      if (validSaved(saved)) {
        model.graphs = saved.graphs;
        if (saved.systems) model.systems = saved.systems;
        if (saved.gameplay && Gameplay.valid(saved.gameplay)) model.gameplay = saved.gameplay;
        if (saved.networking && Networking.valid(saved.networking)) model.networking = saved.networking;
        Gameplay.init(); Networking.init();
        if (Array.isArray(saved.levels)) model.levels = saved.levels;
        if (model.levels.some((item) => item.id === saved.activeLevel)) model.activeLevel = saved.activeLevel;
        if (Array.isArray(saved.apis) && saved.apis.length && saved.apis.length <= 80
          && saved.apis.every((item) => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.path === 'string')) model.apis = saved.apis;
        if (model.apis.some((item) => item.id === saved.activeApi)) model.activeApi = saved.activeApi;
        if (saved.moduleRecords && typeof saved.moduleRecords === 'object' && !Array.isArray(saved.moduleRecords)) model.moduleRecords = saved.moduleRecords;
        if (Number.isFinite(saved.moduleValue)) model.moduleValue = saved.moduleValue;
        const score = model.graphs['client:enemy']?.nodes.find((node) => node.type === 'score');
        if (Number.isFinite(score?.params.value)) model.points = score.params.value;
        if (Number.isInteger(saved.revision)) model.revision = saved.revision;
        ui.storage = '本机草稿已恢复';
      } else { ui.storage = saved ? '草稿无法读取，原始内容保留；本次不覆盖' : '本机草稿'; ui.blockPersist = Boolean(saved); }
    } catch (error) {
      ui.blockPersist = true;
      ui.storage = error instanceof SyntaxError ? '草稿无法解析，原始内容保留；本次不覆盖' : '当前浏览器不允许本地保存';
    }
  }

  // 用户文件与截图夹具分开存储；仅持久化图，不保存账户或模型凭据。
  function persist() {
    if (new URLSearchParams(location.search).has('fixture') || ui.blockPersist) return;
    try {
      synchronizeBindings();
      localStorage.setItem('gamegen-workflow-v3.3', JSON.stringify({ schema: 1, graphs: model.graphs, levels: model.levels, activeLevel: model.activeLevel, activeApi: model.activeApi, apis: model.apis, moduleRecords: model.moduleRecords, moduleValue: model.moduleValue, systems: model.systems, gameplay: model.gameplay, networking: model.networking, revision: model.revision }));
      ui.storage = '已保存到本机';
    } catch { ui.storage = '保存失败，当前修改仍在本次会话'; }
  }

  // 兼容原有得分演示字段，事务同时更新结构化节点，避免对话与图产生两份规则。
  function preparePatch(patch) {
    // 兼容旧关卡入口的显示字段，地图名称仍只由同一事务修改。
    if (patch.gameplay) {
      patch = { ...patch, levels: (patch.levels || model.levels).map(level => {
        const map = patch.gameplay.maps.find(item => item.id === level.id);
        return map ? { ...level, name: map.name } : level;
      }) };
    } else if (patch.levels && model.gameplay) {
      const gameplay = clone(model.gameplay);
      gameplay.maps.forEach(map => { const level = patch.levels.find(item => item.id === map.id); if (level) map.name = level.name; });
      patch = { ...patch, gameplay };
    }
    if (Object.hasOwn(patch, 'points')) {
      const graphs = clone(patch.graphs || model.graphs);
      const node = graphs['client:enemy']?.nodes.find((item) => item.type === 'score');
      if (node) node.params.value = patch.points;
      return { ...patch, graphs };
    }
    return patch;
  }

  // 切换关卡、接口或模块时清空临时连线，保留各文档的节点和镜头位置。
  function current() {
    const key = contextKey();
    if (ui.context !== key) {
      ui.context = key; ui.document = key; ui.pending = null; ui.edge = ''; ui.results = null; ui.debug = null;
    }
    ui.contextBlocked = false;
    if (!model.graphs[key] && Object.keys(model.graphs).length >= 80) {
      ui.contextBlocked = true; ui.document = 'client:enemy';
      return model.graphs['client:enemy'];
    }
    if (!model.graphs[key]) model.graphs[key] = seed(key);
    const graph = model.graphs[ui.document] || model.graphs[key];
    ui.document = graph.id;
    if (!graph.nodes.some((node) => node.id === model.selectedNode)) model.selectedNode = graph.nodes[0]?.id || '';
    return graph;
  }

  // 节点参数由图持有；接口基础参数在API页与节点属性之间共享。
  function valueOf(node, graph = current()) {
    if (graph.domain === 'server' && graph.id === graph.context && node.id === node.type) {
      const endpoint = model.apis.find((item) => item.id === (graph.apiId || graph.context.slice(7)));
      const config = endpoint?.parameters || { bodyLimit: 256, resourceCost: 10, status: 200 };
      if (node.type === 'validate') return config.bodyLimit;
      if (node.type === 'business') return config.resourceCost;
      if (node.type === 'response') return config.status;
    }
    if (node.type === 'moduleAction' && node.id === 'rule' && graph.id === graph.context) {
      return model.moduleRecords[graph.moduleBinding || graph.context.slice(7)]?.value ?? node.params.value ?? 100;
    }
    return node.params.value;
  }

  // 默认节点显式引用API和模块配置，副本保持独立参数；序列化前更新镜像便于审阅。
  function synchronizeBindings() {
    for (const graph of Object.values(model.graphs)) {
      for (const node of graph.nodes) {
        if (types[node.type]?.value !== undefined) node.params.value = valueOf(node, graph);
      }
    }
  }

  // 所有图修改先复制再提交，撤销快照不会被后续原地修改污染。
  function edit(title, change, extra = {}) {
    const graph = current();
    const graphs = clone(model.graphs);
    change(graphs[graph.id]);
    commit(title, { graphs, ...extra });
    ui.results = null; ui.debug = null; ui.error = '';
    render();
  }

  // 端口类型使用固定枚举；执行流与资源、数值不会隐式转换。
  function port(node, direction, id) {
    return (types[node?.type]?.[direction === 'out' ? 'out' : 'input'] || []).find((item) => item[0] === id);
  }

  // 所有连接构成有向无环图；循环行为需未来使用有界循环节点，不能直接回连。
  function createsCycle(graph, from, to) {
    const seen = new Set();
    const pending = [to];
    while (pending.length) {
      const id = pending.pop();
      if (id === from) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to));
    }
    return false;
  }

  // 同一个输入和执行输出只允许一条连接，避免多次触发或悄悄覆盖原规则。
  function connectionProblem(graph, from, output, to, input) {
    const source = graph.nodes.find((node) => node.id === from);
    const target = graph.nodes.find((node) => node.id === to);
    const a = port(source, 'out', output); const b = port(target, 'in', input);
    if (!a || !b) return '端口不存在，请重新选择。';
    if (from === to) return '不能把节点连接到自身。';
    if (a[2] !== b[2]) return '类型不兼容：' + a[1] + '是' + typeLabel(a[2]) + '，' + b[1] + '需要' + typeLabel(b[2]) + '。';
    if (graph.edges.some((edge) => edge.from === from && edge.output === output && edge.to === to && edge.input === input)) return '这条连接已经存在。';
    if (graph.edges.some((edge) => edge.to === to && edge.input === input)) return '这个输入已有连线。请先选中原连线删除，或在线间插入节点。';
    if (a[2] === 'flow' && graph.edges.some((edge) => edge.from === from && edge.output === output)) return '这个执行输出已有连线，请先删除原连线。';
    if (createsCycle(graph, from, to)) return '这次连接会形成循环。请使用可限定次数的循环节点。';
    return '';
  }

  // 连线失败只改变反馈，不改动工程版本或已建立的连接。
  function connect(nodeId, direction, pin) {
    const graph = current();
    if (direction === 'out') {
      ui.pending = { node: nodeId, port: pin }; ui.edge = ''; ui.error = '';
      const sourceType = port(graph.nodes.find((node) => node.id === nodeId), 'out', pin)?.[2];
      const next = graph.nodes.flatMap((node) => (types[node.type].input || []).map((entry) => ({ node, entry })))
        .find((item) => item.node.id !== nodeId && item.entry[2] === sourceType && !graph.edges.some((edge) => edge.to === item.node.id && edge.input === item.entry[0]));
      if (next) ui.nextFocus = '[data-wf-node="' + next.node.id + '"][data-wf-direction=in][data-wf-port="' + next.entry[0] + '"]';
      render(); return;
    }
    if (!ui.pending) { ui.error = '先点一个输出端口，再点这里的输入端口。'; render(); return; }
    const source = ui.pending;
    const problem = connectionProblem(graph, source.node, source.port, nodeId, pin);
    if (problem) { ui.error = problem; render(); return; }
    edit('连接工作流节点', (draft) => draft.edges.push({ id: nextId('edge'), from: source.node,
      output: source.port, to: nodeId, input: pin }));
    ui.pending = null; render(); toast('连接已建立，可撤销。');
  }

  // 序号按当前工程全部标识查重，撤销或恢复后也不会复用现存ID。
  function nextId(prefix) {
    const ids = Object.values(model.graphs).flatMap((graph) => [...graph.nodes, ...graph.edges].map((item) => item.id));
    let index = 1;
    while (ids.includes(prefix + '-' + index)) index += 1;
    return prefix + '-' + index;
  }

  // 标签区分类型，辅助颜色以便色觉差异用户也能识别端口。
  function typeLabel(type) { return ({ flow: '执行流', number: '数值', audio: '音频资源' })[type] || type; }

  // 校验报告基于实际图，错误项带稳定节点ID供定位。
  function validate(graph = current()) {
    const issues = [];
    const entries = graph.nodes.filter((node) => types[node.type].group === '事件');
    if (entries.length > 1) issues.push({ node: entries[1].id, text: '当前原型每张图只支持一个事件入口。请拆成独立工作流。', error: true });
    if (!entries.length) issues.push({ node: '', text: '缺少事件入口：请添加“受到伤害”或当前执行域的事件节点。', error: true });
    for (const node of graph.nodes) {
      const def = types[node.type];
      if ((graph.domain === 'server' && !def.domain && !['number', 'custom'].includes(node.type))
        || (graph.domain === 'client' && def.domain === 'server')) issues.push({ node: node.id, text: node.params.label + '不属于当前执行域。', error: true });
      if (def.value !== undefined && (!Number.isFinite(valueOf(node, graph)) || valueOf(node, graph) < 0 || valueOf(node, graph) > 9999)) {
        issues.push({ node: node.id, text: node.params.label + '的数值需要在0到9999之间。', error: true });
      }
      if ((def.input || []).some((pin) => pin[2] === 'flow') && !graph.edges.some((edge) => edge.to === node.id && edge.input === 'in')) {
        issues.push({ node: node.id, text: node.params.label + '没有执行来源。', error: true });
      }
    }
    const reached = new Set(); const queue = entries.map((node) => node.id);
    while (queue.length) {
      const id = queue.pop(); if (reached.has(id)) continue; reached.add(id);
      queue.push(...graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to));
    }
    for (const node of graph.nodes) if (!reached.has(node.id) && types[node.type].group !== '数据') {
      issues.push({ node: node.id, text: node.params.label + '无法从事件入口到达。', error: true });
    }
    if (graph.domain === 'server') {
      for (const node of graph.nodes.filter((item) => reached.has(item.id) && types[item.type].group !== '数据')) {
        if (node.type !== 'response' && !graph.edges.some((edge) => edge.from === node.id && port(node, 'out', edge.output)?.[2] === 'flow')) {
          issues.push({ node: node.id, text: node.params.label + '后没有返回响应的路径。', error: true });
        }
      }
    }
    for (const edge of graph.edges) {
      const reduced = { ...graph, edges: graph.edges.filter((item) => item.id !== edge.id) };
      const problem = connectionProblem(reduced, edge.from, edge.output, edge.to, edge.input);
      if (problem) issues.push({ node: edge.to, text: problem, error: true });
    }
    return issues;
  }

  // 添加节点会创建工程事务；插入动作时原连线被原子替换为两条新连线。
  function add(type) {
    const graph = current(); const def = types[type];
    if (!def || !available(type, graph)) return;
    if (types[type].group === '事件' && graph.nodes.some((node) => types[node.type].group === '事件')) { ui.palette = false; ui.error = '当前原型一张工作流使用一个事件入口，请新建工作流添加其他事件。'; render(); return; }
    if (graph.nodes.length >= 80) { ui.error = '原型单图最多80个节点，请拆分工作流。'; ui.palette = false; render(); return; }
    const id = nextId(type); const selectedEdge = graph.edges.find((edge) => edge.id === ui.insert);
    const anchor = graph.nodes.find((node) => node.id === model.selectedNode);
    const position = { x: Math.min(1900, (anchor?.x || 32) + 40), y: Math.min(2100, (anchor?.y || 28) + 226) };
    let attempts = 0;
    while (graph.nodes.some((node) => Math.abs(node.x - position.x) < 225 && Math.abs(node.y - position.y) < 190) && attempts < 20) {
      position.x += 240;
      if (position.x > 1900) { position.x = 32; position.y += 220; }
      attempts += 1;
    }
    // 密集图允许有界重叠，正常添加生成的坐标必须能被草稿恢复校验接受。
    position.x = Math.max(0, Math.min(2200, position.x)); position.y = Math.max(0, Math.min(2200, position.y));
    ui.palette = false; ui.pending = null; ui.insert = '';
    edit('添加' + def.title, (draft) => {
      draft.nodes.push({ id, type, ...position, params: { value: def.value ?? 0, label: def.title, audio: '爆炸 · 轻量', enabled: true } });
      if (selectedEdge) {
        draft.edges = draft.edges.filter((edge) => edge.id !== selectedEdge.id);
        draft.edges.push({ ...selectedEdge, id: selectedEdge.id + '-a', to: id, input: 'in' },
          { ...selectedEdge, id: selectedEdge.id + '-b', from: id, output: 'next' });
      }
    });
    model.selectedNode = id; render(); focusNode(id); toast(selectedEdge ? '已插入节点并接好两端连线。' : '节点已添加，点击端口连接执行顺序。');
  }

  // 节点库按执行域过滤，插入模式只允许具有前后执行端口的节点。
  function available(type, graph = current()) {
    const def = types[type];
    const domain = graph.domain === 'server' ? def.domain === 'server' || ['number', 'custom'].includes(type) : def.domain !== 'server';
    return domain && (!ui.insert || ((def.input || []).some((pin) => pin[0] === 'in') && (def.out || []).some((pin) => pin[0] === 'next')));
  }

  // SVG线与端口坐标来自同一模型，节点移动后不会留下固定装饰线。
  function point(node, direction, pin) {
    const pins = types[node.type][direction === 'out' ? 'out' : 'input'] || [];
    return { x: node.x + (direction === 'out' ? 220 : 0), y: node.y + 101 + Math.max(0, pins.findIndex((item) => item[0] === pin)) * 44 };
  }

  // 每条线都提供宽点击区域，手机点按与键盘连接列表共享选择状态。
  function lineMarkup(graph) {
    return graph.edges.map((edge) => {
      const from = graph.nodes.find((node) => node.id === edge.from); const to = graph.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return '';
      const a = point(from, 'out', edge.output); const b = point(to, 'in', edge.input);
      const bend = Math.max(70, Math.abs(b.x - a.x) * 0.45);
      const dataType = port(from, 'out', edge.output)?.[2] || 'flow';
      const route = 'M' + a.x + ' ' + a.y + ' C' + (a.x + bend) + ' ' + a.y + ',' + (b.x - bend) + ' ' + b.y + ',' + b.x + ' ' + b.y;
      return '<g class="wf-line ' + dataType + (ui.edge === edge.id ? ' selected' : '') + '"><path d="' + route + '"/>'
        + '<path class="wf-line-hit" data-wf-edge="' + esc(edge.id) + '" d="' + route + '"/></g>';
    }).join('');
  }

  // 端口按钮包含方向、名称和类型，连接不依赖拖拽精度。
  function portMarkup(node, direction) {
    const pins = types[node.type][direction === 'out' ? 'out' : 'input'] || [];
    const source = ui.pending ? current().nodes.find((item) => item.id === ui.pending.node) : null;
    const pendingType = source ? port(source, 'out', ui.pending.port)?.[2] : '';
    return '<div class="wf-ports ' + direction + '">' + pins.map(([id, label, type]) => {
      const pending = direction === 'out' && ui.pending?.node === node.id && ui.pending?.port === id;
      const compatible = direction === 'in' && pendingType === type;
      return '<button type="button" class="wf-port ' + type + (pending ? ' pending' : '') + (compatible ? ' compatible' : '')
        + '" data-wf-port="' + esc(id) + '" data-wf-direction="' + direction + '" data-wf-node="' + esc(node.id)
        + '"' + (node.params.customLabel ? I18n.terms(node.params.label) : '') + ' aria-label="' + esc(node.params.label + ' · ' + (direction === 'out' ? '输出' : '输入') + label + ' · ' + typeLabel(type))
        + '"><i aria-hidden="true"></i><span>' + esc(label) + '</span></button>';
    }).join('') + '</div>';
  }

  // 节点标题是拖动把手，端口和参数按钮独立，避免点按连接被误判为拖动。
  function nodeMarkup(node, graph) {
    const def = types[node.type]; const active = model.selectedNode === node.id && !ui.edge;
    const running = ui.debug?.trace[ui.debug.step]?.id === node.id;
    const detail = node.type === 'score' ? '增加 ' + valueOf(node, graph) + ' 分' : def.value !== undefined ? '参数 ' + valueOf(node, graph)
      : node.type === 'audio' ? node.params.audio : graph.domain === 'server' ? '服务端执行' : '客户端执行';
    return '<article class="wf-node ' + (def.group === '事件' ? 'event' : def.group === '条件' ? 'condition' : 'action')
      + (active ? ' selected' : '') + (running ? ' running' : '') + '" data-wf-card="' + esc(node.id) + '" style="left:' + node.x + 'px;top:' + node.y + 'px">'
      + '<button type="button" class="wf-node-title" data-wf-select="' + esc(node.id) + '" aria-pressed="' + active + '">'
      + icon(def.glyph) + '<span>' + (node.params.customLabel ? I18n.user(node.params.label) : esc(node.params.label)) + '</span><small>⋮⋮</small></button>'
      + '<div class="wf-node-detail">' + esc(detail) + '</div><div class="wf-port-columns">' + portMarkup(node, 'in') + portMarkup(node, 'out')
      + '</div><span class="wf-node-id">' + esc(node.id) + '</span></article>';
  }

  // 画布只缩放内部内容，工具栏、属性与触控目标保持可操作尺寸。
  function boardMarkup(graph) {
    const width = Math.max(850, ...graph.nodes.map((node) => node.x + 265));
    const height = Math.max(620, ...graph.nodes.map((node) => node.y + 230));
    return '<div class="graph-scroll wf-scroll"><div class="wf-world" style="width:' + width * ui.zoom + 'px;height:' + height * ui.zoom + 'px">'
      + '<div class="wf-board" style="width:' + width + 'px;height:' + height + 'px;transform:scale(' + ui.zoom + ')">'
      + '<svg class="wf-lines" width="' + width + '" height="' + height + '" aria-label="工作流连接">' + lineMarkup(graph) + '</svg>'
      + graph.nodes.map((node) => nodeMarkup(node, graph)).join('') + '</div></div>'
      + (!graph.nodes.length ? '<div class="wf-empty"><b>从一个事件开始</b><p>添加“受到伤害”，再连接条件和动作。</p>'
        + button('添加第一个节点', 'wf-palette', 'primary', 'plus') + '</div>' : '') + '</div>';
  }

  // 节点目录同时服务桌面侧栏和手机弹窗；搜索在当前目录内过滤，不重建输入焦点。
  function libraryMarkup(modal = false) {
    const graph = current();
    const items = Object.entries(types).filter(([type, def]) => available(type, graph) && (ui.group === '全部' || def.group === ui.group));
    const groups = ['全部', '事件', '条件', '动作', '数据'];
    return '<div class="wf-library-content"><label class="search">' + icon('search')
      + '<input id="' + (modal ? 'wf-modal-search' : 'wf-search') + '" data-wf-search placeholder="搜索节点名称" aria-label="搜索节点名称" value="' + esc(ui.search) + '"></label>'
      + '<div class="wf-categories">' + groups.map((group) => '<button type="button" data-wf-group="' + group + '" class="'
        + (ui.group === group ? 'active' : '') + '">' + group + '</button>').join('') + '</div>'
      + '<div class="wf-library-list">' + items.map(([type, def]) => '<button type="button" class="wf-library-item" data-wf-add="' + type
        + '" data-wf-search-text="' + esc(def.title) + '">' + icon(def.glyph) + '<span><b>' + def.title + '</b><small>'
        + def.group + ' · ' + (def.domain === 'server' ? '服务端' : ['number', 'custom'].includes(type) ? '数值输出' : '客户端')
        + '</small></span><span aria-hidden="true">＋</span></button>').join('') + '</div>'
      + '<p class="wf-search-empty" hidden>没有匹配节点，换个关键词试试。</p><p class="wf-library-note">'
      + (ui.insert ? '选择动作后，自动连接原来的前后节点。' : '点击添加，再点输出端口 → 输入端口。') + '</p></div>';
  }

  // 参数编辑采用明确提交，非法值与未保存输入不会覆盖现有图。
  function parameterMarkup(node) {
    const def = types[node.type];
    const label = node.type === 'score' ? '增加分值' : node.type === 'wait' ? '等待时间（秒）'
      : node.type === 'health' ? '伤害扣减值' : node.type === 'business' ? '资源消耗' : node.type === 'response' ? '响应状态码'
        : node.type === 'validate' ? '请求大小上限（KB）' : '数值参数';
    const inputId = node.id === 'score' ? 'score-value' : 'wf-value';
    return field('节点名称', 'wf-label', node.params.label, 'text')
      + (def.value !== undefined ? field(label, inputId, valueOf(node), 'number') : '')
      + (node.type === 'audio' || node.type === 'explode' ? '<label class="field">音效资源<select id="wf-audio"><option>爆炸 · 轻量</option>'
        + '<option' + (node.params.audio === '能量爆破' ? ' selected' : '') + '>能量爆破</option><option'
        + (node.params.audio === '静音' ? ' selected' : '') + '>静音</option></select></label>' : '')
      + (node.type === 'auth' ? '<label class="check-label"><input id="wf-auth" type="checkbox"' + ((node.id === 'auth' ? Studio.api().auth : node.params.enabled) ? ' checked' : '')
        + '>要求登录和资源归属校验</label>' : '')
      + (node.type === 'transaction' ? '<label class="check-label"><input id="wf-idempotent" type="checkbox"'
        + ((node.id === 'transaction' ? Studio.api().parameters?.idempotent !== false : node.params.enabled) ? ' checked' : '') + '>按 requestId 防止重复结算</label>' : '')
      + button('保存参数', 'wf-save', 'primary full', 'check');
  }

  // 连接列表提供无需精准点击曲线的可访问入口，删除前可核对上下游。
  function connectionsMarkup(node, graph) {
    const edges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    return '<div class="wf-section"><h4>与它相连 · ' + edges.length + '</h4>' + edges.map((edge) => {
      const other = graph.nodes.find((item) => item.id === (edge.from === node.id ? edge.to : edge.from));
      return '<button type="button" class="wf-connection" data-wf-edge-button="' + esc(edge.id) + '">'
        + (edge.from === node.id ? '→ ' : '← ') + (other ? labelMarkup(other) : '未知节点') + '</button>';
    }).join('') + (!edges.length ? '<p class="small muted">尚未连接。先点输出，再点输入。</p>' : '') + '</div>';
  }

  // 选中连线与节点使用不同属性，避免删除目标不明确。
  // 默认节点标题随界面语言变化，用户改名在所有引用视图中保持原文。
  function labelMarkup(node) {
    if (!node) return '';
    return node.params.customLabel ? I18n.user(node.params.label) : esc(node.params.label);
  }
  function labelTerms(node) { return node?.params.customLabel ? I18n.terms(node.params.label) : ''; }
  function inspectorMarkup(graph) {
    const edge = graph.edges.find((item) => item.id === ui.edge);
    const node = graph.nodes.find((item) => item.id === model.selectedNode);
    const heading = '<div class="row between wf-inspector-title"><span class="eyebrow">' + (edge ? 'CONNECTION' : 'NODE PROPERTIES')
      + '</span>' + button('收起', 'wf-inspector-close', 'ghost wf-mobile-only') + '</div>';
    if (edge) {
      const from = graph.nodes.find((item) => item.id === edge.from); const to = graph.nodes.find((item) => item.id === edge.to);
      return heading + '<h3>连接属性</h3><p class="wf-edge-description">' + labelMarkup(from) + ' → ' + labelMarkup(to) + '</p>'
        + '<p class="small muted">' + esc(typeLabel(port(from, 'out', edge.output)?.[2])) + ' · 点击删除会断开这条连接。</p>'
        + button('在线间插入节点', 'wf-insert', 'primary full', 'plus', port(from, 'out', edge.output)?.[2] !== 'flow' ? 'disabled' : '')
        + button('删除连线', 'wf-delete-edge', 'danger full', 'close');
    }
    if (!node) return heading + '<h3>选择一个节点</h3><p class="small muted">点击节点标题查看参数，点击端口建立连接。</p>';
    return heading + '<div class="wf-form-error" role="alert" hidden></div><h3>' + (node.params.customLabel ? I18n.user(node.params.label) : esc(node.params.label)) + '</h3><p class="wf-stable-id">' + esc(node.id) + ' · '
      + (graph.domain === 'server' ? '服务端' : '客户端') + '</p>' + parameterMarkup(node)
      + '<div class="wf-node-actions">' + button('复制', 'wf-duplicate', 'soft', 'layers') + button('删除', 'wf-delete', 'danger', 'close') + '</div>'
      + '<div class="wf-section"><h4>移动节点</h4><div class="wf-nudge">' + [['←', '-40,0'], ['↑', '0,-40'], ['↓', '0,40'], ['→', '40,0']]
        .map(([text, delta]) => '<button type="button" data-wf-nudge="' + delta + '" aria-label="向' + text + '移动节点">' + text + '</button>').join('')
      + '</div><p class="small muted">也可拖动节点顶部的把手。</p></div>'
      + button('连接到…', 'wf-connect-dialog', 'soft full', 'nodes', !(types[node.type].out || []).length ? 'disabled' : '') + connectionsMarkup(node, graph)
      + '<div class="wf-section">' + button('回到对话继续改', 'continue-chat', 'soft full', 'chat') + '</div>';
  }

  // 调试器只解释本原型列出的有限节点；每一步展示输入、分支与结果。
  function traceGraph(graph, hp, damage, modulePass = true) {
    const trace = []; const entry = graph.nodes.find((node) => types[node.type].group === '事件');
    let node = entry; let health = hp; let points = 0; let count = 0;
    while (node && count < 80) {
      count += 1; let output = 'next'; let message = '完成';
      if (node.type === 'health') { health -= damage * valueOf(node, graph); message = '生命值 ' + health; }
      else if (node.type === 'condition') { output = health <= 0 ? 'yes' : 'no'; message = '生命值 ' + health + ' → ' + (output === 'yes' ? '成立' : '不成立'); }
      else if (node.type === 'moduleCondition') { output = modulePass ? 'yes' : 'no'; message = '模块条件 → ' + (modulePass ? '成立' : '不成立') + '（模拟输入）'; }
      else if (node.type === 'score') {
        const dataEdge = graph.edges.find((edge) => edge.to === node.id && edge.input === 'amount');
        const dataNode = dataEdge && graph.nodes.find((item) => item.id === dataEdge.from);
        const amount = dataNode ? valueOf(dataNode, graph) : valueOf(node, graph); points += amount; message = '增加 ' + amount + ' 分';
      } else if (node.type === 'explode') {
        const audioEdge = graph.edges.find((edge) => edge.to === node.id && edge.input === 'audio');
        const source = audioEdge && graph.nodes.find((item) => item.id === audioEdge.from);
        message = '播放 ' + (source?.params.audio || node.params.audio) + '（模拟）';
      }
      else if (node.type === 'wait') message = '等待 ' + valueOf(node, graph) + ' 秒（模拟）';
      else if (node.type === 'business') message = '扣除 ' + valueOf(node, graph) + ' 资源（模拟）';
      else if (node.type === 'response') message = '响应 ' + valueOf(node, graph) + '（未请求服务器）';
      else if (node.type === 'moduleAction') message = '模块参数 ' + valueOf(node, graph) + '（模拟）';
      trace.push({ id: node.id, name: node.params.label, message, health, points });
      const edge = graph.edges.find((item) => item.from === node.id && item.output === output);
      node = edge && graph.nodes.find((item) => item.id === edge.to);
    }
    return trace;
  }

  // 调试输入不写回游戏工程，单步只移动执行游标。
  function startDebug() {
    const graph = current(); ui.results = validate(graph);
    if (ui.results.some((issue) => issue.error)) { ui.error = '请先修复校验问题，再运行调试。'; render(); return; }
    const hp = Number(document.getElementById('wf-debug-hp')?.value ?? 1);
    const damage = Number(document.getElementById('wf-debug-damage')?.value ?? 1);
    if (![hp, damage].every((value) => Number.isFinite(value) && value >= 0 && value <= 9999)) {
      ui.error = '调试生命值和伤害需要在0到9999之间。'; render(); return;
    }
    const modulePass = document.getElementById('wf-debug-module')?.checked !== false;
    ui.debug = { trace: traceGraph(graph, hp, damage, modulePass), step: 0, hp, damage, modulePass }; ui.error = ''; render();
    focusNode(ui.debug.trace[0]?.id);
  }

  // 校验项可以定位到节点；调试进度使用文字和高亮共同表达。
  function debugMarkup(graph) {
    const issues = ui.results; const debug = ui.debug; const active = debug?.trace[debug.step];
    return '<section class="wf-debug"><div class="row between"><b>检查与调试</b><span class="pill">本地模拟</span></div>'
      + (issues ? '<div class="wf-check-result">' + (issues.length ? issues.map((issue) => '<button type="button" data-wf-locate="'
        + esc(issue.node) + '"' + labelTerms(graph.nodes.find(node => node.id === issue.node)) + '>' + icon('warning') + esc(issue.text) + '</button>').join('') : '<p>✓ 校验通过：' + graph.nodes.length + ' 个节点，' + graph.edges.length + ' 条连接</p>') + '</div>' : '')
      + '<div class="wf-debug-inputs"><label>敌人生命值<input id="wf-debug-hp" type="number" value="' + (debug?.hp ?? 1) + '" min="0" max="9999"></label>'
      + '<label>本次伤害<input id="wf-debug-damage" type="number" value="' + (debug?.damage ?? 1) + '" min="0" max="9999"></label></div>'
      + (graph.context.startsWith('module:') ? '<label class="check-label"><input id="wf-debug-module" type="checkbox"'
        + (debug?.modulePass !== false ? ' checked' : '') + '>本次模块条件成立（模拟目标完成/资源足够）</label>' : '')
      + '<div class="wf-debug-actions">' + button('开始模拟', 'wf-run', 'primary', 'play')
      + button('下一步', 'wf-step', 'soft', 'arrow', !debug || debug.step >= debug.trace.length - 1 ? 'disabled' : '') + '</div>'
      + (debug ? '<ol class="wf-trace">' + debug.trace.map((step, i) => '<li class="' + (i === debug.step ? 'active' : i < debug.step ? 'done' : '')
        + '"><button type="button" data-wf-trace="' + i + '"><b>' + (i + 1) + '. ' + labelMarkup(graph.nodes.find(node => node.id === step.id)) + '</b><small>'
        + (i <= debug.step ? esc(step.message) : '待执行') + '</small></button></li>').join('') + '</ol><div class="wf-debug-outcome">当前生命 '
        + (active?.health ?? '—') + ' · 本次加分 ' + (active?.points ?? 0) + (debug.step === debug.trace.length - 1 ? ' · 模拟结束' : '') + '</div>' : '')
      + '<p class="wf-library-note">检查当前图；模拟不执行真实游戏、数据库或网络请求。</p></section>';
  }

  // 操作指南明确实际手势，并直接提供相应操作入口。
  function helpMarkup() {
    const steps = [['1', '添加节点', '在节点库搜索并点击添加；节点会出现在当前画布。', 'wf-palette'],
      ['2', '建立连接', '先点右侧输出，再点另一个节点左侧同类型输入。点连线可删除或插入节点。', 'wf-help-close'],
      ['3', '修改与移动', '点节点标题打开属性；保存参数。拖动标题，或用属性里的方向按钮移动。', 'wf-properties'],
      ['4', '验证与调试', '点击检查，修复可定位的问题；设置受击输入并单步查看执行结果。', 'validate-graph'],
      ['5', '继续对话', '手改和对话使用同一份图；撤销与重做保留修改历史。', 'continue-chat']];
    return '<div class="wf-help"><div class="row between"><div><span class="eyebrow">HOW TO BUILD</span><h3>把规则连成可执行的工作流</h3></div>'
      + button('关闭', 'wf-help-close', 'ghost', 'close') + '</div><div class="wf-help-steps">'
      + steps.map(([number, title, detail, action]) => '<button type="button" data-action="' + action + '"><span>' + number
        + '</span><div><b>' + title + '</b><small>' + detail + '</small></div>' + icon('arrow') + '</button>').join('') + '</div></div>';
  }

  // 独立连接表单不随画布缩放，低倍率时也能通过大控件选择目标端口。
  function linkDialogMarkup() {
    const graph = current(); const node = graph.nodes.find((item) => item.id === model.selectedNode);
    const outputs = node ? types[node.type].out || [] : [];
    const source = outputs.find((pin) => pin[0] === ui.chooserPort) || outputs[0];
    const targets = graph.nodes.filter((item) => item.id !== node?.id).flatMap((item) => (types[item.type].input || [])
      .filter((pin) => pin[2] === source?.[2]).map((pin) => ({ item, pin })));
    return '<dialog id="wf-connect-dialog" class="wf-dialog" aria-labelledby="wf-connect-title"><div class="row between">'
      + '<h2 id="wf-connect-title">连接节点</h2>' + button('关闭', 'wf-connect-close', 'ghost') + '</div>'
      + '<p class="small muted">使用列表选择，无需精确点按画布端口。</p><label class="field">输出<select id="wf-source-port">'
      + outputs.map((pin) => '<option value="' + pin[0] + '"' + (pin[0] === source?.[0] ? ' selected' : '') + labelTerms(node) + '>'
        + esc(node.params.label + ' · ' + pin[1] + ' · ' + typeLabel(pin[2])) + '</option>').join('') + '</select></label>'
      + '<label class="field">连接到<select id="wf-target-port"><option value="">选择目标输入</option>'
      + targets.map(({ item, pin }) => '<option value="' + esc(item.id + '|' + pin[0]) + '"'
        + (graph.edges.some((edge) => edge.to === item.id && edge.input === pin[0]) ? ' disabled' : '') + labelTerms(item) + '>'
        + esc(item.params.label + ' · ' + pin[1]) + (graph.edges.some((edge) => edge.to === item.id && edge.input === pin[0]) ? '（已连接）' : '')
        + '</option>').join('') + '</select></label><p id="wf-link-error" class="wf-form-error" role="alert" hidden></p>' + button('建立连接', 'wf-connect-save', 'primary', 'check') + '</dialog>';
  }

  // 弹窗使用原生dialog管理焦点；新文档不会覆盖当前工作流。
  function dialogsMarkup() {
    return linkDialogMarkup() + '<dialog id="wf-library-dialog" class="wf-dialog" aria-labelledby="wf-library-heading"><div class="row between"><h2 id="wf-library-heading">'
      + (ui.insert ? '在线间插入节点' : '添加节点') + '</h2>' + button('关闭', 'wf-palette-close', 'ghost', 'close') + '</div>'
      + libraryMarkup(true) + '</dialog><dialog id="wf-new-dialog" class="wf-dialog" aria-labelledby="wf-new-heading"><h2 id="wf-new-heading">新建工作流</h2>'
      + '<p class="small muted">创建独立的空白图，当前图保留。</p>' + field('工作流名称', 'wf-new-name', '我的工作流')
      + '<div class="row">' + button('取消', 'wf-new-close', 'ghost') + button('创建空白图', 'wf-create', 'primary', 'plus') + '</div></dialog>';
  }

  // 地址中的评审状态只在首次进入时设置，后续点击不被固定场景反复覆盖。
  function applyScenario(graph) {
    const key = view.mode + ':' + view.state + ':' + graph.context;
    if (ui.scenario === key) return;
    ui.scenario = key;
    if (view.state === 'library' || view.state === 'landscape_library' || view.state === 'no_results') {
      ui.palette = true; ui.search = view.state === 'no_results' ? '不存在节点' : '';
    }
    if (view.state === 'connecting') ui.pending = { node: graph.nodes.find((node) => node.type === 'custom')?.id || graph.nodes[0]?.id, port: graph.nodes.some((node) => node.type === 'custom') ? 'value' : 'next' };
    if (view.state === 'properties') ui.inspector = true;
    if (view.state === 'guide') ui.help = true;
    if (view.state === 'debug') {
      ui.inspector = true; ui.results = validate(graph); const trace = traceGraph(graph, 1, 1);
      ui.debug = trace.length ? { trace, step: Math.min(3, trace.length - 1), hp: 1, damage: 1, modulePass: true } : null;
    }
    if (view.state === 'empty' && !ui.document.includes(':blank')) {
      const id = graph.context + ':blank';
      model.graphs[id] = { id, context: graph.context, domain: graph.domain, name: '空白工作流', nodes: [], edges: [] };
      ui.document = id; model.selectedNode = '';
    }
  }

  // 页面骨架保留当前文档、执行域、选中项和高频操作，手机入口不藏在桌面侧栏内。
  function page() {
    let graph = current();
    applyScenario(graph);
    graph = current();
    if (ui.contextBlocked) return editorToolbar('workflow', '', '') + '<div class="panel panel-pad"><h2>工作流数量已达80张上限</h2>'
      + '<p>当前入口尚未创建工作流，已有草稿完整保留。请返回已有工作流继续编辑。</p>' + button('返回敌人工作流', 'wf-limit-return', 'primary') + '</div>';
    const options = Object.values(model.graphs).filter((item) => item.context === graph.context);
    const selected = graph.nodes.find((node) => node.id === model.selectedNode);
    const toolbar = '<div class="wf-primary-actions">' + button('添加节点', 'wf-palette', 'primary', 'plus')
      + button('检查', 'validate-graph', 'soft', 'checkCircle') + (view.mode === 'android'
        ? button(view.state.includes('landscape') ? '返回竖屏' : '横屏编辑', 'toggle-orientation', 'soft', 'phone') : '') + '</div>';
    const context = '<div class="wf-context"><label><span>' + (graph.domain === 'server' ? '服务端工作流' : '客户端工作流')
      + '</span><select id="wf-document" aria-label="当前工作流">' + options.map((item) => '<option value="' + esc(item.id) + '"'
        + (item.id === graph.id ? ' selected' : '') + ' translate="no">' + esc(item.name) + '</option>').join('') + '</select></label>'
      + '<div class="wf-context-actions">' + button('新建', 'wf-new', 'ghost', 'plus') + button('操作指南', 'wf-help', 'ghost', 'info')
      + button(graph.domain === 'server' ? '切换客户端' : '切换服务端', 'toggle-scope', 'ghost', 'globe') + '</div></div>';
    const canvasTools = '<div class="wf-canvas-tools"><div class="row">' + button('−', 'wf-zoom-out', 'ghost', '', 'aria-label="缩小画布"')
      + '<span>' + Math.round(ui.zoom * 100) + '%</span>' + button('＋', 'wf-zoom-in', 'ghost', '', 'aria-label="放大画布"')
      + button('适应', 'wf-fit', 'ghost') + '</div><div class="row">' + button('撤销', 'undo', 'ghost', 'undo', !model.undo.length ? 'disabled' : '')
      + button('重做', 'wf-redo', 'ghost', 'history', !model.redo.length ? 'disabled' : '') + '</div></div>';
    const pending = ui.pending ? '正在连接：请点亮起的同类型输入端口' : '点输出 → 点输入连线；拖动节点标题移动';
    const status = '<div class="wf-connect-status' + (ui.pending ? ' pending' : '') + '"><span>' + pending + '</span>'
      + (ui.pending ? button('取消连接', 'wf-cancel-connect', 'ghost') : '') + '</div>';
    const report = ui.error || ['invalid', 'landscape_invalid'].includes(view.state)
      ? '<div class="wf-error" role="alert">' + icon('warning') + '<span>' + esc(ui.error || '音频资源不能连接到数值输入。原有连线未改变。')
        + '</span>' + button('取消', 'fix-connection', 'ghost') + '</div>' : '';
    const modal = view.mode === 'android' && !view.state.includes('landscape') && ui.inspector;
    const aside = '<aside role="' + (modal ? 'dialog' : 'complementary') + '" aria-label="节点属性与调试"'
      + (modal ? ' aria-modal="true" tabindex="-1"' : '') + ' class="inspector wf-inspector' + (ui.inspector ? ' mobile-open' : '') + '">' + inspectorMarkup(graph)
      + (graph.domain === 'server' ? '<div class="wf-section">' + button('返回接口定义', 'api', 'soft full', 'back')
        + button('用对话调整API', 'ask-api', 'ghost full', 'chat') + '</div>' : '') + debugMarkup(graph) + '</aside>';
    return editorToolbar('workflow', '', toolbar) + '<div class="wf-editor">' + context + (ui.help ? helpMarkup() : '')
      + '<div class="editor-grid wf-grid"><aside class="hierarchy wf-library"><h3>节点库</h3>' + libraryMarkup() + '</aside>'
      + '<section class="graph-center">' + canvasTools + report + status + boardMarkup(graph)
      + '<div class="wf-selection-bar"><span><b>' + (selected ? labelMarkup(selected) : '未选择节点') + '</b><small>' + graph.nodes.length + ' 节点 · '
      + graph.edges.length + ' 连接 · ' + esc(ui.storage || '本机草稿') + '</small></span>'
      + button('属性 / 调试', 'wf-properties', 'soft wf-mobile-only', 'nodes') + '</div></section>' + aside + '</div>'
      + '<div class="wf-mobile-scrim' + (ui.inspector ? ' visible' : '') + '" data-wf-dismiss></div></div>' + dialogsMarkup();
  }

  // 表单错误留在属性抽屉内，保留输入并聚焦错误字段供手机用户修正。
  function formError(message, input) {
    const feedback = document.querySelector('.wf-form-error');
    if (feedback) { feedback.textContent = message; feedback.hidden = false; }
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }

  // 原型只支持明确的数值指令；目标图在任务开始时捕获，不随之后的页面切换漂移。
  function promptPatch(text, graphId) {
    const graph = model.graphs[graphId];
    if (!graph) return { patch: null, explanation: '目标工作流已不存在，没有提交修改。' };
    const scoreMatch = text.match(/(?:增加|加|改成|设为|改为)\s*(\d+)\s*分/);
    const resourceMatch = text.match(/资源.*?(?:改为|改成|设为)\s*(\d+)/);
    const moduleMatch = text.match(/参数.*?(?:改为|改成|设为)\s*(\d+)/);
    const type = scoreMatch ? 'score' : resourceMatch ? 'business' : moduleMatch ? 'moduleAction' : '';
    const match = scoreMatch || resourceMatch || moduleMatch;
    const node = graph.nodes.find((item) => item.type === type);
    if (!match || !node) return { patch: null, explanation: '当前为本地对话演示，尚未识别这条图修改指令；已保留当前工作流，没有提交变更。' };
    const value = Math.min(9999, Number(match[1])); const graphs = clone(model.graphs);
    graphs[graphId].nodes.find((item) => item.id === node.id).params.value = value;
    const patch = { graphs };
    if (graphId === 'client:enemy' && node.id === 'score') patch.points = value;
    if (graph.domain === 'server' && graph.id === graph.context && node.id === 'business') {
      const apis = clone(model.apis); const endpoint = apis.find((item) => item.id === (graph.apiId || graph.context.slice(7)));
      if (endpoint) { endpoint.parameters = { bodyLimit: 256, idempotent: true, status: 200, ...endpoint.parameters, resourceCost: value }; patch.apis = apis; }
    }
    if (graph.context.startsWith('module:') && graph.id === graph.context && node.id === 'rule') {
      const key = graph.moduleBinding || graph.context.slice(7);
      patch.moduleRecords = { ...model.moduleRecords, [key]: { name: graph.name, value } }; patch.moduleValue = value;
    }
    return { patch, explanation: '已修改“' + graph.name + '”中的“' + node.params.label + '”为 ' + value + '，其余节点与连线保留。' };
  }

  // 对话摘要读取捕获的图；显示图规模和绑定值，不编造未发生的修改。
  function describeGraph(graphId) {
    const graph = model.graphs[graphId]; if (!graph) return '目标图不存在';
    const score = graph.nodes.find((node) => node.type === 'score');
    return graph.name + '，' + graph.nodes.length + ' 个节点、' + graph.edges.length + ' 条连接'
      + (score ? '；击败敌人增加 ' + valueOf(score, graph) + ' 分' : '');
  }

  // 参数一次性校验并提交，服务端参数同时反映到API定义页。
  function saveParameters() {
    const graph = current(); const node = graph.nodes.find((item) => item.id === model.selectedNode);
    if (!node) return;
    const label = document.getElementById('wf-label')?.value.trim();
    const valueInput = document.getElementById(node.id === 'score' ? 'score-value' : 'wf-value');
    const value = valueInput ? Number(valueInput.value) : node.params.value;
    if (!label || label.length > 80) { formError('节点名称需要1到80个字符。', document.getElementById('wf-label')); return; }
    if (valueInput && (!Number.isFinite(value) || value < 0 || value > 9999 || !valueInput.value.trim())) {
      formError('请输入0到9999之间的有效数值。', valueInput); return;
    }
    if (node.type === 'response' && (!Number.isInteger(value) || value < 200 || value > 599)) {
      formError('响应状态码需要是200到599之间的整数。', valueInput); return;
    }
    const audio = document.getElementById('wf-audio')?.value;
    const auth = document.getElementById('wf-auth')?.checked;
    const idempotent = document.getElementById('wf-idempotent')?.checked;
    const extra = {};
    if (graph.id === 'client:enemy' && node.id === 'score') extra.points = value;
    if (graph.domain === 'server' && graph.id === graph.context && node.id === node.type) {
      const apis = clone(model.apis); const endpoint = apis.find((item) => item.id === (graph.apiId || graph.context.slice(7)));
      endpoint.parameters = { bodyLimit: 256, resourceCost: 10, idempotent: true, status: 200, ...endpoint.parameters };
      if (node.type === 'validate') endpoint.parameters.bodyLimit = value;
      if (node.type === 'business') endpoint.parameters.resourceCost = value;
      if (node.type === 'response') endpoint.parameters.status = value;
      if (auth !== undefined) endpoint.auth = auth;
      if (idempotent !== undefined) endpoint.parameters.idempotent = idempotent;
      extra.apis = apis;
    }
    if (node.type === 'moduleAction' && node.id === 'rule' && graph.id === graph.context) {
      extra.moduleValue = value;
      extra.moduleRecords = { ...model.moduleRecords, [graph.moduleBinding || graph.context.slice(7)]: { name: Studio.ui.module, value } };
    }
    edit('修改' + node.params.label + '参数', (draft) => {
      const updated = draft.nodes.find((item) => item.id === node.id);
      updated.params = { ...updated.params, label, value,
        customLabel: updated.params.customLabel || label !== updated.params.label, ...(audio ? { audio } : {}),
        ...(auth !== undefined ? { enabled: auth } : {}), ...(idempotent !== undefined ? { enabled: idempotent } : {}) };
    }, extra);
    toast('参数已保存，预览和对话共用当前工作流。');
  }

  // 删除节点同时删除关联边，整个操作可由一次撤销恢复。
  function deleteNode() {
    const node = current().nodes.find((item) => item.id === model.selectedNode);
    if (!node) return;
    edit('删除' + node.params.label, (draft) => {
      draft.nodes = draft.nodes.filter((item) => item.id !== node.id);
      draft.edges = draft.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    });
    ui.pending = null; toast('已删除节点和关联连线；可撤销恢复。');
  }

  // 复制只复制节点参数，连线由用户显式建立，避免意外重复执行。
  function duplicateNode() {
    const node = current().nodes.find((item) => item.id === model.selectedNode);
    if (!node) return;
    if (current().nodes.length >= 80) { formError('单图最多80个节点，请拆分工作流。'); return; }
    const copy = clone(node); copy.id = nextId(node.type); copy.x = Math.min(2200, copy.x + 50); copy.y = Math.min(2200, copy.y + 210);
    copy.params.label = copy.params.label.slice(0, 75) + ' 副本';
    edit('复制节点', (draft) => draft.nodes.push(copy)); model.selectedNode = copy.id; render(); focusNode(copy.id);
  }

  // 文档创建不删除现有图，新图的执行域与当前入口一致。
  function createDocument() {
    const name = document.getElementById('wf-new-name').value.trim(); const graph = current();
    if (!name || name.length > 80) { toast('请输入1到80个字符的名称。'); return; }
    if (Object.keys(model.graphs).length >= 80) { toast('当前项目最多80张工作流，请复用已有图。'); return; }
    const id = graph.context + ':draft-' + (Object.keys(model.graphs).length + 1);
    commit('新建工作流', { graphs: { ...clone(model.graphs), [id]: { id, context: graph.context, domain: graph.domain, name, nodes: [], edges: [] } } });
    ui.document = id; ui.newDialog = false; ui.edge = ''; ui.pending = null; ui.results = null; ui.debug = null;
    model.selectedNode = ''; render();
  }

  // 重做与撤销共用项目快照，跨页编辑也不会仅恢复画布外观。
  function redo() {
    const snapshot = model.redo.pop();
    if (!snapshot) return;
    const previous = projectSnapshot(); model.undo.push(previous);
    Object.assign(model, snapshot); model.revision += 1;
    model.history.push({ revision: model.revision, title: '重做最近修改', note: '恢复工程图和参数' }); ui.results = null; ui.debug = null; persist(); render(); toast('已重做修改。');
  }

  // 镜头单独保存，不影响工程版本和撤销历史。
  function rememberCamera() {
    const scroll = document.querySelector('.wf-scroll');
    if (scroll && ui.document) ui.cameras[ui.document] = { left: scroll.scrollLeft, top: scroll.scrollTop };
  }

  // 定位节点时使用滚动容器，不把整个手机页面滚到不可操作的位置。
  function focusNode(id) {
    const node = current().nodes.find((item) => item.id === id); const scroll = document.querySelector('.wf-scroll');
    if (!node || !scroll) return;
    scroll.scrollLeft = Math.max(0, node.x * ui.zoom - 30); scroll.scrollTop = Math.max(0, node.y * ui.zoom - 35);
    rememberCamera();
  }

  // 适应画布按容器宽度计算；缩放限制保证不会产生零尺寸或无限画布。
  function fit() {
    const scroll = document.querySelector('.wf-scroll'); const graph = current();
    const width = Math.max(300, ...graph.nodes.map((node) => node.x + 250));
    ui.zoom = Math.max(0.4, Math.min(1.25, (scroll.clientWidth - 25) / width));
    ui.cameras[ui.document] = { left: 0, top: 0 }; render();
  }

  // 新旧工具栏动作统一走编辑器，替代过去只弹出“示意”的行为。
  function action(name) {
    const actions = {
      'wf-limit-return': () => { model.workflowScope = 'client'; model.moduleEditing = false; ui.context = ''; render(); },
      'wf-connect-dialog': () => { ui.connectDialog = true; ui.chooserPort = ''; render(); },
      'wf-connect-close': () => { ui.connectDialog = false; ui.nextFocus = '[data-action=wf-connect-dialog]'; render(); },
      'wf-connect-save': () => {
        const value = document.getElementById('wf-target-port').value;
        const output = document.getElementById('wf-source-port').value; const [to, pin] = value.split('|');
        const problem = !value ? '请选择一个未占用的输入端口。' : connectionProblem(current(), model.selectedNode, output, to, pin);
        if (problem) {
          // 原生弹窗处于顶层，错误必须留在弹窗内，不能依赖背景提示条。
          const feedback = document.getElementById('wf-link-error'); feedback.textContent = problem; feedback.hidden = false;
          document.getElementById('wf-target-port').focus(); return;
        }
        ui.pending = { node: model.selectedNode, port: output }; ui.connectDialog = false; ui.inspector = false; connect(to, 'in', pin);
      },
      'wf-palette': () => { ui.palette = true; ui.insert = ''; ui.help = false; ui.search = ''; render(); },
      'wf-palette-close': () => { ui.palette = false; ui.insert = ''; ui.nextFocus = '[data-action=wf-palette]'; render(); },
      'wf-new': () => { ui.newDialog = true; render(); }, 'wf-new-close': () => { ui.newDialog = false; ui.nextFocus = '[data-action=wf-new]'; render(); },
      'wf-create': createDocument, 'wf-save': saveParameters, 'wf-delete': deleteNode, 'wf-duplicate': duplicateNode,
      'wf-redo': redo, 'wf-fit': fit,
      'wf-zoom-in': () => { ui.zoom = Math.min(1.5, Math.round((ui.zoom + 0.1) * 100) / 100); render(); },
      'wf-zoom-out': () => { ui.zoom = Math.max(0.4, Math.round((ui.zoom - 0.1) * 100) / 100); render(); },
      'wf-help': () => { ui.help = !ui.help; render(); }, 'wf-help-close': () => { ui.help = false; render(); },
      'wf-properties': () => { ui.inspector = true; ui.help = false; render(); },
      'wf-inspector-close': () => { ui.inspector = false; ui.nextFocus = '[data-action=wf-properties]'; render(); },
      'wf-cancel-connect': () => { ui.pending = null; ui.error = ''; render(); },
      'wf-delete-edge': () => { const id = ui.edge; edit('删除连线', (draft) => { draft.edges = draft.edges.filter((edge) => edge.id !== id); }); ui.edge = ''; render(); },
      'wf-insert': () => { ui.insert = ui.edge; ui.palette = true; ui.search = ''; ui.group = '全部'; render(); },
      'validate-graph': () => { ui.help = false; ui.results = validate(); ui.inspector = true; ui.error = ''; render(); },
      'fix-connection': () => { ui.pending = null; ui.error = ''; view.state = view.state.includes('landscape') ? 'landscape' : 'selected'; render(); },
      'invalid-connection': () => { ui.error = '音频资源不能连接到数值输入。原有连线未改变。'; view.state = view.state.includes('landscape') ? 'landscape_invalid' : 'invalid'; render(); },
      'wf-run': startDebug,
      'wf-step': () => { if (ui.debug && ui.debug.step < ui.debug.trace.length - 1) { ui.debug.step += 1; render(); focusNode(ui.debug.trace[ui.debug.step].id); } },
    };
    if (name === 'toggle-scope') { ui.document = ''; ui.context = ''; ui.pending = null; }
    if (!actions[name]) return false;
    rememberCamera(); actions[name](); return true;
  }

  // 节点与连接选择都携带稳定标识，不解析自由文本为命令。
  function click(target) {
    const data = target.dataset;
    if (data.wfAdd) add(data.wfAdd);
    else if (data.wfGroup) { ui.group = data.wfGroup; render(); }
    else if (data.wfPort) connect(data.wfNode, data.wfDirection, data.wfPort);
    else if (data.wfSelect) {
      if (ui.suppress) { ui.suppress = false; return true; }
      model.selectedNode = data.wfSelect; ui.edge = ''; ui.inspector = true; render();
    } else if (data.wfEdgeButton) { ui.edge = data.wfEdgeButton; ui.inspector = true; render(); }
    else if (data.wfNudge) {
      const [dx, dy] = data.wfNudge.split(',').map(Number); const id = model.selectedNode;
      edit('移动节点', (draft) => { const node = draft.nodes.find((item) => item.id === id); node.x = Math.max(0, Math.min(2200, node.x + dx)); node.y = Math.max(0, Math.min(2200, node.y + dy)); });
    } else if (data.wfLocate !== undefined) { model.selectedNode = data.wfLocate; ui.edge = ''; render(); focusNode(data.wfLocate); }
    else if (data.wfTrace !== undefined && ui.debug) { ui.debug.step = Number(data.wfTrace); render(); focusNode(ui.debug.trace[ui.debug.step].id); }
    else return data.action ? action(data.action) : false;
    return true;
  }

  // 原有得分输入保持失焦提交，同时同步图参数；其他输入点击保存后再提交。
  function change(input) {
    if (input.id === 'wf-source-port') { ui.chooserPort = input.value; render(); return true; }
    if (input.id === 'wf-document') {
      rememberCamera(); ui.document = input.value; ui.pending = null; ui.edge = ''; ui.results = null; ui.debug = null; render(); return true;
    }
    if (view.page === 'workflow' && input.id === 'score-value') { saveParameters(); return true; }
    return false;
  }

  // 搜索只隐藏列表项，手机输入法和光标不因重绘中断。
  function filterLibrary() {
    document.querySelectorAll('.wf-library-content').forEach((library) => {
      const items = Array.from(library.querySelectorAll('[data-wf-search-text]'));
      items.forEach((item) => { item.hidden = !item.dataset.wfSearchText.includes(ui.search.trim()); });
      library.querySelector('.wf-search-empty').hidden = items.some((item) => !item.hidden);
    });
  }

  // 使用稳定控件标识恢复焦点，避免每次图更新都回到页面开头。
  function beforeRender() {
    rememberCamera();
    const active = document.activeElement;
    if (!active || !active.closest('#app')) return;
    if (active.id) ui.focus = '#' + active.id;
    else if (active.dataset.wfPort) ui.focus = '[data-wf-node="' + active.dataset.wfNode + '"][data-wf-direction="'
      + active.dataset.wfDirection + '"][data-wf-port="' + active.dataset.wfPort + '"]';
    else if (active.dataset.wfSelect) ui.focus = '[data-wf-select="' + active.dataset.wfSelect + '"]';
    else if (active.dataset.action) ui.focus = '[data-action="' + active.dataset.action + '"]';
  }

  // 竖屏属性抽屉具有模态语义，背景控件暂不可达；横屏仍是普通并排属性栏。
  function restoreFocus() {
    const modal = view.mode === 'android' && !view.state.includes('landscape') && ui.inspector;
    for (const selector of ['.review-bar', '.app-top', '.mobile-nav', '.content-toolbar', '.wf-context', '.wf-grid > .graph-center']) {
      const element = document.querySelector(selector); if (element) element.inert = modal;
    }
    let target = null;
    const selector = ui.nextFocus || ui.focus;
    if (selector) target = document.querySelector(selector);
    if (modal && (!target || !target.closest('.wf-inspector'))) target = document.querySelector('[data-action=wf-inspector-close]');
    if (target && target.getClientRects().length && !target.closest('[inert]') && !document.querySelector('.wf-dialog[open]')) target.focus({ preventScroll: true });
    ui.nextFocus = '';
  }

  // 每次重绘后恢复文档镜头和弹窗焦点；桌面与手机共用同一张图。
  function afterRender() {
    if (view.page !== 'workflow') {
      document.querySelectorAll('[inert]').forEach((item) => { item.inert = false; }); return;
    }
    const camera = ui.cameras[ui.document]; const scroll = document.querySelector('.wf-scroll');
    if (camera && scroll) { scroll.scrollLeft = camera.left; scroll.scrollTop = camera.top; }
    filterLibrary();
    restoreFocus();
    for (const [id, open] of [['wf-library-dialog', ui.palette], ['wf-new-dialog', ui.newDialog], ['wf-connect-dialog', ui.connectDialog]]) {
      const dialog = document.getElementById(id);
      if (open && dialog && !dialog.open) {
        dialog.showModal();
        dialog.addEventListener('cancel', (event) => { event.preventDefault(); ui.palette = false; ui.newDialog = false; ui.connectDialog = false;
          ui.nextFocus = id === 'wf-library-dialog' ? '[data-action=wf-palette]' : id === 'wf-new-dialog' ? '[data-action=wf-new]' : '[data-action=wf-connect-dialog]'; render(); });
      }
    }
  }

  // 指针坐标需反解原型的横屏旋转，正式Android方向切换不需要这层模拟。
  function dragDelta(event, drag) {
    const dx = event.clientX - drag.clientX; const dy = event.clientY - drag.clientY;
    return drag.rotated ? { x: dy / ui.zoom, y: -dx / ui.zoom } : { x: dx / ui.zoom, y: dy / ui.zoom };
  }

  // 标题拖动只在释放时提交一次事务，取消手势不会留下半次修改。
  function pointerDown(event) {
    const title = event.target.closest('.wf-node-title');
    if (!title || event.button !== 0) return;
    const graph = current(); const node = graph.nodes.find((item) => item.id === title.dataset.wfSelect);
    if (!node) return;
    event.preventDefault(); title.setPointerCapture(event.pointerId);
    ui.drag = { id: node.id, x: node.x, y: node.y, clientX: event.clientX, clientY: event.clientY,
      rotated: document.body.classList.contains('workflow-wide') && window.matchMedia('(orientation: portrait)').matches,
      moved: false, target: title, pointer: event.pointerId };
  }

  // 拖动预览只改DOM和临时坐标，原图在指针释放前保持原样。
  function pointerMove(event) {
    const drag = ui.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const delta = dragDelta(event, drag);
    if (Math.abs(delta.x) + Math.abs(delta.y) < 5 && !drag.moved) return;
    drag.moved = true;
    drag.nextX = Math.max(0, Math.min(2200, Math.round((drag.x + delta.x) / 8) * 8));
    drag.nextY = Math.max(0, Math.min(2200, Math.round((drag.y + delta.y) / 8) * 8));
    const card = drag.target.closest('.wf-node'); card.style.left = drag.nextX + 'px'; card.style.top = drag.nextY + 'px';
    const draft = clone(current()); const node = draft.nodes.find((item) => item.id === drag.id); node.x = drag.nextX; node.y = drag.nextY;
    document.querySelector('.wf-lines').innerHTML = lineMarkup(draft);
  }

  // pointercancel恢复原位置，释放才写入工程；拖动后的合成点击被忽略。
  function pointerUp(event) {
    const drag = ui.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    ui.drag = null;
    if (drag.target.hasPointerCapture(event.pointerId)) drag.target.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    ui.suppress = true;
    setTimeout(() => { ui.suppress = false; }, 0);
    if (event.type === 'pointercancel') { render(); return; }
    model.selectedNode = drag.id;
    edit('拖动工作流节点', (draft) => { const node = draft.nodes.find((item) => item.id === drag.id); node.x = drag.nextX; node.y = drag.nextY; });
  }

  // 文本输入时保留系统快捷键；编辑画布时才接管撤销、重做与删除。
  function keyboard(event) {
    if (view.page !== 'workflow') return;
    if (event.key === 'Tab' && view.mode === 'android' && ui.inspector && !view.state.includes('landscape')
      && !document.querySelector('.wf-dialog[open]')) {
      const focusable = Array.from(document.querySelector('.wf-inspector').querySelectorAll('button:not(:disabled), input, select, textarea'))
        .filter((item) => item.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); if (event.shiftKey) redo(); else undoChange();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    else if (event.key === 'Escape' && !document.querySelector('.wf-dialog[open]')) {
      ui.pending = null; ui.error = ''; ui.inspector = false; ui.help = false; render();
    } else if (event.key === 'Delete' && !document.querySelector('.wf-dialog[open]')) {
      event.preventDefault(); if (ui.edge) action('wf-delete-edge'); else deleteNode();
    }
  }

  // SVG路径不能嵌套button，因此独立委托到本地编辑器并提供列表等价入口。
  document.addEventListener('click', (event) => {
    const edge = event.target.closest('[data-wf-edge]');
    if (edge) { ui.edge = edge.dataset.wfEdge; ui.inspector = true; render(); }
    if (event.target.hasAttribute('data-wf-dismiss')) { ui.inspector = false; render(); }
  });
  document.addEventListener('input', (event) => {
    if (!event.target.hasAttribute('data-wf-search')) return;
    ui.search = event.target.value; filterLibrary();
  });
  document.addEventListener('pointerdown', pointerDown);
  document.addEventListener('pointermove', pointerMove);
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerUp);
  document.addEventListener('keydown', keyboard);
  document.addEventListener('scroll', (event) => { if (event.target.classList?.contains('wf-scroll')) rememberCamera(); }, true);
  return { init, page, click, action, change, current, ui, types, validate, traceGraph, beforeRender, afterRender, preparePatch, persist,
    rememberCamera, connectionProblem, focusNode, promptPatch, describeGraph };
})();
