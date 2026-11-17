# editor-web 第二版开发接收单

版本：editor-web-v1-draft.2；2026-11-17。承接[首版八任务](../../DEVELOPMENT-HANDOFF.md)，本版细化EW-T01及EW-T03/04，不新增已实现功能，不改变M1既有开发范围。

## 1. 四项问题处置

|问题|已确定的文档/契约|实际接收或实现剩余|
|---|---|---|
|FFI路线|[ABI集成](ABI-INTEGRATION.md)：Windows Rust MSVC动态加载原MinGW DLL、12符号/布局/CRT/生命周期；Android单Core SO/单运行时/平台JNI|DLL/SO真实产物、平台插件接入、免费工具资格、构建与贯通结果未接收|
|HostPort|[精确行为](CONTRACT.md)、[TS](contracts/editor-host.d.ts)、[Schema](contracts/host.schema.json)|三适配器实现、类型编译/契约执行未做|
|驱动协议|[异步协议](DRIVER-PROTOCOL.md)、[Schema](contracts/driver.schema.json)|当前旧CLI仍不支持，需另写新宿主/回环代理|
|兼容/UI|[候选与判定](COMPATIBILITY-INTAKE.md)、[机器候选](contracts/compatibility-candidates.json)|完整锁、MSVC/SDK/移动生成工程/成品工具T1及真实UI输入仍待回填|

## 2. EW-T01拆分（源码实施前先按实际授权和阶段交接）

|增量|依赖|接收定义|回退|
|---|---|---|---|
|EW-T01a 候选资料接收|本版/既有M1头|C1/C2/T1逐个填精确版本、peer/MSRV/平台/许可/来源/expected与observed，未构建不填产物验证|保留原M1及本版候选，按revision退回架构|
|EW-T01b Rust FFI边界|01a和ABI集成|repr(C)声明、12符号加载表、库所有者/租约、异常与关闭actor；不复编C++或跨CRT释放|只回退新宿主，不动native/ABI|
|EW-T01c HostPort实现|01b和精确Schema/TS|12方法、代次与task表、受理/unknown/终态、单结果槽与二进制、cursor100上限|匹配桥接/前端兼容组合回退|
|EW-T01d 新异步driver|01c|独立describe/shutdown，14方法异步响应、stdout协议、有限ID/帧/缓存与安全fixture；不得把旧CLI打完成标记|不启用新测试目标，保留旧CLI事实|
|EW-T01e 浏览器真实适配|01d|仅回环HTTP/token/origin/fixture/启动终止；生产/mock/真实core标记明确|关代理，保留fixture与恢复收据|

EW-T01a可在当前文档范围继续来源接收。实现、安装、构建、自测各按真实会话和对应阶段授权执行，旧文件/任务描述不授予自动化权限。本轮没有进行这些操作。

## 3. 最小闭环/UI输入

先取得COMPATIBILITY-INTAKE的EW-UI-IN-01—08：项目入口/场景树/属性/资源任务界面的页面状态，创建→编辑→durable→重开，错误/取消/unknown/恢复，单位值域/文案，键鼠/IME/触控/旋转环境，稳定定位与真实事件，隔离fixture数据，以及实际版本/hash接收记录。

没有这些输入不复用旧HTML原型build_id或由架构编造UI批准。M1目前可编辑的scene/settings用于闭环；图、地图和完整预览要等对应模块契约/能力，不借extensions执行未声明功能。

## 4. 基础与系统验证文案责任

coding准备改动单元/成功主路径/失败路径的基础自测；独立quality准备协议/桥接/成品/安全/回归/设备/恢复等详细文案。技术上至少覆盖：错误ABI/缺DLL/布局、租约与晚释放、重复/丢响应、错误代次、u64精度、Base64边界、结果槽满、事件缺口、cancel-too-late、关闭时32槽占满、HTTP断连/EOF/崩溃及fixture隔离。这里只定义应交范围，不写已运行结论。

实测证据分层：类型/Schema工具检查、源码集成、构建、Core基本场景、浏览器真实Core、Tauri成品、移动设备、游戏目标。源码/文档存在不是类型编译或运行证明，元数据peer满足不是完整兼容锁。

## 5. 接续规则

开发回交candidate receipt与实际产物/代码状态后，架构按本版规则确认或给有影响记录的新revision；不要求重复选择已接受的React/Tauri路线。M1原生代码、root清单和旧基线由原会话维护，本架构会话没有代改。真实产品/UI/架构/研发/质量人员审批仍独立，ready_for_coding=false不能被文档完整性核对替代。

现行M1全局工具本次还报告.design-mcp.json的identity_manifest归属差异，除真实角色审批外该项亦未通过。原始状态见inputs/active-M1-document-gate.json及root-design-observation.json；本架构未修改design/root清单，也未将此文件代签为本UI包输入。由该清单实际负责人在其迭代处理，不能把现行M1说成只有审批缺项或全门禁通过。
