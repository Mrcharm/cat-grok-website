import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { createVoiceServer } from '../server/index.mjs';

const allowedOrigin = 'https://mrcharm.github.io';

async function openMockUpstream() {
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    server,
    wss,
    url: `ws://127.0.0.1:${port}/api/v3/duplex/realtime/dialogue`,
    close: () => new Promise(resolve => wss.close(() => server.close(resolve)))
  };
}

async function start(overrides = {}) {
  const upstream = await openMockUpstream();
  const app = createVoiceServer({
    config: {
      apiKey: 'server-only-test-key',
      allowedOrigins: [allowedOrigin],
      upstreamUrl: upstream.url,
      sessionTtlMs: 900_000,
      maxConnections: 2,
      ...overrides
    }
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const { port } = app.server.address();
  return {
    app,
    upstream,
    port,
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise(resolve => app.close(resolve));
      await upstream.close();
    }
  };
}

const connect = (url, origin = allowedOrigin) => new WebSocket(url, { origin });
const nextJson = ws => once(ws, 'message').then(([data]) => JSON.parse(data.toString()));

test('health endpoint is public and contains no configuration', async t => {
  const fixture = await start();
  t.after(() => fixture.close());
  const response = await fetch(`${fixture.base}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('proxy initializes the verified Doubao session, greets on session.created, and forwards a 20ms PCM frame', async t => {
  const fixture = await start();
  t.after(() => fixture.close());
  const upstreamConnection = once(fixture.upstream.wss, 'connection');
  const browser = connect(`ws://127.0.0.1:${fixture.port}/voice`);
  t.after(() => browser.close());

  const [upstream, request] = await upstreamConnection;
  assert.equal(request.headers['x-api-key'], 'server-only-test-key');
  assert.ok(request.headers['x-api-connect-id']);

  const sessionCreate = await nextJson(upstream);
  assert.deepEqual(sessionCreate, {
    type: 'session.create',
    session: {
      model: '1.2.6.1',
      instructions: '你是 JARVIS，猫哥的中文 AI 语音陪伴助手。用温柔、舒缓、自然的女声交流，回答简洁、真诚，不夸张撒娇。不要使用工具、联网、位置、音乐或录音能力。',
      audio: {
        input: { format: { type: 'pcm', rate: 16000 } },
        output: {
          format: { type: 'pcm', rate: 24000 },
          voice: 'zh_female_xiaohe_jupiter_bigtts',
          speed: 0,
          loudness: 0
        }
      },
      tools: []
    },
    extension: { extra: { enable_proactive_speak: false } }
  });

  const browserSessionCreated = nextJson(browser);
  upstream.send(JSON.stringify({ type: 'session.created', session: { id: 'verified' } }));
  assert.equal((await browserSessionCreated).type, 'session.created');
  assert.deepEqual(await nextJson(upstream), {
    type: 'speech_text_buffer.commit',
    text: '你好，我是 JARVIS。语音连接成功。'
  });

  const audio = Buffer.alloc(640, 7).toString('base64');
  const forwarded = nextJson(upstream);
  browser.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
  assert.deepEqual(await forwarded, { type: 'input_audio_buffer.append', audio });

  const cancelled = nextJson(upstream);
  browser.send(JSON.stringify({ type: 'response.cancel' }));
  assert.deepEqual(await cancelled, { type: 'response.cancel' });
  for (const type of ['input_audio_mute.commit', 'input_audio_unmute.commit']) {
    const received = nextJson(upstream);
    browser.send(JSON.stringify({ type, unwanted: 'stripped' }));
    assert.deepEqual(await received, { type });
  }
});

test('proxy rejects disallowed origins and caps active sessions globally at two', async t => {
  const fixture = await start();
  t.after(() => fixture.close());

  const forbidden = connect(`ws://127.0.0.1:${fixture.port}/voice`, 'https://attacker.invalid');
  const [forbiddenError] = await once(forbidden, 'error');
  assert.match(forbiddenError.message, /403/);

  const first = connect(`ws://127.0.0.1:${fixture.port}/voice`);
  const second = connect(`ws://127.0.0.1:${fixture.port}/voice`);
  await Promise.all([once(first, 'open'), once(second, 'open')]);
  t.after(() => first.close());
  t.after(() => second.close());

  const third = connect(`ws://127.0.0.1:${fixture.port}/voice`);
  const [limitError] = await once(third, 'error');
  assert.match(limitError.message, /429/);
});

test('closing the browser socket closes its upstream socket', async t => {
  const fixture = await start();
  t.after(() => fixture.close());
  const upstreamConnection = once(fixture.upstream.wss, 'connection');
  const browser = connect(`ws://127.0.0.1:${fixture.port}/voice`);
  const browserOpen = once(browser, 'open');
  const [upstream] = await upstreamConnection;
  await browserOpen;
  const closed = once(upstream, 'close');
  browser.close();
  await closed;
});
