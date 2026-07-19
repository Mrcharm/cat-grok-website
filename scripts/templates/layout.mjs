export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function layout({
  title,
  description,
  canonicalPath = '',
  depth = 0,
  active,
  body,
  pageClass = ''
}) {
  const root = '../'.repeat(depth);
  const siteRoot = 'https://mrcharm.github.io/cat-grok-website/';
  const canonical = siteRoot + canonicalPath;
  const nav = [
    ['home', '首页', root + 'index.html'],
    ['timeline', '人生轨迹', root + 'timeline/'],
    ['writing', '写作', root + 'writing/'],
    ['projects', '作品', root + 'projects/'],
    ['about', '关于我', root + 'about/'],
    ['action', '今日行动', root + 'action/']
  ].map(([id, label, href]) => (
    '<a href="' + href + '"' +
    (active === id ? ' aria-current="page"' : '') +
    '>' + label + '</a>'
  )).join('');

  return '<!doctype html><html lang="zh-CN"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="' + escapeHtml(description) + '">' +
    '<meta name="theme-color" content="#eaf5ff">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:locale" content="zh_CN">' +
    '<meta property="og:site_name" content="猫哥 · 向 2031 生长">' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">' +
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">' +
    '<meta property="og:image" content="' + siteRoot + 'og.png">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta property="og:image:alt" content="猫哥沿着职业、学习、生活与作品的路径向 2031 生长">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">' +
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">' +
    '<meta name="twitter:image" content="' + siteRoot + 'og.png">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<link rel="stylesheet" href="' + root + 'assets/styles/site.css">' +
    '</head><body class="' + escapeHtml(pageClass) + '">' +
    '<a class="skip-link" href="#main">跳到主要内容</a>' +
    '<header class="site-header">' +
    '<a class="brand" href="' + root + 'index.html">🐱 <strong>猫哥</strong></a>' +
    '<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">菜单</button>' +
    '<nav id="site-nav" data-open="false" aria-label="主导航">' + nav + '</nav>' +
    '</header>' +
    '<main id="main">' + body + '</main>' +
    '<footer><strong>猫哥 · 向 2031 生长</strong><span>精选公开，长期更新。</span></footer>' +
    '<script type="module" src="' + root + 'assets/js/site.js"></script>' +
    '</body></html>';
}
