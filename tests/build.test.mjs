import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('生成四个当前公开页面', async () => {
  const files = await buildSite({ write: false });
  for (const path of ['index.html', 'articles/index.html', 'skills/index.html', 'portfolio/index.html']) {
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

