import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

const routes = [
  ['index.html', '首页'],
  ['articles/index.html', '文章'],
  ['skills/index.html', '技能'],
  ['portfolio/index.html', '作品集']
];

test('生成当前四个 JARVIS 公开页面', async () => {
  const files = await buildSite({ write: false });
  assert.deepEqual([...files.keys()].sort(), routes.map(([path]) => path).sort());
});

test('四页使用同一品牌、导航和《我想part2》隐藏单曲', async () => {
  const files = await buildSite({ write: false });
  for (const [path] of routes) {
    const html = files.get(path);
    assert.match(html, /<header class="site-header">/);
    assert.match(html, /<span>MR\.C <b>JARVIS<\/b><\/span>/);
    assert.match(html, /id="site-nav" class="nav"/);
    assert.match(html, /首页[\s\S]*文章[\s\S]*技能[\s\S]*作品集/);
    assert.match(html, /class="[^"]*music-btn[^"]*"[^>]*aria-pressed="true"/);
    assert.match(html, /id="background-music-frame"/);
    assert.match(html, /type=2&amp;id=1336856498&amp;auto=1/);
    assert.doesNotMatch(html, /music-panel|music-unlock|885054268/);
    assert.equal((html.match(/<main\b/g) || []).length, 1, path);
  }
});

test('每页只有对应导航项被选中', async () => {
  const files = await buildSite({ write: false });
  for (const [path, label] of routes) {
    const html = files.get(path);
    const current = html.match(/<a[^>]+aria-current="page"[^>]*>([^<]+)<\/a>/);
    assert.equal(current?.[1], label, path);
  }
});
