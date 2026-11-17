# V3.6 助手扩展原型检查

构建：gamegen-prototype-v3.6-20261114-01。本节为当前原型记录，下方V3.4记录作为历史保留。

- 四语界面：195个基础状态×4语言=780场景通过；0浏览器脚本异常、0缺失译文编号，均无页面横向溢出。
- 交互：助手81、地图58、创作37、工作流67、触控62、语言56、全局55，合计416项通过。
- 七份浏览器报告位于evidence/v3.6，source_sha256一致为ccf03721b6f39f255d8674743dd98e4d349e601675f0ea5cb5b742e5b452dfc4。
- ESLint规则检查通过；最终MCP质量状态以.quality-mcp/v3.6/final-report.json为准。
- 780个场景均绑定当前构建实际截图；656个已有独立设计基线已比较，52个地图与72个助手新增设计稿未有独立批准基线。差异与人工哈希审批未关闭，不声明设计门禁通过。
- 模型/MCP/Skill为配置与会话演示；未进行真实外部请求、命令或脚本执行。Key只存会话内存，尚不证明原生系统安全凭据实现。
- 完整需求仍由V3.5主规格与V3.6扩展构成；浏览器通过结果不替代原生、多系统、母语审校、真实新手、辅助技术或完整引擎验收。

---

# V3.4 四语原型检查

构建：gamegen-prototype-v3.4-20261113-01。最终验证于2026-11-14完成，保留启动本轮时的构建标识。源为本地HTML原型，不含真实C++/Qt/Android构建。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 四语页面 | 164基础状态×4语言=656场景、55跨入口交互通过；0脚本异常、0缺失翻译ID、页面无横向溢出 | evidence/v3.4/all-browser-check.json |
| 语言与内容隔离 | 56项通过：目录、切换、输入/JSON/选择保留、快照/版本不变、自定义名跨入口、提示、暂停画布、横竖屏、偏好与安全回退 | evidence/v3.4/i18n-browser-check.json |
| 新增创作能力回归 | 37项通过 | evidence/v3.4/creation-browser-check.json |
| 工作流回归 | 67项通过 | evidence/v3.4/workflow-browser-check.json |
| 触控输入 | 62项通过，隔离Chrome的CDP输入，不是实体手机 | evidence/v3.4/workflow-touch-check.json |
| 代码质量 | 以最终原始报告的complete、coverage、gate与stale为准；内置词法检查+ESLint，不证明完整安全性 | .quality-mcp/v3.4/final-report.json |
| 产品与设计门禁 | discovery核查声明及摘要；design仍缺5次变更的人工批准；原生实际图与哈希批准缺失 | .product-mcp/v3.4、.design-mcp/v3.4 |

五份最终浏览器报告源码摘要一致：1a0d2a98ea725c6e811e88b4280ac250405781a2efeae12986c9c127e31ee403。原型代码与语言资源在最终回归后保持不变。656张设计PNG在design/v3.4/screens；design_mcp库存按page/state统计164个基础状态，另有四语变体656个。没有用设计图自比较冒充Qt/Android实际截图。

三位agent各完成1680条英语/日语/韩语初稿与键集合校验；英语agent另静态复核接入并发现两处遗漏。已修复用户自定义节点名在连接/调试的引用保护、textarea提示属性，并增加暂停画布局部重画，全部纳入56项语言检查。记录见evidence/v3.4/translation-review.md。母语人员校对、真实新手研究、实体设备、三系统字体/输入法/辅助技术仍未完成。

语言目录离线加载，不依赖外部翻译API。未调用真实模型、扣费、部署服务器或生成游戏包。Android本机OpenCode、C++/WASM与小游戏、真离线APK、原生UI与正式人工验收继续按V3.3方案的技术验证门槛推进。
