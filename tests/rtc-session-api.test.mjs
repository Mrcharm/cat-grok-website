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

test('trusted proxy separates visitors and ignores spoofed prepended addresses', async () => {
  await withServer({ config: baseConfig({ clientIp: {
    mode: 'trusted-proxy', trustedProxyCidrs: ['127.0.0.1/32', '10.8.0.0/24']
  } }), rtcApi: {} }, async request => {
    const prepare = forwarded => request('/rtc/session', {
      method: 'POST', headers: { ...originHeaders, 'X-Forwarded-For': forwarded }, body: '{}'
    });
    assert.equal((await prepare('192.0.2.1, 198.51.100.10, 10.8.0.2')).status, 201);
    assert.equal((await prepare('192.0.2.2, 198.51.100.10, 10.8.0.2')).status, 201);
    assert.equal((await prepare('192.0.2.3, 198.51.100.10, 10.8.0.2')).status, 429);
    assert.equal((await prepare('198.51.100.11, 10.8.0.2')).status, 201);
    for (const malformed of ['', 'unknown', '198.51.100.12,,10.8.0.2', '198.51.100.12:1234', '10.8.0.2']) {
      assert.equal((await prepare(malformed)).status, 503, malformed);
    }
  });
});

test('forwarded metadata fails closed without a verified proxy boundary', async () => {
  for (const trustedProxyCidrs of [[], ['10.8.0.0/24']]) {
    await withServer({ config: baseConfig({ clientIp: { mode: 'trusted-proxy', trustedProxyCidrs } }), rtcApi: {} }, async request => {
      const result = await request('/rtc/session', {
        method: 'POST', headers: { ...originHeaders, 'X-Forwarded-For': '198.51.100.10' }, body: '{}'
      });
      assert.equal(result.status, 503);
    });
  }
});

test('direct deployments ignore attacker-controlled forwarding headers', async () => {
  await withServer({ config: baseConfig(), rtcApi: {} }, async request => {
    for (const [index, expected] of [201, 201, 429].entries()) {
      assert.equal((await request('/rtc/session', {
        method: 'POST', headers: { ...originHeaders, 'X-Forwarded-For': `198.51.100.${index + 1}` }, body: '{}'
      })).status, expected);
    }
  });
});

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

test('defensively caps an injected per-IP session limit at two', async () => {
  await withServer({ config: baseConfig({ maxConnectionsPerIp: 20 }), rtcApi: {} }, async request => {
    assert.equal((await createSession(request)).response.status, 201);
    assert.equal((await createSession(request)).response.status, 201);
    assert.equal((await request('/rtc/session', { method: 'POST', headers: originHeaders, body: '{}' })).status, 429);
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

test('a failed start enters compensating cleanup and cannot be restarted', async () => {
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
    assert.equal(retried.status, 404);
    assert.equal(attempts, 1);
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

test('concurrent deletes wait for a pending start and stop only once', async () => {
  let releaseStart;
  let signalStart;
  let stops = 0;
  const starting = new Promise(resolve => { releaseStart = resolve; });
  const startInvoked = new Promise(resolve => { signalStart = resolve; });
  await withServer({
    config: baseConfig(),
    rtcApi: {
      startVoiceChat: async () => { signalStart(); await starting; },
      stopVoiceChat: async () => { stops += 1; }
    }
  }, async request => {
    const { body: session } = await createSession(request);
    const start = request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    await startInvoked;
    const firstDelete = request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } });
    const secondDelete = request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stops, 0);
    releaseStart();
    assert.equal((await start).status, 200);
    assert.equal((await firstDelete).status, 204);
    assert.equal((await secondDelete).status, 204);
    assert.equal(stops, 1);
  });
});

test('a rejected stop retains the session quota until a later delete succeeds', async () => {
  let stopAttempts = 0;
  await withServer({
    config: baseConfig(),
    rtcApi: {
      startVoiceChat: async () => {},
      stopVoiceChat: async () => {
        stopAttempts += 1;
        if (stopAttempts === 1) throw Object.assign(new Error('do-not-leak'), { code: 'RTC_UPSTREAM' });
      }
    }
  }, async request => {
    const { body: first } = await createSession(request);
    await createSession(request);
    await request(`/rtc/session/${first.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    const failed = await request(`/rtc/session/${first.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: 'RTC_UPSTREAM' });
    assert.equal((await request('/rtc/session', { method: 'POST', headers: originHeaders, body: '{}' })).status, 429);
    assert.equal((await request(`/rtc/session/${first.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } })).status, 204);
    assert.equal((await createSession(request)).response.status, 201);
    assert.equal(stopAttempts, 2);
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

test('a failed TTL stop retains its session until a later delete retry succeeds', async () => {
  let scheduled;
  let stopAttempts = 0;
  await withServer({
    config: baseConfig({ maxConnectionsPerIp: 1 }),
    rtcApi: {
      startVoiceChat: async () => {},
      stopVoiceChat: async () => {
        stopAttempts += 1;
        if (stopAttempts === 1) throw Object.assign(new Error('do-not-leak'), { code: 'RTC_UPSTREAM' });
      }
    },
    setTimeoutFn: callback => { scheduled = callback; return 1; },
    clearTimeoutFn: () => {}
  }, async request => {
    const { body: session } = await createSession(request);
    await request(`/rtc/session/${session.sessionId}/start`, { method: 'POST', headers: originHeaders, body: '{}' });
    await scheduled();
    assert.equal((await request('/rtc/session', { method: 'POST', headers: originHeaders, body: '{}' })).status, 429);
    assert.equal((await request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers: { Origin: ALLOWED_ORIGIN } })).status, 204);
    assert.equal((await createSession(request)).response.status, 201);
    assert.equal(stopAttempts, 2);
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

test('rejects oversized DELETE and OPTIONS bodies before method handling', async () => {
  await withServer({ config: baseConfig(), rtcApi: {} }, async request => {
    const { body: session } = await createSession(request);
    const headers = { ...originHeaders };
    const oversized = 'x'.repeat(8193);
    const deleted = await request(`/rtc/session/${session.sessionId}`, { method: 'DELETE', headers, body: oversized });
    const preflight = await request('/rtc/session', { method: 'OPTIONS', headers, body: oversized });
    assert.equal(deleted.status, 413);
    assert.equal(preflight.status, 413);
  });
});
