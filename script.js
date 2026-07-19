const tasks = [
  {id:1,date:'2026-07-20',asset:'ai',title:'五年反向设计：职业',deliverable:'一份能被检验的 2031 职业画像。',steps:['写出 2031 年别人如何用一句话介绍你','写职业位置、外部收入、AI 代表作三个结果','列出三件未来五年明确不追求的事']},
  {id:2,date:'2026-07-21',asset:'life',title:'五年反向设计：资产与生活',deliverable:'投资、身体与关系的 2026 年领先指标。',steps:['分别写投资、身体、关系的 2031 状态','为每项定义一个 2026 年底领先指标','把固定周复盘时段写进日历']},
  {id:3,date:'2026-07-22',asset:'ai',title:'明确你的稀缺组合',deliverable:'一页个人定位与证据缺口。',steps:['列出银行、数据、Agent、产业研究四项经历','为每项标出证据、缺口和下一步','完成“我帮助谁，把什么变成什么”定位句']},
  {id:4,date:'2026-07-23',asset:'life',title:'生活操作系统落地',deliverable:'本月运动、关系与休息的最低标准。',steps:['设定每周两次 20 分钟运动','预约一次重要关系深聊','确定每天睡前 30 分钟无屏时间']},
  {id:5,date:'2026-07-24',asset:'ai',title:'建立个人知识库首页',deliverable:'四类资产都有入口的个人知识库。',steps:['建立 AI 产品、技术决策、产业研究、生活复盘四栏','放入已有文件或笔记链接','每栏只保留一个本月待完成项']},
  {id:6,date:'2026-07-25',asset:'ai',title:'选择一个对外问题',deliverable:'一个连续写作主题和首篇文章题目。',steps:['确定“受治理约束的企业数据研发 AI Agent”主题','写 10 个目标读者会真实提问的问题','选择一个作为第一篇文章题目']},
  {id:7,date:'2026-07-26',asset:'life',title:'第一次周复盘',deliverable:'一份基于能量和执行事实的周复盘。',steps:['记录完成天数，不补作业','写最有能量与最耗能的事各一项','预约下周两次运动和一个关系时段']},
  {id:8,date:'2026-07-27',asset:'ai',title:'搭出方法论骨架',deliverable:'数据研发 Agent 六段式方法论初稿。',steps:['写需求、知识、生成、检核、人审、留痕六段','每段写输入、处理、输出、失败模式','检查是否全部使用通用、脱敏表达']},
  {id:9,date:'2026-07-28',asset:'tech',title:'技术决策：工作流还是 Agent',deliverable:'一页可复用的架构决策记录。',steps:['阅读工作流与 Agent 的边界资料','写两者各自适用条件','用数据研发场景解释为何不先拆四智能体']},
  {id:10,date:'2026-07-29',asset:'tech',title:'技术决策：RAG 与知识边界',deliverable:'知识源、引用与失败处理方案。',steps:['梳理知识源及其更新责任','定义切分和引用方式','定义命中正确性与可追溯性指标']},
  {id:11,date:'2026-07-30',asset:'tech',title:'技术决策：SQL 与安全',deliverable:'一份只读 SQL 安全策略。',steps:['定义允许与禁止语法','写清权限最小化和人工批准点','列出五条必须拦截的危险 SQL']},
  {id:12,date:'2026-07-31',asset:'tech',title:'技术决策：MCP 的边界',deliverable:'MCP 接入收益、风险与准入条件。',steps:['阅读 MCP tools/resources 概览','写可连接能力与权限风险','设计只读 get_metadata(table) 接口']},
  {id:13,date:'2026-08-01',asset:'ai',title:'最小 Demo 立项',deliverable:'一页窄场景 PRD 和项目骨架。',steps:['定义输入、输出和目标用户','写真实数据、写操作、自动发布三条不做','建立 docs、data、app 三个目录']},
  {id:14,date:'2026-08-02',asset:'ai',title:'发布第一篇文章',deliverable:'一篇已发布或已定时的 600—1000 字文章。',steps:['完成“为什么第一版不追求多智能体”','文末留下一个真问题邀请反驳','记录发布链接与真实互动数据']},
  {id:15,date:'2026-08-03',asset:'life',title:'第二次周复盘',deliverable:'四类资产的进展证据与下周安排。',steps:['检查四类资产是否都有产物','完成运动或长走并记录睡眠质量','写一个追求“看起来厉害”的时刻']},
  {id:16,date:'2026-08-04',asset:'income',title:'定义专业服务假设',deliverable:'目标客户、痛点与两周交付物假设。',steps:['写清目标客户与最痛的问题','定义两周诊断可交付物','列出不承诺的边界与测试价格区间']},
  {id:17,date:'2026-08-05',asset:'income',title:'写一页服务说明',deliverable:'一页能在 30 秒内读懂的服务页。',steps:['写对象、问题、流程与样例产物','补上适合与不适合的人','删除没有证据支撑的宣传词']},
  {id:18,date:'2026-08-06',asset:'income',title:'发出三次访谈邀约',deliverable:'三条已发送的真实访谈邀请。',steps:['选数据负责人、数据工程师、AI 产品同行各一位','发送 20 分钟访谈邀请且不推销','记录时间与回复，不催促']},
  {id:19,date:'2026-08-07',asset:'income',title:'建立产业研究框架',deliverable:'研究数据库字段与证据纪律。',steps:['建立公司、产品、订单、利润、估值、风险等字段','明确观点与证据分开、未知就写未知','今天不买入，只建立决策系统']},
  {id:20,date:'2026-08-08',asset:'income',title:'完成一条研究档案',deliverable:'一个方向、五家公司和可追溯证据。',steps:['选熟悉的方向而不是热点榜','录入五家公司与原始来源','区分买入理由和市场支付溢价的理由']},
  {id:21,date:'2026-08-09',asset:'income',title:'建立交易前后日志',deliverable:'带失效条件和仓位上限的交易模板。',steps:['建立买入假设、定价逻辑、触发和失效条件字段','补写一笔历史交易，区分事实与事后解释','确立无失效条件与仓位上限则不开仓']},
  {id:22,date:'2026-08-10',asset:'ai',title:'发布第二篇文章',deliverable:'一篇关于可审核 NL2SQL 的公开文章。',steps:['完成“价值不只在写出 SQL”文章','配需求到留痕六步流程图','记录发布链接和一个读者问题']},
  {id:23,date:'2026-08-11',asset:'life',title:'第三次周复盘',deliverable:'基于外部反馈的下周唯一 Demo 路径。',steps:['复盘文章、访谈、研究三类反馈','完成运动与一次重要关系联系','选择下周唯一要跑通的 Demo 路径']},
  {id:24,date:'2026-08-12',asset:'tech',title:'制作合成数据与测试集',deliverable:'三张虚构表与十条测试需求。',steps:['创建客户、交易、产品三张虚构表','写十条需求、风险等级与接受条件','检查没有内部表名、字段和口径']},
  {id:25,date:'2026-08-13',asset:'tech',title:'实现 Demo 第一条链路',deliverable:'输入需求到输出结构化需求/模拟 SQL。',steps:['用熟悉技术栈搭输入和结果页面','没有 API Key 时使用 mock','保存一张可运行截图']},
  {id:26,date:'2026-08-14',asset:'tech',title:'加入知识引用与检核',deliverable:'带来源展示和危险 SQL 拦截的流程。',steps:['显示生成 SQL 使用的元数据来源','只允许 SELECT 并拦截未定义对象','用两条危险需求验证并截图']},
  {id:27,date:'2026-08-15',asset:'tech',title:'用十个案例评估',deliverable:'三项指标和一个修复前后对比。',steps:['记录字段完整率、SQL 可执行率、危险 SQL 拦截率','只修出现最多的一类问题','在 README 公开一个失败案例和限制']},
  {id:28,date:'2026-08-16',asset:'ai',title:'形成可展示作品包',deliverable:'README、3—5 分钟录屏与一条同行反馈。',steps:['写问题、架构、演示、指标和安全边界','录制需求到人工批准的完整过程','问同行“哪一步最不可信”']},
  {id:29,date:'2026-08-17',asset:'ai',title:'建立六周输出管线',deliverable:'第三篇草稿与未来六周选题。',steps:['写数据 Agent 最小治理框架草稿','排出未来六周每周一个问题','把文章、决策和 Demo 链接汇总到首页']},
  {id:30,date:'2026-08-18',asset:'life',title:'月度验收与下月承诺',deliverable:'四资产红黄绿验收与下月唯一主攻方向。',steps:['为每项用文件、链接或截图举证','写最大复利资产、失败与被推翻的假设','只选 Demo、用户访谈、连续输出之一作为下月主攻']}
];

