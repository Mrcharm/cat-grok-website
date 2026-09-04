import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSite } from '../scripts/build.mjs';

test('voice proxy has a non-root production container contract', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');
  assert.match(dockerfile, /FROM node:20-alpine/);
  assert.match(dockerfile, /pnpm install --prod --frozen-lockfile/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /CMD \["pnpm", "start:voice"\]/);
});

test('local secret files are excluded from Git and the container', async () => {
  const [gitignore, dockerignore] = await Promise.all([
    readFile('.gitignore', 'utf8'),
    readFile('.dockerignore', 'utf8')
  ]);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(dockerignore, /^\.env\*$/m);
  assert.match(dockerignore, /^\.git$/m);
});

test('deployment guide names server settings without sample secret values', async () => {
  const guide = await readFile('docs/deploy-realtime-voice.md', 'utf8');
  for (const name of [
    'DOUBAO_WS_URL',
    'DOUBAO_APP_ID',
    'DOUBAO_ACCESS_KEY',
    'DOUBAO_MODEL_NAME',
    'DOUBAO_SPEAKER',
    'ALLOWED_ORIGINS'
  ]) assert.match(guide, new RegExp(name));
  assert.doesNotMatch(guide, /ghp_[A-Za-z0-9]+|access_token\s*=|secret_key\s*=/i);
});

test('generated public pages contain no server setting names or simulated voice', async () => {
  const files = await buildSite({ write: false });
  for (const [name, html] of files) {
    assert.doesNotMatch(html, /DOUBAO_APP_ID|DOUBAO_ACCESS_KEY|DOUBAO_MODEL_NAME|secret_key|access_token/i, name);
  }
  const home = files.get('index.html');
  assert.match(home, /assets\/js\/voice\/realtime-voice\.js/);
  assert.doesNotMatch(home, /const REPLIES|speechSynthesis|SpeechRecognition/);
});
