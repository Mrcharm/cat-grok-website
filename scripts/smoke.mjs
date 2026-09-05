import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createVoiceServer } from '../server/index.mjs';

const required = [
  'index.html',
  'articles/index.html',
  'skills/index.html',
  'portfolio/index.html'
];

for (const file of required) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('MR.C') || !home.includes('JARVIS') || !home.includes('type=2&amp;id=2086327879&amp;auto=1')) {
  throw new Error('首页缺少统一品牌或《鲜花》背景音乐');
}
if (!home.includes('assets/dist/rtc-voice.js') || home.includes('assets/js/voice/realtime-voice.js') || home.includes('const REPLIES') || home.includes('speechSynthesis')) {
  throw new Error('首页未正确启用 RTC 实时语音 bundle');
}

let starts = 0;
let stops = 0;
const origin = 'https://smoke.invalid';
const app = createVoiceServer({
  config: {
    rtc: { appId: 'x'.repeat(24), appKey: 'x' },
    iam: { accessKeyId: 'x', secretAccessKey: 'x' },
    s2s: { appId: 'x', accessToken: 'x' },
    allowedOrigins: [origin],
    sessionTtlMs: 60_000,
    maxConnectionsPerIp: 1
  },
  rtcApi: {
    startVoiceChat: async () => { starts += 1; },
    stopVoiceChat: async () => { stops += 1; }
  },
  tokenFactory: () => 'short-lived-smoke-token'
});

await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const { port } = app.server.address();
const request = (path, init = {}) => fetch(`http://127.0.0.1:${port}${path}`, init);
const headers = { Origin: origin, 'Content-Type': 'application/json' };

try {
  const prepared = await request('/rtc/session', { method: 'POST', headers, body: '{}' });
  assert.equal(prepared.status, 201);
  const session = await prepared.json();
  assert.equal(starts, 0);

  const started = await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers, body: '{}' });
  assert.equal(started.status, 200);
  assert.equal(starts, 1);

  const stopped = await request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: origin } });
  assert.equal(stopped.status, 204);
  assert.equal(stops, 1);
} finally {
  await new Promise(resolve => app.close(resolve));
}

console.log('smoke: four JARVIS pages, Flowers music, RTC bundle, and two-phase RTC API are present');
