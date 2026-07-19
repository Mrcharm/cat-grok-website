import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildSite } from '../scripts/build.mjs';

const expectedCanonical = path => {
  const suffix = path === 'index.html' ? '' : path.replace(/index\.html$/, '');
  return 'https://mrcharm.github.io/cat-grok-website/' + suffix;
};

test('每页有唯一 canonical 和完整分享信息', async () => {
  const files = await buildSite({ write: false });
  for (const [path, html] of files) {
    const canonicals = html.match(/<link rel="canonical"/g) || [];
    assert.equal(canonicals.length, 1, path);
    assert.match(html, new RegExp('<link rel="canonical" href="' + expectedCanonical(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '">'), path);
    assert.match(html, /<meta property="og:title"/, path);
    assert.match(html, /<meta property="og:description"/, path);
    assert.match(html, /<meta property="og:image" content="https:\/\/mrcharm\.github\.io\/cat-grok-website\/og\.png">/, path);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, path);
  }
});

test('分享图是 1200 × 630 的有效 PNG', async () => {
  const info = await stat('og.png');
  const png = await readFile('og.png');
  assert.ok(info.size > 20_000);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('公开站点不再引用已删除的旧版资源', async () => {
  const files = await buildSite({ write: false });
  for (const [path, html] of files) {
    assert.doesNotMatch(html, /(?:href|src)="(?:\.\.\/)*styles\.css"/, path);
    assert.doesNotMatch(html, /(?:href|src)="(?:\.\.\/)*script\.js"/, path);
  }
});

test('生成页的站内链接可解析且新窗口链接安全', async () => {
  const files = await buildSite({ write: false });
  for (const [pagePath, html] of files) {
    const attributes = [...html.matchAll(/<(?:a|link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g)];
    for (const match of attributes) {
      const [tag, href] = match;
      if (/^https?:\/\//.test(href)) {
        if (/<a\b/.test(tag) && /target="_blank"/.test(tag)) {
          assert.match(tag, /rel="[^"]*noopener[^"]*"/, pagePath + ' ' + href);
        }
        continue;
      }
      if (href.startsWith('#') || href.startsWith('mailto:')) continue;
      const clean = href.split(/[?#]/)[0];
      let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), clean));
      if (clean.endsWith('/')) resolved = path.posix.join(resolved, 'index.html');
      if (files.has(resolved)) continue;
      await assert.doesNotReject(access(resolved), pagePath + ' → ' + href);
    }
  }
});
