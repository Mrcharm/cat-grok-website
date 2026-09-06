export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const NAV_ITEMS = [
  ['home', '首页', 'index.html'],
  ['articles', '文章', 'articles/'],
  ['skills', '技能', 'skills/'],
  ['portfolio', '作品集', 'portfolio/']
];

export const NETEASE_SONG_ID = '2086327879';
export const NETEASE_PLAYER_URL =
  'https://music.163.com/outchain/player?type=2&amp;id=' +
  NETEASE_SONG_ID +
  '&amp;auto=1&amp;height=32';

export function persistentShell({ depth = 0, active = 'home' } = {}) {
  const root = '../'.repeat(depth);
  const nav = NAV_ITEMS.map(([id, label, path]) => (
    '<a href="' + root + path + '" data-route="' + id + '"' +
    (active === id ? ' aria-current="page"' : '') +
    '>' + label + '</a>'
  )).join('');

  return '<header class="site-header">' +
    '<a class="brand" href="' + root + 'index.html">' +
    '<span class="brand-mark" aria-hidden="true">C</span>' +
    '<span>MR.C <b>JARVIS</b></span></a>' +
    '<div class="topbar-right">' +
    '<nav id="site-nav" class="nav" data-open="false" aria-label="主导航">' + nav + '</nav>' +
    '<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">菜单</button>' +
    '<button class="music-btn playing" type="button" aria-label="停止背景音乐：《鲜花》" aria-pressed="true">' +
    '<span class="bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>音乐</span></button>' +
    '</div></header>' +
    '<iframe class="background-music-frame" id="background-music-frame" title="背景音乐：回春丹乐队《鲜花》" ' +
    'aria-hidden="true" tabindex="-1" src="' + NETEASE_PLAYER_URL + '"></iframe>';
}

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

  return '<!doctype html><html lang="zh-CN"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="' + escapeHtml(description) + '">' +
    '<meta name="theme-color" content="#0b49ff">' +
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
    '<link rel="stylesheet" href="' + root + 'assets/styles/site.css?v=20260906c">' +
    '<link rel="stylesheet" href="' + root + 'assets/styles/home-street.css">' +
    '</head><body class="' + escapeHtml(pageClass) + '">' +
    '<a class="skip-link" href="#main">跳到主要内容</a>' +
    persistentShell({ depth, active }) +
    '<main id="main">' + body + '</main>' +
    '<footer><strong>猫哥 · JARVIS</strong><span>AI 陪伴系统 · 静态生成</span></footer>' +
    '<script type="module" src="' + root + 'assets/js/site.js?v=20260906c"></script>' +
    '</body></html>';
}
