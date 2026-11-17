# 缺陷与复核登记规则

版本editor-increment.1，execution_status=not_run，quality_verified=false，release_permitted=false。

## 缺陷登记规则

真实执行后每条记录必须含case、需求/验收ID、source_revision、环境/制品SHA、输入、复现步骤、实际与预期、证据路径和发现人。架构源码观察与运行缺陷分开：AR-INC-01—03仅在architect-writeback.md登记源级修正，不能记成复测通过。

## 严重度与优先级

P0为数据丢失/越权/系统破坏，停止受影响写入并升级真实负责人；P1为主路径阻断/无法恢复；P2为局部功能/反馈错误；P3为低影响文案。优先级还需产品按影响场景确认，不伪造结论。

## 修复复测与回归

coding提供修改路径和意图，执行负责人用原fixture复测，再覆盖相邻任务/恢复/语言路径。没有运行授权只更新步骤和预期，不创建实际结果。未知结果继续保留原请求身份。

## 关闭与风险接受

仅实际负责人按当前source/build证据确认才能关闭；无法重测或排除覆盖仍开放。接受风险需真实owner、版本、原因、期限和补偿措施，不能用文档检查或新截图覆盖旧证据。

## 结果记录模板

字段为defect_id、case_id、requirement/acceptance、source_revision、buildId、环境/制品SHA、steps/data、expected/actual、evidence、severity、priority、owner、fix_revision、retest_status、decision_owner和decision_at。当前无运行缺陷登记。
