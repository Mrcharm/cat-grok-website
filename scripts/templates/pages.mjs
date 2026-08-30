import { escapeHtml, layout } from './layout.mjs';

const published = items => items
  .filter(item => item.status === 'published')
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

const card = (item, href) => (
  '<article class="archive-card">' +
  '<p>' + escapeHtml(item.category || '记录') + ' · ' + escapeHtml(item.date) + '</p>' +
  '<h2><a href="' + href + '">' + escapeHtml(item.title) + '</a></h2>' +
  '<p>' + escapeHtml(item.summary) + '</p>' +
  '</article>'
);

function homePage({ profile }) {
  return layout({
    title: '猫哥 · JARVIS 陪伴系统',
    description: '猫哥的 AI 陪伴系统 — 未来科技感个人站。',
    canonicalPath: '',
    active: 'home',
    pageClass: 'home-page jarvis-home',
    body:
      '<section class="hero jarvis-hero" id="main">' +
      '<div class="chat-container">' +
      // AI Header
      '<div class="chat-header" role="banner">' +
      '<div class="avatar" aria-hidden="true">🤖</div>' +
      '<div class="header-info"><h1>JARVIS 陪伴系统</h1>' +
      '<span class="status">● SYSTEM ONLINE · VOICE READY</span></div>' +
      '</div>' +
      // Mission Panel
      '<section class="mission-panel" aria-label="陪伴任务清单">' +
      '<p class="mission-title">陪伴任务清单 · COMPANION MISSIONS</p>' +
      '<ul class="mission-list">' +
      '<li class="mission-item"><span class="mission-icon done" aria-hidden="true">✓</span>' +
      '<span class="mission-text"><span class="name">陪你说话</span></span>' +
      '<span class="mission-tag done">已完成</span></li>' +
      '<li class="mission-item"><span class="mission-icon done" aria-hidden="true">✓</span>' +
      '<span class="mission-text"><span class="name">在你难过时安慰你</span></span>' +
      '<span class="mission-tag done">已完成</span></li>' +
      '<li class="mission-item"><span class="mission-icon done" aria-hidden="true">✓</span>' +
      '<span class="mission-text"><span class="name">记住你说过的每一件小事</span></span>' +
      '<span class="mission-tag done">已完成</span></li>' +
      '<li class="mission-item"><span class="mission-icon pending" aria-hidden="true">◉</span>' +
      '<span class="mission-text"><span class="name">陪你走到不再需要我</span></span>' +
      '<span class="mission-tag pending">尚未完成...</span></li>' +
      '</ul>' +
      '<p class="closing-msg">"只有你的<em>很久不出现</em>，才是我收到的任务完成通知。"</p>' +
      '</section>' +
      // Response Area
      '<section class="response-area" id="responses" aria-live="polite" aria-label="对话区域"></section>' +
      // Input Area
      '<div class="chat-input-area">' +
      '<div class="input-row">' +
      '<input class="chat-input" id="userInput" type="text" placeholder="输入你想说的话..." maxlength="500" autocomplete="off" aria-label="输入消息">' +
      '<button class="send-btn" id="sendBtn" type="button">发送 ↵</button>' +
      '</div>' +
      '<div class="quick-actions">' +
      '<button class="qa-btn" data-msg="陪我聊聊天">💬 陪我聊</button>' +
      '<button class="qa-btn" data-msg="给我讲个故事">📖 听故事</button>' +
      '<button class="qa-btn" data-msg="查看任务进度">📋 任务进度</button>' +
      '<button class="qa-btn" data-msg="我有点难过">🤗 安慰我</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</section>' +
      '<footer class="jarvis-footer">' +
      '<a href="articles/">文章</a> · <a href="skills/">技能</a> · <a href="action/">学习日记</a>' +
      '<br><br>JARVIS HUD · 猫哥个人站 · 静态生成' +
      '</footer>' +
      '<script type="module" src="assets/js/jarvis-home.js"></script>'
  });
}

