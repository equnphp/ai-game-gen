> 新增需求版本V3.7：[Windows多引擎项目转换](PROJECT-IMPORT-REQUIREMENTS-V3.7.md) · [Windows/Android局域网资源同步](LOCAL-LAN-SYNC-REQUIREMENTS-V3.7.md) · [架构交接](HANDOFF-IMPORT-SYNC-V3.7.md)。本轮仅文档；execution_status=not_run，quality_verified=false，release_permitted=false。以下可操作原型仍为V3.6，旧报告只对应原版本，不覆盖新增能力。

# Aimeta GameGen Studio · V3.6 可操作原型

构建身份：gamegen-prototype-v3.6-20261114-01。沿用蓝白界面，共195个基础状态、四语780个场景。

[打开原型](index.html) · [全部界面目录](gallery.html) · [完整需求](PRODUCT.md) · [本轮地图范围](PROTOTYPE-MAP-V3.5.md)

直接双击index.html可离线浏览；推荐用本地HTTP服务打开，浏览器本机存储依所在地址保存。无需安装node_modules即可使用交互原型。

## 新增：AI开发助手

设置→AI开发助手可管理模型服务、MCP工具和Skill技能；对话输入区可直接选择模型或打开扩展配置。

- 模型：自定义Base URL、模型ID和API Key；OpenAI Chat Completions/Responses、Claude Messages的API Key/Bearer两个预设，以及按API格式选择路由的OpenCode Go。
- MCP：远程地址或本地stdio参数数组、当前项目/全部项目范围、只读/工作流提案权限、启停与配置格式检查。
- Skill：填写说明或导入SKILL.md，预览、保存、启停；正文只作文本，不执行脚本。
- 会话：发送时固定模型、工具、技能版本及费用来源。配置变更从下一轮生效。
- 密钥：原型仅在内存暂存；本机持久化只保存配置元数据，刷新后按服务要求重新填写。不会向真实模型/MCP发请求。

完整新增需求见ASSISTANT-EXTENSIONS-REQUIREMENTS-V3.6.md。

## 先看新增地图

1. 顶部选择桌面端/Android、世界与玩法、斜45°立体地图。也可从旧地图页点击“斜45°立体地图”。
2. 用草地、水面、树林、小屋、宝箱画地图；俯视辅助与立体显示共用地块。
3. 高级设置包含0—3层高度、坡道、桥面、阻挡、地面/桥面通行面和遮挡透明度。
4. 寻路与试玩：选择地块与通行面，设置起终点，检查路径并预览行走。高度差或上下桥需要坡道。
5. 关卡目标：设置名称、通关条件、目标数量及奖励金币；保存会同步旧地图与关卡工具。可进入当前关卡工作流。
6. 手机点“横屏编辑”扩大地图工作台，再返回竖屏；选择、输入草稿和已提交修改保留。

地图修改使用已有项目事务、撤销/重做和本机存储。试玩/显示切换不修改地图逻辑。界面支持中英日韩，用户手工内容保持原文。

## 原有页面继续保留

创建项目时先选游戏类型；画面中的物理、粒子和角色动作预设可编辑；世界与玩法包括数值、成长、任务及对话分支；API工具包括协议配置和有限OpenAPI 3 JSON导入。工作流支持添加节点、连接、参数、移动、检查、模拟运行、撤销/重做及手机横屏。

完整产品需求见PRODUCT-REQUIREMENTS-V3.5.md和地图/工作流网络/编辑器引擎/游戏类型四份附件。原型只实现其中明确的浏览器交互样例；页面中的模型生成、费用、服务器运行和游戏导出均为演示。本轮没有生成Qt/Android原生编辑器或游戏引擎，也没有调用真实云模型、扣积分或导出APK。完整需求不因这些原型边界缩减。

## 版本与检查

源码：app.js、studio.js、workflow.js、creation.js、effects-preview.js、gameplay.js、networking.js、isometric.js、assistant-setup.js、i18n.js及对应HTML/CSS/语言资源。evidence/v3.6存放本轮浏览器检查和实际界面截图；旧V3.4设计图保留，不覆盖为已批准图。

新增72个助手设置场景；地图的52个场景继续保留。新增界面是可审阅设计稿；人工设计审批仍为空。浏览器检查与静态质量检查不代表原生真机、母语审校或完整引擎验收。界面目录是交付导航，不单列为编辑器功能状态。

开发检查使用npm ci --ignore-scripts及npm run lint；tools目录包含隔离Chrome的交互检查脚本。正式产品不能把这些有限样例当作真实引擎、网络服务或费用实现。
