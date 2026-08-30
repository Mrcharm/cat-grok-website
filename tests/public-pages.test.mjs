import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('文章页展示技术文章与分类筛选', async () => {
  const html = (await buildSite({ write: false })).get('articles/index.html');
  assert.match(html, /技术文章/);
  assert.match(html, /data-cat="all"/);
});

test('技能页展示技能库和下载入口', async () => {
  const html = (await buildSite({ write: false })).get('skills/index.html');
  assert.match(html, /技能库/);
  assert.match(html, /下载 SKILL\.md/);
});

test('作品集明确展示代表项目', async () => {
  const html = (await buildSite({ write: false })).get('portfolio/index.html');
  assert.match(html, /作品集/);
  assert.match(html, /JARVIS 陪伴系统/);
});