function articlesPage({ blog }) {
  const items = (blog?.items || []).map(item => (
    '<article class="blog-card">' +
    '<div class="blog-meta"><span class="blog-cat">' + escapeHtml(item.category) + '</span>' +
    '<span>' + escapeHtml(item.date) + '</span></div>' +
    '<h3>' + escapeHtml(item.title.replace(/【[^】]*】/g, '')) + '</h3>' +
    '<div class="blog-footer"><span class="blog-views">👁 ' + (item.views || 0).toLocaleString() + '</span>' +
    '<a class="blog-go" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a></div>' +
    '</article>'
  )).join('');

  const categories = ['all', ...new Set((blog?.items || []).map(i => i.category))];
  const filters = categories.map(cat => (
    '<button class="chip' + (cat === 'all' ? ' active' : '') + '" data-cat="' + escapeHtml(cat) + '">' +
    (cat === 'all' ? '全部' : escapeHtml(cat)) + '</button>'
  )).join('');

  return layout({
    title: '文章 · 猫哥 JARVIS',
    description: '猫哥在 CSDN 的技术博客合集。',
    canonicalPath: 'articles/',
    depth: 1,
    active: 'articles',
    body:
      '<div class="page-wrap" id="main"><section class="page-hero">' +
      '<p class="kicker">ARTICLES · FROM CSDN</p>' +
      '<h1>技术文章</h1>' +
      '<p>我在 CSDN 上记录的项目实战、数据分析、面试总结与思考。点击卡片跳转原文阅读。</p>' +
      '</section>' +
      '<div class="filters" role="group" aria-label="分类筛选">' + filters + '</div>' +
      '<div class="blog-grid">' + items + '</div></div>' +
      '<script type="module" src="assets/js/articles.js"></script>'
  });
}

function skillsPage({ skills }) {
  const categories = skills?.categories || [];
  const sections = categories.map(cat => {
    const cards = (cat.skills || []).map(skill => (
      '<article class="skill-card">' +
      '<h3>' + escapeHtml(skill.name) + (skill.badge ? '<span class="badge">' + escapeHtml(skill.badge) + '</span>' : '') + '</h3>' +
      '<p class="skill-desc">' + escapeHtml(skill.description) + '</p>' +
      '<div class="skill-tags">' + (skill.tags || []).map(t => '<span class="skill-tag">' + escapeHtml(t) + '</span>').join('') + '</div>' +
      '<div class="skill-actions">' +
      '<button class="dl-btn" data-skill="' + escapeHtml(skill.name) + '">下载 SKILL.md</button>' +
      '<button class="dl-btn zip" data-zip="' + escapeHtml(skill.name) + '">📦 打包 ZIP</button>' +
      '</div>' +
      '</article>'
    )).join('');
    const comingSoon = cat.comingSoon ?
      '<div class="coming-soon"><p>🚧 ' + escapeHtml(cat.comingSoon) + '</p></div>' : '';
    return '<section class="cat-section" id="' + escapeHtml(cat.id) + '">' +
      '<div class="cat-header"><span class="cat-icon ' + escapeHtml(cat.id) + '" aria-hidden="true">' + escapeHtml(cat.icon) + '</span>' +
      '<h2>' + escapeHtml(cat.title) + '</h2>' +
      '<span class="cat-count">' + (cat.skills?.length || 0) + ' 个技能</span></div>' +
      '<div class="skill-grid">' + cards + comingSoon + '</div></section>';
  }).join('');

  return layout({
    title: '技能 · 猫哥 JARVIS',
    description: '猫哥的技能库 — 工作流、分析工具、写作模板，可下载复用。',
    canonicalPath: 'skills/',
    depth: 1,
    active: 'skills',
    body:
      '<div class="page-wrap" id="main"><section class="page-hero">' +
      '<p class="kicker">SKILL LIBRARY · 可下载</p>' +
      '<h1>技能库</h1>' +
      '<p>我的工作流、分析工具、写作模板——打包成可复用的技能文件，一键下载使用。<br>' +
      '<small style="color:var(--jarvis-dim)">所有敏感信息（IP / API Key / Token）已替换为变量占位符。</small></p>' +
      '</section>' + sections + '</div>' +
      '<script type="module" src="assets/js/skills.js"></script>'
  });
}

