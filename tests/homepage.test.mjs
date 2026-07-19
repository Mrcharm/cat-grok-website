import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('首页顺序符合猫哥个人叙事', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  const ids = ['now', 'life-lines', 'roadmap', 'notes', 'featured-projects', 'home-about'];
  const positions = ids.map(id => html.indexOf('id="' + id + '"'));
  assert.ok(positions.every(value => value >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('智能体团队不出现在首页第一屏', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  const firstSectionEnd = html.indexOf('</section>');
  assert.equal(html.slice(0, firstSectionEnd).includes('智能体团队'), false);
});
