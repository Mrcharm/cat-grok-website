import { escapeHtml as esc } from './layout.mjs';

export function homeHighlights(blog, skills) {
  const preview = (href, title, detail, artwork, art = '') => `<a class="home-preview" href="${esc(href)}"><span class="preview-art" data-art="${esc(art)}"><span class="preview-lettering">${esc(artwork)}</span></span><span class="preview-copy"><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></a>`;
  const column = (title, more, href, cards) => `<section class="home-column"><div class="column-heading"><h2>${title}</h2><a href="${href}">${more} →</a></div>${cards.join('')}</section>`;
  return '<section class="home-highlights" aria-label="探索猫哥的站点">' +
    column('最近在写', '更多文章', 'articles/', blog.items.slice(0, 2).map((x, i) => preview(x.url, x.title, `${x.date} · ${x.category}`, i ? 'Data\nNotes' : 'AI', i ? 'notes' : 'cat'))) +
    column('正在学习', '更多技能', 'skills/', skills.categories.flatMap(x => x.skills || []).slice(0, 2).map((x, i) => preview('skills/', x.badge || x.name, x.tags.slice(0, 2).join(' · '), i ? '需求\n澄清' : 'SQL\n生成', 'learning'))) +
    column('代表作品', '更多作品', 'portfolio/', [
      preview('portfolio/', 'ETL 在线设计平台', '数据研发 · Web IDE', 'ETL\nSTUDIO', 'project'),
      preview('portfolio/', 'AI 数据研发 Copilot', 'NL2SQL · AI 助手 · Agent', 'AI\nCOPILOT', 'project')
    ]) + '</section>';
}
