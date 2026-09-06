import { escapeHtml as esc } from './layout.mjs';

export function homeHighlights(blog, skills) {
  const preview = (href, title, detail, artwork, image = '') => `<a class="home-preview" href="${esc(href)}"><span class="preview-art">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : esc(artwork)}</span><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></a>`;
  const column = (title, more, href, cards) => `<section class="home-column"><div class="column-heading"><h2>${title}</h2><a href="${href}">${more} →</a></div>${cards.join('')}</section>`;
  return '<section class="home-highlights" aria-label="探索猫哥的站点">' +
    column('最近在写', '更多文章', 'articles/', blog.items.slice(0, 2).map((x, i) => preview(x.url, x.title, `${x.date} · ${x.category}`, i ? 'DATA\nNOTES' : 'AI\nNOTES'))) +
    column('正在学习', '更多技能', 'skills/', skills.categories.flatMap(x => x.skills || []).slice(0, 2).map(x => preview('skills/', x.badge || x.name, x.tags.slice(0, 2).join(' · '), x.name.replace('etl-', '').replaceAll('-', '\n')))) +
    column('代表作品', '更多作品', 'portfolio/', [
      preview('portfolio/', 'ETL 在线设计平台', '数据研发 · Web IDE', '', 'assets/portfolio/design-blueprint.png'),
      preview('portfolio/', 'AI 数据研发 Copilot', 'NL2SQL · AI 助手 · Agent', '', 'assets/portfolio/ai-assistant.png')
    ]) + '</section>';
}