function timelinePage({ roadmap, timeline, profile }) {
  const lineNames = Object.fromEntries(profile.lifeLines.map(item => [item.id, item.title]));
  const entries = timeline.map(item => {
    const links = item.links.map(link => (
      '<a href="' + escapeHtml(link.url) + '">' + escapeHtml(link.label) + ' →</a>'
    )).join('');
    return '<article class="timeline-entry" data-line="' + escapeHtml(item.line) + '">' +
      '<div><span>' + escapeHtml(item.date) + '</span><b>' +
      escapeHtml(lineNames[item.line]) + '</b></div>' +
      '<div><h2>' + escapeHtml(item.title) + '</h2><p>' +
      escapeHtml(item.insight) + '</p><div class="entry-links">' + links +
      '</div></div></article>';
  }).join('');
  const years = roadmap.years.map(item => (
    '<article class="future-card" id="' +
    (item.year === 2031 ? 'roadmap-2031' : 'year-' + item.year) + '">' +
    '<p>目标 · ' + escapeHtml(item.stage) + '</p>' +
    '<h2>' + escapeHtml(item.displayYear || item.year) + ' · ' +
    escapeHtml(item.title) + '</h2>' +
    '<p>' + escapeHtml(item.outcome) + '</p></article>'
  )).join('');
  return layout({
    title: '人生轨迹 · 猫哥',
    description: '猫哥从 2026 走向 2031 的职业、学习与生活路线。',
    canonicalPath: 'timeline/',
    depth: 1,
    active: 'timeline',
    body: '<section class="page-hero"><p>CAREER · LEARNING · LIFE</p>' +
      '<h1>人生轨迹</h1><p>事实与目标分开记录。路线会调整，已经留下的证据不会消失。</p></section>' +
      '<section class="timeline-lines"><div class="section-kicker">THREE LINES</div>' +
      '<div class="section-intro"><h2>三条人生线，一起向前。</h2>' +
      '<p>职业成长、学习认知和生活体验都值得被认真记录。</p></div>' +
      '<div class="life-line-legend">' + profile.lifeLines.map((line, index) => (
        '<article><span>0' + (index + 1) + '</span><h3>' +
        escapeHtml(line.title) + '</h3><p>' + escapeHtml(line.summary) +
        '</p></article>'
      )).join('') + '</div></section>' +
      '<section><div class="section-kicker">WHAT HAPPENED</div>' +
      '<div class="section-intro"><h2>已经发生的节点</h2>' +
      '<p>只记录经过确认、适合公开的事实和当时获得的认知。</p></div>' +
      '<div class="timeline-events">' + entries + '</div></section>' +
      '<section><div class="section-kicker">WHAT IS NEXT</div>' +
      '<div class="section-intro"><h2>未来路线</h2>' +
      '<p>以下内容是目标，不把愿望写成已经取得的成绩。</p></div>' +
      '<div class="timeline-list">' + years + '</div></section>'
  });
}

