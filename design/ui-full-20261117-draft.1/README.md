# GameGen 全量 UI 设计交付

设计修订：ui-full-20261117-draft.1，2026-11-17。完整产品设计草案，独立于 local-core-v1 无 GUI 研发包。

直接打开 [index.html](index.html)，无需联网或安装依赖。可按桌面/Android、模块、关键词、当前/后续范围筛选，点击页面后切换状态，并打开对应 SVG 或 PNG。这个目录用于看设计，产品交互仍以根目录的产品经理原型作为参考。

- 79 个业务页面 + 1 个公共浮层分组；16 种浮层。
- 507 张设计画板：桌面 264、Android 243；覆盖原型 195 个基础状态。
- 507 张可编辑 SVG、507 张 PNG；另有设计系统和三张总览图。
- 42 条需求、80 项验收定义均有关联；原型 780 个四语场景有映射。
- 新视觉稿以中文为基线；英/日/韩没有冒充成已完成的本语最终图。

| 文件 | 用途 |
| --- | --- |
| [index.html](index.html) | 全部页面和状态的离线浏览入口 |
| [桌面总览](desktop-overview.png) / [Android总览](android-overview.png) | 快速看视觉方向 |
| [专业工具总览](details-overview.png) | 模型、MCP、导入和契约校对 |
| [components.svg](components.svg) / [tokens.json](tokens.json) | 设计系统、组件状态和变量 |
| [DESIGN-SPEC.md](DESIGN-SPEC.md) | 跨端布局、业务约束和实施边界 |
| [INTERACTIONS.md](INTERACTIONS.md) | 完整路径、异常恢复和公共浮层 |
| [PAGE-SPECS.md](PAGE-SPECS.md) | 逐页面的操作、需求和状态索引 |
| [acceptance-matrix.csv](acceptance-matrix.csv) | 507项最终构建验收计划，全部 not_run |
| [locale-mapping.csv](locale-mapping.csv) | 原型780场景到新中文画板的映射 |
| [requirements-trace.json](requirements-trace.json) | 42条需求与80项验收的页面对应 |
| [assets.json](assets.json) | 图形来源、尺寸和许可状态 |
| [DOCUMENTATION-STATUS.md](DOCUMENTATION-STATUS.md) | 文档工具结果与未关闭事项 |

screens/ 是可编辑 SVG，previews/ 是同名 PNG；source/ 包含页面数据、渲染源、固定示例与输入摘要。可把 SVG 导入矢量设计工具继续编辑；普通控件仍应由 Qt/Flutter 组件实现，不能整页当作位图嵌入。

source/export-artboards.mjs 是可选的设计资产重建入口，需要 sharp；在当前机器可通过 GAMEGEN_DESIGN_NODE_MODULES 指向已提供的依赖目录。该入口不被登记为已执行的产品验证，重导出后如设计有变化需重算摘要并保留评审历史。

本次只执行设计资产绘制与导出，并查看了代表性画板。未构建产品、运行测试、做静态扫描、比较最终截图、调用模型/MCP或操作设备。真实设计负责人批准缺失，设计门禁为 documents_incomplete；执行 not_run、quality_verified=false、release_permitted=false。旧 .design-mcp.json 已保存在项目 .design-mcp/ui-full-20261117-draft.1/inputs/prior-design-mcp.json；未修改原型、产品/架构/研发/质量/流程清单。
