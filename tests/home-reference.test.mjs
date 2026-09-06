import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
import { readFile } from 'node:fs/promises';
test('header and homepage use one centered frame width', async () => {
 const css=await readFile(new URL('../assets/styles/site.css',import.meta.url),'utf8');
 assert.match(css,/--site-frame:1450px/);
 assert.match(css,/width:min\(var\(--site-frame\),calc\(100% - 60px\)\)/);
});
test('reference homepage keeps three populated columns and the supplied portrait', async () => {
  const html = (await buildSite({write:false})).get('index.html');
  assert.match(html, /electric-cat-collage.png/);
  assert.match(html, /street-paper-edge/);
  assert.match(html, /KEEP GOING/);
  assert.match(html, /home-street.css/);
  assert.equal((html.match(/class="home-column"/g)||[]).length, 3);
  assert.equal((html.match(/class="home-preview"/g)||[]).length, 6);
  assert.match(html, /Obsidian/);
  assert.doesNotMatch(html, /72%|45%/);
});
