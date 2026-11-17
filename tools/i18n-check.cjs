/* 四语检查只连接隔离原型，验证界面切换与项目/草稿隔离，不调用外部服务。 */
'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const q=require('./verify-prototype.cjs');
const [,root,baseUrl]=process.argv.slice(2);const checks=[];const act=e=>q.evaluate(e);
const test=async(name,expression,expected)=>q.assert(checks,name,await act(expression),expected);
const choose=language=>act('(()=>{const s=document.querySelector("[data-ui-language]");s.value='+JSON.stringify(language)+';s.dispatchEvent(new Event("change",{bubbles:true}));})()');
async function main(){await q.connect();let error='';try{
 const source=JSON.parse(await fs.readFile(path.join(root,'locales/source.json'),'utf8'));
 const languages=['en-US','ja-JP','ko-KR'];
 for(const language of languages){const messages=JSON.parse(await fs.readFile(path.join(root,'locales',language+'.json'),'utf8'));q.assert(checks,language+'目录完整',Object.keys(messages).length,source.length);q.assert(checks,language+'无缺键或空文案',source.every(s=>typeof messages[s.id]==='string'&&messages[s.id].trim().length>0),true);}
 await q.navigate('desktop','projects','first_use');
 await act('window.i18nDraftNode=document.getElementById("new-name");i18nDraftNode.value="项目 <script>保留原文</script>";i18nDraftNode.focus();i18nDraftNode.setSelectionRange(2,5);document.getElementById("new-prompt").value="工作流 日本語 한국어 用户描述";window.beforeI18nSnapshot=JSON.stringify(GameGenPrototype.snapshot());window.beforeI18nRevision=GameGenPrototype.model.revision;');
 for(const language of ['en-US','ja-JP','ko-KR','zh-CN']){
  await choose(language);
  await test(language+'文档语言切换','document.documentElement.lang',language);
  await test(language+'名称草稿保留','document.getElementById("new-name").value','项目 <script>保留原文</script>');
  await test(language+'描述草稿保留','document.getElementById("new-prompt").value','工作流 日本語 한국어 用户描述');
  await test(language+'表单DOM与选择范围保留','document.getElementById("new-name")===i18nDraftNode&&i18nDraftNode.selectionStart===2&&i18nDraftNode.selectionEnd===5',true);
  await test(language+'项目快照与版本不变','JSON.stringify(GameGenPrototype.snapshot())===beforeI18nSnapshot&&GameGenPrototype.model.revision===beforeI18nRevision',true);
  await test(language+'两处语言选择同步','Array.from(document.querySelectorAll("[data-ui-language]")).every(s=>s.value==='+JSON.stringify(language)+')',true);
 }
 await choose('en-US');await test('英文创建按钮翻译','document.querySelector("[data-action=create-project]").textContent.trim()===GameGenPrototype.i18n.translate("创建并开始对话")',true);
 await act('GameGenPrototype.model.name="项目";GameGenPrototype.go("scene");');
 await test('名称恰好等于界面词仍保留','document.querySelector(".project-switch").textContent.includes("项目")',true);
 await test('主导航独立翻译','document.querySelector(".rail [data-page=projects]").textContent.includes("Project")',true);
 await act('GameGenPrototype.go("workflow","selected");document.getElementById("wf-label").value="工作流";document.querySelector("[data-action=wf-save]").click();');
 await test('手改节点名原样显示','document.querySelector("[data-wf-select=score]").textContent.includes("工作流")',true);
 await test('手改节点名写入标记','GameGenPrototype.workflow.current().nodes.find(n=>n.id==="score").params.customLabel',true);
 await act('document.querySelector("[data-wf-select=explode]").click()');
 await test('连接列表保留手改名称','document.querySelector(".wf-connection").parentElement.textContent.includes("工作流")',true);
 await act('document.querySelector("[data-action=wf-connect-dialog]").click()');
 await test('连接弹窗保留目标名称','Array.from(document.querySelectorAll("#wf-target-port option")).some(o=>o.textContent.includes("工作流"))',true);
 await act('document.querySelector("[data-action=wf-connect-close]").click();document.querySelector("[data-action=wf-run]").click()');
 await test('调试轨迹保留手改名称','document.querySelector(".wf-trace").textContent.includes("工作流")',true);
 const graph=await act('JSON.stringify(GameGenPrototype.workflow.current())');
 for(const language of ['ja-JP','ko-KR','zh-CN','en-US']){await choose(language);await test(language+'工作流源不变','JSON.stringify(GameGenPrototype.workflow.current())',graph);}
 await act('GameGenPrototype.go("api","import_review");document.querySelector("[data-nw-op=name]").value="接口 项目";document.querySelector("[data-nw-op=requestText]").value=JSON.stringify([{name:"中文字段"}]);');
 await choose('ko-KR');await test('未提交接口名称保留','document.querySelector("[data-nw-op=name]").value','接口 项目');
 await test('未提交接口JSON保留','document.querySelector("[data-nw-op=requestText]").value','[{"name":"中文字段"}]');
 await act('GameGenPrototype.go("workspace");document.getElementById("chat-input").value="保留用户草稿";');await choose('ja-JP');await test('未提交对话草稿保留','document.getElementById("chat-input").value','保留用户草稿');
 await test('输入提示随界面翻译','document.getElementById("chat-input").placeholder===GameGenPrototype.i18n.translate("描述要改的玩法，输入 @ 引用对象、/ 选择命令…")',true);
 await act('GameGenPrototype.go("scene","ability_paused");window.pausedLocaleTime=document.getElementById("cr-canvas").dataset.time');await choose('en-US');
 await test('暂停画布语言更新且时间不变','document.getElementById("cr-canvas").dataset.locale==="en-US"&&document.getElementById("cr-canvas").dataset.time===pausedLocaleTime',true);
 await q.navigate('android','workflow','selected',390,844,'en-US');
 await act('document.querySelector("[data-action=toggle-orientation]").click()');
 await test('横屏仍使用英文','document.documentElement.lang','en-US');
 await choose('ja-JP');await test('横屏切日语保持横屏','document.body.classList.contains("workflow-wide")&&document.documentElement.lang==="ja-JP"',true);
 await act('document.querySelector("[data-action=toggle-orientation]").click()');await test('返回竖屏保留日语','!document.body.classList.contains("workflow-wide")&&document.documentElement.lang==="ja-JP"',true);
 await act('GameGenPrototype.go("settings")');await test('设置内也有语言入口','Boolean(document.getElementById("settings-language"))',true);
 await choose('ko-KR');await q.command('Page.navigate',{url:baseUrl+'/?mode=desktop&page=settings&state=normal&fixture=1'});await q.delay(300);
 await test('重开不带语言参数恢复本机偏好','document.documentElement.lang','ko-KR');
 await test('跟随系统映射四语','["zh-TW","en-GB","ja","ko","fr-FR"].map(GameGenPrototype.i18n.systemLocale)',['zh-CN','en-US','ja-JP','ko-KR','zh-CN']);
 await act('GameGenPrototype.i18n.setLocale("system")');await test('跟随系统使用浏览器语言','document.documentElement.lang===GameGenPrototype.i18n.systemLocale(navigator.language)',true);
 await act('GameGenPrototype.i18n.setLocale("unsupported")');await test('不支持语言安全回退','GameGenPrototype.i18n.preference()','system');
 await act('GameGenPrototype.i18n.setLocale("en-US");window.i18nSavedSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error("test storage unavailable")};GameGenPrototype.i18n.setLocale("ja-JP");Storage.prototype.setItem=i18nSavedSet;');
 await test('存储不可用仍切换','document.documentElement.lang','ja-JP');
 await act('GameGenPrototype.i18n.setLocale("zh-CN")');
 }catch(cause){error=cause.stack;}
 const report={build_id:'gamegen-prototype-v3.6-20261114-01',source_sha256:await q.sourceDigest(),checks,error,browser_errors:q.browserErrors,passed:!error&&!q.browserErrors.length&&checks.every(c=>c.passed),limitations:['隔离Chrome，不证明Qt/Android原生','翻译为agent初稿，未完成母语人员校对','不自动翻译用户游戏或历史消息']};
 await fs.writeFile(path.join(root,'evidence/v3.6/i18n-browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length,error}));q.close();if(!report.passed)process.exitCode=1;}
main().catch(error=>{console.error(error.stack);q.close();process.exitCode=1;});
