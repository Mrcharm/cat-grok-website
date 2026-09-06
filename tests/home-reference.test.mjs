import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
test('reference homepage keeps three populated columns and the supplied portrait', async () => {
  const html = (await buildSite({write:false})).get('index.html');
  assert.match(html, /electric-cat-user.png/);
  assert.equal((html.match(/class="home-column"/g)||[]).length, 3);
  assert.equal((html.match(/class="home-preview"/g)||[]).length, 6);
  assert.match(html, /企业 AI 落地/);
  assert.doesNotMatch(html, /72%|45%/);
});