const storageKey = 'mrcharm-growth-state-v1';
const state = JSON.parse(localStorage.getItem(storageKey) || '{"tasks":{}}');
let calendarCursor = new Date(2026, 6, 1);
let activeTask = null;
let timer = null;
let secondsLeft = 1800;

const $ = selector => document.querySelector(selector);
const formatDate = iso => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${iso}T12:00:00`));
const getTaskState = id => state.tasks[id] || {checks:[],evidence:'',done:false};
const persist = () => localStorage.setItem(storageKey, JSON.stringify(state));
const isTaskStarted = task => {const s=getTaskState(task.id);return !s.done && (s.checks.some(Boolean)||s.evidence.trim())};

function getFocusTask(){
  const today = new Date();
  const localIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return tasks.find(t=>t.date===localIso&&!getTaskState(t.id).done) || tasks.find(t=>!getTaskState(t.id).done) || tasks[tasks.length-1];
}

function updateHero(){
  const focus=getFocusTask(),done=tasks.filter(t=>getTaskState(t.id).done).length,percent=Math.round(done/tasks.length*100);
  $('#todayDate').textContent=formatDate(focus.date);
  $('#todayCode').textContent=`D${focus.id}`;
  $('#todayTitle').textContent=focus.title;
  $('#todayDeliverable').textContent=focus.deliverable;
  $('#openToday').onclick=()=>openTask(focus.id);
  $('#heroProgress').textContent=`${percent}%`;
  $('#doneCount').textContent=done;
  $('#progressBar').style.width=`${percent}%`;
}

function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  $('#calendarMonth').textContent=`${y} 年 ${m+1} 月`;
  const monthTasks=tasks.filter(t=>{const d=new Date(`${t.date}T12:00:00`);return d.getFullYear()===y&&d.getMonth()===m});
  $('#calendarSummary').textContent=`${monthTasks.filter(t=>getTaskState(t.id).done).length} / ${monthTasks.length} 项已完成`;
  const first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const current=new Date(),todayIso=`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
  const cells=[];
  for(let i=0;i<first;i++)cells.push('<div class="calendar-day empty" aria-hidden="true"></div>');
  for(let day=1;day<=days;day++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,task=tasks.find(t=>t.date===iso);
    if(!task){cells.push(`<div class="calendar-day${iso===todayIso?' today':''}"><span class="calendar-date">${day}</span></div>`);continue;}
    const done=getTaskState(task.id).done;
    cells.push(`<button class="calendar-day has-task ${done?'done':''}${iso===todayIso?' today':''}" data-id="${task.id}" aria-label="D${task.id} ${task.title}"><span class="calendar-date">${day}</span><i class="calendar-asset ${task.asset}"></i><span class="calendar-task">D${task.id} · ${task.title}</span>${done?'<span class="calendar-check">✓</span>':''}</button>`);
  }
  while(cells.length%7)cells.push('<div class="calendar-day empty" aria-hidden="true"></div>');
  $('#calendarGrid').innerHTML=cells.join('');
  document.querySelectorAll('.calendar-day[data-id]').forEach(el=>el.onclick=()=>openTask(Number(el.dataset.id)));
}

