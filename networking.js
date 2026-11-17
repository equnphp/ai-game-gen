/* 多协议页面仅保存声明式连接与工作流草案；不会连接服务器、调用AI、部署或执行导入文档。 */
/* global I18n, model, Studio, esc, heading, notice, render, commit, toast, URL -- 复用项目状态与原子事务。 */
/* exported Networking -- 主界面按脚本顺序接入统一事件委托。 */
"use strict";
const Networking = (() => {
  const protocols = ["HTTPS", "WSS", "TCP", "UDP", "Socket.IO", "gRPC", "MQTT"];
  const methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
  const ui = { tab: "start", active: "net-world", error: "", result: "", importText: "", operations: [],
    openCompatibility: false, openRpg: false, legacy: false, importName: "", importEndpoint: "",
    importKey: "", importRevision: 0, warnings: [], fileSequence: 0 };
  let sequence = 0;


  // 网络文档按版本、有界集合与引用关系恢复，损坏草稿不进入编辑器。
  function valid(data) {
    try {
      if (!data || data.schemaVersion !== 1 || !Array.isArray(data.services) || data.services.length > 40
        || !Array.isArray(data.imports) || data.imports.length > 200 || JSON.stringify(data).length > 2097152) return false;
      const counts = { operations: 0, messages: 0, drafts: 0 };
      const services = new Set();
      const operations = new Set();
      const references = [];
      for (const service of data.services) {
        if (!validService(service) || services.has(service.id)) return false;
        services.add(service.id);
        counts.operations += service.operations.length;
        counts.messages += service.messages.length;
        counts.drafts += service.workflowDrafts.length;
        for (const operation of service.operations) {
          if (operations.has(operation.id)) return false;
          operations.add(operation.id);
        }
        service.workflowDrafts.forEach((draft) => draft.nodes.forEach((node) => {
          if (node.operationId) references.push(node.operationId);
        }));
      }
      if (counts.operations > 400 || counts.messages > 800 || counts.drafts > 400
        || references.some((reference) => !operations.has(reference))) return false;
      const imports = new Set();
      return data.imports.every((record) => validId(record.id) && !imports.has(record.id) && imports.add(record.id)
        && services.has(record.serviceId) && record.format === "OpenAPI-JSON"
        && record.status === "reviewed-configuration-draft" && Array.isArray(record.operations)
        && record.operations.length > 0 && record.operations.length <= 40
        && record.operations.every((reference) => operations.has(reference))) && validJson(data);
    } catch { return false; }
  }

  // 标识不接受路径与控制字符，跨对象引用独立于显示名称。
  function validId(value) { return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value); }

  // schema等保留数据也必须是有界JSON，不接受循环、函数或无限深度。
  function validJson(rootValue) {
    const visited = new Set();
    let count = 0;
    const visit = (value, depth) => {
      count += 1;
      if (count > 40000 || depth > 24) return false;
      if (value === null || typeof value === "boolean") return true;
      if (typeof value === "string") return value.length <= 32768;
      if (typeof value === "number") return Number.isFinite(value);
      if (typeof value !== "object" || visited.has(value)) return false;
      visited.add(value);
      const entries = Object.entries(value);
      if (entries.length > 1000) return false;
      const result = entries.every(([key, child]) => key.length <= 240 && visit(child, depth + 1));
      visited.delete(value);
      return result;
    };
    return visit(rootValue, 0);
  }

  // 服务配置严格检查枚举、数值与集合，不能仅凭顶层版本号信任草稿。
  function validService(service) {
    if (!service || !validId(service.id) || typeof service.name !== "string" || !service.name.trim()
      || service.name.length > 80 || !protocols.includes(service.protocol) || typeof service.endpoint !== "string"
      || service.endpoint.length > 500 || endpointError(service.protocol, service.endpoint)
      || !["local-mock", "test", "production"].includes(service.environment)
      || typeof service.credentialRef !== "string" || service.credentialRef.length > 80
      || /\s|[:/=]/.test(service.credentialRef) || typeof service.jitter !== "boolean"
      || service.status !== "configuration-draft") return false;
    const numbers = [service.heartbeatSeconds, service.reconnectAttempts, service.reconnectDelayMs, service.reconnectMaxMs];
    if (numbers.some((value) => !Number.isInteger(value) || value < 0) || service.heartbeatSeconds > 3600
      || service.reconnectAttempts > 30 || service.reconnectMaxMs > 120000
      || service.reconnectDelayMs > service.reconnectMaxMs) return false;
    if (!Array.isArray(service.messages) || service.messages.length > 60 || !Array.isArray(service.operations)
      || service.operations.length > 40 || !Array.isArray(service.workflowDrafts) || service.workflowDrafts.length > 80) return false;
    if (service.sourceKey !== undefined && (typeof service.sourceKey !== "string" || service.sourceKey.length > 800)) return false;
    const messageKeys = new Set();
    const ids = new Set();
    if (!service.messages.every((message) => {
      const key = message.direction + ":" + message.name;
      if (!validId(message.id) || ids.has(message.id) || typeof message.name !== "string"
        || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(message.name) || messageKeys.has(key)
        || !["send", "receive"].includes(message.direction) || !["JSON", "text", "binary"].includes(message.format)) return false;
      ids.add(message.id); messageKeys.add(key); return true;
    })) return false;
    const operationKeys = new Set();
    return service.operations.every((operation) => {
      const key = operation.method + " " + operation.path;
      if (!validOperation(operation) || operationKeys.has(key)) return false;
      operationKeys.add(key); return true;
    }) && new Set(service.operations.map((operation) => operation.id)).size === service.operations.length
      && service.workflowDrafts.every(validDraft)
      && new Set(service.workflowDrafts.map((draft) => draft.id)).size === service.workflowDrafts.length;
  }

  // 人工字段和导入字段遵守同一结构，原schema另外保留待核对。
  function validOperation(operation) {
    if (!operation || !validId(operation.id) || typeof operation.sourceKey !== "string" || operation.sourceKey.length > 500
      || typeof operation.name !== "string" || !operation.name.trim() || operation.name.length > 120
      || !methods.map((method) => method.toUpperCase()).includes(operation.method)
      || typeof operation.path !== "string" || !operation.path.startsWith("/") || operation.path.length > 240
      || typeof operation.authSummary !== "string" || operation.authSummary.length > 800
      || typeof operation.responseStatus !== "string" || operation.responseStatus.length > 20) return false;
    return validFields(operation.requestFields) && validFields(operation.responseFields)
      && operation.sourceSchemas && typeof operation.sourceSchemas === "object" && !Array.isArray(operation.sourceSchemas);
  }

  // 字段名称按位置唯一，路径变量必须为必填。
  function validFields(fields) {
    if (!Array.isArray(fields) || fields.length > 60) return false;
    const keys = new Set();
    return fields.every((field) => {
      if (!field || typeof field.name !== "string" || !field.name || field.name.length > 120
        || !["string", "number", "integer", "boolean", "object", "array", "null"].includes(field.type)
        || !["path", "query", "header", "cookie", "body", "response"].includes(field.in)
        || typeof field.required !== "boolean" || (field.in === "path" && !field.required)) return false;
      const key = field.in + ":" + field.name;
      if (keys.has(key)) return false;
      keys.add(key); return true;
    });
  }

  // 草案状态与节点种类明确，不允许恢复后被当作当前解释器可执行图。
  function validDraft(draft) {
    if (!draft || !validId(draft.id) || typeof draft.name !== "string" || draft.name.length > 500
      || draft.domain !== "client" || draft.status !== "configuration-draft" || draft.interpreterCompatible !== false
      || !Array.isArray(draft.nodes) || draft.nodes.length > 80 || !Array.isArray(draft.edges) || draft.edges.length > 160) return false;
    const ids = new Set();
    if (!draft.nodes.every((node) => {
      if (!validId(node.id) || ids.has(node.id)
        || !["request-input", "http-call-draft", "result-or-error"].includes(node.kind)) return false;
      if (node.kind === "http-call-draft" && !validId(node.operationId)) return false;
      if (node.fields !== undefined && !validFields(node.fields)) return false;
      ids.add(node.id); return true;
    })) return false;
    return draft.edges.every((edge) => edge && ids.has(edge.from) && ids.has(edge.to));
  }

  // 所有入口提交前再次校验同一份文档，不让超限或不兼容数据部分写入。
  function saveDocument(title, data) {
    if (!valid(data)) {
      ui.error = "网络文档结构无效或超过限制，请减少配置并核对字段。";
      ui.result = ""; toast(ui.error); render(); return false;
    }
    commit(title, { networking: data }); return true;
  }

  // 稳定标识写入项目数据，选择和引用不依赖可变名称。
  function id(prefix) { sequence += 1; return prefix + "-" + Date.now().toString(36) + "-" + sequence; }

  // 每次提交完整复制网络文档，避免共享对象绕过撤销事务。
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  // 默认连接是可编辑草案，示例域名不会被实际请求。
  function seed(protocol, serviceId, name) {
    return { id: serviceId, name, protocol, endpoint: protocol === "WSS"
      ? "wss://world.example.invalid/game" : "https://api.example.invalid",
    environment: "local-mock", credentialRef: "player-session", heartbeatSeconds: 20,
    reconnectAttempts: 5, reconnectDelayMs: 1000, reconnectMaxMs: 15000, jitter: true,
    messages: protocol === "WSS" ? [
      { id: serviceId + "-join", name: "join_world", direction: "send", format: "JSON" },
      { id: serviceId + "-state", name: "world_snapshot", direction: "receive", format: "JSON" },
    ] : [], operations: [], workflowDrafts: [], status: "configuration-draft" };
  }

  // 恢复与重绘不会覆盖用户保存的连接。
  function init() {
    if (!valid(model.networking)) {
      model.networking = { schemaVersion: 1, services: [seed("WSS", "net-world", "RPG 世界连接"),
        seed("HTTPS", "net-api", "账号与存档")], imports: [] };
    }
    if (!model.networking.services.some((item) => item.id === ui.active)) {
      ui.active = model.networking.services[0] ? model.networking.services[0].id : "";
    }
  }

  // 选中目标始终按ID读取，删除或撤销后安全回到首项。
  function current() { init(); return model.networking.services.find((item) => item.id === ui.active); }

  // 控件复用原型设计变量，所有外部文档字段经过HTML转义。
  function input(label, key, value, type = "text") {
    return '<label class="field">' + esc(label) + '<input id="nw-' + key + '" type="' + type
      + '" value="' + esc(String(value)) + '"></label>';
  }

  // 选项值来自固定目录，显示值仍统一转义。
  function select(label, key, value, options) {
    return '<label class="field">' + esc(label) + '<select id="nw-' + key + '">'
      + options.map((item) => '<option value="' + esc(item[0]) + '"'
        + (value === item[0] ? " selected" : "") + ">" + esc(item[1]) + "</option>").join("") + "</select></label>";
  }

  // 局部动作使用独立命名空间，不截获旧API和工作流按钮。
  function action(label, value, style = "") {
    return '<button class="btn ' + style + '" data-nw-action="' + value + '">' + esc(label) + "</button>";
  }

  // 新手先选要实现的能力，专业协议与服务器结构折叠。
  function startPage() {
    const cards = [
      ["save", "云存档与排行榜", "用 HTTPS 保存进度、读榜单；奖励和排名在服务端验证。",
        "添加云能力草案"],
      ["rpg", "多人 RPG 世界", "HTTP 处理账号与数据，WSS 交换入场、移动、聊天与世界快照。",
        "添加 RPG 联网草案"],
      ["slg", "策略与经营联网", "资源、行军和队列以服务器时间与事务为准；客户端展示倒计时。",
        "添加 SLG 联网草案"],
    ];
    return '<div class="nw-cards">' + cards.map((card) => '<section class="panel panel-pad"><span class="pill blue">'
      + "入门方案</span><h2>" + card[1] + "</h2><p>" + card[2] + "</p>" + action(card[3], "template:" + card[0], "soft")
      + "</section>").join("") + '</div><section class="panel panel-pad nw-section"><h2>先做一小段能玩的联网流程</h2>'
      + "<p>选择方案 → 调整连接和消息 → 查看工作流草案 → 在未来真实服务中验证。"
      + "当前原型只编辑本机配置，没有连接网络或部署。</p>"
      + '<details class="nw-details"' + (ui.openRpg ? ' open' : '')
      + '><summary>展开 RPG 网游服务器设计</summary><div class="nw-server-plan">'
      + ["身份与网关：登录、会话、连接限流；凭证不放公开项目",
        "世界与房间：地图实例、兴趣区域、单位可见性与玩家入离场",
        "权威玩法：移动与战斗验证、技能冷却、掉落和奖励由服务端判定",
        "可靠恢复：序号、快照、重连补偿、重复消息处理和版本兼容",
        "数据与运营：背包、任务、交易事务、备份、追踪、扩容与费用预算"]
        .map((text) => "<p>" + text + "</p>").join("") + "</div></details>"
      + '<p class="summary-footer">这些是设计范围，不表示已具备 MMO 容量、同步、数据库或服务器能力。'
      + '</p></section>'
      + compatibility();
  }

  // 目录按游戏运行目标标注限制，编辑器原生能力不冒充H5游戏能力。
  function compatibility() {
    const rows = [
      ["HTTPS / WSS", "浏览器标准接口", "运行时适配待研发",
        "request / connectSocket，需合法域名", "request / connectSocket，需合法域名"],
      ["原始 TCP / UDP", "普通 H5 无通用原始套接字；需网关", "可设计原生桥接，当前未实现",
        "官方有 TCP / UDP API；需基础库与端口适配", "本次未核实直接 API；先按网关方案"],
      ["Socket.IO", "需 Socket.IO 客户端，不能直连普通 WSS", "客户端适配待研发",
        "需专门适配与实测", "需专门适配与实测"],
      ["gRPC / MQTT", "gRPC-Web / MQTT-over-WSS 等适配", "原生 / 网关方案待选择",
        "需平台适配或网关", "需平台适配或网关"],
    ];
    return '<details class="panel panel-pad nw-details nw-section"' + (ui.openCompatibility ? ' open' : '')
      + '><summary>高级：协议目录与导出能力</summary>'
      + '<p class="summary-footer">推荐先用 HTTPS + WSS。Socket 不是独立的统一协议；Socket.IO 与 WebSocket 不互通。</p>'
      + '<div class="nw-table-scroll"><table class="nw-table"><thead><tr><th>连接类型</th><th>H5</th><th>APK</th>'
      + "<th>微信小游戏</th><th>抖音小游戏</th></tr></thead><tbody>"
      + rows.map((row) => "<tr>" + row.map((cell) => "<td>" + esc(cell) + "</td>").join("") + "</tr>").join("")
      + "</tbody></table></div><p class=\"summary-footer\">官方 API 存在不代表 GameGen 已实现。目标版本、域名白名单、"
      + "证书、端口和消息限制须在真实产物中验证；跨平台优先通过 HTTPS / WSS 网关统一。</p></details>";
  }

  // 列表和协议添加都保持现有服务ID，不以数组位置充当引用。
  function serviceList() {
    return '<aside class="panel panel-pad nw-services"><h3>连接与服务</h3><div class="nw-service-list">'
      + model.networking.services.map((service) => '<button class="nw-service'
        + (service.id === ui.active ? " active" : "") + '" data-nw-service="' + esc(service.id) + '"><b>'
        + I18n.user(service.name) + '</b><small>' + esc(service.protocol) + " · 配置草案</small></button>").join("")
      + '</div><details class="nw-details"><summary>高级：添加其他协议</summary><div class="nw-protocols">'
      + protocols.map((protocol) => action(protocol, "add:" + protocol, "soft")).join("")
      + "</div></details></aside>";
  }

  // 消息schema先用受限JSON数组编辑，避免伪装成已接入的协议执行器。
  function messagesEditor(service) {
    return '<label class="field">消息类型（name / direction / format）'
      + '<textarea id="nw-messages" rows="7" spellcheck="false">' + esc(JSON.stringify(service.messages, null, 2))
      + '</textarea></label><p class="summary-footer">direction 为 send 或 receive；format 为 JSON、text 或 binary。'
      + "现有消息 ID 应保留。应用层心跳需要服务器协商，不等于浏览器可自行发 WebSocket 协议层 ping。</p>";
  }

  // 声明式草案用于审阅，不传入当前受限工作流解释器。
  function draftsPanel(service) {
    const drafts = service.workflowDrafts || [];
    const names = drafts.length ? drafts.map((draft) => draft.name)
      : service.protocol === "WSS" ? ["连接成功 → 校验消息 → 分派事件",
        "超时 / 断线 → 退避重连 → 请求世界快照"]
        : ["发起请求 → 服务端校验待设计 → 结果 / 错误分支"];
    return '<section class="panel panel-pad nw-section"><div class="row between"><h3>工作流配置草案</h3>'
      + '<span class="pill orange">尚未接入解释器</span></div><div class="nw-draft-flow">'
      + names.map((name) => "<div>" + I18n.user(name) + "</div>").join("") + "</div>"
      + '<p class="summary-footer">逻辑最终必须成为可人工编辑的受控工作流。这里只保存声明式图草案，'
      + "当前不执行连接、消息、服务端业务或数据库操作。</p></section>";
  }

  // 基本连接优先，心跳和重连等参数在高级区按需展开。
  function connectionForm(service) {
    const protocolOptions = protocols.map((protocol) => [protocol, protocol === "HTTPS" ? "HTTP / HTTPS" : protocol]);
    const fields = input("服务名称", "name", service.name)
      + select("协议", "protocol", service.protocol, protocolOptions)
      + input("连接地址", "endpoint", service.endpoint)
      + select("环境", "environment", service.environment, [
        ["local-mock", "本地模拟（未联网）"],
        ["test", "测试环境配置（未连接）"], ["production", "正式环境配置（未部署）"],
      ]);
    return '<section class="panel panel-pad"><div class="row between"><h2>连接配置</h2>'
      + '<span class="pill orange">本机草案</span></div><div class="nw-form-grid">' + fields + "</div>"
      + '<details class="nw-details"><summary>高级：鉴权、心跳与重连</summary><div class="nw-form-grid">'
      + input("凭证绑定引用（不填密钥）", "credential", service.credentialRef)
      + input("应用层心跳间隔 / 秒（0 为关闭）", "heartbeat", service.heartbeatSeconds, "number")
      + input("最大重连次数", "attempts", service.reconnectAttempts, "number")
      + input("首次重连延迟 / 毫秒", "delay", service.reconnectDelayMs, "number")
      + input("最大重连延迟 / 毫秒", "max", service.reconnectMaxMs, "number")
      + '<label class="check-label"><input id="nw-jitter" type="checkbox"'
      + (service.jitter ? " checked" : "") + '>随机抖动，避免同时重连</label></div></details>'
      + (service.protocol === "WSS" ? messagesEditor(service) : "")
      + '<p class="summary-footer">正式凭证必须在系统安全存储 / 服务端绑定；这里仅保存引用名称。'
      + "测试与正式环境必须隔离，选择正式环境不会触发部署。</p>"
      + '<p id="nw-form-error" class="nw-form-error" role="alert" hidden></p>'
      + '<div class="row wrap">' + action("保存连接配置", "save", "primary")
      + action("检查本机配置", "check", "soft") + "</div></section>";
  }

  // HTTP操作保留从文档真实提取的字段，不生成固定假接口。
  function savedOperations(service) {
    if (!service.operations.length) return "";
    return '<section class="panel panel-pad nw-section"><h3>已导入的 HTTP 操作</h3>'
      + service.operations.map((operation) => '<div class="nw-operation-summary"><strong>' + esc(operation.method)
        + "</strong><code>" + esc(operation.path) + "</code><span>" + esc(operation.name) + "</span></div>").join("")
      + '<p class="summary-footer">修改字段请重新导入并修订；再次应用保留已有配置 ID。</p></section>';
  }

  // 原有API编辑器继续可访问，不因新增多协议页面丢失已有能力。
  function connectionsPage() {
    const service = current();
    return (ui.openCompatibility ? compatibility() : '') + '<div class="nw-layout">' + serviceList() + '<div class="nw-main">'
      + (service ? connectionForm(service) + savedOperations(service) + draftsPanel(service)
        : notice("还没有连接", "选择一种协议，或者从入门方案开始。"))
      + '</div></div>' + (ui.openCompatibility ? '' : compatibility())
      + '<details class="nw-details nw-legacy"><summary>高级：已有 HTTP 与服务端工作流编辑器</summary>'
      + Studio.apiPage() + "</details>";
  }

  // 预览允许人工修订真实字段，JSON结构在应用时再次检查。
  function operationPreview(operation, index) {
    const prefix = ' data-nw-index="' + index + '" ';
    return '<section class="nw-operation-edit"><label class="check-label"><input type="checkbox"'
      + prefix + 'data-nw-op="selected"' + (operation.selected ? " checked" : "") + '>导入此操作</label>'
      + '<div class="nw-form-grid"><label class="field">操作名称<input' + prefix + 'data-nw-op="name" value="'
      + esc(operation.name) + '"></label><label class="field">方法<select' + prefix + 'data-nw-op="method">'
      + methods.map((method) => '<option' + (operation.method === method.toUpperCase() ? " selected" : "") + ">"
        + method.toUpperCase() + "</option>").join("") + '</select></label><label class="field">路径<input'
      + prefix + 'data-nw-op="path" value="' + esc(operation.path) + '"></label></div>'
      + '<label class="field">请求字段（可编辑 JSON 数组）<textarea rows="5"' + prefix + 'data-nw-op="requestText">'
      + esc(operation.requestText) + '</textarea></label><label class="field">响应字段（可编辑 JSON 数组）<textarea rows="4"'
      + prefix + 'data-nw-op="responseText">' + esc(operation.responseText) + "</textarea></label>"
      + '<p class="summary-footer">鉴权声明：' + esc(operation.authSummary)
      + "。只保留文档声明，实际权限与业务规则仍需设计。</p></section>";
  }

  // 文档只在本机解析，OpenAPI之外的格式不假装得到AI结果。
  function importPage() {
    return '<section class="panel panel-pad"><h2>从接口文档开始</h2><p>粘贴或选择 OpenAPI 3.0 / 3.1 JSON。'
      + "本机读取真实 paths，校验后先预览，人工修订后再应用。</p>"
      + '<label class="field">选择 JSON 文件<input id="nw-file" type="file" accept=".json,application/json"></label>'
      + '<label class="field">OpenAPI JSON<textarea id="nw-import-text" rows="9" spellcheck="false"'
      + ' placeholder="粘贴 OpenAPI JSON；不会上传服务器">' + esc(ui.importText) + "</textarea></label>"
      + '<div class="row wrap">' + action("校验并预览真实操作", "parse", "primary")
      + action("填入示例文档", "example", "soft") + "</div>"
      + '<p class="summary-footer">当前是受限结构校验，非完整 OpenAPI 验证器。不下载外部 $ref。'
      + "AsyncAPI、proto、Markdown、图片 / PDF 及 AI 理解文档需要后续映射；当前没有接入模型。</p></section>"
      + (ui.operations.length ? '<section class="panel panel-pad nw-section"><h2>预览与人工修订</h2>'
        + '<p class="small muted">读取到 ' + ui.operations.length + " 个真实操作；只有勾选项会应用。"
        + "文档不能自动推断服务器授权、交易与战斗逻辑。</p><div class=\"nw-form-grid\">"
        + input("导入服务名称", "import-name", ui.importName) + input("服务基地址", "import-endpoint", ui.importEndpoint)
        + "</div>" + ui.warnings.map((warning) => notice("需要核对", esc(warning), "warning")).join("")
        + ui.operations.map(operationPreview).join("") + '<div class="row wrap">'
        + action("应用配置与工作流草案", "apply", "primary") + "</div></section>" : "");
  }


  // 仅由主壳在页面/状态键变化时调用，手动切tab重绘不重置选择。
  function enterState(state) {
    init();
    ui.error = ""; ui.result = ""; ui.openCompatibility = false; ui.openRpg = false; ui.legacy = false;
    ui.tab = "start";
    if (["invalid", "unauthenticated"].includes(state)) { ui.legacy = true; return; }
    if (state === "protocols") { ui.tab = "connections"; ui.openCompatibility = true; }
    else if (state === "realtime") {
      ui.tab = "connections";
      const socket = model.networking.services.find((service) => service.protocol === "WSS");
      if (socket) ui.active = socket.id;
    } else if (state === "mmorpg") ui.openRpg = true;
    else if (["import", "import_invalid", "import_review"].includes(state)) {
      ui.tab = "import"; ui.operations = []; ui.importText = "";
      if (state === "import_invalid") {
        ui.importText = "{ OpenAPI JSON 尚未完整 }";
        ui.error = "文档不是有效JSON，请修正后重新校验；未生成任何操作。";
      } else if (state === "import_review") {
        ui.importText = exampleText();
        const parsed = parseDocument(ui.importText);
        Object.assign(ui, { operations: parsed.operations, importName: parsed.name, importEndpoint: parsed.endpoint,
          importKey: parsed.key, warnings: parsed.warnings, importRevision: model.revision });
        ui.result = "真实示例已解析，可人工修订；没有提交项目配置。";
      }
    }
  }

  // 页面状态由原型主壳承载，错误和来源说明不会被toast代替。
  function page() {
    init();
    if (ui.legacy) return Studio.apiPage();
    const tabs = [["start", "联网入门"], ["connections", "连接与消息"], ["import", "导入接口文档"]];
    return heading("联网与接口", "从目标开始；高级协议按需打开，玩法和服务端逻辑最终都以工作流交付。")
      + '<div class="nw-tabs" role="tablist" aria-label="联网工具">'
      + tabs.map((tab) => '<button role="tab" aria-selected="' + (ui.tab === tab[0])
        + '" class="' + (ui.tab === tab[0] ? "active" : "") + '" data-nw-tab="' + tab[0] + '">' + tab[1] + "</button>").join("")
      + "</div>" + (ui.error ? notice("请检查配置", esc(ui.error), "error") : "")
      + (ui.result ? notice("本机结果", esc(ui.result), "success") : "")
      + (ui.tab === "connections" ? connectionsPage() : ui.tab === "import" ? importPage() : startPage());
  }

  // 地址仅做语法约束，不声称DNS、证书或服务器已验证。
  function endpointError(protocol, value) {
    try {
      const url = new URL(value);
      const allowed = protocol === "WSS" ? ["wss:"] : ["TCP", "UDP"].includes(protocol)
        ? [protocol.toLowerCase() + ":"] : protocol === "MQTT" ? ["mqtt:", "mqtts:", "wss:"]
          : protocol === "Socket.IO" ? ["https:", "wss:"] : ["https:", "http:"];
      if (!allowed.includes(url.protocol) || !url.hostname || url.username || url.password)
        return "地址协议不匹配或含账号密码。";
      if (["TCP", "UDP"].includes(protocol) && (!url.port || Number(url.port) < 1)) return "TCP / UDP 地址需要有效端口。";
      return "";
    } catch { return "请输入包含协议和主机的完整地址。"; }
  }

  // 数值范围与语法错误保留在当前表单，失败不产生部分提交。
  function saveConnection(checkOnly) {
    const service = current();
    if (!service) return;
    const read = (key) => document.getElementById("nw-" + key).value.trim();
    const patch = { name: read("name"), protocol: read("protocol"), endpoint: read("endpoint"),
      environment: read("environment"), credentialRef: read("credential"), heartbeatSeconds: Number(read("heartbeat")),
      reconnectAttempts: Number(read("attempts")), reconnectDelayMs: Number(read("delay")), reconnectMaxMs: Number(read("max")),
      jitter: document.getElementById("nw-jitter").checked };
    let error = !patch.name || patch.name.length > 80 ? "服务名称需要 1 到 80 个字符。"
      : endpointError(patch.protocol, patch.endpoint);
    const numbers = [patch.heartbeatSeconds, patch.reconnectAttempts, patch.reconnectDelayMs, patch.reconnectMaxMs];
    if (numbers.some((value) => !Number.isInteger(value) || value < 0)
      || patch.heartbeatSeconds > 3600 || patch.reconnectAttempts > 30 || patch.reconnectMaxMs > 120000
      || patch.reconnectDelayMs > patch.reconnectMaxMs) {
      error = "心跳、重连次数与延迟需为有效整数，最大延迟不能小于首次延迟。";
    }
    if (patch.credentialRef.length > 80 || /\s|[:/=]/.test(patch.credentialRef))
      error = "只填写凭证引用名称，不填写密钥或令牌。";
    if (service.protocol === "WSS") {
      try { patch.messages = validateMessages(document.getElementById("nw-messages").value, service.messages); }
      catch (cause) { error = cause.message; }
    }
    if (error) {
      ui.error = error; ui.result = "";
      const errorElement = document.getElementById("nw-form-error");
      if (errorElement) { errorElement.textContent = error; errorElement.hidden = false; }
      toast(error); return;
    }
    if (!checkOnly) {
      const next = clone(model.networking);
      Object.assign(next.services.find((item) => item.id === service.id), patch);
      if (!saveDocument("保存联网连接配置", next)) return;
    }
    ui.error = ""; ui.result = checkOnly ? "语法检查通过；未连接服务器，未验证网络可用性。"
      : "连接与消息已保存到同一项目事务；仍为配置草案，未建立真实连接。";
    render();
  }

  // 消息类型有界且唯一，缺ID时生成并保留已有同名消息引用。
  function validateMessages(text, previous) {
    const messages = JSON.parse(text);
    if (!Array.isArray(messages) || messages.length > 60) throw new Error("消息类型需为最多 60 项的 JSON 数组。");
    const names = new Set();
    const ids = new Set();
    return messages.map((message) => {
      if (!message || typeof message.name !== "string" || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(message.name)
        || !["send", "receive"].includes(message.direction) || !["JSON", "text", "binary"].includes(message.format)) {
        throw new Error("消息需要有效的 name、send/receive 方向及 JSON/text/binary 格式。");
      }
      const key = message.direction + ":" + message.name;
      const previousItem = previous.find((item) => item.name === message.name && item.direction === message.direction);
      const stableId = typeof message.id === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(message.id)
        ? message.id : previousItem ? previousItem.id : id("message");
      if (names.has(key) || ids.has(stableId)) throw new Error("消息名称 / 方向或 ID 不能重复。");
      names.add(key); ids.add(stableId);
      return { id: stableId, name: message.name, direction: message.direction, format: message.format };
    });
  }

  // 仅解析本地JSON Pointer，文档引用不会触发文件或网络访问。
  function resolve(value, doc, depth = 0) {
    if (!value || typeof value !== "object" || !value.$ref) return value || {};
    if (depth > 10 || typeof value.$ref !== "string" || !value.$ref.startsWith("#/")) {
      throw new Error("仅支持有界的本地 $ref；请展开外部或循环引用。");
    }
    let target = doc;
    for (const token of value.$ref.slice(2).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
      if (["__proto__", "constructor", "prototype"].includes(token)
        || !target || !Object.hasOwn(target, token)) throw new Error("文档含无法解析的本地 $ref。");
      target = target[token];
    }
    return resolve(target, doc, depth + 1);
  }

  // 字段视图保留原schema，不把复杂约束误报成已完整编译。
  function schemaFields(schema, place, doc) {
    const resolved = resolve(schema, doc);
    if (resolved.properties && typeof resolved.properties === "object" && !Array.isArray(resolved.properties)) {
      return Object.entries(resolved.properties).map(([name, property]) => ({ name, in: place,
        type: property.type || "object", required: Array.isArray(resolved.required) && resolved.required.includes(name),
        schema: clone(property) }));
    }
    return Object.keys(resolved).length ? [{ name: place === "body" ? "body" : "result", in: place,
      type: resolved.type || "object", required: false, schema: clone(resolved) }] : [];
  }

  // 从每个operation提取真实参数、请求体和成功响应，不从样例猜接口。
  function operationFrom(path, method, item, parent, doc) {
    const operation = resolve(item, doc);
    const parameters = [...(Array.isArray(parent.parameters) ? parent.parameters : []),
      ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
    const fields = new Map();
    parameters.forEach((raw) => {
      const parameter = resolve(raw, doc);
      if (!parameter.name || !["path", "query", "header", "cookie"].includes(parameter.in)) {
        throw new Error("参数需要名称和有效的 in 位置。");
      }
      const schema = resolve(parameter.schema || {}, doc);
      fields.set(parameter.in + ":" + parameter.name, { name: parameter.name, in: parameter.in,
        type: schema.type || "string", required: parameter.in === "path" || parameter.required === true, schema: clone(schema) });
    });
    const body = resolve(operation.requestBody || {}, doc);
    const bodyType = body.content && (body.content["application/json"] || Object.values(body.content)[0]);
    if (bodyType) schemaFields(bodyType.schema || {}, "body", doc).forEach((field) => fields.set("body:" + field.name, field));
    if (!operation.responses || typeof operation.responses !== "object") throw new Error("每个操作必须声明 responses。");
    const success = Object.keys(operation.responses).find((key) => /^2[0-9Xx]{2}$/.test(key)) || "default";
    const response = resolve(operation.responses[success] || {}, doc);
    const responseType = response.content && (response.content["application/json"] || Object.values(response.content)[0]);
    const security = operation.security === undefined ? doc.security || [] : operation.security;
    const authSummary = Array.isArray(security) && security.length ? security.map((requirement) =>
      Object.keys(requirement).join(" + ")).join(" 或 ") : "未声明；需人工核对";
    return { selected: true, sourceKey: method.toUpperCase() + " " + path, method: method.toUpperCase(), path,
      name: operation.summary || operation.operationId || method.toUpperCase() + " " + path,
      requestText: JSON.stringify([...fields.values()], null, 2),
      responseText: JSON.stringify(responseType ? schemaFields(responseType.schema || {}, "response", doc) : [], null, 2),
      authSummary, responseStatus: success, sourceSchemas: { requestBody: body, responses: clone(operation.responses) } };
  }

  // 受限导入严格限制文档大小和操作数，超过限制不静默截断。
  function parseDocument(text) {
    if (text.length > 524288) throw new Error("文档超过 512 KiB，请拆成较小的接口文档。");
    const doc = JSON.parse(text);
    if (!doc || !/^3\.(0|1)\.\d+$/.test(doc.openapi || "")) throw new Error("当前仅支持 OpenAPI 3.0 / 3.1 JSON。");
    if (!doc.info || typeof doc.info.title !== "string" || !doc.info.title.trim()) throw new Error("需要 info.title。");
    if (!doc.paths || typeof doc.paths !== "object" || Array.isArray(doc.paths)) throw new Error("需要有效的 paths 对象。");
    if (Object.keys(doc.paths).length > 120) throw new Error("路径过多，请拆分文档；本次不会部分导入。");
    const operations = [];
    for (const [path, raw] of Object.entries(doc.paths)) {
      if (!path.startsWith("/") || path.length > 240) throw new Error("每个 paths 路径必须以 / 开始且不超过 240 字符。");
      const parent = resolve(raw, doc);
      for (const method of methods) {
        if (parent[method]) operations.push(operationFrom(path, method, parent[method], parent, doc));
      }
    }
    if (!operations.length || operations.length > 40) throw new Error("需要 1 到 40 个真实 HTTP 操作，请拆分后导入。");
    const server = Array.isArray(doc.servers) && doc.servers[0] ? doc.servers[0].url : "";
    // 相对地址和服务器变量需人工绑定，不能自动当作可连接地址。
    const absoluteServer = typeof server === "string" && ["https:", "http:"].some((scheme) => server.startsWith(scheme));
    const endpoint = absoluteServer ? server : "https://api.example.invalid";
    const warnings = ["当前只转换字段及调用骨架；复合 Schema、权限和业务规则需人工核对。"];
    if (!server || endpoint !== server) warnings.push("文档未提供绝对 HTTP 基地址，请在预览中填写实际地址。");
    return { operations, name: doc.info.title.slice(0, 80), endpoint, key: doc.info.title + "|" + String(server), warnings };
  }

  // 校验前捕获当前输入，失败清空旧预览，避免错误文档沿用旧操作。
  function parseImport() {
    ui.importText = document.getElementById("nw-import-text").value;
    ui.operations = []; ui.result = ""; ui.error = "";
    try {
      const parsed = parseDocument(ui.importText);
      Object.assign(ui, { operations: parsed.operations, importName: parsed.name, importEndpoint: parsed.endpoint,
        importKey: parsed.key, warnings: parsed.warnings, importRevision: model.revision });
      ui.result = "已读取 " + parsed.operations.length + " 个真实操作。请人工核对，再应用为本机配置草案。";
    } catch (cause) { ui.error = cause.message; }
    render();
  }

  // 人工字段仍执行结构检查，避免将无效JSON应用成“成功”配置。
  function editedFields(text) {
    const fields = JSON.parse(text);
    const names = new Set();
    if (!Array.isArray(fields) || fields.length > 60) throw new Error("字段需为最多 60 项的 JSON 数组。");
    fields.forEach((field) => {
      if (!field || typeof field.name !== "string" || !field.name || field.name.length > 120
        || !["string", "number", "integer", "boolean", "object", "array", "null"].includes(field.type)
        || !["path", "query", "header", "cookie", "body", "response"].includes(field.in)
        || typeof field.required !== "boolean") throw new Error("字段需要有效的 name、type、in 和布尔 required。");
      const key = field.in + ":" + field.name;
      if (names.has(key)) throw new Error("同一位置的字段名称不能重复。");
      if (field.in === "path" && !field.required) throw new Error("路径参数必须为 required: true。");
      names.add(key);
    });
    return fields;
  }

  // 声明式调用骨架不凭HTTP契约编造服务端业务实现。
  function requestDraft(operation) {
    const draftId = "draft-" + operation.id;
    return { id: draftId, name: operation.method + " " + operation.path, domain: "client",
      status: "configuration-draft", interpreterCompatible: false,
      nodes: [{ id: draftId + "-start", kind: "request-input", fields: clone(operation.requestFields) },
        { id: draftId + "-call", kind: "http-call-draft", operationId: operation.id },
        { id: draftId + "-result", kind: "result-or-error", fields: clone(operation.responseFields) }],
      edges: [{ from: draftId + "-start", to: draftId + "-call" }, { from: draftId + "-call", to: draftId + "-result" }] };
  }

  // 应用前再次校验全部选择项，一次事务写入；过期预览不覆盖较新工程。
  function applyImport() {
    if (ui.importRevision !== model.revision) { ui.error = "项目版本已改变，请重新校验文档再应用。"; render(); return; }
    try {
      const name = document.getElementById("nw-import-name").value.trim();
      const endpoint = document.getElementById("nw-import-endpoint").value.trim();
      const endpointIssue = endpointError("HTTPS", endpoint);
      if (!name || name.length > 80 || endpointIssue) throw new Error(endpointIssue || "服务名称需要 1 到 80 个字符。");
      const selected = ui.operations.filter((operation) => operation.selected);
      if (!selected.length) throw new Error("至少选择一个操作。");
      const keys = new Set();
      const next = clone(model.networking);
      let service = next.services.find((item) => item.sourceKey === ui.importKey);
      if (!service) { service = seed("HTTPS", id("service"), name); next.services.push(service); }
      const updated = selected.map((operation) => {
        const key = operation.method + " " + operation.path;
        if (!methods.includes(operation.method.toLowerCase()) || !operation.path.startsWith("/")
          || operation.path.length > 240 || !operation.name.trim() || operation.name.length > 120 || keys.has(key)) {
          throw new Error("操作名称 / 方法 / 路径无效或重复。");
        }
        keys.add(key);
        const previous = service.operations.find((item) => item.sourceKey === operation.sourceKey);
        return { id: previous ? previous.id : id("operation"), sourceKey: operation.sourceKey, name: operation.name,
          method: operation.method, path: operation.path, requestFields: editedFields(operation.requestText),
          responseFields: editedFields(operation.responseText), authSummary: operation.authSummary,
          responseStatus: operation.responseStatus, sourceSchemas: clone(operation.sourceSchemas) };
      });
      const touched = new Set(updated.map((operation) => operation.sourceKey));
      const remaining = service.operations.filter((operation) => !touched.has(operation.sourceKey));
      const merged = remaining.concat(updated);
      if (new Set(merged.map((operation) => operation.method + " " + operation.path)).size !== merged.length) {
        throw new Error("与已保存操作的方法 / 路径冲突；请在预览中修订。");
      }
      Object.assign(service, { name, endpoint, sourceKey: ui.importKey, operations: merged,
        workflowDrafts: merged.map(requestDraft), status: "configuration-draft" });
      next.imports.push({ id: id("import"), serviceId: service.id, operations: updated.map((operation) => operation.id),
        format: "OpenAPI-JSON", status: "reviewed-configuration-draft" });
      if (!saveDocument("从接口文档应用联网配置草案", next)) return;
      ui.active = service.id; ui.tab = "connections"; ui.error = "";
      ui.result = "已应用 " + updated.length + " 个真实操作和声明式工作流草案；未接入解释器、AI或真实网络。";
      render();
    } catch (cause) { ui.error = cause.message; ui.result = ""; render(); }
  }

  // 入门卡生成可审阅的消息与服务架构草案，绝不标成已部署网游。
  function addTemplate(kind) {
    const next = clone(model.networking);
    const serviceId = id("service");
    const name = kind === "rpg" ? "多人 RPG 世界" : kind === "slg" ? "SLG 权威世界" : "云存档与排行榜";
    const service = seed(kind === "save" ? "HTTPS" : "WSS", serviceId, name);
    if (kind !== "save") {
      const names = kind === "rpg" ? [["join_world", "send"], ["move_intent", "send"], ["chat", "send"],
        ["world_snapshot", "receive"], ["entity_delta", "receive"]]
        : [["submit_order", "send"], ["world_snapshot", "receive"], ["queue_update", "receive"]];
      service.messages = names.map((message) => ({ id: id("message"), name: message[0], direction: message[1], format: "JSON" }));
    }
    service.workflowDrafts = [{ id: id("draft"), name: "连接 → 身份验证待设计 → 收发消息 → 错误 / 重连",
      domain: "client", status: "configuration-draft", interpreterCompatible: false, nodes: [], edges: [] }];
    next.services.push(service);
    if (!saveDocument("添加" + name + "配置草案", next)) return;
    ui.active = service.id; ui.tab = "connections"; ui.error = "";
    ui.result = "已添加可编辑联网草案；服务器、同步与运行适配待研发。"; render();
  }

  // 示例本身是有效OpenAPI输入，也会走与用户文档相同的解析流程。
  // 预览场景与填充按钮使用相同真实OpenAPI样例。
  function exampleText() {
    return JSON.stringify({ openapi: "3.0.3", info: { title: "星岛 RPG API", version: "1.0.0" },
      servers: [{ url: "https://api.example.invalid" }], paths: {
        "/v1/characters/{characterId}": { get: { summary: "读取角色", parameters: [
          { name: "characterId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "角色", content: { "application/json": { schema: { type: "object",
          properties: { level: { type: "integer" }, name: { type: "string" } } } } } } } } },
        "/v1/world/join": { post: { summary: "申请进入世界", requestBody: { required: true,
          content: { "application/json": { schema: { type: "object", required: ["worldId"],
            properties: { worldId: { type: "string" } } } } } },
        responses: { "200": { description: "入场结果", content: { "application/json": { schema: { type: "object",
          properties: { sessionId: { type: "string" } } } } } } } } },
      } }, null, 2);
  }

  function example() {
    ui.importText = exampleText();
    ui.operations = []; ui.error = ""; ui.result = "已填入示例；点击校验读取真实 paths。"; render();
  }

  // 点击只处理本模块动作，不发起任何网络请求。
  function click(target) {
    if (target.dataset.nwTab) {
      ui.tab = target.dataset.nwTab; ui.error = ""; ui.result = ""; render(); return true;
    }
    if (target.dataset.nwService) { ui.active = target.dataset.nwService; ui.error = ""; render(); return true; }
    const name = target.dataset.nwAction;
    if (!name) return false;
    if (name === "save" || name === "check") saveConnection(name === "check");
    else if (name === "parse") parseImport();
    else if (name === "apply") applyImport();
    else if (name === "example") example();
    else if (name.startsWith("template:")) addTemplate(name.slice(9));
    else if (name.startsWith("add:")) {
      const protocol = name.slice(4);
      if (!protocols.includes(protocol)) return true;
      const next = clone(model.networking);
      const service = seed(protocol, id("service"), protocol + " 连接");
      service.endpoint = protocol === "TCP" ? "tcp://server.example.invalid:9000"
        : protocol === "UDP" ? "udp://server.example.invalid:9001"
          : protocol === "MQTT" ? "wss://broker.example.invalid/mqtt" : service.endpoint;
      next.services.push(service);
      if (!saveDocument("添加协议配置草案", next)) return true;
      ui.active = service.id;
      ui.error = ""; ui.result = "已添加 " + protocol + " 配置；请核对目标兼容性，当前未实现真实连接。"; render();
    }
    return true;
  }

  // 文件读取有大小和并发序号边界；文件仅在本机解析，不上传。
  function readFile(file) {
    const token = ++ui.fileSequence;
    if (!file || file.size > 524288) { ui.error = "请选择不超过 512 KiB 的 JSON 文件。"; render(); return; }
    file.text().then((text) => {
      if (token !== ui.fileSequence) return;
      ui.importText = text; ui.operations = []; ui.error = "";
      ui.result = "已在本机读取 " + file.name + "，尚未解析；请点击校验预览。"; render();
    }).catch(() => { if (token === ui.fileSequence) { ui.error = "文件读取失败，请重新选择。"; render(); } });
  }

  // 文档预览编辑留在草案，只有“应用”会提交工程事务。
  function change(inputElement) {
    if (inputElement.id === "nw-file") {
      readFile(inputElement.files[0]); inputElement.value = ""; return true;
    }
    if (inputElement.id === "nw-import-text") { ui.importText = inputElement.value; return true; }
    if (inputElement.dataset.nwOp) {
      const operation = ui.operations[Number(inputElement.dataset.nwIndex)];
      if (operation) operation[inputElement.dataset.nwOp] = inputElement.type === "checkbox"
        ? inputElement.checked : inputElement.value;
      return true;
    }
    return inputElement.id.startsWith("nw-");
  }

  // 无原生连接或隐式测试副作用；未来运行器应显式接入生命周期。
  function afterRender() { init(); }

  return { init, valid, enterState, page, click, change, afterRender };
})();
