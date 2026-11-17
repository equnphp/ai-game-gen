/* 地图、数值和任务复用同一项目事务；这里编辑配置数据，不执行真实游戏或服务端逻辑。 */
/* global I18n, model, view, esc, button, field, heading, notice -- 复用现有控件。 */
/* global render, commit, Studio, Isometric, go, toast -- 共享项目事务。 */
/* exported Gameplay -- 由主界面加载并转发页面、事件和持久化快照。 */
"use strict";
const Gameplay = (() => {
  const ui = { brush: "grass", level: "level-01", actor: "hero", quest: "quest-01", error: "" };
  const terrainNames = { grass: "草地", water: "水面", forest: "树林" };
  const growthNames = { gentle: "慢慢成长", steady: "均衡成长", quick: "快速成长" };
  const outcomeNames = { accept: "接取任务", progress: "询问进度", close: "结束对话" };

  // 已有项目不重置，保持刷新、撤销和手工修改使用相同的数据版本。
  function init() {
    if (valid(model.gameplay)) return;
    if (model.gameplay) ui.error = "玩法配置未通过恢复校验，已载入示例模板；请检查导入的数据。";
    model.gameplay = {
      schemaVersion: 1,
      maps: ["星岛 · 起点", "月光森林", "遗迹守卫"].map((name, index) => ({
        id: "level-0" + (index + 1), name, width: 10, height: 6, spawn: 10, exit: 49,
        cells: Array.from({ length: 60 }, (_, cell) => ({
          terrain: [5, 6, 15, 16].includes(cell) ? "water" : cell % 13 === 0 ? "forest" : "grass",
          blocked: cell === 25 || cell === 35, event: cell === 28 ? "chest" : "",
        })),
        goal: { type: index === 1 ? "defeat" : "reach", count: 3, reward: (index + 1) * 100 },
      })),
      actors: [
        { id: "hero", name: "星岛勇者", hp: 100, attack: 12, growth: "steady", dropItem: "potion" },
        { id: "slime", name: "森林史莱姆", hp: 35, attack: 5, growth: "gentle", dropItem: "mushroom" },
        { id: "guardian", name: "遗迹守卫", hp: 140, attack: 18, growth: "quick", dropItem: "potion" },
      ],
      items: [{ id: "potion", name: "恢复药水", heal: 30 }, { id: "mushroom", name: "森林蘑菇", heal: 15 }],
      quests: [{ id: "quest-01", title: "村长的小请求", target: "slime", count: 3,
        rewardItem: "potion", rewardCount: 2, npc: "村长", line: "森林里出现了史莱姆，能帮我赶走3只吗？",
        branches: [{ text: "交给我吧", outcome: "accept" }, { text: "我再准备一下", outcome: "close" }] }],
    };
  }

  // 恢复数据按当前原型支持范围校验；限制大小和引用，防止坏存档进入表单或画布。
  function valid(data) {
    const record = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).every((key) => keys.includes(key));
    const number = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    const label = (value, max = 80) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
    const id = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
    const list = (value, max) => Array.isArray(value) && value.length >= 1 && value.length <= max;
    const unique = (values) => values.every((item) => item && id(item.id))
      && new Set(values.map((item) => item.id)).size === values.length;
    if (!record(data, ["schemaVersion", "maps", "actors", "items", "quests"]) || data.schemaVersion !== 1
      || !list(data.maps, 80) || !list(data.actors, 256) || !list(data.items, 512) || !list(data.quests, 256)
      || ![data.maps, data.actors, data.items, data.quests].every(unique)) return false;
    const itemIds = new Set(data.items.map((item) => item.id));
    const actorIds = new Set(data.actors.map((item) => item.id));
    if (!data.items.every((item) => record(item, ["id", "name", "heal"])
      && label(item.name) && number(item.heal, 0, 9999))) return false;
    if (!data.actors.every((actor) => record(actor, ["id", "name", "hp", "attack", "growth", "dropItem"])
      && label(actor.name) && number(actor.hp, 1, 9999) && number(actor.attack, 0, 9999)
      && typeof actor.growth === "string" && Object.hasOwn(growthNames, actor.growth) && itemIds.has(actor.dropItem))) return false;
    if (!data.maps.every((map) => record(map, ["id", "name", "width", "height", "spawn", "exit", "cells", "goal", "iso"])
      && (map.iso === undefined || Isometric.valid(map.iso, map.cells?.length))
      && label(map.name) && number(map.width, 1, 64) && number(map.height, 1, 64)
      && map.width * map.height <= 4096 && Array.isArray(map.cells) && map.cells.length === map.width * map.height
      && map.cells.every((cell) => record(cell, ["terrain", "blocked", "event"])
        && typeof cell.terrain === "string" && Object.hasOwn(terrainNames, cell.terrain) && typeof cell.blocked === "boolean"
        && ["", "chest"].includes(cell.event))
      && number(map.spawn, 0, map.cells.length - 1) && number(map.exit, 0, map.cells.length - 1)
      && map.spawn !== map.exit && !map.cells[map.spawn].blocked && !map.cells[map.exit].blocked
      && record(map.goal, ["type", "count", "reward"]) && ["reach", "defeat"].includes(map.goal.type)
      && number(map.goal.count, 1, 99) && number(map.goal.reward, 0, 9999))) return false;
    return data.quests.every((quest) => record(quest,
      ["id", "title", "target", "count", "rewardItem", "rewardCount", "npc", "line", "branches"])
      && label(quest.title) && label(quest.npc) && label(quest.line, 500) && actorIds.has(quest.target)
      && quest.target !== "hero" && itemIds.has(quest.rewardItem) && number(quest.count, 1, 99)
      && number(quest.rewardCount, 1, 99) && Array.isArray(quest.branches) && quest.branches.length === 2
      && quest.branches.every((branch) => record(branch, ["text", "outcome"])
        && label(branch.text) && typeof branch.outcome === "string" && Object.hasOwn(outcomeNames, branch.outcome)));
  }

  // 快照只包含可序列化数据；视图选择不会混入发布配置。
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  // 修改完整副本后一次提交，避免无效表单或撤销留下半份配置。
  function save(title, edit) {
    const next = clone(model.gameplay);
    edit(next);
    commit(title, { gameplay: next });
    ui.error = "";
    render();
    toast("已保存到当前项目 · r" + model.revision);
  }

  // 错误反馈不重绘表单，保留新手刚输入的内容以便直接修正。
  function fail(message) {
    ui.error = message;
    const region = document.getElementById("gp-feedback");
    if (region) region.innerHTML = notice("还差一步", esc(message), "error");
    return false;
  }

  // 统一选项把显示名称与稳定ID分离，重命名不会破坏引用。
  function select(label, id, value, entries) {
    return '<label class="field">' + esc(label) + '<select id="' + id + '">'
      + entries.map(([key, name]) => '<option' + (/(?:target|drop|reward)/.test(id) ? ' translate="no"' : '') + ' value="' + esc(key) + '"'
        + (key === value ? " selected" : "") + '>' + esc(name) + '</option>').join("") + '</select></label>';
  }

  // 字符串和整数都先校验，原型不接受任意表达式或隐式类型转换。
  function text(id) { return document.getElementById(id).value.trim(); }
  function integer(id, min = 0, max = 9999) {
    const value = text(id);
    return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
  }

  // 页面入口先给可完成的三个任务，专业能力只在用户主动展开时出现。
  function page() {
    init();
    const type = view.state;
    const pages = [["map_editor", "画地图", "scene"], ["data_tables", "调角色数值", "grid"],
      ["quests", "加任务和对话", "chat"]];
    const titles = { map_editor: ["画出你的第一关", "先选笔刷，再点击格子。起点、终点和目标都能随时改。"],
      data_tables: ["让角色更强一点", "先改生命和攻击，再选择成长速度。完整对话联动待研发，本轮先保存配置。"],
      quests: ["给冒险加一个小任务", "选目标、给奖励，再让NPC说一句话。从简单任务开始。"] };
    const current = titles[type] || titles.map_editor;
    const tabs = '<nav class="gp-tabs" aria-label="玩法编辑步骤">' + pages.map(([id, label, glyph], index) =>
      button((index + 1) + ' ' + label, "gp-page", id === type ? "primary" : "", glyph,
        'data-gp-page="' + id + '"' + (id === type ? ' aria-current="page"' : ""))).join("") + '</nav>';
    const body = type === "quests" ? questPage() : type === "data_tables" ? dataPage() : mapPage();
    return '<section class="gp-page">' + heading(current[0], current[1]) + tabs
      + '<div id="gp-feedback" aria-live="polite">' + (ui.error ? notice("还差一步", esc(ui.error), "error") : "")
      + '</div>' + body + '<p class="gp-boundary">交互原型：这里的编辑会真实保存到本地项目。'
      + '游戏运行、战斗、寻路、剧情推进与发布尚未接入。</p></section>';
  }

  // 每关独立保存格子、起终点和目标，切关不会把另一关的参数覆盖掉。
  function activeMap() { return model.gameplay.maps.find((item) => item.id === model.activeLevel) || model.gameplay.maps[0]; }
  function activeActor() { return model.gameplay.actors.find((item) => item.id === ui.actor) || model.gameplay.actors[0]; }
  function activeQuest() { return model.gameplay.quests.find((item) => item.id === ui.quest) || model.gameplay.quests[0]; }

  // 地形与阻挡/事件分别存储，视觉上的水面不会暗中改变通行规则。
  function mapCells(map) {
    const labels = { blocked: "阻挡", chest: "宝箱事件", start: "起点", exit: "终点" };
    return '<div class="gp-map-scroll" tabindex="0" aria-label="地图画布，可横向滚动">'
      + '<div class="gp-map" style="grid-template-columns:repeat(' + map.width + ',minmax(44px,1fr));min-width:'
      + (map.width * 44) + 'px" role="group" aria-label="点击格子使用当前笔刷">' + map.cells.map((cell, index) => {
        const mark = index === map.spawn ? "start" : index === map.exit ? "exit" : cell.blocked ? "blocked" : cell.event;
        const textMark = { start: "起", exit: "终", blocked: "×", chest: "宝" }[mark] || "";
        const label = '第' + (Math.floor(index / map.width) + 1) + '行第' + (index % map.width + 1) + '列，'
          + terrainNames[cell.terrain] + (mark ? '，' + labels[mark] : "");
        return '<button type="button" class="gp-cell ' + esc(cell.terrain) + ' ' + esc(mark)
          + '" data-gp-cell="' + index + '" aria-label="' + esc(label) + '"><span>' + textMark + '</span></button>';
      }).join("") + '</div></div>';
  }

  // 高级工具用折叠区说明边界，未实现的寻路和六边格不伪装成可运行能力。
  function mapAdvanced(map) {
    return '<details class="gp-advanced panel panel-pad"><summary>需要更精细？打开地图进阶选项</summary>'
      + '<div class="gp-advanced-body"><p>当前地图：' + esc(map.id) + ' · ' + map.width + ' × ' + map.height + ' 方格。</p>'
      + '<ul><li>地形、阻挡、事件是三份独立数据，保存时一起进入项目事务。</li>'
      + '<li>图层重排、导航代价/路径预览、波次刷怪、六边格与大地图区块：待研发。</li>'
      + '<li>宝箱是事件标记；实际奖励与触发逻辑要连接工作流。</li></ul>'
      + workflowButton("levels", "打开关卡规则工作流") + '</div></details>';
  }

  // 新手只需选地形和目标，画布保留足够大的点击区域并允许手机横向滚动。
  function mapPage() {
    const map = activeMap();
    const brushes = [["grass", "草地"], ["water", "水面"], ["forest", "树林"], ["block", "阻挡"],
      ["event", "宝箱事件"], ["start", "起点"], ["exit", "终点"], ["erase", "擦除标记"]];
    const choices = '<div class="gp-levels">' + model.gameplay.maps.map((item, index) => button(
      '第' + (index + 1) + '关 · ' + item.name, "gp-level", item.id === map.id ? "soft active" : "",
      "", 'data-gp-level="' + esc(item.id) + '"' + I18n.terms(item.name) + (item.id === map.id ? ' aria-pressed="true"' : ""))).join("") + '</div>';
    const canvas = '<section class="panel panel-pad"><div class="row between"><h2>1. 画地图</h2>'
      + '<span class="pill blue">每次点击自动保存</span></div><div class="gp-brushes">'
      + brushes.map(([id, name]) => button(name, "gp-brush", ui.brush === id ? "primary" : "", "",
        'data-gp-brush="' + id + '" aria-pressed="' + (ui.brush === id) + '"')).join("") + '</div>'
      + '<p class="small muted">水面和树林只改外观；用“阻挡”设置不可通行。手机上可左右滑动画布。</p>'
      + mapCells(map) + '<div class="gp-legend"><span>起 · 出生点</span><span>终 · 到达点</span>'
      + '<span>× · 阻挡</span><span>宝 · 事件标记</span></div></section>';
    const settings = '<aside class="panel panel-pad"><h2>2. 设定通关目标</h2>'
      + field("关卡名称", "gp-map-name", map.name)
      + select("怎样算通关？", "gp-goal-type", map.goal.type, [["reach", "到达终点"], ["defeat", "打败指定数量敌人"]])
      + field("需要打败几只？", "gp-goal-count", map.goal.count, "number", "仅在打败敌人目标时使用，1到99。")
      + field("通关金币奖励", "gp-goal-reward", map.goal.reward, "number")
      + button("保存关卡目标", "gp-save-map", "primary", "check")
      + '<p class="small muted">设置会保存；敌人统计、通关和发奖仍需引擎与工作流运行。</p></aside>';
    return button("斜45°立体地图", "iso-open", "primary", "layers", 'data-iso-action="tab-isometric"') + choices + '<div class="gp-layout">' + canvas + settings + '</div>' + mapAdvanced(map);
  }

  // 预置成长曲线只计算展示数据，不把任意脚本或公式作为玩法入口。
  function growthPreview(actor) {
    const rate = { gentle: 1.08, steady: 1.15, quick: 1.22 }[actor.growth];
    return '<div class="gp-growth"><h3>成长后的样子</h3><p class="small muted">已保存数据 · 预置曲线的计算示例</p>'
      + '<table><caption class="sr-only">角色成长预览</caption><thead><tr><th>等级</th><th>生命</th><th>攻击</th>'
      + '</tr></thead><tbody>' + [1, 5, 10].map((level) => '<tr><th>' + level + '级</th><td>'
        + Math.round(actor.hp * Math.pow(rate, level - 1)) + '</td><td>'
        + Math.round(actor.attack * Math.pow(rate, level - 1)) + '</td></tr>').join("") + '</tbody></table></div>';
  }

  // 有限字段承担真实编辑任务，高级关联检查不占新手默认空间。
  function dataPage() {
    const actor = activeActor();
    const items = model.gameplay.items;
    const list = '<div class="gp-levels">' + model.gameplay.actors.map((item) => button(item.name,
      "gp-actor", item.id === actor.id ? "soft active" : "", "", 'data-gp-actor="' + esc(item.id) + '"' + I18n.terms(item.name))).join("") + '</div>';
    const form = '<section class="panel panel-pad"><h2>角色属性</h2><div class="gp-fields">'
      + field("角色名称", "gp-actor-name", actor.name) + field("初始生命", "gp-actor-hp", actor.hp, "number")
      + field("初始攻击", "gp-actor-attack", actor.attack, "number")
      + select("成长速度", "gp-actor-growth", actor.growth, Object.entries(growthNames))
      + select("掉落什么物品？", "gp-actor-drop", actor.dropItem, items.map((item) => [item.id, item.name]))
      + '</div><details class="gp-advanced"><summary>进阶：检查数据关联</summary><div class="gp-advanced-body">'
      + '<p>角色ID：<code>' + esc(actor.id) + '</code>。名称可改，ID保持稳定。</p>'
      + field("覆盖掉落物品ID（留空使用上方选择）", "gp-actor-ref", "", "text", "填写不存在的ID会阻止保存。")
      + '<p class="small muted">可用ID：' + items.map((item) => esc(item.id)).join("、") + '。</p>'
      + '<p class="small muted">批量导入、装备/状态叠加、曲线编辑、版本对比：待研发。</p></div></details>'
      + button("保存角色数值", "gp-save-actor", "primary", "check") + '</section>';
    const catalog = '<section class="panel panel-pad gp-items"><h2>奖励物品</h2>' + items.map((item) =>
      '<div class="gp-item-row"><b>' + I18n.user(item.name) + '</b><span>恢复生命 ' + item.heal + '</span>'
      + '<small>物品ID：' + esc(item.id) + '</small></div>').join("")
      + '<p class="small muted">本轮物品为只读示例；任务奖励与掉落引用同一份物品定义。</p></section>';
    return list + '<div class="gp-layout">' + form + '<aside>' + growthPreview(actor) + catalog + '</aside></div>';
  }

  // 对话分支保存明确选项；选项效果只声明意图，执行仍需关联工作流。
  function branchFields(quest) {
    return quest.branches.map((branch, index) => '<div class="gp-dialogue-branch"><b>选项 ' + (index + 1) + '</b>'
      + field("玩家怎么回答？", 'gp-branch-text-' + index, branch.text)
      + select("选择后做什么？", 'gp-branch-outcome-' + index, branch.outcome, Object.entries(outcomeNames))
      + '</div>').join("");
  }

  // 任务和奖励使用稳定引用，台词及分支与任务一起原子保存。
  function questPage() {
    const quest = activeQuest();
    const options = model.gameplay.actors.filter((item) => item.id !== "hero").map((item) => [item.id, item.name]);
    const items = model.gameplay.items.map((item) => [item.id, item.name]);
    return '<div class="gp-layout"><section class="panel panel-pad"><h2>1. 设个简单目标</h2>'
      + field("任务名称", "gp-quest-title", quest.title)
      + select("要打败谁？", "gp-quest-target", quest.target, options)
      + '<div class="gp-fields">' + field("需要几只？", "gp-quest-count", quest.count, "number")
      + select("完成后奖励什么？", "gp-quest-reward", quest.rewardItem, items)
      + field("奖励数量", "gp-quest-reward-count", quest.rewardCount, "number") + '</div>'
      + '<details class="gp-advanced"><summary>进阶：任务状态和关联</summary><div class="gp-advanced-body">'
      + '<p>任务ID：<code>' + esc(quest.id) + '</code>。目标和奖励引用角色表与物品表。</p>'
      + '<p>接取 → 进行中 → 完成 → 已领奖，需要工作流运行器接入。'
      + '任务链、失败条件、复合目标、存档迁移：待研发。</p>'
      + workflowButton("rpg", "打开关联任务工作流") + '</div></details></section>'
      + '<section class="panel panel-pad"><h2>2. 让NPC开口</h2>' + field("谁在说话？", "gp-quest-npc", quest.npc)
      + '<label class="field">第一句台词<textarea id="gp-quest-line" rows="3" maxlength="500">'
      + esc(quest.line) + '</textarea></label>' + branchFields(quest)
      + '<p class="small muted">保存选项配置，不在此模拟真实任务推进。'
      + '正式版本将从相同配置编译工作流，本轮尚未贯通运行图。</p></section></div>'
      + '<div class="gp-save-bar">' + button("保存任务和对话", "gp-save-quest", "primary", "check")
      + '<span class="small muted">本轮保存配置；完整对话与工作流联动待研发</span></div>';
  }

  // 关联入口复用已有模块图；显式说明图是示例，避免声称已生成完整规则。
  function workflowButton(module, label) {
    return button(label, "client-workflow", "soft", "nodes", 'data-gp-module="' + module + '"')
      + '<p class="small muted">关联模块示例图；本轮配置尚未编译为真实游戏运行图。</p>';
  }

  // 标记层与起终点互相校验，禁止把出生点放进阻挡造成明显坏配置。
  function paint(index) {
    const map = activeMap();
    if (!Number.isInteger(index) || index < 0 || index >= map.cells.length) return true;
    if ((ui.brush === "block") && [map.spawn, map.exit].includes(index)) {
      return fail("起点和终点不能被阻挡，请先移动它们。");
    }
    if (["start", "exit"].includes(ui.brush) && map.cells[index].blocked) {
      return fail("这个格子有阻挡，请先用擦除标记清除。");
    }
    if ((ui.brush === "start" && index === map.exit) || (ui.brush === "exit" && index === map.spawn)) {
      return fail("起点和终点需要放在不同格子。");
    }
    save("修改关卡地图", (data) => {
      const target = data.maps.find((item) => item.id === map.id);
      const cell = target.cells[index];
      if (terrainNames[ui.brush]) cell.terrain = ui.brush;
      else if (ui.brush === "block") cell.blocked = !cell.blocked;
      else if (ui.brush === "event") cell.event = "chest";
      else if (ui.brush === "erase") { cell.blocked = false; cell.event = ""; }
      else if (ui.brush === "start") target.spawn = index;
      else if (ui.brush === "exit") target.exit = index;
    });
    return true;
  }

  // 范围与枚举在提交前校验，失败不改变项目版本或原始配置。
  function saveMap() {
    const name = text("gp-map-name");
    const count = integer("gp-goal-count", 1, 99);
    const reward = integer("gp-goal-reward");
    const type = text("gp-goal-type");
    if (!name || name.length > 80 || count === null || reward === null || !["reach", "defeat"].includes(type)) {
      return fail("关卡名称填1到80字；目标数量1到99；金币0到9999。请检查这些设置。");
    }
    save("修改关卡目标", (data) => Object.assign(data.maps.find((item) => item.id === activeMap().id),
      { name, goal: { type, count, reward } }));
    return true;
  }

  // 关联ID通过定义表校验，未知物品不能静默替换成默认奖励。
  function saveActor() {
    const name = text("gp-actor-name");
    const hp = integer("gp-actor-hp", 1);
    const attack = integer("gp-actor-attack");
    const growth = text("gp-actor-growth");
    const dropItem = text("gp-actor-ref") || text("gp-actor-drop");
    if (!name || name.length > 80 || hp === null || attack === null || !growthNames[growth]) {
      return fail("角色名称填1到80字；生命1到9999；攻击0到9999，并选择已有成长预设。");
    }
    if (!model.gameplay.items.some((item) => item.id === dropItem)) return fail("找不到这个物品ID，请从奖励物品表选择。");
    save("修改角色数值", (data) => Object.assign(data.actors.find((item) => item.id === activeActor().id),
      { name, hp, attack, growth, dropItem }));
    return true;
  }

  // 台词、目标与奖励一并验证，避免表单只保存一半造成任务和对白脱节。
  function saveQuest() {
    const title = text("gp-quest-title");
    const npc = text("gp-quest-npc");
    const line = text("gp-quest-line");
    const count = integer("gp-quest-count", 1, 99);
    const rewardCount = integer("gp-quest-reward-count", 1, 99);
    const target = text("gp-quest-target");
    const rewardItem = text("gp-quest-reward");
    const branches = [0, 1].map((index) => ({ text: text('gp-branch-text-' + index),
      outcome: text('gp-branch-outcome-' + index) }));
    if (!title || title.length > 80 || !npc || npc.length > 80 || !line || line.length > 500
      || count === null || rewardCount === null || branches.some((item) => !item.text || item.text.length > 80
        || !outcomeNames[item.outcome])) return fail("请填写名称、台词和两个选项；目标及奖励数量填1到99。");
    if (!model.gameplay.actors.some((item) => item.id === target && item.id !== "hero")
      || !model.gameplay.items.some((item) => item.id === rewardItem)) {
      return fail("任务目标或奖励引用失效，请重新选择。");
    }
    save("修改任务和对话", (data) => Object.assign(data.quests.find((item) => item.id === activeQuest().id),
      { title, npc, line, count, rewardCount, target, rewardItem, branches }));
    return true;
  }

  // 先由本模块消费关联工作流入口，防止通用动作丢失当前任务或关卡上下文。
  function click(target) {
    const data = target.dataset;
    if (data.gpPage) { ui.error = ""; go("world", data.gpPage); }
    else if (data.gpLevel) { ui.level = data.gpLevel; model.activeLevel = data.gpLevel; ui.error = ""; render(); }
    else if (data.gpActor) { ui.actor = data.gpActor; ui.error = ""; render(); }
    else if (data.gpBrush) { ui.brush = data.gpBrush; ui.error = ""; render(); }
    else if (data.gpCell !== undefined) { paint(Number(data.gpCell)); }
    else if (data.gpModule) {
      Studio.ui.worldTab = data.gpModule;
      Studio.ui.module = data.gpModule === "rpg" ? "任务与目标" : "胜利与失败";
      model.activeLevel = activeMap().id;
      model.workflowScope = "client";
      model.moduleEditing = true;
      go("workflow", "selected");
    } else if (data.action === "gp-save-map") saveMap();
    else if (data.action === "gp-save-actor") saveActor();
    else if (data.action === "gp-save-quest") saveQuest();
    else return false;
    return true;
  }

  // 输入过程不触发重绘，避免手机输入法组合输入和光标位置被打断。
  function change(input) { return input.id.startsWith("gp-"); }

  // 页面渲染后的辅助动作不写项目数据，保持保存和撤销边界明确。
  function afterRender() {
    const count = document.getElementById("gp-goal-count");
    const type = document.getElementById("gp-goal-type");
    if (count && type) {
      const hint = count.parentElement.querySelector("small");
      if (hint) { hint.id = "gp-goal-count-hint"; count.setAttribute("aria-describedby", hint.id); }
    }
  }
  return { init, valid, page, click, change, afterRender };
})();
