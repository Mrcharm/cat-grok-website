# Doubao Realtime Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JARVIS homepage's browser speech recognition and preset replies with a secure, continuous Doubao speech-to-speech conversation started by one user click.

**Architecture:** GitHub Pages hosts only the UI and browser audio pipeline. A separate Node.js WebSocket proxy owns all Doubao credentials, translates the small site protocol to the official Doubao binary protocol, and streams PCM in both directions. The UI and supplier adapter are isolated so neither browser code nor public build output can reveal credentials.

**Tech Stack:** Node.js 20+, native Web Audio API, native browser WebSocket, `ws` 8.x, Node test runner, GitHub Pages, container-based WebSocket hosting.

## Global Constraints

- First use requires exactly one user click to unlock microphone capture and audio playback.
- No App ID, Access Token, Secret Key, credential fragment, audio, or transcript may be committed or logged.
- Treat every credential pasted in chat as compromised; production uses newly rotated values configured directly in the hosting platform.
- The server uses the official speech-dialog headers: `X-Api-App-ID`, `X-Api-Access-Key`, `X-Api-Resource-Id: volc.speech.dialog`, `X-Api-App-Key: PlgvMymc7f3tQnJ6`, and a unique `X-Api-Connect-Id`.
- `DOUBAO_MODEL_NAME` records the purchased model name for diagnostics but does not replace the official fixed speech-dialog Resource ID.
- The server never returns upstream headers or raw credential-bearing errors to the browser.
- Starting voice pauses background music; ending voice does not restart it automatically.
- Generated subpages are never edited by hand; `pnpm build` remains authoritative.
- No account system, persistence, RAG, payment, multi-user room, recording, or voice cloning is added.

---

### Task 1: Server configuration and admission policy

**Files:**
- Modify: `package.json`
- Create: `server/config.mjs`
- Create: `tests/realtime-server-config.test.mjs`

**Interfaces:**
- Produces: `loadConfig(env): ServerConfig` and `isAllowedOrigin(origin, allowedOrigins): boolean`.
- `ServerConfig` contains `port`, `doubaoWsUrl`, `appId`, `accessKey`, `modelName`, `speaker`, `allowedOrigins`, `maxSessionMs`, and `maxConnectionsPerIp`.

- [ ] **Step 1: Write failing configuration tests**

```js
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

test('loadConfig rejects missing secrets without printing values', () => {
  assert.throws(() => loadConfig({}), /DOUBAO_APP_ID/);
});

test('loadConfig accepts hosting environment and applies safe limits', () => {
  const config = loadConfig(valid);
  assert.equal(config.appId, 'app-from-host');
  assert.equal(config.maxSessionMs, 15 * 60 * 1000);
  assert.deepEqual(config.allowedOrigins, ['https://mrcharm.github.io', 'http://localhost:4173']);
});

test('origin policy accepts only exact configured origins', () => {
  const origins = loadConfig(valid).allowedOrigins;
  assert.equal(isAllowedOrigin('https://mrcharm.github.io', origins), true);
  assert.equal(isAllowedOrigin('https://evil.example', origins), false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/realtime-server-config.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/config.mjs`.

- [ ] **Step 3: Implement strict environment loading and add the server scripts**

```js
// server/config.mjs
const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8787),
    doubaoWsUrl: required(env, 'DOUBAO_WS_URL'),
    appId: required(env, 'DOUBAO_APP_ID'),
    accessKey: required(env, 'DOUBAO_ACCESS_KEY'),
    modelName: required(env, 'DOUBAO_MODEL_NAME'),
    speaker: env.DOUBAO_SPEAKER || 'zh_female_vv_jupiter_bigtts',
    allowedOrigins: required(env, 'ALLOWED_ORIGINS').split(',').map(value => value.trim()),
    maxSessionMs: Number(env.MAX_SESSION_MS || 15 * 60 * 1000),
    maxConnectionsPerIp: Number(env.MAX_CONNECTIONS_PER_IP || 2)
  };
}

export function isAllowedOrigin(origin, allowedOrigins) {
  return typeof origin === 'string' && allowedOrigins.includes(origin);
}
```

