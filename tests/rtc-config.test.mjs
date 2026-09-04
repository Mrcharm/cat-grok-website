import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRtcConfig } from '../server/config.mjs';

const valid = {
  RTC_APP_ID: ' rtc-app-id ',
  RTC_APP_KEY: ' rtc-app-key ',
  VOLC_ACCESS_KEY_ID: ' volc-access-key-id ',
  VOLC_SECRET_ACCESS_KEY: ' volc-secret-access-key ',
  S2S_APP_ID: ' s2s-app-id ',
  S2S_ACCESS_TOKEN: ' s2s-access-token ',
  ALLOWED_ORIGINS: ' https://mrcharm.github.io, http://localhost:4173 '
};

test('loadRtcConfig requires every server-only RTC credential and origin setting', () => {
  for (const name of Object.keys(valid)) {
    const env = { ...valid };
    delete env[name];
    assert.throws(() => loadRtcConfig(env), new RegExp(name));
  }
});

test('loadRtcConfig rejects blank required values after trimming', () => {
  for (const name of Object.keys(valid)) {
    assert.throws(
      () => loadRtcConfig({ ...valid, [name]: '   ' }),
      new RegExp(name)
    );
  }
});

test('loadRtcConfig rejects an origin list that becomes empty after trimming', () => {
  assert.throws(
    () => loadRtcConfig({ ...valid, ALLOWED_ORIGINS: '  ,   ' }),
    /ALLOWED_ORIGINS/
  );
});

test('loadRtcConfig trims credentials and parses origins into server configuration', () => {
  const config = loadRtcConfig({
    ...valid,
    RTC_SESSION_TTL_MS: ' 1200000 ',
    MAX_CONNECTIONS_PER_IP: ' 4 '
  });

  assert.deepEqual(config, {
    rtc: { appId: 'rtc-app-id', appKey: 'rtc-app-key' },
    iam: {
      accessKeyId: 'volc-access-key-id',
      secretAccessKey: 'volc-secret-access-key'
    },
    s2s: { appId: 's2s-app-id', accessToken: 's2s-access-token' },
    allowedOrigins: ['https://mrcharm.github.io', 'http://localhost:4173'],
    sessionTtlMs: 900000,
    maxConnectionsPerIp: 4
  });
});

test('loadRtcConfig applies the safe session and connection defaults', () => {
  const config = loadRtcConfig(valid);

  assert.equal(config.sessionTtlMs, 900000);
  assert.equal(config.maxConnectionsPerIp, 2);
});

test('loadRtcConfig rejects non-positive and non-numeric limits', () => {
  for (const value of ['not-a-number', '0', '-1']) {
    assert.throws(
      () => loadRtcConfig({ ...valid, RTC_SESSION_TTL_MS: value }),
      /RTC_SESSION_TTL_MS/
    );
    assert.throws(
      () => loadRtcConfig({ ...valid, MAX_CONNECTIONS_PER_IP: value }),
      /MAX_CONNECTIONS_PER_IP/
    );
  }
});
