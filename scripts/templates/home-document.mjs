import { persistentShell } from './layout.mjs';

const HEADER_AND_MUSIC =
  /<header class="(?:topbar|site-header)">[\s\S]*?<\/(?:div|aside)>\s*(?=(?:<!-- Fullscreen|<main\b))/;

export function normalizeHomeDocument(source) {
  let html = source
    .replace('<body>', '<body class="home-page jarvis-home">')
    .replace(/<body class="[^"]*">/, '<body class="home-page jarvis-home">')
    .replace(HEADER_AND_MUSIC, persistentShell({ active: 'home' }) + '\n');

  if (!html.includes('assets/styles/site.css')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="assets/styles/site.css">\n</head>');
  }

  if (!html.includes('rel="canonical"')) {
    const siteUrl = 'https://mrcharm.github.io/cat-grok-website/';
    const social =
      '<link rel="canonical" href="' + siteUrl + '">\n' +
      '<meta property="og:type" content="website">\n' +
      '<meta property="og:title" content="猫哥 · JARVIS">\n' +
      '<meta property="og:description" content="JARVIS — 猫哥的 AI 陪伴系统。我在这里，等你开口。">\n' +
      '<meta property="og:image" content="' + siteUrl + 'og.png">\n' +
      '<meta name="twitter:card" content="summary_large_image">\n';
    html = html.replace('</head>', social + '</head>');
  }

  if (!/<main\b/.test(html)) {
    html = html
      .replace('<!-- Fullscreen Three.js canvas -->', '<main id="main" data-page-module="home">\n<!-- Fullscreen Three.js canvas -->')
      .replace('<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>', '</main>\n<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>');
  } else {
    html = html.replace(/<main\b([^>]*)>/, '<main id="main" data-page-module="home">');
  }

  if (!/<h1\b/.test(html)) {
    html = html.replace(
      '<main id="main" data-page-module="home">',
      '<main id="main" data-page-module="home"><h1 class="visually-hidden">猫哥 · JARVIS 陪伴系统</h1>'
    );
  }

  html = html.replace(
    /\/\/ ============ BACKGROUND MUSIC[\s\S]*?(?=<\/script>)/,
    ''
  );

  if (!html.includes('assets/js/site.js')) {
    html = html.replace('</body>', '<script type="module" src="assets/js/site.js"></script>\n</body>');
  }

  return html;
}
