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

test('首页采用电蓝街头主视觉并保留三个内容入口', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  assert.match(html, /class="street-hero"/);
  assert.match(html, /assets\/images\/electric-cat-user\.png/);
  assert.match(html, /猫哥，[\s\S]*不止一面/);
  for (const path of ['articles/', 'skills/', 'portfolio/']) assert.match(html, new RegExp('href="' + path));
  assert.doesNotMatch(html, /coreCanvas|three\.min\.js/);
});

test('首页使用一次启动的豆包实时语音入口而不是浏览器模拟回复', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  assert.match(html, /id="voiceDock"[^>]*data-voice-endpoint=/);
  assert.match(html, /id="voiceStatus"[^>]*aria-live="polite"[^>]*>JARVIS 已就绪</);
  assert.match(html, /assets\/dist\/duplex-voice\.js/);
  assert.doesNotMatch(html, /assets\/dist\/rtc-voice\.js/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /const REPLIES|speechSynthesis|SpeechRecognition/);
});

