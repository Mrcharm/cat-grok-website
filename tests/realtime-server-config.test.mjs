import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, isAllowedOrigin } from '../server/config.mjs';

const valid = {
  DOUBAO_WS_URL: 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
  DOUBAO_APP_ID: 'app-from-host',
  DOUBAO_ACCESS_KEY: 'key-from-host',
  DOUBAO_MODEL_NAME: 'Doubao_scene_SLM_Doubao_realtime_voice_model_example',
  ALLOWED_ORIGINS: 'https://mrcharm.github.io,http://localhost:4173'
};

test('loadConfig rejects missing server-only settings without exposing values', () => {
  assert.throws(() => loadConfig({}), /DOUBAO_WS_URL/);
});

test('loadConfig accepts hosting settings and applies safe limits', () => {
  const config = loadConfig(valid);
  assert.equal(config.appId, 'app-from-host');
  assert.equal(config.accessKey, 'key-from-host');
  assert.equal(config.maxSessionMs, 15 * 60 * 1000);
  assert.equal(config.maxConnectionsPerIp, 2);
  assert.deepEqual(config.allowedOrigins, [
    'https://mrcharm.github.io',
    'http://localhost:4173'
  ]);
});

test('loadConfig rejects invalid numeric limits', () => {
  assert.throws(
    () => loadConfig({ ...valid, MAX_SESSION_MS: 'zero' }),
    /MAX_SESSION_MS/
  );
});

test('origin policy accepts only exact configured origins', () => {
  const origins = loadConfig(valid).allowedOrigins;
  assert.equal(isAllowedOrigin('https://mrcharm.github.io', origins), true);
  assert.equal(isAllowedOrigin('https://evil.example', origins), false);
  assert.equal(isAllowedOrigin(undefined, origins), false);
});
