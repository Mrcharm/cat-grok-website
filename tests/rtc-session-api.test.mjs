import assert from 'node:assert/strict';
import test from 'node:test';
import { createVoiceServer } from '../server/index.mjs';

const APP_ID = 'a'.repeat(24);
const ALLOWED_ORIGIN = 'https://mrcharm.github.io';

const baseConfig = (overrides = {}) => ({
  rtc: { appId: APP_ID, appKey: 'rtc-app-key' },
  iam: { accessKeyId: 'iam-access-key', secretAccessKey: 'iam-secret-key' },
  s2s: { appId: 's2s-app-id', accessToken: 's2s-access-token' },
  allowedOrigins: [ALLOWED_ORIGIN],
  sessionTtlMs: 15 * 60 * 1000,
  maxConnectionsPerIp: 2,
  ...overrides
});

async function withServer(options, run) {
  const app = createVoiceServer(options);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  const request = (path, init = {}) => fetch(`http://127.0.0.1:${port}${path}`, init);
  try {
    await run(request);
  } finally {
    await new Promise(resolve => app.close(resolve));
  }
}

const originHeaders = {
  Origin: ALLOWED_ORIGIN,
  'Content-Type': 'application/json'
};

async function createSession(request) {
  const response = await request('/rtc/session', {
    method: 'POST', headers: originHeaders, body: '{}'
  });
  return { response, body: await response.json() };
}

test('allows only exact configured origins and emits scoped CORS headers', async () => {
  await withServer({ config: baseConfig(), rtcApi: {} }, async request => {
    const rejected = await request('/rtc/session', {
      method: 'POST', headers: { ...originHeaders, Origin: 'https://mrcharm.github.io.evil.example' }, body: '{}'
    });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);

    const accepted = await request('/rtc/session', {
      method: 'POST', headers: originHeaders, body: '{}'
    });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.equal(accepted.headers.get('cache-control'), 'no-store');

    const preflight = await request('/rtc/session', {
      method: 'OPTIONS', headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
  });
});

test('prepares at most two sessions per IP without starting AI or exposing secrets', async () => {
  let starts = 0;
  await withServer({
    config: baseConfig(),
    rtcApi: { startVoiceChat: async () => { starts += 1; } },
    tokenFactory: () => 'short-lived-token'
  }, async request => {
    const first = await createSession(request);
    const second = await createSession(request);
    const third = await request('/rtc/session', { method: 'POST', headers: originHeaders, body: '{}' });

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.equal(third.status, 429);
    assert.equal(starts, 0);
    assert.deepEqual(Object.keys(first.body).sort(), [
      'appId', 'botUserId', 'expiresAt', 'roomId', 'sessionId', 'taskId', 'token', 'userId'
    ]);
    assert.match(first.body.roomId, /^room_/);
    assert.match(first.body.userId, /^user_/);
    assert.match(first.body.botUserId, /^bot_/);
    assert.match(first.body.taskId, /^task_/);
    assert.doesNotMatch(JSON.stringify(first.body), /rtc-app-key|iam-access-key|iam-secret-key|s2s-access-token/);
  });
});

test('starts each prepared session once, including concurrent requests', async () => {
  let starts = 0;
  let releaseStart;
  let signalStart;
  const started = new Promise(resolve => { releaseStart = resolve; });
  const startInvoked = new Promise(resolve => { signalStart = resolve; });
  await withServer({
    config: baseConfig(),
    rtcApi: { startVoiceChat: async () => { starts += 1; signalStart(); await started; } }
  }, async request => {
    const { body: session } = await createSession(request);
    const first = request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    const second = request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    await startInvoked;
    assert.equal(starts, 1);
    releaseStart();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(await firstResponse.json(), { sessionId: session.sessionId, state: 'started' });
    assert.deepEqual(await secondResponse.json(), { sessionId: session.sessionId, state: 'started' });
  });
});

test('rolls a failed start back to prepared so it can be retried', async () => {
  let attempts = 0;
  await withServer({
    config: baseConfig(),
    rtcApi: { startVoiceChat: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('upstream'), { code: 'RTC_UPSTREAM' });
    } }
  }, async request => {
    const { body: session } = await createSession(request);
    const failed = await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: 'RTC_UPSTREAM' });

    const retried = await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    assert.equal(retried.status, 200);
    assert.equal(attempts, 2);
  });
});

test('deletes idempotently and stops a started task exactly once', async () => {
  let stops = 0;
  await withServer({
    config: baseConfig(),
    rtcApi: { startVoiceChat: async () => {}, stopVoiceChat: async () => { stops += 1; } }
  }, async request => {
    const { body: session } = await createSession(request);
    await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    const first = await request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } });
    const second = await request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(first.status, 204);
    assert.equal(second.status, 204);
    assert.equal(stops, 1);
  });
});

test('automatically stops and removes sessions at the configured fifteen-minute TTL', async () => {
  let scheduled;
  let stops = 0;
  await withServer({
    config: baseConfig(),
    rtcApi: { startVoiceChat: async () => {}, stopVoiceChat: async () => { stops += 1; } },
    setTimeoutFn: (callback, delay) => { scheduled = { callback, delay }; return 1; },
    clearTimeoutFn: () => {}
  }, async request => {
    const { body: session } = await createSession(request);
    await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    assert.equal(scheduled.delay, 15 * 60 * 1000);
    await scheduled.callback();
    assert.equal(stops, 1);
    const missing = await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    assert.equal(missing.status, 404);
  });
});

test('rejects request bodies over 8 KiB', async () => {
  await withServer({ config: baseConfig(), rtcApi: {} }, async request => {
    const response = await request('/rtc/session', {
      method: 'POST', headers: originHeaders, body: JSON.stringify({ padding: 'x'.repeat(8192) })
    });
    assert.equal(response.status, 413);
  });
});