Add dependency `ws@8.18.3`, script `start:voice: node server/index.mjs`, and engine requirement `node >=20` in `package.json`, then run `pnpm install` to update `pnpm-lock.yaml`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/realtime-server-config.test.mjs`

Expected: 3 tests PASS and no credential values in output.

- [ ] **Step 5: Commit**

```text
git add package.json pnpm-lock.yaml server/config.mjs tests/realtime-server-config.test.mjs
git commit -m "feat: validate realtime voice server configuration"
```

### Task 2: Official Doubao binary protocol adapter

**Files:**
- Create: `server/doubao-protocol.mjs`
- Create: `tests/doubao-protocol.test.mjs`

**Interfaces:**
- Produces: `encodeStartConnection()`, `encodeStartSession(sessionId, options)`, `encodeAudio(sessionId, pcm)`, `encodeFinishSession(sessionId)`, and `decodeServerFrame(frame)`.
- `decodeServerFrame` returns `{ event, sessionId, payload, errorCode }`; event payloads 352 are raw PCM and JSON events are parsed objects.

- [ ] **Step 1: Write failing byte-level protocol tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeStartConnection, encodeAudio, decodeServerFrame } from '../server/doubao-protocol.mjs';

test('start connection uses v1 full-request event header', () => {
  const frame = encodeStartConnection();
  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x14, 0x11, 0x00]);
  assert.equal(frame.readUInt32BE(4), 1);
});

test('audio frame uses no serialization and event 200', () => {
  const frame = encodeAudio('session-1', Buffer.from([1, 2, 3, 4]));
  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x24, 0x01, 0x00]);
  assert.equal(frame.readUInt32BE(4), 200);
});

test('decoder rejects truncated frames', () => {
  assert.throws(() => decodeServerFrame(Buffer.from([0x11, 0x94])), /too short/i);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/doubao-protocol.test.mjs`

Expected: FAIL because the protocol module does not exist.

- [ ] **Step 3: Port the official v1 framing algorithm**

Implement the four-byte header, big-endian event/session/payload lengths, gzip compression, JSON serialization, raw PCM handling, bounds checks, and server error frames. Use Node `gzipSync`/`gunzipSync`; never log payloads. The concrete header factory is:

```js
const header = ({ type = 1, flags = 4, serialization = 1, compression = 1 } = {}) =>
  Buffer.from([0x11, (type << 4) | flags, (serialization << 4) | compression, 0x00]);
```

Map events `1` (StartConnection), `100` (StartSession), `200` (audio), `102` (FinishSession), `450/451/459` (ASR), `350/351/352/359` (TTS), `550/559` (chat), and `154` (usage). Reject any declared length that exceeds the available frame.

- [ ] **Step 4: Run protocol tests and verify GREEN**

Run: `node --test tests/doubao-protocol.test.mjs`

Expected: all protocol tests PASS.

- [ ] **Step 5: Commit**

```text
git add server/doubao-protocol.mjs tests/doubao-protocol.test.mjs
git commit -m "feat: encode Doubao realtime voice protocol"
```

### Task 3: Upstream session and secure WebSocket proxy

**Files:**
- Create: `server/doubao-session.mjs`
- Create: `server/index.mjs`
- Create: `tests/doubao-session.test.mjs`
- Create: `tests/realtime-proxy.test.mjs`

**Interfaces:**
- Consumes: `ServerConfig` and all functions from `server/doubao-protocol.mjs`.
- Produces: `createDoubaoSession({ config, connect, connectId })` and `createVoiceServer({ config, upstreamFactory })`.
- Browser JSON messages are `client.start`, `client.text`, `client.interrupt`, `client.stop`; server messages are `server.ready`, `server.transcript`, `server.state`, `server.error`.

