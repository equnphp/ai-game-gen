/* 渐进式创作界面只写入结构化组件配置；画布是效果示意，不代替正式运行时。 */
/* global I18n, model, view, Studio, EffectsPreview, esc, icon, button, field, heading, notice, editorToolbar, gameStage, commit, render, go -- 共用控件与原子事务。 */
/* exported Creation -- 渐进式组件编辑入口。 */
"use strict";
const Creation = (() => {
  const clone = (data) => JSON.parse(JSON.stringify(data));
  const objects = [['player', '主角'], ['enemy', '敌人'], ['portal', '传送门']];
  const labels = { physics: '运动与碰撞', particles: '粒子特效', skeleton: '角色动作' };
  const defaults = {
    physics: { preset: 'drop', gravity: 9.8, bounce: 0.35, friction: 0.3, bodyType: 'dynamic', shape: 'circle', sensor: false },
    particles: { preset: 'explosion', effectPreset: 'explosion', count: 80, lifetime: 1.2, speed: 140, size: 5, spread: 360, gravity: 30, color: '#9e8cff', loop: true, seed: 42 },
    skeleton: { preset: 'idle', clip: 'idle', speed: 1, loop: true, boneAngle: 0, showBones: true, skin: 'astronaut' },
  };
  const presets = {
    physics: [['drop', '会掉落', { gravity: 9.8, bounce: 0.35, bodyType: 'dynamic' }],
      ['bounce', '弹跳小球', { gravity: 9.8, bounce: 0.85, bodyType: 'dynamic' }],
      ['fixed', '固定障碍', { gravity: 0, bounce: 0, bodyType: 'static' }]],
    particles: [['explosion', '能量爆炸', { effectPreset: 'explosion', count: 80, lifetime: 1.2, speed: 140, color: '#9e8cff', gravity: 30 }],
      ['fire', '温暖火焰', { effectPreset: 'fire', count: 120, lifetime: 1.8, speed: 70, color: '#ffad50', gravity: -30 }],
      ['rain', '下雨', { effectPreset: 'rain', count: 180, lifetime: 2, speed: 170, color: '#76cfff', gravity: 45 }],
      ['trail', '星光拖尾', { effectPreset: 'trail', count: 65, lifetime: 1.5, speed: 60, color: '#84edd1', gravity: 0 }]],
    skeleton: [['idle', '待机', { clip: 'idle', speed: 1, boneAngle: 0 }],
      ['run', '跑步', { clip: 'run', speed: 1.2, boneAngle: 0 }],
      ['attack', '攻击', { clip: 'attack', speed: 1, boneAngle: 0 }]],
  };
  const ui = { object: 'player', paused: false, elapsed: 0, started: 0, raf: 0, error: '', stats: {}, advanced: false };
  // 仅接受本版本定义的有界数据；无效草稿不会被当成有效组件执行。
  function valid(data) {
    if (!data || data.schema !== 1 || !data.objects || Object.keys(data.objects).length > 240) return false;
    return Object.entries(data.objects).every(([id, components]) => /^[a-zA-Z0-9:-]{1,100}$/.test(id)
      && components && Object.entries(components).every(([kind, params]) => {
        if (!defaults[kind] || !params || typeof params !== 'object') return false;
        return Object.keys(defaults[kind]).every((key) => {
          if (typeof params[key] !== typeof defaults[kind][key]) return false;
          if (typeof params[key] === 'number') return Number.isFinite(params[key]) && Math.abs(params[key]) <= 10000;
          return typeof params[key] !== 'string' || params[key].length < 80;
        });
      }));
  }
  function init(reset = false) {
    if (reset || !valid(model.systems)) model.systems = { schema: 1, objects: {} };
    ui.error = ''; ui.object = 'player'; ui.elapsed = 0; ui.paused = false;
  }
  function key() { return model.activeLevel + ':' + ui.object; }
  function component(kind) { return model.systems.objects[key()]?.[kind] || null; }
  // 所有入口提交完整组件文档；高级展开只改变视图，不重建数据。
  function patchFor(kind, params, target = key()) {
    const systems = clone(model.systems);
    systems.objects[target] ||= {};
    systems.objects[target][kind] = clone(params);
    return { systems };
  }
  function save(kind, params, title) {
    resetClock(); commit(title, patchFor(kind, params)); ui.error = ''; render();
  }
  function activeKind() {
    return ['physics', 'particles', 'skeleton'].find((kind) => view.state.startsWith(kind)) || 'particles';
  }
  function select(label, id, value, choices) {
    return '<label class="field">' + label + '<select id="' + id + '">' + choices.map(([v, text]) =>
      '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + text + '</option>').join('') + '</select></label>';
  }
  function check(label, id, value) {
    return '<label class="check-label"><input type="checkbox" id="' + id + '"' + (value ? ' checked' : '') + '>' + label + '</label>';
  }
  function input(label, name, value, type = 'number', hint = '') { return field(label, 'cr-' + name, value, type, hint); }
  function advancedForm(kind, data) {
    if (kind === 'physics') return '<div class="cr-fields">'
      + select('物体类型', 'cr-bodyType', data.bodyType, [['dynamic', '动态物体'], ['static', '静态物体'], ['kinematic', '运动学物体']])
      + select('碰撞形状', 'cr-shape', data.shape, [['circle', '圆形'], ['box', '矩形']])
      + input('重力（m/s²，示意）', 'gravity', data.gravity) + input('弹性（0～1）', 'bounce', data.bounce)
      + input('摩擦（0～1）', 'friction', data.friction) + '</div>' + check('只检测接触，不产生碰撞响应', 'cr-sensor', data.sensor);
    if (kind === 'particles') return '<div class="cr-fields">' + input('粒子数（1～300）', 'count', data.count)
      + input('生命周期（秒）', 'lifetime', data.lifetime) + input('初速度（像素/秒）', 'speed', data.speed)
      + input('大小（像素）', 'size', data.size) + input('散布角（0～360°）', 'spread', data.spread)
      + input('重力（像素/秒²）', 'gravity', data.gravity) + input('颜色', 'color', data.color, 'color')
      + input('随机种子', 'seed', data.seed) + '</div>' + check('循环预览', 'cr-loop', data.loop);
    return '<div class="cr-fields">' + select('动作片段', 'cr-clip', data.clip, [['idle', '待机'], ['run', '跑步'], ['attack', '攻击']])
      + input('播放速度（0.1～3倍）', 'speed', data.speed) + input('手臂局部偏移（度）', 'boneAngle', data.boneAngle)
      + select('示例外观', 'cr-skin', data.skin, [['astronaut', '蓝色宇航员'], ['ember', '橙色宇航员']]) + '</div>'
      + check('循环预览', 'cr-loop', data.loop) + check('显示关节和骨骼', 'cr-showBones', data.showBones)
      + '<p class="small muted">当前可调整预设骨架动作。网格蒙皮、绑定、IK与关键帧制作仍待研发。</p>';
  }
  function objectBar() {
    return '<div class="cr-objectbar"><div><small class="muted">正在编辑</small><b>' + I18n.user(Studio.level().name) + '</b></div>'
      + '<div class="segmented">' + objects.map(([id, name]) => '<button data-cr-object="' + id + '" class="'
        + (ui.object === id ? 'active' : '') + '">' + name + '</button>').join('') + '</div></div>';
  }
  function cards() {
    return '<div class="cr-ability-grid">' + Object.entries(labels).map(([kind, title]) => '<button class="cr-ability" data-cr-open="' + kind + '">'
      + icon(kind === 'physics' ? 'box' : kind === 'particles' ? 'sparkle' : 'cursor') + '<h3>' + title + '</h3><p>'
      + ({ physics: '让物体掉落、弹跳，或成为障碍', particles: '给场景加爆炸、火焰、雨和星光', skeleton: '选择待机、跑步和攻击动作' })[kind]
      + '</p><span class="pill ' + (component(kind) ? 'green' : '') + '">' + (component(kind) ? '已添加 · 可调整' : '点击选择效果') + '</span></button>').join('') + '</div>';
  }
  function page() {
    const detail = ['physics', 'particles', 'skeleton', 'ability_'].some((s) => view.state.startsWith(s));
    const toolbar = editorToolbar('scene', '先选对象，再为它添加能力', button('用对话修改', 'cr-ask', 'soft', 'chat'));
    const intro = toolbar + '<div class="cr-page">' + objectBar();
    if (!detail) return intro + '<div class="cr-scene-grid"><div><div class="cr-stage">' + gameStage(true)
      + '</div><p class="small muted">选一个对象，试试它会动、会发光、会做什么。</p></div><section><h2>给'
      + esc(objects.find(([id]) => id === ui.object)[1]) + '添加能力</h2>' + cards()
      + (ui.object === 'player' ? '<details class="cr-advanced"><summary>主角位置与生命值</summary><div class="cr-fields">'
      + field('X 位置', 'player-x', model.x, 'number') + field('Y 位置', 'player-y', model.y, 'number')
      + field('生命值', 'player-hp', model.hp, 'number') + '</div></details>' : '<p class="small muted">当前画面为主角关卡示意；能力配置保存到所选对象。其他对象的场景绘制待接入。</p>')
      + '<button class="btn soft" data-page="world">画地图与设置关卡</button></section></div></div>';
    const kind = activeKind(); const stored = component(kind); const data = stored || defaults[kind];
    const empty = view.state === 'ability_empty' || !stored;
    const stateNotice = view.state === 'ability_missing' ? notice('引用的外部资源缺失', '当前仅显示内置示意。请选择示例资源，或回资源库重新绑定。', 'warning', 'cr-repair', '改用内置示例')
      : view.state === 'ability_error' ? notice('参数未通过校验', '粒子数须在1～300之间；错误不会覆盖已保存内容。', 'error')
        : ui.error ? notice('还没有保存', esc(ui.error), 'error') : '';
    return intro + '<div class="cr-subheading"><button class="btn ghost" data-cr-back>← 返回画面</button><h2>' + labels[kind]
      + '</h2><span class="pill blue">交互原型 · 效果示意</span></div>' + stateNotice
      + '<div class="cr-workbench"><section><div class="cr-canvas-wrap"><canvas id="cr-canvas" width="800" height="450" aria-label="'
      + labels[kind] + '效果示意">此浏览器不支持画布</canvas></div><div class="cr-playbar">'
      + '<button class="btn" data-cr-pause>' + (ui.paused || view.state === 'ability_paused' ? '继续预览' : '暂停预览') + '</button>'
      + '<button class="btn ghost" data-cr-restart>从头播放</button><output id="cr-stats">等待预览</output></div>'
      + '<p class="small muted">' + ({ physics: '单物体解析运动示意，未集成物理求解器。摩擦、碰撞与传感器完整行为由正式引擎验证。',
        particles: '固定随机种子的小规模CPU粒子示意，未接入引擎渲染与性能预算。',
        skeleton: '内置骨架的关节动画示意，不会把单张图片自动变成可用的骨骼动画。' })[kind] + '</p></section>'
      + '<aside class="panel panel-pad"><h3>' + (empty ? '先选择一个效果' : '选择你想要的效果') + '</h3><div class="cr-presets">'
      + presets[kind].map(([id, name]) => '<button data-cr-preset="' + id + '" class="btn '
        + (stored?.preset === id ? 'primary' : '') + '">' + name + '</button>').join('')
      + '</div><p class="small">' + (stored ? '当前：' + (stored.preset === 'custom' ? '自定义' : presets[kind].find(([id]) => id === stored.preset)?.[1] || '已配置')
        : '示意预览尚未加入对象；选择效果后才会保存。') + '</p>'
      + '<details class="cr-advanced"' + (view.state.endsWith('_advanced') || ui.advanced || ui.error ? ' open' : '') + '><summary>高级参数 · 按需展开</summary>'
      + advancedForm(kind, data) + button('保存高级参数', 'cr-save', 'primary full', 'check') + '</details>'
      + '<details class="cr-advanced"><summary>什么时候播放？</summary><p class="small muted">效果资源和组件只保存配置；受击、技能、触发条件等执行逻辑统一在工作流中配置。</p>'
      + button('查看示例敌人工作流', 'cr-workflow', 'soft full', 'nodes') + '</details>'
      + button('用对话调整这个效果', 'cr-ask', 'full', 'chat') + '</aside></div></div>';
  }
  function saveAdvanced() {
    const kind = activeKind(); const data = clone(component(kind) || defaults[kind]);
    const limits = { gravity: kind === 'physics' ? [0, 30] : [-300, 300], bounce: [0, 1], friction: [0, 1],
      count: [1, 300], lifetime: [0.1, 10], speed: kind === 'skeleton' ? [0.1, 3] : [0, 400],
      size: [1, 30], spread: [0, 360], seed: [0, 9999], boneAngle: [-90, 90] };
    for (const [name, defaultValue] of Object.entries(defaults[kind])) {
      const node = document.getElementById('cr-' + name);
      if (!node) continue;
      const value = typeof defaultValue === 'boolean' ? node.checked : typeof defaultValue === 'number' ? Number(node.value) : node.value;
      if (typeof value === 'number') {
        const [min, max] = limits[name];
        if (!node.value.trim() || !Number.isFinite(value) || value < min || value > max
          || (['count', 'seed'].includes(name) && !Number.isInteger(value))) {
          ui.error = '请检查' + node.closest('label').textContent.trim() + '，允许范围为' + min + '～' + max + '。';
          const old = document.getElementById('cr-inline-error');
          if (old) old.remove();
          const error = document.createElement('p'); error.id = 'cr-inline-error'; error.className = 'cr-error'; error.setAttribute('role', 'alert');
          error.textContent = ui.error; node.closest('details').append(error); node.focus(); return;
        }
      }
      data[name] = value;
    }
    data.preset = 'custom'; ui.advanced = true;
    save(kind, data, '手动调整' + labels[kind]);
  }
  // 对话示例捕获对象和关卡ID，异步期间切换对象不能把补丁写到另一个对象。
  function promptPatch(text, target) {
    if (!target || !/掉落|弹跳|爆炸|火焰|下雨|跑步|待机|攻击动作/.test(text)) return null;
    const match = /掉落/.test(text) ? ['physics', 'drop'] : /弹跳/.test(text) ? ['physics', 'bounce']
      : /火焰/.test(text) ? ['particles', 'fire'] : /下雨/.test(text) ? ['particles', 'rain']
        : /爆炸/.test(text) ? ['particles', 'explosion'] : /跑步/.test(text) ? ['skeleton', 'run']
          : /待机/.test(text) ? ['skeleton', 'idle'] : ['skeleton', 'attack'];
    const [kind, id] = match; const preset = presets[kind].find(([name]) => name === id);
    const data = { ...(model.systems.objects[target]?.[kind] || defaults[kind]), ...preset[2], preset: id };
    return { patch: patchFor(kind, data, target), explanation: '已把' + labels[kind] + '设为“' + preset[1] + '”；配置与手动编辑共用同一份数据。' };
  }
  function click(target) {
    if (target.hasAttribute('data-cr-back')) { go('scene'); return true; }
    if (target.dataset.crObject) { resetClock(); ui.object = target.dataset.crObject; ui.error = ''; render(); return true; }
    if (target.dataset.crOpen) { resetClock(); ui.paused = false; ui.advanced = false; go('scene', target.dataset.crOpen); return true; }
    if (target.dataset.crPreset) {
      const kind = activeKind(); const preset = presets[kind].find(([id]) => id === target.dataset.crPreset);
      if (preset) save(kind, { ...(component(kind) || defaults[kind]), ...preset[2], preset: preset[0] }, '选择' + preset[1]);
      return true;
    }
    if (target.hasAttribute('data-cr-pause')) {
      ui.paused = !(ui.paused || view.state === 'ability_paused');
      if (view.state === 'ability_paused') view.state = activeKind();
      render(); return true;
    }
    if (target.hasAttribute('data-cr-restart')) { resetClock(); ui.paused = false; render(); return true; }
    if (target.dataset.crTemplate) {
      model.genres = [target.dataset.crTemplate]; render(); return true;
    }
    if (target.dataset.action === 'cr-save') { saveAdvanced(); return true; }
    if (target.dataset.action === 'cr-repair') { go('scene', activeKind()); return true; }
    if (target.dataset.action === 'cr-workflow') {
      model.workflowScope = 'client'; model.moduleEditing = false; go('workflow'); return true;
    }
    if (target.dataset.action === 'cr-ask') {
      ui.chatTarget = key(); const kind = activeKind();
      go('workspace'); document.getElementById('chat-input').value = '让' + objects.find(([id]) => id === ui.object)[1]
        + ({ physics: '会弹跳', particles: '播放爆炸效果', skeleton: '做跑步动作' })[kind]; return true;
    }
    return false;
  }
  // 复位时先丢弃旧计时起点，避免渲染清理把已播放时长重新加回来。
  function resetClock() {
    if (ui.raf) cancelAnimationFrame(ui.raf);
    ui.raf = 0; ui.started = 0; ui.elapsed = 0;
  }
  function beforeRender() {
    if (ui.raf) cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    if (ui.started) { ui.elapsed += Math.max(0, performance.now() - ui.started) / 1000; ui.started = 0; }
  }
  // 每次渲染取消旧循环；暂停时保留同一时间，离开工作台后不继续占用画布。
  function afterRender() {
    const canvas = document.getElementById('cr-canvas');
    if (!canvas) return;
    const kind = activeKind(); const data = component(kind) || defaults[kind];
    const paused = ui.paused || view.state === 'ability_paused';
    if (!paused) ui.started = performance.now();
    const draw = (now) => {
      const time = ui.elapsed + (paused ? 0 : (now - ui.started) / 1000);
      ui.stats = EffectsPreview.draw(canvas, kind, data, time) || {};
      canvas.dataset.time = time.toFixed(3);
      const output = document.getElementById('cr-stats');
      if (output) output.textContent = '示意时间 ' + time.toFixed(1) + 's · '
        + (kind === 'particles' ? (ui.stats.liveParticles ?? ui.stats.count ?? '—') + ' 粒子'
          : kind === 'skeleton' ? '预设骨架' : '单物体运动');
      if (!paused) ui.raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
  }
  // 常用例子先呈现，完整类型及联网/时间规则只在用户需要时展开。
  function templates() {
    const examples = [['横版闯关', '跳过障碍，找到终点'], ['动作 RPG', '探索地图，完成任务'], ['回合制 RPG', '组队战斗与成长'],
      ['塔防', '放置防御，保护目标'], ['三消', '交换方块，达成目标'], ['大地图 SLG', '建造基地与策略经营']];
    return '<div class="cr-template-grid">' + examples.map(([name, text]) => '<button class="cr-template '
      + (model.genres.includes(name) ? 'active' : '') + '" data-cr-template="' + name + '">'
      + icon('play') + '<b>' + name + '</b><small>' + text + '</small></button>').join('') + '</div>'
      + '<details class="cr-advanced"><summary>更多类型与混合玩法</summary>' + Studio.genrePicker() + '</details>';
  }
  function options() { return '<details class="cr-advanced"><summary>更多设置：联网、世界结构与屏幕方向</summary>' + Studio.creationSettings() + '</details>'; }
  const catalog = [
    ['画地图', '方格地形、阻挡、事件、出生点与目标', '原型可操作', 'world', 'map_editor'],
    ['数值与成长', '有类型的数据表、外键校验、有限成长曲线', '原型可操作', 'world', 'data_tables'],
    ['任务与对白', '目标、奖励和对白分支配置', '原型可操作', 'world', 'quests'],
    ['工作流', '节点、类型连线、事务、受限逐步调试', '原型可操作', 'workflow', 'normal'],
    ['网络与接口', '多协议配置、OpenAPI文档解析与人工调整', '原型可操作', 'api', 'normal'],
    ['资源库', '素材选择、导入和生成流程', '流程示意', 'assets', 'normal'],
    ['物理求解器', '刚体/触发器/层遮罩/CCD/关节/角色控制器', '待研发', 'scene', 'physics'],
    ['粒子系统', '发射器、曲线、子发射器、材质与预算', '待研发', 'scene', 'particles'],
    ['骨骼与动画', '绑定/蒙皮/IK/状态机/关键帧/事件', '待研发', 'scene', 'skeleton'],
    ['渲染与摄像机', '2D批处理/图集/排序/裁剪/灯光/视差/适配', '待研发'],
    ['场景与资源管线', '对象/组件/预制体/引用/版本迁移/异步加载', '待研发'],
    ['地图与导航', '等距/六边形/分块/大地图/寻路/动态避障', '待研发'],
    ['音频与界面', '音频总线/混音/空间声/布局/焦点/本地化', '待研发'],
    ['玩法系统', '战斗/技能/Buff/背包/装备/经济/SLG队列与迷雾', '待研发'],
    ['服务端运行时', '权威模拟/房间/分区/AOI/持久化/幂等/运维', '待研发'],
    ['Android OpenCode', 'Android本机核心/API/进程沙箱/模型网关', '待技术验证'],
    ['跨平台发布', 'H5/APK/微信与抖音小游戏构建与能力检查', '待技术验证'],
    ['诊断与协作', '性能采样/日志定位/存档迁移/版本合并/恢复', '待研发'],
  ];
  function toolsPage() {
    const list = view.state === 'no_results' ? [] : catalog;
    return heading('更多工具', '先完成一个能试玩的小改动，需要更多能力时再打开。')
      + '<div class="cr-tool-grid">' + list.map(([title, text, status, pageId, state]) => '<section class="panel panel-pad"><span class="pill '
        + (status === '原型可操作' ? 'green' : '') + '">' + status + '</span><h3>' + title + '</h3><p class="small muted">' + text + '</p>'
        + (pageId ? '<button class="btn soft" data-cr-route="' + pageId + '" data-cr-state="' + state + '">'
          + (status === '待研发' ? '查看效果示意' : '打开工具') + '</button>' : '<p class="small">已纳入能力清单，当前没有可运行编辑器。</p>') + '</section>').join('')
      + '</div>' + (!list.length ? notice('没有匹配工具', '请返回全部工具。', '', 'cr-tools-reset', '查看全部工具') : '');
  }
  // 暂停时切换语言也重画同一时刻，不重置播放、选择或参数。
  I18n.subscribe(() => {
    const canvas = document.getElementById('cr-canvas');
    if (canvas) EffectsPreview.draw(canvas, activeKind(), component(activeKind()) || defaults[activeKind()], Number(canvas.dataset.time || 0));
  });
  function change(inputNode) { return inputNode.id.startsWith('cr-'); }
  return { ui, init, valid, page, templates, options, toolsPage, promptPatch, beforeRender, afterRender, change,
    click(target) {
      if (target.dataset.crRoute) { go(target.dataset.crRoute, target.dataset.crState); return true; }
      if (target.dataset.action === 'cr-tools-reset') { go('tools'); return true; }
      return click(target);
    } };
})();
