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
  return layout({
    title: '猫哥 · 向 2031 生长',
    description: '猫哥的职业、学习、生活与作品长期记录。',
    active: 'home',
    pageClass: 'home-page',
    body:
      '<section class="page-hero"><p>2026 → 2031</p>' +
      '<h1>你好，我是' + escapeHtml(profile.name) + '。</h1>' +
      '<p>' + escapeHtml(profile.tagline) + '</p>' +
      '<p>' + escapeHtml(profile.role) + '</p></section>' +
      '<section><h2>通往 2031</h2><p>' + escapeHtml(roadmap.northStar) + '</p></section>' +
      '<section><h2>近期写作</h2><div class="archive-grid">' + recentPosts + '</div></section>' +
      '<section><h2>作品档案</h2><div class="archive-grid">' + featuredProjects + '</div></section>' +
      '<section><h2>今天做什么</h2><p>每天至少 30 分钟，把长期目标变成一项可交付动作。</p>' +
      '<a href="action/">进入今日行动</a></section>'
  });
}

function timelinePage({ roadmap }) {
  const years = roadmap.years.map(item => (
    '<article id="' + (item.year === 2031 ? 'roadmap-2031' : 'year-' + item.year) + '">' +
    '<p>' + escapeHtml(item.stage) + '</p>' +
    '<h2>' + escapeHtml(item.displayYear || item.year) + ' · ' + escapeHtml(item.title) + '</h2>' +
    '<p>' + escapeHtml(item.outcome) + '</p></article>'
  )).join('');
  return layout({
    title: '人生轨迹 · 猫哥',
    description: '猫哥从 2026 走向 2031 的职业、学习与生活路线。',
    depth: 1,
    active: 'timeline',
    body: '<section class="page-hero"><h1>人生轨迹</h1><p>路线会调整，证据会留下。</p></section>' +
      '<section class="timeline-list">' + years + '</section>'
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
    body: '<section class="page-hero"><h1>写作</h1><p>写清问题、证据、取舍和仍然不知道的部分。</p></section>' +
      '<section class="archive-grid">' + items + '</section>'
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
  return layout({
    title: '关于我 · 猫哥',
    description: '猫哥的能力组合、长期方向和公开入口。',
    depth: 1,
    active: 'about',
    body: '<section class="page-hero"><h1>关于我</h1><p>' + escapeHtml(profile.role) + '</p></section>' +
      '<section class="archive-grid">' + strengths + '</section>'
  });
}

function actionPage({ tasks }) {
  const first = tasks[0];
  return layout({
    title: '今日行动 · 猫哥',
    description: '猫哥的 30 天执行日历与行动看板。',
    depth: 1,
    active: 'action',
    body: '<section class="page-hero"><h1>今日行动</h1><p>每天只推进一个可交付结果。</p></section>' +
      '<section><p>' + escapeHtml(first.date) + ' · ' + escapeHtml(first.id.toUpperCase()) + '</p>' +
      '<h2>' + escapeHtml(first.title) + '</h2><p>' + escapeHtml(first.deliverable) + '</p></section>'
  });
}

function projectDetail(project) {
  return layout({
    title: project.title + ' · 猫哥作品',
    description: project.summary,
    depth: 2,
    active: 'projects',
    body: '<article class="project-detail"><p>' + escapeHtml(project.category) + ' · ' +
      escapeHtml(project.date) + '</p><h1>' + escapeHtml(project.title) + '</h1>' +
      '<p>' + escapeHtml(project.summary) + '</p>' + project.bodyHtml + '</article>'
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
    files.set('projects/' + project.slug + '/index.html', projectDetail(project));
  }
  return files;
}