- [ ] **Step 1: Write failing session tests with an in-memory socket double**

Test these observable behaviors separately: exact upstream headers contain config values; `server.ready` is emitted only after StartConnection and StartSession acknowledgements; browser binary frames are wrapped as event 200; event 451 becomes user transcript; event 550 becomes assistant transcript; event 352 remains binary PCM; event 450 emits interruption; upstream errors become a stable public code without raw messages.

```js
test('upstream headers keep credentials server-side', async () => {
  const seen = {};
  await createDoubaoSession({
    config,
    connect: async (url, options) => { Object.assign(seen, options.headers); return fakeUpstream; },
    connectId: 'fixed-id'
  });
  assert.equal(seen['X-Api-App-ID'], config.appId);
  assert.equal(seen['X-Api-Access-Key'], config.accessKey);
  assert.equal(seen['X-Api-Resource-Id'], 'volc.speech.dialog');
  assert.equal(seen['X-Api-Connect-Id'], 'fixed-id');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/doubao-session.test.mjs tests/realtime-proxy.test.mjs`

Expected: FAIL because the session and proxy modules do not exist.

- [ ] **Step 3: Implement upstream lifecycle**

Connect with the official headers and send the official session payload:

```js
{
  asr: { extra: { end_smooth_window_ms: 1000 } },
  tts: { speaker: config.speaker, audio_config: { channel: 1, format: 'pcm_s16le', sample_rate: 24000 } },
  dialog: {
    bot_name: 'JARVIS',
    system_role: '你是猫哥的中文 AI 伙伴 JARVIS。回答自然、简洁、坦诚，不假装记得未提供的信息。',
    speaking_style: '语速适中，语气自然温暖，避免夸张和冗长。',
    extra: { strict_audit: false, recv_timeout: 120, input_mod: 'audio' }
  }
}
```

Expose callbacks for PCM, transcript, interruption, ready, and safe errors. Close the upstream on browser stop, timeout, or disconnect.

- [ ] **Step 4: Implement the public proxy**

Create an HTTP health endpoint `GET /healthz` returning `{ "ok": true }` and WebSocket upgrade path `/voice`. Enforce exact Origin matching before upgrade, two sessions per IP, 64 KiB maximum browser message size, a 15-minute timer, and no request-body logging. Return close code `1008` for rejected origins and stable `server.error` codes for configuration, quota, upstream, and protocol failures.

- [ ] **Step 5: Run focused and full server tests**

Run: `node --test tests/doubao-session.test.mjs tests/realtime-proxy.test.mjs`

Expected: all tests PASS, process exits cleanly, and test output contains no fixture credential value.

- [ ] **Step 6: Commit**

```text
git add server/doubao-session.mjs server/index.mjs tests/doubao-session.test.mjs tests/realtime-proxy.test.mjs
git commit -m "feat: proxy secure Doubao realtime voice sessions"
```

### Task 4: Browser PCM capture and streaming playback

**Files:**
- Create: `assets/js/voice/pcm-capture.js`
- Create: `assets/js/voice/pcm-player.js`
- Create: `assets/js/voice/pcm-worklet.js`
- Create: `tests/pcm-audio.test.mjs`

**Interfaces:**
- Produces: `downsampleFloat32(samples, fromRate, toRate): Int16Array`, `PcmCapture.start(onChunk)`, `PcmCapture.stop()`, `PcmPlayer.enqueue(bytes)`, `PcmPlayer.interrupt()`, and `PcmPlayer.close()`.
- Capture emits mono signed 16-bit little-endian PCM at 16 kHz; playback consumes mono signed 16-bit little-endian PCM at 24 kHz.

- [ ] **Step 1: Write failing pure audio conversion tests**

