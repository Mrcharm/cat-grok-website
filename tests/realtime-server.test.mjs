import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { createVoiceServer } from '../server/index.mjs';

const config = {
  rtc: { appId: 'a'.repeat(24), appKey: 'rtc-app-key' },
  iam: { accessKeyId: 'iam-access-key', secretAccessKey: 'iam-secret-key' },
  s2s: { appId: 's2s-app-id', accessToken: 's2s-access-token' },
  allowedOrigins: ['https://mrcharm.github.io'],
  sessionTtlMs: 60_000,
  maxConnectionsPerIp: 2
};

const start = async () => {
  const app = createVoiceServer({ config, rtcApi: {} });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const { port } = app.server.address();
  return { ...app, port, base: `http://127.0.0.1:${port}` };
};

const stop = app => new Promise(resolve => app.close(resolve));

const requestUpgrade = async port => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  await once(socket, 'connect');
  const response = once(socket, 'data');
  socket.write([
    'GET /voice HTTP/1.1',
    `Host: 127.0.0.1:${port}`,
    'Connection: Upgrade',
    'Upgrade: websocket',
    'Sec-WebSocket-Version: 13',
    'Sec-WebSocket-Key: dGVzdC10ZXN0LXRlc3Q=',
    '',
    ''
  ].join('\r\n'));
  const [data] = await response;
  socket.destroy();
  return data.toString('utf8');
};

test('health endpoint is public and contains no configuration', async t => {
  const app = await start();
  t.after(() => stop(app));
  const response = await fetch(`${app.base}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('obsolete /voice HTTP and WebSocket paths both return 404', async t => {
  const app = await start();
  t.after(() => stop(app));

  const response = await fetch(`${app.base}/voice`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });

  assert.match(await requestUpgrade(app.port), /^HTTP\/1\.1 404 Not Found\r\n/);
});
