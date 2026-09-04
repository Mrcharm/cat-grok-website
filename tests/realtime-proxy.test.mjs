import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import WebSocket from 'ws';
import { createVoiceServer } from '../server/index.mjs';

class FakeSession extends EventEmitter {
  ready = false;
  audio = [];
  texts = [];
  closed = false;
  sendAudio(value) { this.audio.push(Buffer.from(value)); }
  sendText(value) { this.texts.push(value); }
  close() { this.closed = true; this.emit('closed-by-proxy'); }
}

const config = {
  port: 0,
  allowedOrigins: ['https://mrcharm.github.io'],
  maxSessionMs: 60_000,
  maxConnectionsPerIp: 2,
  accessKey: 'must-not-leak'
};

const start = async options => {
  const app = createVoiceServer({ config, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const { port } = app.server.address();
  return { ...app, base: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}/voice` };
};

const stop = app => new Promise(resolve => app.close(resolve));

test('health endpoint is public and contains no configuration', async () => {
  const app = await start();
  const response = await fetch(`${app.base}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await stop(app);
});

test('websocket rejects an origin outside the exact allowlist', async () => {
  const app = await start();
  const socket = new WebSocket(app.ws, { origin: 'https://evil.example' });
  const [error] = await once(socket, 'unexpected-response');
  assert.ok(error);
  await stop(app);
});

test('proxy starts one upstream session and maps safe events', async t => {
  const upstream = new FakeSession();
  let resolveCreated;
  const created = new Promise(resolve => { resolveCreated = resolve; });
  const app = await start({ upstreamFactory: async () => {
    resolveCreated();
    return upstream;
  } });
  t.after(() => stop(app));
  const socket = new WebSocket(app.ws, { origin: 'https://mrcharm.github.io' });
  await once(socket, 'open');
  const messages = [];
  socket.on('message', (data, binary) => messages.push(binary ? Buffer.from(data) : JSON.parse(data.toString())));
  socket.send(JSON.stringify({ type: 'client.start' }));
  await created;
  await new Promise(resolve => setImmediate(resolve));

  upstream.ready = true;
  upstream.emit('ready');
  upstream.emit('transcript', { speaker: 'user', text: '你好', final: true });
  upstream.emit('audio', Buffer.from([1, 2, 3]));
  upstream.emit('interrupted');
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(messages[0], { type: 'server.ready' });
  assert.deepEqual(messages[1], { type: 'server.transcript', speaker: 'user', text: '你好', final: true });
  assert.deepEqual(messages[2], Buffer.from([1, 2, 3]));
  assert.deepEqual(messages[3], { type: 'server.state', state: 'interrupted' });

  socket.send(Buffer.from([9, 8]));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(upstream.audio[0], Buffer.from([9, 8]));
  socket.send(JSON.stringify({ type: 'client.text', text: '文字问题' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(upstream.texts, ['文字问题']);
  const upstreamClosed = once(upstream, 'closed-by-proxy');
  socket.close();
  await once(socket, 'close');
  await upstreamClosed;
  assert.equal(upstream.closed, true);
});

test('factory failures return a stable message without secrets', async () => {
  const app = await start({
    upstreamFactory: async () => { throw new Error('must-not-leak'); }
  });
  const socket = new WebSocket(app.ws, { origin: 'https://mrcharm.github.io' });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'client.start' }));
  const [raw] = await once(socket, 'message');
  const message = JSON.parse(raw.toString());
  assert.deepEqual(message, {
    type: 'server.error',
    code: 'UPSTREAM_CONNECTION_FAILED',
    message: '实时语音服务连接失败，请稍后重试。'
  });
  assert.doesNotMatch(raw.toString(), /must-not-leak/);
  socket.close();
  await once(socket, 'close');
  await stop(app);
});
