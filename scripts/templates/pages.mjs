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

function homePage({ profile, roadmap, posts, projects }) {
  const recentPosts = published(posts).slice(0, 3)
    .map(item => card(item, item.url))
    .join('');
  const featuredProjects = published(projects).slice(0, 3)
    .map(item => card(item, item.url))
    .join('');
  const nowCards = [
    ['职业', profile.current.career, '💼'],
    ['学习', profile.current.learning, '🧠'],
    ['生活', profile.current.life, '🌿'],
    ['本月', profile.current.month, '🎯']
  ].map(([label, value, icon]) => (
    '<article><span aria-hidden="true">' + icon + '</span><p>' + escapeHtml(label) +
    '</p><h3>' + escapeHtml(value) + '</h3></article>'
  )).join('');
  const lifeLines = profile.lifeLines.map((line, index) => (
    '<article><span>0' + (index + 1) + '</span><h3>' + escapeHtml(line.title) +
    '</h3><p>' + escapeHtml(line.summary) + '</p></article>'
  )).join('');
  const years = roadmap.years.map(item => (
    '<article class="' + (item.status === 'active' ? 'active' : '') + '">' +
    '<span>' + escapeHtml(item.stage) + '</span>' +
    '<strong>' + escapeHtml(item.displayYear || item.year) + '</strong>' +
    '<h3>' + escapeHtml(item.title) + '</h3>' +
    '<p>' + escapeHtml(item.outcome) + '</p></article>'
  )).join('');
  const annualGoals = roadmap.annual.goals
    .map(goal => '<li>' + escapeHtml(goal) + '</li>')
    .join('');
  const weekly = roadmap.weekly.map(item => (
    '<article><span>' + escapeHtml(item.date) + '</span><h3>' +
    escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.summary) +
    '</p></article>'
  )).join('');
  const profileLinks = profile.links.map(link => (
    '<a href="' + escapeHtml(link.url) +
    '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(link.label) + ' ↗</a>'
  )).join('');

  return layout({
    title: '猫哥 · 向 2031 生长',
    description: '猫哥的职业、学习、生活与作品长期记录。',
    active: 'home',
    pageClass: 'home-page',
    body:
      '<section class="page-hero home-hero">' +
      '<div class="hero-copy"><p>2026 → 2031 · 公开成长现场</p>' +
      '<h1>你好，我是' + escapeHtml(profile.name) + '。</h1>' +
      '<p>' + escapeHtml(profile.tagline) + '</p>' +
      '<p class="hero-role">' + escapeHtml(profile.role) + '</p>' +
      '<div class="hero-actions"><a class="button button-primary" href="action/">开始今日 30 分钟</a>' +
      '<a class="button button-secondary" href="writing/">阅读我的记录</a></div></div>' +
      '<aside class="north-star-card"><span>2031 NORTH STAR</span>' +
      '<strong>' + escapeHtml(roadmap.northStar) + '</strong>' +
      '<p>' + escapeHtml(roadmap.principle) + '</p>' +
      '<div><b>05</b><small>年长期记录</small><b>30′</b><small>每日最低投入</small></div>' +
      '</aside></section>' +
      '<section id="now" class="home-section"><div class="section-kicker">NOW</div>' +
      '<div class="section-intro"><h2>此刻的我</h2><p>不等“准备好”再开始。先把当下真正投入的方向公开出来。</p></div>' +
      '<div class="now-grid">' + nowCards + '</div></section>' +
      '<section id="life-lines" class="home-section"><div class="section-kicker">THREE LINES</div>' +
      '<div class="section-intro"><h2>职业、学习，也认真生活。</h2>' +
      '<p>这三条线不是互相争夺时间，而是一起构成我想成为的人。</p></div>' +
      '<div class="life-line-grid">' + lifeLines + '</div></section>' +
      '<section id="roadmap" class="home-section"><div class="section-kicker">ROAD TO 2031</div>' +
      '<div class="section-intro"><h2>五年目标，一步步留下证据。</h2>' +
      '<p>' + escapeHtml(roadmap.northStar) + '</p></div>' +
      '<div class="year-track">' + years + '</div>' +
      '<div class="roadmap-detail"><article><span>' + escapeHtml(roadmap.annual.year) +
      ' 年度目标</span><h3>' + escapeHtml(roadmap.annual.title) + '</h3><ul>' +
      annualGoals + '</ul></article><article><span>本月重点</span><h3>' +
      escapeHtml(roadmap.month.title) + '</h3><p>' + escapeHtml(roadmap.month.focus) +
      '</p><a class="button button-primary" href="action/">查看 30 天计划</a></article></div>' +
      '<div class="weekly-progress"><div><span>WEEKLY UPDATE</span><h3>每周精选进展</h3></div>' +
      weekly + '</div></section>' +
      '<section id="notes" class="home-section"><div class="section-kicker">NOTES</div>' +
      '<div class="section-intro"><h2>近期记录</h2>' +
      '<p>公开的是经过整理的版本：职业实践、学习认知、生活感悟和产业研究。</p></div>' +
      '<div class="archive-grid">' + recentPosts + '</div>' +
      '<a class="section-link" href="writing/">查看全部写作 →</a></section>' +
      '<section id="featured-projects" class="home-section"><div class="section-kicker">WORKS</div>' +
      '<div class="section-intro"><h2>作品档案</h2>' +
      '<p>每个作品都记录问题、角色、方法、结果与仍然存在的限制。</p></div>' +
      '<div class="archive-grid">' + featuredProjects + '</div>' +
      '<a class="section-link" href="projects/">查看全部作品 →</a></section>' +
      '<section id="home-about" class="home-section home-about"><div>' +
      '<span class="cat-bubble" aria-hidden="true">🐱</span><div><div class="section-kicker">ABOUT</div>' +
      '<h2>懂业务、数据与 AI，也愿意记录真实生活。</h2>' +
      '<p>我的稀缺性不来自一个标签，而来自银行业务、数据平台、AI Agent 与产业研究的交叉。</p>' +
      '<div class="profile-links">' + profileLinks + '<a href="about/">更多关于我 →</a></div>' +
      '</div></div></section>'
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

function writingPage({ posts }) {
  const items = published(posts).map(item => {
    const href = item.url.startsWith('http') ? item.url : '../' + item.url;
    return card(item, href);
  }).join('');
  return layout({
    title: '写作 · 猫哥',
    description: '猫哥关于职业、学习、生活和产业研究的精选公开记录。',
    depth: 1,
    active: 'writing',
    body: '<section class="page-hero"><p>SELECTED PUBLIC NOTES</p>' +
      '<h1>写作</h1><p>写清问题、证据、取舍和仍然不知道的部分。</p></section>' +
      '<section><div class="writing-categories"><span>职业与产品</span>' +
      '<span>学习与认知</span><span>生活与关系</span><span>产业研究</span></div>' +
      '<div class="archive-grid">' + items + '</div></section>'
  });
}

function projectsPage({ projects }) {
  const items = published(projects)
    .map(item => card(item, '../' + item.url))
    .join('');
  return layout({
    title: '作品 · 猫哥',
    description: '猫哥的 AI 产品、智能体与长期实践作品档案。',
    depth: 1,
    active: 'projects',
    body: '<section class="page-hero"><h1>作品档案</h1><p>作品不是身份本身，而是每个阶段留下的证据。</p></section>' +
      '<section class="archive-grid">' + items + '</section>'
  });
}

function aboutPage({ profile }) {
  const strengths = profile.strengths.map(item => (
    '<article><h2>' + escapeHtml(item.title) + '</h2><p>' +
    escapeHtml(item.description) + '</p></article>'
  )).join('');
  const links = profile.links.map(link => (
    '<a class="button button-secondary" href="' + escapeHtml(link.url) +
    '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(link.label) + ' ↗</a>'
  )).join('');
  return layout({
    title: '关于我 · 猫哥',
    description: '猫哥的能力组合、长期方向和公开入口。',
    depth: 1,
    active: 'about',
    body: '<section class="page-hero"><p>ABOUT MR. CHARM</p><h1>关于我</h1><p>' +
      escapeHtml(profile.role) + '</p></section>' +
      '<section class="about-story"><div class="section-kicker">MY COMBINATION</div>' +
      '<div class="section-intro"><h2>我不是一个单一标签。</h2>' +
      '<p>我关心大型组织里的复杂数据工作，怎样被 AI 更可靠地理解、生成、检查与交付。</p></div>' +
      '<div class="archive-grid">' + strengths + '</div></section>' +
      '<section class="about-principles"><div><span class="cat-bubble" aria-hidden="true">🐱</span>' +
      '<div><div class="section-kicker">WHAT I BELIEVE</div>' +
      '<h2>不等成为专家再输出，也不靠输出假装成为专家。</h2>' +
      '<p>每一次公开记录，都应该比动笔前更接近事实；每一个作品，都应该说清价值、证据和限制。</p>' +
      '<div class="hero-actions">' + links + '</div></div></div></section>'
  });
}

function actionPage({ tasks }) {
  const safeTasksJson = JSON.stringify(tasks).replaceAll('<', '\\u003c');
  return layout({
    title: '今日行动 · 猫哥',
    description: '猫哥的 30 天执行日历与行动看板。',
    depth: 1,
    active: 'action',
    pageClass: 'action-page',
    body: '<section class="page-hero action-hero"><p>30 DAYS · LOCAL FIRST</p>' +
      '<h1>今日行动</h1><p>每天至少 30 分钟，只推进一个能留下证据的结果。</p>' +
      '<div class="action-privacy">🔒 清单、证据和复盘只保存在当前浏览器，不会上传到网站。</div></section>' +
      '<section class="action-overview" aria-label="今日任务与本月进度">' +
      '<article class="focus-card" id="today-task"><div class="focus-meta"><span id="today-date">正在定位今天</span>' +
      '<b id="today-code">DAY</b></div><h2 id="today-title">载入今日任务…</h2>' +
      '<p id="today-deliverable">准备好后，从一个 30 分钟行动开始。</p>' +
      '<button class="button button-primary" id="open-today" type="button">打开执行策略</button></article>' +
      '<aside class="action-progress"><span>30 天证据进度</span><strong><b id="done-count">0</b> / ' + tasks.length + '</strong>' +
      '<div class="progress-track" role="progressbar" aria-label="30 天任务完成进度" aria-valuemin="0" aria-valuemax="' + tasks.length + '" aria-valuenow="0"><i id="progress-bar"></i></div>' +
      '<p id="progress-text">完成任务后，进度会保存在本机。</p></aside></section>' +
      '<section class="calendar-shell"><div class="section-kicker">CALENDAR</div>' +
      '<div class="calendar-toolbar"><div><h2>30 天行动日历</h2><p id="calendar-summary">点击日期查看执行策略</p></div>' +
      '<div class="calendar-nav"><button id="prev-month" type="button" aria-label="上个月">←</button>' +
      '<strong id="calendar-month"></strong><button id="next-month" type="button" aria-label="下个月">→</button></div></div>' +
      '<div class="weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="calendar-grid" id="calendar-grid"></div></section>' +
      '<section class="kanban-shell"><div class="section-kicker">BOARD</div>' +
      '<div class="section-intro"><h2>行动看板</h2><p>开始勾选或留下记录后，任务会进入“进行中”；满足验收条件后才算完成。</p></div>' +
      '<div class="kanban"><section class="kanban-column"><h3>下一步 <span id="kanban-next-count">0</span></h3><div id="kanban-next"></div></section>' +
      '<section class="kanban-column is-doing"><h3>进行中 <span id="kanban-doing-count">0</span></h3><div id="kanban-doing"></div></section>' +
      '<section class="kanban-column is-complete"><h3>已完成 <span id="kanban-complete-count">0</span></h3><div id="kanban-complete"></div></section></div></section>' +
      '<section class="backup-panel"><div><div class="section-kicker">LOCAL BACKUP</div><h2>备份本机进度</h2>' +
      '<p>换设备或清理浏览器前，请先导出 JSON 文件。导入只接受本行动台生成的格式。</p>' +
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
      '<div class="dialog-actions"><button class="button button-secondary" id="save-task" type="button">保存进度</button>' +
      '<button class="button button-primary" id="complete-task" type="button">验收并完成</button></div></div></dialog>' +
      '<div class="action-toast" id="action-toast" role="status" aria-live="polite"></div>' +
      '<script type="application/json" id="action-data">' + safeTasksJson + '</script>' +
      '<script type="module" src="../assets/js/action-page.js"></script>'
  });
}

const simpleArchiveItems = items => items.map(item => (
  '<article><h3>' + escapeHtml(item.title || item.name) + '</h3>' +
  (item.role ? '<span class="tag">' + escapeHtml(item.role) + '</span>' : '') +
  '<p>' + escapeHtml(item.description) + '</p></article>'
)).join('');

function agentTeamArchive(agentTeam) {
  const milestones = agentTeam.milestones.map(item => (
    '<article><span aria-hidden="true">' + escapeHtml(item.emoji) + '</span>' +
    '<div><small>' + escapeHtml(item.date) + '</small><h3>' +
    escapeHtml(item.title) + '</h3></div></article>'
  )).join('');
  const articles = agentTeam.articles.map(item => {
    const title = item.url
      ? '<a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.title) + ' ↗</a>'
      : escapeHtml(item.title);
    return '<article><span class="tag">' + escapeHtml(item.status) + '</span>' +
      '<h3>' + title + '</h3><p>' + escapeHtml(item.description) + '</p></article>';
  }).join('');
  return '<div class="project-notice"><strong>这是一份历史作品档案</strong><p>' +
    escapeHtml(agentTeam.intro) + '</p></div>' +
    '<section class="project-section"><div class="section-kicker">MILESTONES</div>' +
    '<h2>成长里程碑</h2><div class="milestone-grid">' + milestones + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">TEAM</div>' +
    '<h2>四位智能体成员</h2><div class="project-grid">' +
    simpleArchiveItems(agentTeam.members) + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">PRINCIPLES</div>' +
    '<h2>团队理念</h2><div class="project-grid">' +
    simpleArchiveItems(agentTeam.principles) + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">WHAT IS CLAW</div>' +
    '<h2>Claw 是什么</h2><p>原站用四个切面解释智能体能力；新站保留内容，并补充权限与审核边界。</p>' +
    '<div class="project-grid">' + simpleArchiveItems(agentTeam.science) +
    '</div></section>' +
    '<section class="project-section"><div class="section-kicker">ARCHIVE</div>' +
    '<h2>阶段成果</h2><div class="project-grid">' +
    simpleArchiveItems(agentTeam.achievements) + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">SKILLS</div>' +
    '<h2>技能与角色</h2><div class="project-grid">' +
    simpleArchiveItems(agentTeam.skills) + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">ARTICLES</div>' +
    '<h2>实战文章</h2><div class="project-grid">' + articles + '</div></section>' +
    '<section class="project-section"><div class="section-kicker">TOOLS</div>' +
    '<h2>工具原型</h2><div class="project-grid">' +
    simpleArchiveItems(agentTeam.tools) + '</div></section>';
}

function projectDetail(project, model) {
  const archive = project.slug === 'agent-team'
    ? agentTeamArchive(model.agentTeam)
    : '';
  return layout({
    title: project.title + ' · 猫哥作品',
    description: project.summary,
    depth: 2,
    active: 'projects',
    body: '<article class="project-detail"><p>' + escapeHtml(project.category) + ' · ' +
      escapeHtml(project.date) + '</p><h1>' + escapeHtml(project.title) + '</h1>' +
      '<p>' + escapeHtml(project.summary) + '</p>' + project.bodyHtml +
      archive + '</article>'
  });
}

export function renderPages(model) {
  const files = new Map([
    ['index.html', homePage(model)],
    ['timeline/index.html', timelinePage(model)],
    ['writing/index.html', writingPage(model)],
    ['projects/index.html', projectsPage(model)],
    ['about/index.html', aboutPage(model)],
    ['action/index.html', actionPage(model)]
  ]);

  for (const project of published(model.projects)) {
    files.set('projects/' + project.slug + '/index.html', projectDetail(project, model));
  }
  return files;
}
