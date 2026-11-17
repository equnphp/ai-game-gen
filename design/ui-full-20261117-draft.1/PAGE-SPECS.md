# 逐页 UI 规格

修订：ui-full-20261117-draft.1。80 个页面/浮层分组。字段、文案、布局以同名 SVG 画板为视觉基线；业务约束以产品与架构输入为准。所有人员批准待登记；运行状态 not_run。

<a id="projects"></a>

## 项目工作台 · projects

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：新建游戏 → 打开项目 → 从引擎导入 → 附近设备。
- 正常后续：[创建新游戏](#new-project)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-001、REQ-017。验收定义：AC-001、AC-030。
- 页面画板：8 张；状态：normal、first_use、empty、no_results。
- 视觉源：[desktop-projects-normal](screens/desktop-projects-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="new-project"></a>

## 创建新游戏 · new-project

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：选择类型 → 选择起点 → 命名并创建。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-001、REQ-034。验收定义：AC-001、AC-047。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-new-project-normal](screens/desktop-new-project-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="templates"></a>

## 玩法模板 · templates

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：搜索类型 → 预览规则 → 使用模板。
- 正常后续：[创建新游戏](#new-project)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-034。验收定义：AC-047。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-templates-normal](screens/desktop-templates-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="chat"></a>

## 对话创作 · chat

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：创作。
- 主操作：选择模型 → 补充需求 → 查看提案 → 发送。
- 正常后续：[审阅本次修改](#proposal)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-002、REQ-027。验收定义：AC-002、AC-012、AC-017、AC-040。
- 页面画板：18 张；状态：normal、loading、clarification、offline、error_timeout、interrupted、success、duplicate。
- 视觉源：[desktop-workspace-normal](screens/desktop-workspace-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="sessions"></a>

## 创作会话 · sessions

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：创作。
- 主操作：新会话 → 重命名 → 分支 → 上下文摘要。
- 正常后续：返回原上下文；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-027。验收定义：AC-040。
- 页面画板：4 张；状态：sessions、normal。
- 视觉源：[desktop-sessions-normal](screens/desktop-sessions-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="proposal"></a>

## 审阅本次修改 · proposal

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：创作。
- 主操作：查看变化 → 逐项接受 → 放弃 → 应用修改。
- 正常后续：[场景编辑器](#scene)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-004、REQ-026、REQ-040。验收定义：AC-004、AC-013、AC-014、AC-015、AC-016、AC-039、AC-073、AC-074。
- 页面画板：4 张；状态：review、normal。
- 视觉源：[desktop-proposal-normal](screens/desktop-proposal-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="permissions"></a>

## 工具使用授权 · permissions

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：创作。
- 主操作：查看目标 → 本次允许 → 限定范围 → 拒绝。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-027、REQ-035。验收定义：AC-040、AC-051、AC-053。
- 页面画板：6 张；状态：permission、assist_permission、normal。
- 视觉源：[desktop-permissions-normal](screens/desktop-permissions-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="scene"></a>

## 场景编辑器 · scene

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：添加对象 → 选择移动 → 编辑属性 → 试玩。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-003、REQ-018。验收定义：AC-003、AC-031。
- 页面画板：14 张；状态：normal、selected、abilities、ability_empty、ability_error、ability_missing、ability_paused。
- 视觉源：[desktop-scene-normal](screens/desktop-scene-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="prefab"></a>

## 预制体与实例 · prefab

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：编辑模板 → 查看覆盖 → 恢复字段 → 应用到模板。
- 正常后续：[场景编辑器](#scene)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-018。验收定义：AC-031。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-prefab-normal](screens/desktop-prefab-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="camera"></a>

## 画面与摄像机 · camera

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：画面层级 → 相机边界 → 预览比例 → 安全区。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-019。验收定义：AC-032。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-camera-normal](screens/desktop-camera-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="game-ui"></a>

## 游戏 UI 编辑 · game-ui

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：添加控件 → 锚点 → 多语预览 → 绑定工作流。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-019。验收定义：AC-032。
- 页面画板：4 张；状态：normal、invalid。
- 视觉源：[desktop-game-ui-normal](screens/desktop-game-ui-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="controls"></a>

## 输入与角色控制 · controls

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：输入映射 → 虚拟摇杆 → 交互优先级 → 预览。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-019、REQ-020。验收定义：AC-032、AC-033。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-controls-normal](screens/desktop-controls-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="physics"></a>

## 运动与碰撞 · physics

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：选择预设 → 编辑碰撞体 → 分组 → 高级参数。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-020。验收定义：AC-033。
- 页面画板：6 张；状态：physics、physics_advanced、normal。
- 视觉源：[desktop-physics-normal](screens/desktop-physics-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="particles"></a>

## 粒子与特效 · particles

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：特效预设 → 发射器 → 生命周期 → 播放。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-021。验收定义：AC-034。
- 页面画板：6 张；状态：particles、particles_advanced、normal。
- 视觉源：[desktop-particles-normal](screens/desktop-particles-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="animation"></a>

## 动画时间轴 · animation

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：帧动画 → 补间 → 事件点 → 播放范围。
- 正常后续：[动画控制图](#animation-graph)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-021。验收定义：AC-034。
- 页面画板：6 张；状态：normal、ability_missing、ability_paused。
- 视觉源：[desktop-animation-normal](screens/desktop-animation-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="skeleton"></a>

## 骨骼与角色动作 · skeleton

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：骨骼层级 → 蒙皮 → 挂点 → 动作片段。
- 正常后续：[动画时间轴](#animation)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-021。验收定义：AC-034。
- 页面画板：6 张；状态：skeleton、skeleton_advanced、normal。
- 视觉源：[desktop-skeleton-normal](screens/desktop-skeleton-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="animation-graph"></a>

## 动画控制图 · animation-graph

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：画面。
- 主操作：添加状态 → 过渡条件 → 混合 → 预览。
- 正常后续：返回原上下文；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-021。验收定义：AC-034。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-animation-graph-normal](screens/desktop-animation-graph-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="audio"></a>

## 音频与混音 · audio

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：资源。
- 主操作：试听 → 音轨 → 淡入淡出 → 叠加策略。
- 正常后续：[资源详情与依赖](#asset-detail)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-022。验收定义：AC-035。
- 页面画板：6 张；状态：normal、ability_missing、ability_paused。
- 视觉源：[desktop-audio-normal](screens/desktop-audio-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="assets"></a>

## 资源库 · assets

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：资源。
- 主操作：搜索筛选 → 导入 → 查看引用 → 资源详情。
- 正常后续：[导入本地资源](#import-assets)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-005、REQ-022。验收定义：AC-005、AC-035。
- 页面画板：8 张；状态：normal、empty、no_results、permission_denied。
- 视觉源：[desktop-assets-normal](screens/desktop-assets-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="asset-detail"></a>

## 资源详情与依赖 · asset-detail

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：资源。
- 主操作：预览 → 来源许可 → 使用位置 → 替换版本。
- 正常后续：[场景编辑器](#scene)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-022。验收定义：AC-035。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-asset-detail-normal](screens/desktop-asset-detail-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="import-assets"></a>

## 导入本地资源 · import-assets

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：资源。
- 主操作：选择文件 → 依赖检查 → 处理重名 → 导入。
- 正常后续：[资源库](#assets)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-005、REQ-022。验收定义：AC-005、AC-035。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-import-assets-normal](screens/desktop-import-assets-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="generate-image"></a>

## 生成图片 · generate-image

- 范围：后续联网能力的设计预留。
- 平台：desktop / android。分组：资源。
- 主操作：填写描述 → 选择模型 → 费用上限 → 比较候选。
- 正常后续：[资源生成任务](#generation-tasks)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-006、REQ-030。验收定义：AC-006、AC-043。
- 页面画板：12 张；状态：normal、loading、success、error_timeout、insufficient。
- 视觉源：[desktop-generate-normal](screens/desktop-generate-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="generate-audio"></a>

## 生成音效 · generate-audio

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：资源。
- 主操作：本机模型 → 音效描述 → 试听 → 接收资源。
- 正常后续：[音频与混音](#audio)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-006、REQ-022、REQ-030。验收定义：AC-006、AC-035、AC-043。
- 页面画板：10 张；状态：normal、missing_runtime、loading、success、error_timeout。
- 视觉源：[desktop-generate-audio-normal](screens/desktop-generate-audio-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="generation-tasks"></a>

## 资源生成任务 · generation-tasks

- 范围：后续联网能力的设计预留。
- 平台：desktop / android。分组：资源。
- 主操作：任务状态 → 取消 → 用量 → 重新获取产物。
- 正常后续：[资源库](#assets)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-030。验收定义：AC-043。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-generation-tasks-normal](screens/desktop-generation-tasks-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="map"></a>

## 斜45°地图 · map

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：世界。
- 主操作：画地面 → 放物体 → 图层 → 寻路试玩。
- 正常后续：[通行面与寻路](#map-path)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-016、REQ-013。验收定义：AC-024、AC-025、AC-026、AC-027、AC-028、AC-029、AC-048、AC-049、AC-050、AC-020。
- 页面画板：9 张；状态：map_editor、isometric、iso_empty、iso_landscape、normal。
- 视觉源：[desktop-map-normal](screens/desktop-map-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="map-height"></a>

## 高度与桥梁 · map-height

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：世界。
- 主操作：高度层 → 坡道 → 桥面 → 遮挡。
- 正常后续：[通行面与寻路](#map-path)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-016。验收定义：AC-024、AC-025、AC-026、AC-027、AC-028、AC-029、AC-048、AC-049、AC-050。
- 页面画板：4 张；状态：iso_height、normal。
- 视觉源：[desktop-map-height-normal](screens/desktop-map-height-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="map-path"></a>

## 通行面与寻路 · map-path

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：世界。
- 主操作：起点 → 终点 → 地面桥面 → 检查路径。
- 正常后续：[关卡与目标](#levels)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-016。验收定义：AC-024、AC-025、AC-026、AC-027、AC-028、AC-029、AC-048、AC-049、AC-050。
- 页面画板：6 张；状态：iso_path、iso_invalid、normal。
- 视觉源：[desktop-map-path-normal](screens/desktop-map-path-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="levels"></a>

## 关卡与目标 · levels

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：世界。
- 主操作：选择地图 → 通关规则 → 奖励 → 进入工作流。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-016、REQ-010。验收定义：AC-024、AC-025、AC-026、AC-027、AC-028、AC-029、AC-048、AC-049、AC-050、AC-010。
- 页面画板：6 张；状态：levels、iso_level、normal。
- 视觉源：[desktop-levels-normal](screens/desktop-levels-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="world"></a>

## 世界与地图连接 · world

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：世界。
- 主操作：地图连接 → 出生点 → 传送 → 区域规则。
- 正常后续：[斜45°地图](#map)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-016。验收定义：AC-024、AC-025、AC-026、AC-027、AC-028、AC-029、AC-048、AC-049、AC-050。
- 页面画板：4 张；状态：normal、empty。
- 视觉源：[desktop-world-normal](screens/desktop-world-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="data"></a>

## 数值与成长 · data

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：数据表 → 校验公式 → 关联对象 → 批量编辑。
- 正常后续：[经济与平衡模拟](#economy)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-023、REQ-013。验收定义：AC-036、AC-020。
- 页面画板：4 张；状态：data_tables、normal。
- 视觉源：[desktop-data-normal](screens/desktop-data-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="economy"></a>

## 经济与平衡模拟 · economy

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：公式 → 固定种子 → 对比方案 → 查看流水。
- 正常后续：[数值与成长](#data)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-023。验收定义：AC-036。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-economy-normal](screens/desktop-economy-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="rpg"></a>

## RPG 战斗与物品 · rpg

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：角色 → 技能 → 物品 → Buff规则。
- 正常后续：[任务与进度](#quests)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-024、REQ-010。验收定义：AC-037、AC-010。
- 页面画板：4 张；状态：rpg、normal。
- 视觉源：[desktop-rpg-normal](screens/desktop-rpg-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="quests"></a>

## 任务与进度 · quests

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：目标组合 → 前置条件 → 奖励 → 重复限制。
- 正常后续：[对白与分支](#dialogue)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-024、REQ-013。验收定义：AC-037、AC-020。
- 页面画板：4 张；状态：quests、normal。
- 视觉源：[desktop-quests-normal](screens/desktop-quests-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="dialogue"></a>

## 对白与分支 · dialogue

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：对白节点 → 分支条件 → 角色 → 预览。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-024。验收定义：AC-037。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-dialogue-normal](screens/desktop-dialogue-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="slg"></a>

## 经营与策略规则 · slg

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：玩法。
- 主操作：建筑 → 配方 → 队列 → 科技 → 防御波次。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-025、REQ-010。验收定义：AC-038、AC-010。
- 页面画板：4 张；状态：slg、normal。
- 视觉源：[desktop-slg-normal](screens/desktop-slg-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="workflow"></a>

## 工作流编辑器 · workflow

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：工作流。
- 主操作：添加节点 → 连接 → 参数 → 校验 → 调试。
- 正常后续：[节点与子工作流库](#nodes)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-004、REQ-026。验收定义：AC-004、AC-013、AC-014、AC-015、AC-016、AC-039。
- 页面画板：24 张；状态：normal、selected、invalid、module_rpg、module_slg、module_levels、connecting、empty、no_results、properties、guide、landscape、landscape_invalid。
- 视觉源：[desktop-workflow-normal](screens/desktop-workflow-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="nodes"></a>

## 节点与子工作流库 · nodes

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：工作流。
- 主操作：搜索 → 分类 → 输入输出 → 插入。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-026。验收定义：AC-039。
- 页面画板：5 张；状态：library、landscape_library、normal。
- 视觉源：[desktop-nodes-normal](screens/desktop-nodes-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="graph-debug"></a>

## 工作流逐步调试 · graph-debug

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：工作流。
- 主操作：断点 → 单步 → 变量 → 调用链。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-026。验收定义：AC-039。
- 页面画板：4 张；状态：debug、normal。
- 视觉源：[desktop-graph-debug-normal](screens/desktop-graph-debug-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="api"></a>

## API 与接口契约 · api

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：联网。
- 主操作：接口列表 → 请求响应 → 认证引用 → 生成工作流。
- 正常后续：[接口识别结果校对](#api-review)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-011、REQ-028。验收定义：AC-011、AC-041。
- 页面画板：6 张；状态：normal、invalid、unauthenticated。
- 视觉源：[desktop-api-normal](screens/desktop-api-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="api-import"></a>

## 导入接口文档 · api-import

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：联网。
- 主操作：选择文档 → 来源页码 → 识别 → 问题澄清。
- 正常后续：[接口识别结果校对](#api-review)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-014、REQ-028。验收定义：AC-021、AC-041。
- 页面画板：6 张；状态：import、import_invalid、normal。
- 视觉源：[desktop-api-import-normal](screens/desktop-api-import-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="api-review"></a>

## 接口识别结果校对 · api-review

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：联网。
- 主操作：字段映射 → 来源对照 → 缺失处理 → 应用。
- 正常后续：[API 与接口契约](#api)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-028。验收定义：AC-041。
- 页面画板：4 张；状态：import_review、normal。
- 视觉源：[desktop-api-review-normal](screens/desktop-api-review-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="protocol"></a>

## 协议与目标能力 · protocol

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：联网。
- 主操作：传输 → 编码 → 安全层 → 兼容性。
- 正常后续：[API 与接口契约](#api)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-028。验收定义：AC-041。
- 页面画板：4 张；状态：protocols、normal。
- 视觉源：[desktop-protocol-normal](screens/desktop-protocol-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="realtime"></a>

## 实时连接配置 · realtime

- 范围：后续联网能力的设计预留。
- 平台：desktop / android。分组：联网。
- 主操作：握手 → 心跳 → 重连 → 消息幂等。
- 正常后续：[服务端工作流](#server-graph)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-028、REQ-029。验收定义：AC-041、AC-042。
- 页面画板：4 张；状态：realtime、normal。
- 视觉源：[desktop-realtime-normal](screens/desktop-realtime-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="server-graph"></a>

## 服务端工作流 · server-graph

- 范围：后续联网能力的设计预留。
- 平台：desktop / android。分组：联网。
- 主操作：执行域 → 可信校验 → 状态 → 错误路径。
- 正常后续：[房间与持续世界](#multiplayer)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-011、REQ-029。验收定义：AC-011、AC-042。
- 页面画板：5 张；状态：server、server_landscape、normal。
- 视觉源：[desktop-server-graph-normal](screens/desktop-server-graph-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="multiplayer"></a>

## 房间与持续世界 · multiplayer

- 范围：后续联网能力的设计预留。
- 平台：desktop / android。分组：联网。
- 主操作：房间 → 区域 → 重连 → 数据版本。
- 正常后续：[试玩与输入预览](#preview)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-029。验收定义：AC-042。
- 页面画板：4 张；状态：mmorpg、normal。
- 视觉源：[desktop-multiplayer-normal](screens/desktop-multiplayer-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="preview"></a>

## 试玩与输入预览 · preview

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：试玩。
- 主操作：开始 → 暂停 → 重置 → 设备比例 → 日志。
- 正常后续：[问题与诊断](#diagnostics)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-032。验收定义：AC-045。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-preview-normal](screens/desktop-preview-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="diagnostics"></a>

## 问题与诊断 · diagnostics

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：试玩。
- 主操作：筛选 → 定位对象 → 跳转节点 → 修复建议。
- 正常后续：[场景编辑器](#scene)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-032。验收定义：AC-045。
- 页面画板：4 张；状态：normal、empty。
- 视觉源：[desktop-diagnostics-normal](screens/desktop-diagnostics-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="localization"></a>

## 游戏内容本地化 · localization

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：设置。
- 主操作：四语 → 缺失翻译 → 回退 → 预览。
- 正常后续：[导出游戏](#publish)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-015、REQ-031。验收定义：AC-022、AC-023、AC-044。
- 页面画板：6 张；状态：normal、no_results、invalid。
- 视觉源：[desktop-localization-normal](screens/desktop-localization-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="publish"></a>

## 导出游戏 · publish

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：发布。
- 主操作：选择目标 → 检查能力 → 固定版本 → 生成。
- 正常后续：[导出目标设置](#target-settings)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-007、REQ-033。验收定义：AC-007、AC-046。
- 页面画板：12 张；状态：normal、offline、loading、interrupted、error_timeout、success。
- 视觉源：[desktop-publish-normal](screens/desktop-publish-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="target-settings"></a>

## 导出目标设置 · target-settings

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：发布。
- 主操作：包名 → 版本 → 方向 → 图标 → 签名凭据引用。
- 正常后续：[本地构建进度](#build-progress)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-033。验收定义：AC-046。
- 页面画板：6 张；状态：normal、invalid、credential_missing。
- 视觉源：[desktop-target-settings-normal](screens/desktop-target-settings-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="build-progress"></a>

## 本地构建进度 · build-progress

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：发布。
- 主操作：查看阶段 → 取消 → 输出日志 → 恢复。
- 正常后续：[构建产物与版本](#build-result)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-033。验收定义：AC-046。
- 页面画板：8 张；状态：normal、interrupted、error_timeout、cancelled。
- 视觉源：[desktop-build-progress-normal](screens/desktop-build-progress-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="build-result"></a>

## 构建产物与版本 · build-result

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：发布。
- 主操作：打开目录 → 安装包 → 校验清单 → 再次编辑。
- 正常后续：[场景编辑器](#scene)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-033。验收定义：AC-046。
- 页面画板：4 张；状态：normal、success。
- 视觉源：[desktop-build-result-normal](screens/desktop-build-result-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="history"></a>

## 历史与恢复点 · history

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：查看变化 → 锁定 → 新建恢复点 → 恢复副本。
- 正常后续：[版本差异](#diff)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-008、REQ-017。验收定义：AC-008、AC-030。
- 页面画板：4 张；状态：normal、conflict。
- 视觉源：[desktop-history-normal](screens/desktop-history-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="diff"></a>

## 版本差异 · diff

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：按对象比较 → 保留双方 → 局部应用。
- 正常后续：[项目恢复与兼容](#recovery)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-008、REQ-017。验收定义：AC-008、AC-030。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-diff-normal](screens/desktop-diff-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="recovery"></a>

## 项目恢复与兼容 · recovery

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：项目。
- 主操作：查看检查点 → 保留旧版本 → 恢复副本 → 重新授权。
- 正常后续：[项目工作台](#projects)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-017。验收定义：AC-030。
- 页面画板：10 张；状态：normal、version_incompatible、permission_denied、insufficient_space、success。
- 视觉源：[desktop-recovery-normal](screens/desktop-recovery-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="settings"></a>

## 偏好与本机配置 · settings

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：设置。
- 主操作：界面语言 → 目录 → 保存 → 安全凭据。
- 正常后续：[模型服务](#models)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-009、REQ-031、REQ-015。验收定义：AC-009、AC-044、AC-022、AC-023。
- 页面画板：4 张；状态：normal、unauthenticated。
- 视觉源：[desktop-settings-normal](screens/desktop-settings-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="models"></a>

## 模型服务 · models

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：添加 → 编辑 → 作用范围 → 默认模型。
- 正常后续：[添加模型服务](#model-form)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-037。验收定义：AC-054、AC-055、AC-056、AC-057。
- 页面画板：4 张；状态：assistants、normal。
- 视觉源：[desktop-models-normal](screens/desktop-models-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="model-form"></a>

## 添加模型服务 · model-form

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：服务来源 → API格式 → Base URL → 模型ID → 凭据。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-037。验收定义：AC-054、AC-055、AC-056、AC-057。
- 页面画板：12 张；状态：llm_add、assist_error、normal、invalid、credential_missing、success。
- 视觉源：[desktop-model-form-normal](screens/desktop-model-form-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="mcp"></a>

## MCP 工具 · mcp

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：添加连接 → 查看能力 → 范围 → 授权状态。
- 正常后续：[添加 MCP 连接](#mcp-form)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-035。验收定义：AC-051、AC-053。
- 页面画板：6 张；状态：assist_empty、assist_offline、normal。
- 视觉源：[desktop-mcp-normal](screens/desktop-mcp-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="mcp-form"></a>

## 添加 MCP 连接 · mcp-form

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：连接方式 → 参数数组 → 依赖 → 动作权限。
- 正常后续：[MCP 工具](#mcp)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-035。验收定义：AC-051、AC-053。
- 页面画板：14 张；状态：mcp_add、normal、missing_runtime、unauthenticated、error_timeout、permission、success。
- 视觉源：[desktop-mcp-form-normal](screens/desktop-mcp-form-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="skills"></a>

## Skill 技能 · skills

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：预览 → 导入 → 启用范围 → 更新差异。
- 正常后续：[Skill 详情与版本](#skill-detail)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-036。验收定义：AC-052。
- 页面画板：6 张；状态：normal、empty、no_results。
- 视觉源：[desktop-skills-normal](screens/desktop-skills-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="skill-detail"></a>

## Skill 详情与版本 · skill-detail

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：正文 → 附件 → 依赖 → 内容版本 → 启用。
- 正常后续：[Skill 技能](#skills)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-036。验收定义：AC-052。
- 页面画板：10 张；状态：skill_add、normal、invalid、permission、success。
- 视觉源：[desktop-skill-detail-normal](screens/desktop-skill-detail-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="assistant-log"></a>

## 助手活动与用量 · assistant-log

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：扩展。
- 主操作：轮次快照 → 工具记录 → 脱敏 → 事务关联。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-027、REQ-035、REQ-036、REQ-037。验收定义：AC-040、AC-051、AC-053、AC-052、AC-054、AC-055、AC-056、AC-057。
- 页面画板：4 张；状态：assist_log、normal。
- 视觉源：[desktop-assistant-log-normal](screens/desktop-assistant-log-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="tools"></a>

## 全部创作工具 · tools

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：工具。
- 主操作：搜索 → 最近使用 → 按任务浏览 → 收藏。
- 正常后续：[斜45°地图](#map)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-012、REQ-032、REQ-034。验收定义：AC-018、AC-019、AC-045、AC-047。
- 页面画板：4 张；状态：normal、no_results。
- 视觉源：[desktop-tools-normal](screens/desktop-tools-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-devices"></a>

## 附近设备 · lan-devices

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：允许发现 → 选择设备 → 扫码 → 本地地址。
- 正常后续：[确认配对](#lan-pair)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：12 张；状态：normal、empty、loading、unreachable、permission_denied、version_incompatible。
- 视觉源：[desktop-lan-devices-normal](screens/desktop-lan-devices-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-pair"></a>

## 确认配对 · lan-pair

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：双端核对 → 确认 → 拒绝 → 过期重试。
- 正常后续：[设备信任与授权范围](#lan-scope)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：10 张；状态：normal、pair_expired、pair_rejected、loading、success。
- 视觉源：[desktop-lan-pair-normal](screens/desktop-lan-pair-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-scope"></a>

## 设备信任与授权范围 · lan-scope

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：项目范围 → 操作权限 → 断开 → 取消信任。
- 正常后续：[同步变化预览](#lan-diff)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：6 张；状态：normal、revoked、permission_denied。
- 视觉源：[desktop-lan-scope-normal](screens/desktop-lan-scope-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-diff"></a>

## 同步变化预览 · lan-diff

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：固定快照 → 缺失依赖 → 空间检查 → 开始同步。
- 正常后续：[传输与断点续传](#lan-transfer)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：12 张；状态：normal、loading、empty、insufficient_space、version_incompatible、required_missing。
- 视觉源：[desktop-lan-diff-normal](screens/desktop-lan-diff-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-transfer"></a>

## 传输与断点续传 · lan-transfer

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：进度 → 暂停 → 续传 → 源变化处理。
- 正常后续：[接收完成与继续创作](#lan-received)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：14 张；状态：normal、interrupted、source_changed、checksum_failed、insufficient_space、success、cancelled。
- 视觉源：[desktop-lan-transfer-normal](screens/desktop-lan-transfer-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-conflict"></a>

## 同步冲突处理 · lan-conflict

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：共同祖先 → 两侧修改 → 保留版本 → 提交。
- 正常后续：[同步变化预览](#lan-diff)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：8 张；状态：normal、empty、invalid、success。
- 视觉源：[desktop-lan-conflict-normal](screens/desktop-lan-conflict-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-diagnostics"></a>

## 局域网连接诊断 · lan-diagnostics

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：系统权限 → 网卡 → 防火墙说明 → 重试。
- 正常后续：[附近设备](#lan-devices)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：6 张；状态：normal、offline、permission_denied。
- 视觉源：[desktop-lan-diagnostics-normal](screens/desktop-lan-diagnostics-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="lan-received"></a>

## 接收完成与继续创作 · lan-received

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：同步。
- 主操作：查看固定版本 → 打开副本 → 查看迁移报告。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-039。验收定义：AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：6 张；状态：normal、credential_missing、version_incompatible。
- 视觉源：[desktop-lan-received-normal](screens/desktop-lan-received-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-import"></a>

## 从引擎工程导入 · engine-import

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：选择三类引擎 → 只读来源 → 目标新目录。
- 正常后续：[内容分析与兼容性](#engine-analysis)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：5 张；状态：normal、empty、unsupported_source、permission_denied、invalid。
- 视觉源：[desktop-engine-import-normal](screens/desktop-engine-import-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-analysis"></a>

## 内容分析与兼容性 · engine-analysis

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：版本能力 → 依赖 → 阻塞项 → 继续。
- 正常后续：[迁移映射与许可](#engine-mapping)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：5 张；状态：normal、loading、required_missing、version_incompatible、error_timeout。
- 视觉源：[desktop-engine-analysis-normal](screens/desktop-engine-analysis-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-mapping"></a>

## 迁移映射与许可 · engine-mapping

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：对象映射 → 四类结果 → 许可 → 待补工作流。
- 正常后续：[转换进度](#engine-convert)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：3 张；状态：normal、required_missing、invalid。
- 视觉源：[desktop-engine-mapping-normal](screens/desktop-engine-mapping-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-convert"></a>

## 转换进度 · engine-convert

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：固定来源 → 转换阶段 → 取消 → 原件保留。
- 正常后续：[迁移结果与待补任务](#engine-report)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：6 张；状态：normal、loading、interrupted、cancelled、error_timeout、success。
- 视觉源：[desktop-engine-convert-normal](screens/desktop-engine-convert-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-report"></a>

## 迁移结果与待补任务 · engine-report

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：对账 → 待补逻辑 → 定位对象 → 打开项目。
- 正常后续：[工作流编辑器](#workflow)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：3 张；状态：normal、required_missing、success。
- 视觉源：[desktop-engine-report-normal](screens/desktop-engine-report-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="engine-conflict"></a>

## 重新导入三方比较 · engine-conflict

- 范围：仅 Windows 工程转换。
- 平台：desktop。分组：迁移。
- 主操作：旧导入基线 → GameGen手改 → 新源工程 → 合并。
- 正常后续：[内容分析与兼容性](#engine-analysis)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-038。验收定义：AC-058、AC-059、AC-060、AC-061、AC-062、AC-063、AC-064。
- 页面画板：4 张；状态：normal、invalid、empty、success。
- 视觉源：[desktop-engine-conflict-normal](screens/desktop-engine-conflict-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="future-export"></a>

## 可编辑引擎工程写出 · future-export

- 范围：未来增量，仅扩展边界。
- 平台：desktop / android。分组：扩展。
- 主操作：能力表 → 固定快照 → 新目录 → 差异报告。
- 正常后续：[可编辑引擎工程写出](#future-export)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-041、REQ-042。验收定义：AC-075、AC-076、AC-077、AC-078、AC-079、AC-080。
- 页面画板：2 张；状态：normal。
- 视觉源：[desktop-future-export-normal](screens/desktop-future-export-normal.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

<a id="overlays"></a>

## 公共对话框与浮层 · overlays

- 范围：当前完整产品设计范围，研发按增量交接。
- 平台：desktop / android。分组：公共组件。
- 主操作：选择范围 → 查看影响 → 确认 → 取消。
- 正常后续：[对话创作](#chat)；进入下一步前保留项目、对象选择和未提交草稿。
- 需求：REQ-017、REQ-026、REQ-035、REQ-039。验收定义：AC-030、AC-039、AC-051、AC-053、AC-065、AC-066、AC-067、AC-068、AC-069、AC-070、AC-071、AC-072。
- 页面画板：32 张；状态：model-picker、context-picker、dirty-leave、delete-object、delete-asset、replace-asset、restore-confirm、cancel-task、connection-mode、skill-update、scope-change、pair-qr、manual-ip、source-version、budget-confirm、signature-picker。
- 视觉源：[desktop-overlay-model-picker](screens/desktop-overlay-model-picker.svg)。所有画板见 [目录](index.html) 与 [矩阵](acceptance-matrix.csv)。
- 失败恢复：就地显示原因，保留用户输入；涉及资源、项目或图修改的操作先校验再提交。外部任务先查询状态，避免重复执行。空态/加载/错误的共享规则见 INTERACTIONS.md，领域附加状态以本页画板为准。