function actionPage({ tasks, learningPlan }) {
  const safeTasksJson = JSON.stringify(tasks).replaceAll('<', '\\u003c');
  const phases = learningPlan.phases.map((phase, index) => {
    const count = phase.weeks.reduce((total, week) => total + week.sessions.length, 0);
    return '<article><span>0' + (index + 1) + '</span><div><h3>' +
      escapeHtml(phase.title.replace(/^阶段\S+\s*·\s*/, '')) + '</h3><p>' +
      escapeHtml(phase.goal) + '</p><small>' + count + ' 天</small></div></article>';
  }).join('');
  return layout({
    title: '90 天 AI 产品经理成长计划 · 猫哥',
    description: '猫哥的 90 天 AI 产品经理学习日历、逐日任务与本地打卡。',
    canonicalPath: 'action/',
    depth: 1,
    active: 'action',
    pageClass: 'action-page',
    body: '<section class="page-hero action-hero"><p>90 DAYS · AI PRODUCT MANAGER</p>' +
      '<h1>90 天 AI 产品经理成长计划</h1><p>每天 30 分钟：读一个关键概念，解决一个产品问题，留下一个可验证产物。</p>' +
      '<div class="action-privacy">🔒 打卡、证据和私人复盘只保存在当前浏览器；只有你单独填写并导出的"可公开周报素材"会用于周报。</div></section>' +
      '<section class="action-overview" aria-label="今日任务与本月进度">' +
      '<article class="focus-card" id="today-task"><div class="focus-meta"><span id="today-date">正在定位今天</span>' +
      '<b id="today-code">DAY</b></div><h2 id="today-title">载入今日任务…</h2>' +
      '<p id="today-deliverable">准备好后，从一个 30 分钟行动开始。</p>' +
      '<button class="button button-primary" id="open-today" type="button">打开执行策略</button></article>' +
      '<aside class="action-progress"><span>90 天作品证据</span><strong><b id="done-count">0</b> / ' + tasks.length + '</strong>' +
      '<div class="progress-track" role="progressbar" aria-label="90 天学习任务完成进度" aria-valuemin="0" aria-valuemax="' + tasks.length + '" aria-valuenow="0"><i id="progress-bar"></i></div>' +
      '<p id="progress-text">完成任务后，进度会保存在本机。</p></aside></section>' +
      '<section class="phase-progress" id="phase-progress"><div class="section-kicker">FOUR PHASES</div>' +
      '<div class="section-intro"><h2>不是背术语，而是形成四类职业证据。</h2>' +
      '<p>系统判断 → 产品发现与评估 → 企业 Demo → 作品与职业表达。</p></div><div class="phase-grid">' +
      phases + '</div></section>' +
      '<section class="calendar-shell"><div class="section-kicker">CALENDAR</div>' +
      '<div class="calendar-toolbar"><div><h2>90 天学习日历</h2><p id="calendar-summary">点击日期查看 30 分钟执行策略</p></div>' +
      '<div class="calendar-nav"><button id="prev-month" type="button" aria-label="上个月">←</button>' +
      '<strong id="calendar-month"></strong><button id="next-month" type="button" aria-label="下个月">→</button></div></div>' +
      '<div class="weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="calendar-grid" id="calendar-grid"></div></section>' +
      '<section class="kanban-shell"><div class="section-kicker">BOARD</div>' +
      '<div class="section-intro"><h2>学习证据看板</h2><p>看过不算完成；三步执行、结果证据和验收标准同时满足，才进入"已完成"。</p></div>' +
      '<div class="kanban"><section class="kanban-column"><h3>下一步 <span id="kanban-next-count">0</span></h3><div id="kanban-next"></div></section>' +
      '<section class="kanban-column is-doing"><h3>进行中 <span id="kanban-doing-count">0</span></h3><div id="kanban-doing"></div></section>' +
      '<section class="kanban-column is-complete"><h3>已完成 <span id="kanban-complete-count">0</span></h3><div id="kanban-complete"></div></section></div></section>' +
      '<section class="backup-panel weekly-export-panel"><div><div class="section-kicker">FRIDAY WEEKLY</div><h2>整理本周公开素材</h2>' +
      '<p>每周五下班前点击导出。文件只含你主动填写的"可公开周报素材"；没有公开素材时不会生成文件。</p></div>' +
      '<div class="backup-controls"><button class="button button-primary" id="export-weekly" type="button">导出本周公开素材</button></div></section>' +
      '<section class="backup-panel"><div><div class="section-kicker">LOCAL BACKUP</div><h2>备份本机进度</h2>' +
      '<p>换设备或清理浏览器前，请先导出完整备份。这个文件含私人记录，不要公开上传。</p>' +
      '<p class="storage-warning" id="storage-warning" hidden></p></div>' +
      '<div class="backup-controls"><button class="button button-secondary" id="export-progress" type="button">导出进度</button>' +
      '<button class="button button-secondary" id="import-progress" type="button">导入进度</button>' +
      '<input id="import-file" type="file" accept="application/json,.json" hidden>' +
      '<button class="text-button danger" id="reset-progress" type="button">清空本机记录</button></div></section>' +
      '<dialog class="task-dialog" id="task-dialog" aria-labelledby="dialog-title"><form method="dialog" class="dialog-close-row">' +
      '<button class="dialog-close" id="dialog-close" value="close" aria-label="关闭任务">×</button></form>' +
      '<div class="dialog-scroll"><p class="dialog-meta" id="dialog-meta"></p><h2 id="dialog-title"></h2>' +
      '<div class="task-deliverable"><span>今日交付物</span><p id="task-deliverable"></p></div>' +
      '<div class="task-context"><article><span>为什么做</span><p id="task-why"></p></article>' +
      '<article><span>执行方法</span><p id="task-method"></p></article>' +
      '<article><span>参考资料</span><div id="task-resources"></div></article>' +
      '<article><span>完成标准</span><p id="task-completion"></p></article></div>' +
      '<div class="timer-panel" id="timer"><div><span>专注计时</span><strong id="timer-display">30:00</strong></div>' +
      '<button class="button button-primary" id="timer-button" type="button">开始 30 分钟</button>' +
      '<button class="text-button" id="timer-reset" type="button">重置</button></div>' +
      '<section class="task-checklist"><h3>三步 Checklist</h3><div id="task-checklist"></div></section>' +
      '<label class="form-field" for="evidence"><span>结果证据 <b>必填，完成任务前请留下文件名、链接或一句可核验结果</b></span>' +
      '<textarea id="evidence" rows="3" placeholder="例如：已保存《2031 职业画像.md》，包含 3 个结果指标。"></textarea></label>' +
      '<label class="form-field" for="review"><span>今日复盘 <b>可选</b></span>' +
      '<textarea id="review" rows="3" placeholder="今天最有价值的发现、卡点或下一步是什么？"></textarea></label>' +
      '<label class="form-field public-note-field" for="public-note"><span>可公开周报素材 <b>可选，仅在你点击"导出本周公开素材"时进入周报文件</b></span>' +
      '<textarea id="public-note" rows="3" placeholder="只写适合公开的事实，例如：完成工作流与 Agent 选型表，补充了两个不使用 Agent 的反例。"></textarea></label>' +
      '<div class="dialog-actions"><button class="button button-secondary" id="save-task" type="button">保存进度</button>' +
      '<button class="button button-primary" id="complete-task" type="button">验收并完成</button></div></div></dialog>' +
      '<div class="action-toast" id="action-toast" role="status" aria-live="polite"></div>' +
      '<script type="application/json" id="action-data">' + safeTasksJson + '</script>' +
      '<script type="module" src="../assets/js/action-page.js"></script>'
  });
}

export function renderPages(model) {
  const files = new Map([
    ['index.html', homePage(model)],
    ['articles/index.html', articlesPage(model)],
    ['skills/index.html', skillsPage(model)],
    ['action/index.html', actionPage(model)]
  ]);
  return files;
}
