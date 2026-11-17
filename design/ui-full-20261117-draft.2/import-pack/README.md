# 四平台通用 SVG 导入包

版本：ui-full-20261117-draft.2。目标：即时设计、Pixso、MasterGo、墨刀设计；不包含蓝湖适配。

## 内容

- boards/desktop、android、shared：2188张命名对象SVG，保留图形、文字与可编辑几何；不是2188个独立业务页面。
- assets/icons：16个独立图标，SVG + 透明PNG的1×/2×/3×。
- assets/illustrations：9个独立人物/地块/星晶/树木/岩石/粒子示意，SVG + 透明PNG的1×/2×/3×。
- 素材合计25份SVG、75份PNG；尺寸与用途见ASSETS.json。它们是设计示例素材，不是完整游戏生产资产库。
- tokens.json/css：视觉变量。IMPORT-MANIFEST.json：画稿、素材、尺寸、哈希和目标工具状态。
- asset-preview.html / asset-preview.png：透明素材浏览。

SVG中的字段组、按钮和图标有稳定ID与中文名称；全体对象ID按画稿加前缀，避免多图同画布定义冲突。data-name只是辅助元数据，具体导入器是否用它命名不能保证；ID仍保留语义。文字未转轮廓，未打包字体。完整属性长图代表滚动内容，不建议在设计工具中压缩到一屏。

## 先打开这些代表稿

- [蒙皮网格、绑定与顶点权重 · desktop](boards/desktop/桌面—蒙皮网格、绑定与顶点权重—默认界面—0517.svg)
- [混音总线、空间音频与并发策略 · desktop](boards/desktop/桌面—混音总线、空间音频与并发策略—默认界面—0557.svg)
- [源工程更新后的重导入三方比较 · desktop](boards/desktop/桌面—源工程更新后的重导入三方比较—默认界面—1691.svg)
- [首次欢迎卡 · android](boards/android/手机—首次欢迎卡—新手引导—2102.svg)
- [当前步骤提示 · android](boards/android/手机—当前步骤提示—新手引导—2106.svg)
- [软键盘/旋转/返回草稿 · android](boards/android/手机—软键盘、旋转、返回草稿—对话组合—1920.svg)

建议按默认操作面→必要属性→对应状态，分模块导入。2188张全部塞进一个页面会增加图层负担。

## 可编辑能力边界

已准备标准SVG、命名对象和独立透明素材。尚未创建四个平台各自的原生工程、组件实例、自动布局、变量绑定、交互连线和预设切片。整页PNG只用于对照，不能替代图层。导入SVG后需要检查字体、文本层、渐变、裁剪、坐标与分组，并在选定平台整理原生组件和导出设置。不能把SVG导入支持表述成这批稿已100%导入通过。

本次没有登录、上传或实际导入这四个平台，也没有执行截图比较。actual_import_validation=not_run，quality_verified=false，release_permitted=false。

## 中文文件名修订

当前所有SVG均已改为中文文件名，画稿和素材内容保持不变。独立文件可按名称识别，原路径对应见[SVG中文文件名对照表](SVG中文文件名对照表.json)。
