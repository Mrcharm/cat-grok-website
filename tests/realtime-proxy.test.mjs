import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
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

test('obsolete voice WebSocket upgrade receives HTTP 404', async t => {
  const app = await start();
  t.after(() => stop(app));
  const socket = new WebSocket(app.ws, { origin: 'https://mrcharm.github.io' });
  const [, response] = await once(socket, 'unexpected-response');
  assert.equal(response.statusCode, 404);
});