function boardCard(task){
  const s=getTaskState(task.id),doneSteps=s.checks.filter(Boolean).length;
  return `<button class="board-card" data-id="${task.id}" data-asset="${task.asset}"><small>${formatDate(task.date)} · D${task.id}${doneSteps?` · ${doneSteps}/${task.steps.length}`:''}</small><strong>${task.title}</strong><p>${task.deliverable}</p></button>`;
}

function renderBoard(){
  const next=tasks.filter(t=>!getTaskState(t.id).done&&!isTaskStarted(t)).slice(0,6);
  const doing=tasks.filter(isTaskStarted);
  const complete=tasks.filter(t=>getTaskState(t.id).done).slice(-6).reverse();
  const fill=(selector,items)=>$(selector).innerHTML=items.length?items.map(boardCard).join(''):'<p class="board-empty">还没有任务来到这里</p>';
  fill('#nextList',next);fill('#doingList',doing);fill('#completeList',complete);
  $('#nextCount').textContent=next.length;$('#doingCount').textContent=doing.length;$('#completeCount').textContent=tasks.filter(t=>getTaskState(t.id).done).length;
  document.querySelectorAll('.board-card').forEach(el=>el.onclick=()=>openTask(Number(el.dataset.id)));
}

function openTask(id){
  activeTask=tasks.find(t=>t.id===id);const s=getTaskState(id);
  $('#dialogMeta').textContent=`${formatDate(activeTask.date)} · D${activeTask.id} · ${assetName(activeTask.asset)}`;
  $('#dialogTitle').textContent=activeTask.title;$('#dialogDeliverable').textContent=`今日交付物：${activeTask.deliverable}`;
  $('#dialogChecklist').innerHTML=activeTask.steps.map((step,i)=>`<label class="check-item"><input type="checkbox" data-index="${i}" ${s.checks[i]?'checked':''}><span>${step}</span></label>`).join('');
  $('#evidenceInput').value=s.evidence||'';secondsLeft=1800;clearInterval(timer);timer=null;renderTimer();$('#timerButton').textContent='启动计时';
  $('#taskDialog').showModal();
}

