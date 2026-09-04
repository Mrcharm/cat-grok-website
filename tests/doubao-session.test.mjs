import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { gzipSync } from 'node:zlib';
import { createDoubaoSession } from '../server/doubao-session.mjs';

const u32 = value => {
  const result = Buffer.alloc(4);
  result.writeUInt32BE(value);
  return result;
};

const response = ({ event, sessionId = 'upstream-session', payload = {}, raw = false }) => {
  const compressed = gzipSync(raw ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload)));
  return Buffer.concat([
    Buffer.from([0x11, 0x94, raw ? 0x01 : 0x11, 0]),
    u32(event),
    u32(Buffer.byteLength(sessionId)),
    Buffer.from(sessionId),
    u32(compressed.length),
    compressed
  ]);
};

class FakeSocket extends EventEmitter {
  sent = [];
  closed = false;
  send(value) { this.sent.push(Buffer.from(value)); }
  close() { this.closed = true; }
}

const config = {
  doubaoWsUrl: 'wss://upstream.example/dialogue',
  appId: 'server-app',
  accessKey: 'server-key',
  modelName: 'model-name',
  speaker: 'speaker-id'
};

test('session connects with official server-only headers', async () => {
  const socket = new FakeSocket();
  let request;
  const session = await createDoubaoSession({
    config,
    connect: async (url, options) => { request = { url, options }; return socket; },
    connectId: 'fixed-connect-id'
  });
  assert.equal(request.url, config.doubaoWsUrl);
  assert.deepEqual(request.options.headers, {
    'X-Api-App-ID': 'server-app',
    'X-Api-Access-Key': 'server-key',
    'X-Api-Resource-Id': 'volc.speech.dialog',
    'X-Api-App-Key': 'PlgvMymc7f3tQnJ6',
    'X-Api-Connect-Id': 'fixed-connect-id'
  });
  assert.equal(socket.sent[0].readUInt32BE(4), 1);
  session.close();
});

test('session becomes ready only after connection and session acknowledgements', async () => {
  const socket = new FakeSocket();
  const session = await createDoubaoSession({ config, connect: async () => socket });
  let ready = 0;
  session.on('ready', () => { ready += 1; });

  socket.emit('message', response({ event: 50 }));
  assert.equal(socket.sent[1].readUInt32BE(4), 100);
  assert.equal(ready, 0);

  socket.emit('message', response({ event: 150 }));
  assert.equal(ready, 1);
  session.close();
});

test('session maps transcripts, PCM, and interruption without logging payloads', async () => {
  const socket = new FakeSocket();
  const session = await createDoubaoSession({ config, connect: async () => socket });
  const seen = [];
  for (const name of ['transcript', 'audio', 'interrupted']) {
    session.on(name, value => seen.push([name, value]));
  }
  socket.emit('message', response({ event: 451, payload: { results: [{ text: '用户说话' }] } }));
  socket.emit('message', response({ event: 550, payload: { content: '助手回复' } }));
  socket.emit('message', response({ event: 352, payload: Buffer.from([1, 2]), raw: true }));
  socket.emit('message', response({ event: 450 }));

  assert.deepEqual(seen[0], ['transcript', { speaker: 'user', text: '用户说话', final: true }]);
  assert.deepEqual(seen[1], ['transcript', { speaker: 'assistant', text: '助手回复', final: false }]);
  assert.deepEqual(seen[2], ['audio', Buffer.from([1, 2])]);
  assert.deepEqual(seen[3], ['interrupted', undefined]);
  session.close();
});

test('session sends audio only after ready and closes upstream cleanly', async () => {
  const socket = new FakeSocket();
  const session = await createDoubaoSession({ config, connect: async () => socket });
  assert.throws(() => session.sendAudio(Buffer.from([1, 2])), /not ready/i);
  socket.emit('message', response({ event: 50 }));
  socket.emit('message', response({ event: 150 }));
  session.sendAudio(Buffer.from([1, 2]));
  assert.equal(socket.sent.at(-1).readUInt32BE(4), 200);
  session.sendText('文字问题');
  assert.equal(socket.sent.at(-1).readUInt32BE(4), 501);
  session.close();
  assert.equal(socket.closed, true);
});

test('upstream failures become a stable safe error', async () => {
  const socket = new FakeSocket();
  const session = await createDoubaoSession({ config, connect: async () => socket });
  const errors = [];
  session.on('safe-error', error => errors.push(error));
  socket.emit('error', new Error('server-key must never reach browser'));
  assert.deepEqual(errors, [{ code: 'UPSTREAM_CONNECTION_FAILED', message: '实时语音服务连接失败，请稍后重试。' }]);
  session.close();
});