```js
test('downsampleFloat32 clips and converts to signed 16-bit PCM', () => {
  const pcm = downsampleFloat32(Float32Array.from([-2, -1, 0, 0.5, 2]), 16000, 16000);
  assert.deepEqual([...pcm], [-32768, -32768, 0, 16384, 32767]);
});

test('48 kHz input becomes one third as many 16 kHz samples', () => {
  const pcm = downsampleFloat32(new Float32Array(480), 48000, 16000);
  assert.equal(pcm.length, 160);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/pcm-audio.test.mjs`

Expected: FAIL because the capture module does not exist.

- [ ] **Step 3: Implement capture**

Use `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`, an `AudioWorkletNode`, deterministic downsampling, and 20 ms output chunks. `stop()` disconnects nodes, stops every media track, and closes its AudioContext.

- [ ] **Step 4: Implement gap-resistant streaming playback**

Convert little-endian Int16 PCM to Float32, schedule buffers on a 24 kHz AudioContext timeline, cap queued audio at 10 seconds, and let `interrupt()` cancel all scheduled sources immediately and reset the timeline.

- [ ] **Step 5: Verify focused tests and commit**

Run: `node --test tests/pcm-audio.test.mjs`

Expected: all audio conversion and queue tests PASS.

```text
git add assets/js/voice tests/pcm-audio.test.mjs
git commit -m "feat: capture and play realtime PCM audio"
```

### Task 5: Homepage realtime voice controller and accessible UI

**Files:**
- Create: `assets/js/voice/realtime-voice.js`
- Create: `tests/realtime-voice-controller.test.mjs`
- Modify: `index.html`
- Modify: `scripts/templates/home-document.mjs` only if normalization requires new attributes to be preserved
- Modify: `assets/styles/site.css` only for shared state styles actually used by the homepage

**Interfaces:**
- Consumes: `PcmCapture`, `PcmPlayer`, and a public `data-voice-endpoint` value.
- Produces: `RealtimeVoiceController` with `start()`, `sendText(text)`, `stop()`, and observable `state`.

- [ ] **Step 1: Write failing controller state tests**

Cover these transitions with injected socket/capture/player factories:

```js
test('one click unlocks audio, pauses music, and starts a session', async () => {
  await controller.start();
  assert.equal(controller.state, 'connecting');
  assert.equal(capture.started, true);
  assert.equal(music.paused, true);
  assert.deepEqual(socket.sentJson[0], { type: 'client.start' });
});

test('server interruption stops queued assistant audio', () => {
  socket.receiveJson({ type: 'server.state', state: 'interrupted' });
  assert.equal(player.interruptCalls, 1);
});

test('stop releases microphone and socket', async () => {
  await controller.stop();
  assert.equal(capture.stopped, true);
  assert.equal(socket.closed, true);
});
```

- [ ] **Step 2: Run controller tests and verify RED**

Run: `node --test tests/realtime-voice-controller.test.mjs`

Expected: FAIL because `RealtimeVoiceController` does not exist.

- [ ] **Step 3: Implement the state machine**

Accept only transitions among `idle`, `permission`, `connecting`, `listening`, `speaking`, `reconnecting`, `stopped`, and `error`. Queue no microphone data before `server.ready`. Retry transient disconnects at 500 ms, 1500 ms, and 3000 ms, then enter `error`. Do not replay captured audio after reconnect.

- [ ] **Step 4: Replace the simulated homepage behavior**

Remove the inline preset `REPLIES`, Web Speech recognition, and `speechSynthesis` logic. Keep the current dock position and visual language, but change the microphone control to a start/stop session control with visible text status. Add an `aria-live="polite"` transcript region and escaped DOM text nodes for both speakers. Load `assets/js/voice/realtime-voice.js` as a module. Set only the public proxy endpoint in `data-voice-endpoint`; do not add credentials.

- [ ] **Step 5: Verify UI tests, build consistency, and commit**

Run:

```text
node --test tests/realtime-voice-controller.test.mjs tests/homepage.test.mjs tests/current-site-contract.test.mjs
node -e "import('./scripts/build.mjs').then(async m=>{const f=await m.buildSite({write:false});const fs=await import('node:fs/promises');for(const[n,c]of f){let cur='';try{cur=await fs.readFile(n,'utf8')}catch{};console.log((cur===c?'ok':'DIFF')+' '+n)}})"
```