function assetName(asset){return {ai:'个人影响力',income:'收入与研究',tech:'技术深度',life:'生活系统'}[asset]}
function captureTask(done=false){
  if(!activeTask)return;const checks=[...document.querySelectorAll('#dialogChecklist input')].map(i=>i.checked),evidence=$('#evidenceInput').value.trim();
  if(done&&(!checks.every(Boolean)||!evidence)){showToast('完成全部清单并留下一条证据后，才能标记完成');return false}
  state.tasks[activeTask.id]={checks,evidence,done:done||getTaskState(activeTask.id).done};persist();renderAll();return true;
}
function renderTimer(){const mm=String(Math.floor(secondsLeft/60)).padStart(2,'0'),ss=String(secondsLeft%60).padStart(2,'0');$('.timer-row strong').textContent=`${mm}:${ss}`}
function toggleTimer(){
  if(timer){clearInterval(timer);timer=null;$('#timerButton').textContent='继续计时';return}
  $('#timerButton').textContent='暂停';timer=setInterval(()=>{secondsLeft--;renderTimer();if(secondsLeft<=0){clearInterval(timer);timer=null;$('#timerButton').textContent='已完成';showToast('30 分钟完成。现在保存证据。')}},1000)
}
function showToast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function renderAll(){updateHero();renderCalendar();renderBoard()}

$('#prevMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
$('#nextMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
$('#closeDialog').onclick=()=>$('#taskDialog').close();
$('#saveTask').onclick=()=>{if(captureTask(false)){showToast('进度已保存在这台设备');$('#taskDialog').close()}};
$('#completeTask').onclick=()=>{if(captureTask(true)){showToast('完成。你又留下了一份证据。');$('#taskDialog').close()}};
$('#timerButton').onclick=toggleTimer;
$('#taskDialog').addEventListener('click',event=>{if(event.target===$('#taskDialog'))$('#taskDialog').close()});
$('#menuButton').onclick=()=>{const open=$('#mobileNav').classList.toggle('open');$('#menuButton').setAttribute('aria-expanded',String(open))};
document.querySelectorAll('#mobileNav a').forEach(a=>a.onclick=()=>{$('#mobileNav').classList.remove('open');$('#menuButton').setAttribute('aria-expanded','false')});
$('#exportProgress').onclick=()=>{
  const payload={exportedAt:new Date().toISOString(),plan:'四资产启动月',progress:tasks.map(t=>({id:t.id,date:t.date,title:t.title,...getTaskState(t.id)}))};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`mrcharm-growth-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);showToast('进度备份已下载');
};

renderAll();
