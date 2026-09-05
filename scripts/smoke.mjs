import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { createVoiceServer } from '../server/index.mjs';

for (const file of ['index.html', 'articles/index.html', 'skills/index.html', 'portfolio/index.html']) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('MR.C') || !home.includes('JARVIS') || !home.includes('type=2&amp;id=2086327879&amp;auto=1')) {
  throw new Error('首页缺少统一品牌或《鲜花》背景音乐');
}
if (!home.includes('assets/dist/duplex-voice.js') || home.includes('assets/dist/rtc-voice.js') || home.includes('speechSynthesis')) {
  throw new Error('首页未正确启用豆包双工语音 bundle');
}

const upstreamServer = http.createServer();
const upstreamWss = new WebSocketServer({ noServer: true });
upstreamServer.on('upgrade', (request, socket, head) => {
  upstreamWss.handleUpgrade(request, socket, head, ws => upstreamWss.emit('connection', ws, request));
});
upstreamServer.listen(0, '127.0.0.1');
await once(upstreamServer, 'listening');

const origin = 'https://smoke.invalid';
const app = createVoiceServer({
  config: {
    apiKey: 'smoke-only-placeholder',
    allowedOrigins: [origin],
    upstreamUrl: `ws://127.0.0.1:${upstreamServer.address().port}/api/v3/duplex/realtime/dialogue`,
    sessionTtlMs: 60_000,
    maxConnections: 2
  }
});
app.server.listen(0, '127.0.0.1');
await once(app.server, 'listening');

try {
  const upstreamConnection = once(upstreamWss, 'connection');
  const browser = new WebSocket(`ws://127.0.0.1:${app.server.address().port}/voice`, { origin });
  const [upstream] = await upstreamConnection;
  const [sessionData] = await once(upstream, 'message');
  const session = JSON.parse(sessionData.toString());
  assert.equal(session.type, 'session.create');
  assert.equal(session.session.model, '1.2.6.1');
  assert.deepEqual(session.session.audio.input.format, { type: 'pcm', sample_rate: 16000 });
  assert.deepEqual(session.session.audio.output.format, { type: 'pcm', sample_rate: 24000 });

  upstream.send(JSON.stringify({ type: 'session.created' }));
  const [greetingData] = await once(upstream, 'message');
  assert.equal(JSON.parse(greetingData.toString()).type, 'speech_text_buffer.commit');
  browser.close();
} finally {
  await new Promise(resolve => app.close(resolve));
  await new Promise(resolve => upstreamWss.close(() => upstreamServer.close(resolve)));
}

console.log('smoke: four JARVIS pages, Flowers music, and Doubao duplex WebSocket initialization are present');