Expected: tests PASS and every generated file reports `ok`.

```text
git add index.html scripts/templates/home-document.mjs assets/styles/site.css assets/js/voice/realtime-voice.js tests/realtime-voice-controller.test.mjs
git commit -m "feat: turn JARVIS homepage into realtime voice chat"
```

### Task 6: Deployment configuration, security scan, and real end-to-end verification

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docs/deploy-realtime-voice.md`
- Modify: `.gitignore`
- Modify: `scripts/smoke.mjs`
- Test: all `tests/*.test.mjs`

**Interfaces:**
- Consumes: `pnpm start:voice`, the hosting platform's secret environment variables, and the GitHub Pages homepage.
- Produces: a public HTTPS health endpoint and WSS `/voice` endpoint referenced by the homepage.

- [ ] **Step 1: Write a failing deployment contract test**

Add assertions that the Docker image starts `pnpm start:voice`, `.gitignore` excludes `.env*`, documentation names all required variables without values, and generated public files contain none of `DOUBAO_APP_ID`, `DOUBAO_ACCESS_KEY`, `secret_key`, `access_token`, or known leaked credential fragments.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/deployment-contract.test.mjs`

Expected: FAIL because deployment files do not exist.

- [ ] **Step 3: Add a minimal production container and operator guide**

Use `node:20-alpine`, install with `pnpm install --prod --frozen-lockfile`, run as a non-root user, expose the platform-provided `PORT`, and start with `pnpm start:voice`. Document these exact server-only variables without example secrets: `DOUBAO_WS_URL`, `DOUBAO_APP_ID`, `DOUBAO_ACCESS_KEY`, `DOUBAO_MODEL_NAME`, optional `DOUBAO_SPEAKER`, and `ALLOWED_ORIGINS`.

- [ ] **Step 4: Run the complete local quality gate**

Run:

```text
pnpm validate
pnpm test
pnpm build
pnpm smoke
git grep -n -I -E "access[_-]?token|secret[_-]?key|api[_-]?key|ghp_[A-Za-z0-9]+"
git diff --check
```

Expected: all quality commands PASS; credential scan returns no matches outside a test's literal forbidden-key list; generated-page comparison reports only `ok`.

- [ ] **Step 5: Rotate and configure credentials outside Git**

The site owner revokes the credentials pasted in chat, creates replacements in the Volcengine console, and enters them directly into the backend host's secret settings. Record only confirmation that rotation occurred, never the values.

- [ ] **Step 6: Deploy the proxy, then update the public endpoint**

Deploy the container to a host that supports persistent WebSockets. Verify `GET /healthz` over HTTPS, set the homepage `data-voice-endpoint` to the resulting `wss://.../voice` URL, re-run the complete quality gate, commit, and push `main` without force.

- [ ] **Step 7: Perform real-browser acceptance**

On the live GitHub Pages site, verify microphone permission, three continuous Chinese turns, incremental user and assistant captions, streaming playback, interruption while JARVIS speaks, explicit stop, denied-permission fallback, mobile layout, and release of the microphone after leaving the page. Confirm server logs contain only request ID, status, and duration.

- [ ] **Step 8: Commit deployment material and release change**

```text
git add Dockerfile .dockerignore .gitignore docs/deploy-realtime-voice.md scripts/smoke.mjs tests/deployment-contract.test.mjs index.html
git commit -m "chore: deploy and verify JARVIS realtime voice"
git push origin main
```

## Completion Gate

Do not claim completion from unit tests alone. Completion requires all ten acceptance criteria in the approved design, a successful live Doubao handshake using rotated credentials, three live dialogue turns, a verified interruption, clean credential scanning, a successful GitHub Pages build, and a healthy deployed WebSocket proxy.
