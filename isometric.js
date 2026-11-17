/* 等距地图是可操作产品原型；所有编辑复用地图文档与事务，试玩状态不写回项目。 */
/* global I18n, Gameplay, Studio, Workflow, model, view, esc, button, render, commit, go, undoChange -- 共用现有编辑与持久化边界。 */
/* exported Isometric -- 主页面和地图恢复校验复用此模块。 */
"use strict";
const Isometric = (() => {
  const ui = { map: "level-01", brush: "select", cell: 23, surface: "ground", zoom: 1, top: false,
    advanced: false, route: null, start: null, finish: null, step: 0, playing: false, timer: null, error: "", draft: null };
  const brushes = { select: "选择", grass: "草地", water: "水面", forest: "树林", house: "小屋", chest: "宝箱",
    raise: "抬高", lower: "降低", ramp: "坡道", bridge: "桥梁", block: "阻挡", erase: "擦除物体" };
  const states = ["isometric", "iso_height", "iso_path", "iso_level", "iso_landscape", "iso_invalid", "iso_empty"];
  // 旧方格地图不被隐式改写；第一次提交等距编辑时才物化这份可撤销的配置。
  function defaults(map) {
    const size = map.cells.length;
    return { version: 1, occlusion: 35,
      heights: Array.from({ length: size }, (_, i) => i % map.width >= 7 && i < map.width * 3 ? 1 : 0),
      objects: Array.from({ length: size }, (_, i) => i === 23 ? "house" : [2, 31, 43].includes(i) ? "tree" : ""),
      bridges: Array.from({ length: size }, (_, i) => [5, 15].includes(i)),
      ramps: Array.from({ length: size }, (_, i) => [4, 14, 27].includes(i)) };
  }
  // 导入字段只接受有界结构，避免坏草稿以视觉偏移冒充可通行地形。
  function valid(data, size) {
    if (!data || data.version !== 1 || !Number.isInteger(data.occlusion) || data.occlusion < 0 || data.occlusion > 100) return false;
    if (Object.keys(data).some(key => !["version", "occlusion", "heights", "objects", "bridges", "ramps"].includes(key))) return false;
    return ["heights", "objects", "bridges", "ramps"].every(key => Array.isArray(data[key]) && data[key].length === size)
      && data.heights.every(n => Number.isInteger(n) && n >= 0 && n <= 3)
      && data.objects.every(name => ["", "house", "tree"].includes(name))
      && [...data.bridges, ...data.ramps].every(value => typeof value === "boolean");
  }
  // 地图ID与原有关卡一致；名称、起终点和通关参数不另存一份。
  function map() { return model.gameplay.maps.find(item => item.id === model.activeLevel) || model.gameplay.maps[0]; }
  function config(target = map()) { return target.iso || defaults(target); }
  function t(value) { return I18n.translate(value); }
  function node(index, surface = "ground") { return { index, surface }; }
  function key(point) { return point.index + ":" + point.surface; }
  // 地面和桥面是两个逻辑节点；透明显示只影响绘制，不改变通行数据。
  function allowed(point, target = map(), iso = config(target)) {
    const cell = target.cells[point.index];
    if (!cell || cell.blocked) return false;
    if (point.surface === "bridge") return iso.bridges[point.index];
    return cell.terrain !== "water" && !iso.objects[point.index];
  }
  function height(point, iso = config()) { return iso.heights[point.index] + (point.surface === "bridge" ? 1 : 0); }
  // 路径演示按逻辑格和显式坡道连接，桥下不自动跳到桥上。
  function neighbors(point, target = map(), iso = config(target)) {
    const x = point.index % target.width;
    const y = Math.floor(point.index / target.width);
    const result = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (x + dx < 0 || x + dx >= target.width || y + dy < 0 || y + dy >= target.height) continue;
      const index = (y + dy) * target.width + x + dx;
      for (const surface of ["ground", "bridge"]) {
        const next = node(index, surface);
        const difference = Math.abs(height(point, iso) - height(next, iso));
        const ramp = iso.ramps[point.index] || iso.ramps[index];
        if (allowed(next, target, iso) && (point.surface === surface || ramp) && (difference === 0 || (difference === 1 && ramp))) {
          result.push(next);
        }
      }
    }
    return result;
  }
  // 小样例使用有限广度搜索；失败有明确结果，不画穿墙的直线。
  function findPath(start, finish, target = map(), iso = config(target)) {
    if (!allowed(start, target, iso) || !allowed(finish, target, iso)) return [];
    const queue = [start];
    const seen = new Map([[key(start), null]]);
    const points = new Map([[key(start), start]]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (key(current) === key(finish)) {
        const route = [];
        for (let at = key(finish); at !== null; at = seen.get(at)) route.unshift(points.get(at));
        return route;
      }
      for (const next of neighbors(current, target, iso)) {
        if (seen.has(key(next))) continue;
        seen.set(key(next), key(current)); points.set(key(next), next); queue.push(next);
      }
    }
    return [];
  }
  // 平面逆投影不用于多层命中；每个渲染地块直接携带稳定的格索引。
  function position(index, elevation = 0, target = map()) {
    const x = index % target.width;
    const y = Math.floor(index / target.width);
    return ui.top ? [100 + x * 59, 55 + y * 59 - elevation * 5]
      : [380 + (x - y) * 38, 75 + (x + y) * 19 - elevation * 28];
  }
  function diamond(x, y, fill, stroke = "#ffffff80") {
    return '<polygon points="' + [[x, y - 19], [x + 38, y], [x, y + 19], [x - 38, y]].map(p => p.join(",")).join(" ")
      + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
  }
  // 地形、桥面与物体分别绘制；鼠标和键盘都能选择同一格。
  function tile(index, target, iso) {
    const cell = target.cells[index];
    const elevation = iso.heights[index];
    const [x, y] = position(index, elevation, target);
    const fill = cell.terrain === "water" ? "#7dcbd3" : cell.terrain === "forest" ? "#86b49a" : "#b4d1a2";
    const selected = index === ui.cell;
    const top = ui.top ? '<rect x="' + (x - 27) + '" y="' + (y - 27) + '" width="54" height="54" rx="4" fill="' + fill + '"/>'
      : (elevation ? '<path d="M' + (x - 38) + ',' + y + 'l38,19 38,-19v' + elevation * 28 + 'l-38,19 -38,-19Z" fill="#809b73"/>'
        : "") + diamond(x, y, fill);
    return '<g data-iso-cell="' + index + '" role="button" tabindex="0" aria-label="' + esc(t("选择地块") + " " + (index + 1))
      + '" class="iso-tile' + (selected ? " selected" : "") + '">' + top
      + (cell.terrain === "water" ? '<path d="M' + (x - 13) + ',' + y + 'q7,-5 13,0t13,0" fill="none" stroke="#e5fbff"/>' : "")
      + (cell.blocked ? '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" fill="#a3554c">×</text>' : "")
      + (selected ? '<circle cx="' + x + '" cy="' + y + '" r="15" fill="#4e76e522" stroke="#5675df" stroke-width="3"/>' : "")
      + '</g>';
  }
  // 建筑底座与脚点固定在逻辑格，遮挡预览只淡化美术部件。
  function objectArt(index, target, iso) {
    const [x, y] = position(index, iso.heights[index], target);
    const object = iso.objects[index];
    const opacity = ui.occluded && object === "house" ? iso.occlusion / 100 : 1;
    let art = "";
    if (object === "house") art = '<g opacity="' + opacity + '"><path d="M-30,-7v-40l29,-15 30,15v40L0,9Z" fill="#f7ead2"/>'
      + '<path d="M0,-47v56l29,-16v-40Z" fill="#dfc6a4"/><path d="M-40,-43L-9,-79 40,-46 0,-23Z" fill="#8b9cc5"/>'
      + '<path d="M-40,-43L-9,-79 -7,-48 0,-23Z" fill="#657da8"/><path d="M9,-4v-22l12,-6v22Z" fill="#897666"/>'
      + '<path d="M-19,-22v-12l10,5v12Z" fill="#ffe4a3"/><path d="M16,-65v-20l8,5v20" fill="#c0b4a3"/></g>';
    if (object === "tree") art = '<ellipse cy="3" rx="19" ry="8" fill="#5b896744"/><path d="M-3,0v-38h7V0" fill="#8c8c6b"/>'
      + '<path d="M0,-73 -24,-32h12l-20,21q32,22 64,0L12,-32h12Z" fill="#487c6a"/><path d="M0,-73v70q18,2 32,-8L12,-32h12Z" fill="#608d73"/>';
    if (target.cells[index].event === "chest") art += '<path d="M-13,-4v-14q12,-13 26,0v14l-13,7Z" fill="#d9a759" stroke="#9f784c"/>'
      + '<path d="M0,-22v24" stroke="#ffdf8f" stroke-width="4"/>';
    if (iso.ramps[index]) art += '<path d="M-23,2l24,-16L23,-1 0,14Z" fill="#d5c49c" stroke="#f7e7bc"/>'
      + '<path d="M-13,-3l24,12M-5,-8l24,12" stroke="#9a977d"/>';
    if (iso.bridges[index]) art += '<g transform="translate(0,-28)">' + diamond(0, 0, "#bd9d78")
      + '<path d="M-34,-3L2,15M-20,-10l36,18M-5,-17l36,18" stroke="#f6d6a8" stroke-width="3"/></g>';
    return art ? '<g pointer-events="none" transform="translate(' + x + ',' + y + ')">' + art + '</g>' : "";
  }
  // 路径与人物都在逻辑节点上定位；试玩不会向地图写入运行位置。
  function routeArt(target, iso, onlyPath = false) {
    const route = ui.route?.length ? ui.route : [];
    const path = route.map(p => position(p.index, height(p, iso), target).join(",")).join(" ");
    const point = route[ui.step] || node(target.spawn);
    const [x, y] = position(point.index, height(point, iso), target);
    const line = (route.length ? '<polyline data-iso-route points="' + path + '" stroke="#6689e9" stroke-width="6" fill="none"'
      + ' stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 11"/>' : "");
    if (onlyPath) return line;
    return '<g pointer-events="none" class="iso-hero" transform="translate(' + x + ',' + y + ')"><ellipse rx="13" ry="6" fill="#385d6640"/>'
      + '<path d="M-8,-9v-12q8,-7 16,0v12l-8,4Z" fill="#5e7ac2"/><circle cy="-31" r="9" fill="#ffdfb0"/>'
      + '<path d="M-10,-32q0,-18 18,-6l3,8-11,-5Z" fill="#5c627c"/><path d="M-6,-8v8M6,-8v8" stroke="#52617d" stroke-width="5"/></g>';
  }
  // 一个SVG同时作为可编辑画布和本地试玩视图，网格辅助不重建项目。
  function canvas(target, iso) {
    const tiles = target.cells.map((_, i) => i).sort((a, b) => {
      const depth = i => Math.floor(i / target.width) + i % target.width;
      return depth(a) - depth(b);
    });
    const background = '<defs><radialGradient id="iso-bg"><stop stop-color="#edf2ee"/><stop offset="1" stop-color="#e6edf5"/></radialGradient></defs>';
    return '<div class="iso-canvas-scroll" tabindex="0"><svg id="iso-canvas" viewBox="0 0 840 590" style="width:'
      + (840 * ui.zoom) + 'px;--iso-zoom:' + ui.zoom + '" role="group" aria-label="等距地图画布">' + background
      + '<rect width="840" height="590" fill="url(#iso-bg)"/><ellipse cx="450" cy="376" rx="300" ry="135" fill="#c8d2cf55"/>'
      + tiles.map(index => tile(index, target, iso)).join("")
      + '<g pointer-events="none">' + routeArt(target, iso, true) + '</g>'
      + tiles.map(index => objectArt(index, target, iso)
        + (index === (ui.route?.[ui.step]?.index ?? target.spawn) ? routeArt(target, iso) : "")).join("")
      + '<g pointer-events="none"><circle cx="150" cy="500" r="25" fill="#ffffffaa"/><path d="m150,480 -7,24 7,-6 7,6Z" fill="#7e92a8"/>'
      + '<text x="150" y="548" text-anchor="middle" fill="#6f7e8c">N</text></g></svg></div>';
  }
  // 控件始终使用原有按钮语义，避免把画布图形当作唯一可达入口。
  function action(label, value, active = false, extra = "") {
    return button(label, "iso-action", active ? "primary" : "soft", "", 'data-iso-action="' + value + '" ' + extra);
  }
  function choice(label, id, value, entries) {
    return '<label class="field">' + label + '<select id="' + id + '">' + entries.map(([keyValue, text]) =>
      '<option value="' + keyValue + '"' + (String(keyValue) === String(value) ? " selected" : "") + '>' + text + '</option>').join("") + '</select></label>';
  }
  // 表单草稿独立于运行状态，横屏与重绘不丢用户输入。
  function remember() {
    if (!document.getElementById("iso-map-name") && !document.getElementById("iso-opacity")) return;
    ui.draft = { ...ui.draft, ...Object.fromEntries(["iso-map-name", "iso-goal-type", "iso-goal-count", "iso-goal-reward", "iso-opacity"]
      .map(id => [id, document.getElementById(id)?.value]).filter(([, value]) => value !== undefined)) };
  }
  function draft(id, fallback) { return ui.draft?.[id] ?? fallback; }
  function input(label, id, value, type = "number") {
    return '<label class="field">' + label + '<input id="' + id + '" type="' + type + '" value="' + esc(draft(id, value)) + '"></label>';
  }
  // 高级面板不改写默认数据；当前面、占地与具体规则先以可读说明展示。
  function inspector(target, iso) {
    const cell = target.cells[ui.cell] || target.cells[0];
    const level = iso.heights[ui.cell] || 0;
    return '<aside class="iso-inspector panel panel-pad"><div class="row between"><h2>选中的地块</h2><span class="pill">#'
      + (ui.cell + 1) + '</span></div><div class="iso-cell-summary"><b>' + (ui.surface === "bridge" ? "桥面" : "地面")
      + '</b><span>' + (cell.blocked ? "不可通行" : allowed(node(ui.cell, ui.surface), target, iso) ? "可以通行" : "当前面不可站立") + '</span></div>'
      + '<div class="iso-stepper">' + action("←", "left") + action("↑", "up") + action("↓", "down") + action("→", "right") + '</div>'
      + '<p class="small muted">方向键按钮可精确选择格子</p>'
      + '<details class="iso-advanced"' + (ui.advanced || ["iso_height", "iso_path", "iso_invalid"].includes(view.state) ? " open" : "") + '>'
      + '<summary>高级：高度、桥面与遮挡</summary><div class="iso-detail-body"><p>逻辑高度 <b>' + level + '</b></p>'
      + '<div class="iso-actions">' + action("抬高一层", "raise") + action("降低一层", "lower") + '</div>'
      + '<div class="iso-actions">' + action("连接坡道", "ramp", iso.ramps[ui.cell]) + action("放置桥面", "bridge", iso.bridges[ui.cell]) + '</div>'
      + '<div class="iso-actions">' + action("地面", "surface-ground", ui.surface === "ground")
      + action("桥面", "surface-bridge", ui.surface === "bridge") + '</div>'
      + '<div class="iso-actions">' + action("阻挡", "block") + action("擦除物体", "erase") + '</div>'
      + input("遮挡后不透明度（0—100）", "iso-opacity", iso.occlusion)
      + action("保存遮挡设置", "opacity") + action("预览房屋淡化", "occlusion", Boolean(ui.occluded))
      + '<p class="small muted">淡化只改显示，不改变碰撞和寻路。</p>'
      + '<p class="small muted">桥上与桥下分别选中；上下桥需要坡道。</p></div></details>'
      + '<div class="iso-linked"><small>当前关联</small><b>' + I18n.user(target.name) + '</b>'
      + '<span class="small muted">地图与关卡目标使用同一份数据</span>' + action("编辑通关目标", "level") + action("打开关卡工作流", "workflow") + '</div></aside>';
  }
  // 关卡目标沿用已有枚举与验证，不复制名称或奖励字段。
  function levelPanel(target) {
    return '<section class="iso-level-panel panel panel-pad"><h2>这张地图怎样通关？</h2><div class="iso-level-fields">'
      + input("关卡名称", "iso-map-name", target.name, "text")
      + choice("通关条件", "iso-goal-type", draft("iso-goal-type", target.goal.type), [["reach", "到达终点"], ["defeat", "打败敌人"]])
      + input("目标数量（1—99）", "iso-goal-count", target.goal.count)
      + input("奖励金币（0—9999）", "iso-goal-reward", target.goal.reward) + '</div><div class="iso-actions">'
      + action("保存通关目标", "save-level") + action("打开关卡工作流", "workflow") + '</div>'
      + '<p class="small muted">关卡定义目标；地图定义空间。地图 ID 保持不变。</p></section>';
  }
  // 路径端点包含通行面，避免同屏桥上桥下被误判为一个位置。
  function pathPanel(target) {
    return '<div class="iso-pathbar"><div><b>路径与试玩</b><p class="small muted">选择格子，再设置起终点；按逻辑地面行走。</p></div>'
      + '<div class="iso-actions">' + action("设为路径起点", "path-start") + action("设为路径终点", "path-finish")
      + action("检查路径", "path") + action(ui.playing ? "暂停试玩" : "沿路径试玩", "play", ui.playing) + '</div>'
      + '<div id="iso-path-result" role="status">' + (ui.route ? (ui.route.length ? t("找到路径") + " · " + (ui.route.length - 1)
        + " " + t("步") : t("没有可通行路径")) : t("起点与终点来自当前关卡"))
      + ' · ' + esc(target.id) + '</div></div>';
  }
  // 地图入口保持简单；高度与导航只在所需状态展开。
  function page() {
    Gameplay.init();
    const target = map();
    const iso = config(target);
    if (ui.cell >= target.cells.length) ui.cell = 0;
    const landscape = view.mode === "android" && view.state === "iso_landscape";
    const toolbar = '<div class="iso-toolbar"><div><span class="iso-eyebrow">WORLD BUILDER</span><h1>把想象画成一座小世界</h1>'
      + '<p>用 2D 地块搭出斜 45°地图，随时用对话继续修改。</p></div><div class="iso-actions">'
      + action("俯视辅助", "top", ui.top) + (view.mode === "android" ? action(landscape ? "返回竖屏" : "横屏编辑", "rotate") : "")
      + action("用对话修改", "chat") + '</div></div>';
    const tabs = '<nav class="iso-tabs" aria-label="地图工具">' + [["isometric", "地图"], ["iso_height", "高度与桥梁"],
      ["iso_path", "寻路与试玩"], ["iso_level", "关卡目标"]].map(([id, name]) => action(name, "tab-" + id, view.state === id)).join("") + '</nav>';
    const controls = '<div class="iso-canvas-head"><div><b>' + I18n.user(target.name) + '</b><span class="pill blue">斜 45° · 2D</span></div>'
      + '<div class="iso-actions">' + action("撤销", "undo") + action("重做", "redo") + action("−", "zoom-out") + action("+", "zoom-in") + '</div></div>';
    const tools = '<div class="iso-brushes">' + Object.entries(brushes).slice(0, 6).map(([id, label]) =>
      action(label, "brush-" + id, ui.brush === id)).join("") + '</div>';
    const status = ui.error || (view.state === "iso_invalid" ? "输入不合法，原来的地图已保留。" : "");
    const empty = view.state === "iso_empty";
    return '<section class="iso-page' + (landscape ? " iso-landscape" : "") + '">' + toolbar + tabs
      + '<div class="iso-map-choices">' + model.gameplay.maps.map(item => action(item.name, "map-" + item.id, item.id === target.id,
        I18n.terms(item.name))).join("") + '</div>'
      + '<div id="iso-feedback" class="iso-feedback" role="alert"' + (status ? "" : " hidden") + '>' + esc(status) + '</div>'
      + (empty ? '<div class="iso-empty panel"><h2>从一块地面开始</h2><p>先用当前地图打开等距视图，再放角色与目标。</p>'
        + action("开始编辑地图", "tab-isometric") + '</div>' : '<div class="iso-workbench"><section class="iso-canvas-panel panel">'
        + controls + tools + canvas(target, iso) + '<div class="iso-canvas-foot"><span>点击选格 · 高级设置按需展开</span>'
        + '<span>' + (ui.surface === "bridge" ? "当前：桥面" : "当前：地面") + '</span></div></section>' + inspector(target, iso) + '</div>'
        + pathPanel(target) + (view.state === "iso_level" ? levelPanel(target) : ""))
      + '<p class="iso-note">本地交互原型 · 地图修改可保存和撤销；试玩展示当前格子规则。</p></section>';
  }
  // 提交前对完整玩法副本验证，阻断错误不会清空草稿或推进版本。
  function edit(title, mutate) {
    const next = JSON.parse(JSON.stringify(model.gameplay));
    const target = next.maps.find(item => item.id === map().id);
    target.iso = JSON.parse(JSON.stringify(config(target)));
    mutate(target, target.iso);
    if (!Gameplay.valid(next)) return fail("设置不合法，请保留当前输入并修正。");
    stop(); ui.route = null; ui.error = "";
    commit(title, { gameplay: next }); render();
    return true;
  }
  function fail(message) {
    ui.error = message;
    const box = document.getElementById("iso-feedback");
    if (box) { box.hidden = false; box.textContent = t(message); }
    return true;
  }
  // 高度仅允许样例定义的四档；水面上的地面不可站立，桥面单独验证。
  function paint(kind = ui.brush) {
    const target = map();
    const index = ui.cell;
    if (kind === "select") return true;
    if (kind === "block" && [target.spawn, target.exit].includes(index)) return fail("起点和终点不能设为阻挡。");
    if (kind === "raise" && config().heights[index] >= 3) return fail("高度范围为 0—3 层。");
    if (kind === "lower" && config().heights[index] <= 0) return fail("高度范围为 0—3 层。");
    return edit("修改等距地图", (next, iso) => {
      if (["grass", "water", "forest"].includes(kind)) next.cells[index].terrain = kind;
      if (kind === "house") iso.objects[index] = iso.objects[index] === "house" ? "" : "house";
      if (kind === "chest") next.cells[index].event = next.cells[index].event ? "" : "chest";
      if (kind === "raise") iso.heights[index] += 1;
      if (kind === "lower") iso.heights[index] -= 1;
      if (kind === "ramp") iso.ramps[index] = !iso.ramps[index];
      if (kind === "bridge") iso.bridges[index] = !iso.bridges[index];
      if (kind === "block") next.cells[index].blocked = !next.cells[index].blocked;
      if (kind === "erase") { iso.objects[index] = ""; next.cells[index].event = ""; }
    });
  }
  // 仅完整整数可提交，空值和小数不会被隐式转为零。
  function number(id, min, max) {
    const raw = document.getElementById(id)?.value.trim() || "";
    return /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max ? Number(raw) : null;
  }
  function saveLevel() {
    const name = document.getElementById("iso-map-name").value.trim();
    const type = document.getElementById("iso-goal-type").value;
    const count = number("iso-goal-count", 1, 99);
    const reward = number("iso-goal-reward", 0, 9999);
    if (!name || name.length > 80 || count === null || reward === null || !["reach", "defeat"].includes(type)) {
      return fail("请填写有效名称、目标数量和奖励。");
    }
    ui.draft = null;
    return edit("修改等距关卡目标", target => { target.name = name; target.goal = { type, count, reward }; });
  }
  // 切图前终止当前预览；不同地图的路径端点不会串用。
  function setMap(id) {
    remember(); stop();
    model.activeLevel = id; ui.cell = 0; ui.start = null; ui.finish = null; ui.route = null; ui.draft = null; ui.error = "";
    render();
  }
  function checkPath() {
    stop(); ui.step = 0;
    ui.route = findPath(ui.start || node(map().spawn), ui.finish || node(map().exit));
    render();
  }
  // 定时器以视图与地图为边界，离开工具不会留下隐藏运行状态。
  function stop() { clearTimeout(ui.timer); ui.playing = false; }
  function play() {
    if (ui.playing) { stop(); render(); return; }
    if (!ui.route) ui.route = findPath(ui.start || node(map().spawn), ui.finish || node(map().exit));
    if (!ui.route.length) return fail("没有可通行路径，请调整地形或通行面。");
    if (ui.step >= ui.route.length - 1) ui.step = 0;
    ui.playing = true;
    const tick = () => {
      if (!ui.playing || view.page !== "world" || !states.includes(view.state)) { stop(); return; }
      ui.step += 1;
      if (ui.step >= ui.route.length - 1) stop();
      render();
      if (ui.playing) ui.timer = setTimeout(tick, 300);
    };
    render(); ui.timer = setTimeout(tick, 300);
    return true;
  }
  // 视图切换前保存表单，旋转后仍是同一个地图与草稿。
  function click(target) {
    const value = target.dataset.isoAction;
    if (!value) return false;
    remember();
    if (value.startsWith("tab-")) { stop(); ui.error = ""; go("world", value.slice(4)); }
    else if (value.startsWith("map-")) setMap(value.slice(4));
    else if (value.startsWith("brush-")) { ui.brush = value.slice(6); render(); }
    else if (["raise", "lower", "ramp", "bridge", "block", "erase"].includes(value)) paint(value);
    else if (value.startsWith("surface-")) { ui.surface = value.slice(8); render(); }
    else if (["left", "right", "up", "down"].includes(value)) {
      const move = { left: -1, right: 1, up: -map().width, down: map().width }[value];
      ui.cell = Math.max(0, Math.min(map().cells.length - 1, ui.cell + move)); render();
    } else if (value === "opacity") {
      const opacity = number("iso-opacity", 0, 100);
      if (opacity === null) return fail("不透明度请输入 0—100 的整数。");
      ui.draft = null; edit("修改遮挡设置", (_, iso) => { iso.occlusion = opacity; });
    } else if (value === "occlusion") { ui.occluded = !ui.occluded; render(); }
    else if (value === "top") { ui.top = !ui.top; render(); }
    else if (value === "rotate") go("world", view.state === "iso_landscape" ? "isometric" : "iso_landscape");
    else if (value === "zoom-in" || value === "zoom-out") { ui.zoom = Math.max(0.65, Math.min(1.65, ui.zoom + (value === "zoom-in" ? 0.15 : -0.15))); render(); }
    else if (value === "path-start" || value === "path-finish") {
      ui[value === "path-start" ? "start" : "finish"] = node(ui.cell, ui.surface); ui.route = null; render();
    } else if (value === "path") checkPath();
    else if (value === "play") play();
    else if (value === "save-level") saveLevel();
    else if (value === "level") go("world", "iso_level");
    else if (value === "undo") { stop(); ui.route = null; ui.draft = null; undoChange(); }
    else if (value === "redo") { stop(); ui.route = null; ui.draft = null; Workflow.action("wf-redo"); }
    else if (value === "workflow") {
      model.activeLevel = map().id; Studio.ui.worldTab = "levels"; Studio.ui.module = "胜利与失败";
      model.moduleEditing = true; model.workflowScope = "client"; go("workflow", "module_levels");
    } else if (value === "chat") {
      go("workspace"); const input = document.getElementById("chat-input");
      if (input) input.value = t("保留这张地图，继续调整关卡规则");
    }
    return true;
  }
  // SVG格子支持鼠标及键盘；监听只绑定当前画布，不影响其他工具。
  function afterRender() {
    const svg = document.getElementById("iso-canvas");
    if (!svg) return;
    const choose = event => {
      const tileNode = event.target.closest("[data-iso-cell]");
      if (!tileNode) return;
      remember(); ui.cell = Number(tileNode.dataset.isoCell); ui.error = "";
      if (ui.brush === "select") render(); else paint();
    };
    svg.addEventListener("click", choose);
    svg.addEventListener("keydown", event => {
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(event); }
    });
    document.querySelector(".iso-advanced")?.addEventListener("toggle", event => { ui.advanced = event.target.open; });
  }
  // 离开地图立即结束演示，保存的项目数据不会夹带运行位置。
  function beforeRender() { if (view.page !== "world" || !states.includes(view.state)) stop(); }
  return { page, click, afterRender, beforeRender, valid, defaults, findPath, neighbors, allowed, map, config, ui, states };
})();
