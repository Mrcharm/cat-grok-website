import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('生成六个主页面和两个作品详情', async () => {
  const files = await buildSite({ write: false });
  for (const path of [
    'index.html',
    'timeline/index.html',
    'writing/index.html',
    'projects/index.html',
    'about/index.html',
    'action/index.html',
    'projects/agent-team/index.html',
    'projects/data-ai-copilot/index.html'
  ]) {
    assert.ok(files.has(path), path);
  }
});

test('所有生成页面使用相对根路径且有唯一主标题', async () => {
  const files = await buildSite({ write: false });
  for (const [path, html] of files) {
    assert.equal((html.match(/<h1\b/g) || []).length, 1, path);
    assert.doesNotMatch(html, /href="\/assets\//, path);
  }
});

test('本地发布文章会生成可访问的详情页', async () => {
  const files = await buildSite({ write: false });
  const localPublishedPosts = [...files.keys()].filter(path => (
    path.startsWith('writing/') && path !== 'writing/index.html'
  ));
  assert.ok(localPublishedPosts.length >= 1);
});
