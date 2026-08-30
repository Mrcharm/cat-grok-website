import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('首页保留 JARVIS 陪伴体验', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  for (const text of ['JARVIS', '陪你说话', '陪你走到不再需要我']) {
    assert.match(html, new RegExp(text));
  }
});

test('首页第一屏不把智能体团队当作主体', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  const firstSectionEnd = html.indexOf('</section>');
  assert.equal(html.slice(0, firstSectionEnd).includes('智能体团队'), false);
});

