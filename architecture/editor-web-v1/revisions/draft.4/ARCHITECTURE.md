# editor-web 第四版：七语言、英文默认与本机持久化

版本：editor-web-v1-draft.4；2026-11-17。实际读取“产品经理”会话最新四条用户补充及最终交付，接收localization-20261117-draft.1的3个LANG-REQ、9个LANG-AC。来源见[真实消息](inputs/product-conversation.json)、[产品规格](inputs/product/localization/LANGUAGE-SETTINGS.md)和[源文件基线](inputs/product-baselines.json)。

## 1. 本版取代与继承

最新语言范围为 **en、zh-Hans、zh-Hant、ja、ko、es、fr**。首次无有效已保存选择默认英文；系统语言不自动覆盖。用户主动选择成功保存后立即应用，离线、重启、升级、换项目/登录状态均沿用本机已存选择。简繁为独立资源和审阅范围。

本版取代第三版及此前输入中的“四语”要求、语言默认/保存策略；原冻结文件保留历史，不逐份改写。213操作面、88对话原子状态/28组合、GUIDE-VIEW-01—06与G01—06全部适用内置文字/布局提升为七语，不增加同数量语言页面。

[第三版引导](../draft.3/ONBOARDING.md)、[编辑/对话状态](../draft.3/EDITOR-STATE.md)、[源ID映射](../draft.3/contracts/product-architecture-map.json)继续继承；其中四语和教学进度“内存先行”的机制不能当语言选择的最新策略：**语言仅在本机设置提交成功后应用，失败保留此前有效选择**。学习完成证据、真实任务、localOnly、保存试玩栅栏继续有效。

## 2. 模块与数据边界

技术路线继续React/TypeScript DOM+SVG、Tauri2、Rust薄桥和本机UX、C++20共享领域。新增职责落在已有LocalUXService及其LocalPreferencesActor：统一首页/欢迎/设置语言面板、离线LocaleCatalog、顺序化选择与真实落盘；不另拆云服务或在C++重写界面语言。

语言设置使用独立host-private-app-data/editor-profile/editor-locale-v1.json，schema1，最大8KiB，单写者与有界旧副本。课程profile、布局恢复、项目DDL/游戏语言、LAN与导出各自分离。修复/升级读取不因安全英文回退而覆盖未知或损坏原件；显式重选才可能写新设置。详见[LOCALIZATION.md](LOCALIZATION.md)。

## 3. 接口演进

原EditorUXPort1.0对象关闭额外字段，不能直接添加字段并让旧客户端照常解析。采用显式协商 **EditorUXPort1.1，7方法**：保留6个课程/偏好方法，新增ux.locale.select；snapshot含独立localeState，describe含规范语言集合/选择通道，事件有语言提交事实。1.0保留其原6方法/原响应投影，不混用事件游标。

见[UX-CONTRACTS.md](UX-CONTRACTS.md)、[1.1 Schema](contracts/editor-ux.schema.json)、[TS声明](contracts/editor-ux.d.ts)。Core HostPort1.0的12方法、Core Driver1.0的14方法、C ABI1.0/消息1.0/DDL1均不变。课程重置不重置语言；语言选择不提交项目、不重发模型或构建任务。

## 4. 一致性与用户可见事实

启动读取成功的有效显式选择优先，其次英文；缺失/未知/读失败回退英文并保留诊断和语言入口。选择后以pending独立显示；真正提交成功后新语言生效，失败不假称已保存。快速连选以最后有效意图为准，旧响应不覆盖新选择；写入结果未知先核对本机文件，不盲重放。

语言切换保持页面、对象选区、视口、输入法草稿、撤销历史、任务、引导步骤及阅读锚点。已有聊天、用户项目/变量/文件名、第三方协议原文和游戏本地化配置不被翻译或改写。新对话发送时可冻结默认回复语言，用户明确指定优先；切换本身不调用模型。

## 5. 交付状态

本版冻结6份新增产品输入，继承第三版44份冻结架构文件；详细设计与源验收的技术落点见[开发交接](DEVELOPMENT-HANDOFF.md)、[语言政策](contracts/locale-policy.json)和[LANG验收映射](contracts/requirement-map.json)。

[独立架构清单](.architecture-mcp.json)、[文件基线](baseline.json)、[文档完整性记录](documentation-check.json)。当前交付为架构/接口文档；七语翻译目录、真实画稿、客户端实现、兼容锁和角色接收仍待办。原M1根清单与开发索引保持原迭代。没有构建/测试/扫描/Schema验证器/截图/设备操作；execution_status=not_run、quality_verified=false、release_permitted=false。
