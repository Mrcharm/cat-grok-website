import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVoiceConfig } from '../server/config.mjs';

const valid = {
  DOUBAO_API_KEY: ' server-key ',
  ALLOWED_ORIGINS: ' https://mrcharm.github.io, http://localhost:4173 '
};

test('live voice config requires only the API key and allowed origins', () => {
  assert.deepEqual(loadVoiceConfig(valid), {
    apiKey: 'server-key',
    allowedOrigins: ['https://mrcharm.github.io', 'http://localhost:4173'],
    upstreamUrl: 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue',
    sessionTtlMs: 900_000,
    maxConnections: 2
  });
  for (const name of Object.keys(valid)) {
    const env = { ...valid };
    delete env[name];
    assert.throws(() => loadVoiceConfig(env), new RegExp(name));
  }
});

test('live voice config keeps session lifetime and concurrency within hard caps', () => {
  assert.equal(loadVoiceConfig({ ...valid, VOICE_SESSION_TTL_MS: '1200000' }).sessionTtlMs, 900_000);
  assert.equal(loadVoiceConfig({ ...valid, VOICE_MAX_CONNECTIONS: '8' }).maxConnections, 2);
});
