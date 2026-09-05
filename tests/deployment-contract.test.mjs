import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { buildSite } from '../scripts/build.mjs';

const REQUIRED_SERVER_SETTINGS = [
  'RTC_APP_ID',
  'RTC_APP_KEY',
  'VOLC_ACCESS_KEY_ID',
  'VOLC_SECRET_ACCESS_KEY',
  'S2S_APP_ID',
  'S2S_ACCESS_TOKEN',
  'ALLOWED_ORIGINS'
];

test('RTC service has a non-root production container contract', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');
  assert.match(dockerfile, /FROM node:22\.22\.2-alpine/);
  assert.match(dockerfile, /RUN npm install --global corepack@0\.35\.0 && corepack enable/);
  assert.doesNotMatch(dockerfile, /COREPACK_INTEGRITY_KEYS\s*=\s*0/);
  assert.match(dockerfile, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/);
  assert.match(dockerfile, /pnpm install --prod --frozen-lockfile/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /CMD \["pnpm", "start:voice"\]/);
});

test('package runtime matches pnpm and permits only the required esbuild install script', async () => {
  const [manifestText, workspace] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('pnpm-workspace.yaml', 'utf8')
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.packageManager, 'pnpm@11.9.0');
  assert.equal(manifest.engines.node, '>=22.13');
  assert.deepEqual(workspace.trim().split(/\r?\n/), [
    'allowBuilds:',
    '  esbuild: true'
  ]);
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
  const documented = [...guide.matchAll(/^\| `([A-Z0-9_]+)` \|/gm)]
    .map(match => match[1]);
  assert.deepEqual(documented, REQUIRED_SERVER_SETTINGS);
  assert.doesNotMatch(guide, /ghp_[A-Za-z0-9]+|(?:access[_ -]?token|secret[_ -]?(?:access[_ -]?)?key|app[_ -]?key)\s*[=:]\s*\S+/i);
});

test('obsolete PCM and WebSocket implementation is absent', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.dependencies?.ws, undefined);
  for (const file of [
    'server/doubao-protocol.mjs',
    'server/doubao-session.mjs',
    'assets/js/voice/pcm-capture.js',
    'assets/js/voice/pcm-player.js',
    'assets/js/voice/pcm-worklet.js',
    'assets/js/voice/realtime-voice.js'
  ]) {
    await assert.rejects(access(file), error => error?.code === 'ENOENT', file);
  }
});

test('generated public pages contain no server setting names or simulated voice', async () => {
  const files = await buildSite({ write: false });
  for (const [name, html] of files) {
    assert.doesNotMatch(html, /RTC_APP_KEY|IAM_ACCESS_KEY|IAM_SECRET_KEY|S2S_ACCESS_TOKEN|DOUBAO_APP_ID|DOUBAO_ACCESS_KEY|DOUBAO_MODEL_NAME|secret_key|access_token/i, name);
  }
  const home = files.get('index.html');
  assert.match(home, /assets\/dist\/rtc-voice\.js/);
  assert.doesNotMatch(home, /assets\/js\/voice\/realtime-voice\.js/);
  assert.doesNotMatch(home, /const REPLIES|speechSynthesis|SpeechRecognition/);
});
