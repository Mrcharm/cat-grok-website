import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RtcVoiceController,
  bindRtcLifecycle
} from '../assets/js/voice/rtc-controller.js';

const RTC = {
  events: {
    onRemoteAudioFirstFrame: 'onRemoteAudioFirstFrame',
    onRoomBinaryMessageReceived: 'onRoomBinaryMessageReceived',
    onAutoplayFailed: 'onAutoplayFailed',
    onError: 'onError',
    onConnectionStateChanged: 'onConnectionStateChanged'
  },
  MediaType: { AUDIO: 1 },
  ErrorCode: {
    TOKEN_EXPIRED: 'TOKEN_EXPIRED', RECONNECT_FAILED: 'RECONNECT_FAILED',
    KICKED_OUT: 'KICKED_OUT', ROOM_DISMISS: 'ROOM_DISMISS',
    DUPLICATE_LOGIN: 'DUPLICATE_LOGIN', RTM_DUPLICATE_LOGIN: 'RTM_DUPLICATE_LOGIN',
    RTM_TOKEN_ERROR: 'RTM_TOKEN_ERROR'
  },
  RoomProfileType: { chat: 5 },
  ConnectionState: {
    CONNECTION_STATE_DISCONNECTED: 1,
    CONNECTION_STATE_CONNECTED: 3,
    CONNECTION_STATE_RECONNECTING: 4,
    CONNECTION_STATE_RECONNECTED: 5,
    CONNECTION_STATE_LOST: 6
  },
  RTCAutoPlayPolicy: { AUTO_PLAY: 0 }
};

class FakeEngine {
  constructor(trace, joinResponse) {
    this.trace = trace;
    this.joinResponse = joinResponse;
    this.listeners = new Map();
    this.joinArgs = null;
    this.captureDeviceId = null;
  }

  on(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  emit(name, event) {
    for (const listener of this.listeners.get(name) || []) listener(event);
  }

  async startAudioCapture(deviceId) {
    this.captureDeviceId = deviceId;
    this.trace.push('capture');
  }

  async joinRoom(...args) {
    this.joinArgs = args;
    this.trace.push('join-room');
    if (this.joinResponse) return this.joinResponse();
  }

  async leaveRoom() {
    this.trace.push('leave-room');
  }

  async stopAudioCapture() {
    this.trace.push('release-microphone');
  }

}

const response = ({ status = 200, body } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; }
});

const session = {
  sessionId: 'session_test',
  appId: 'rtc-app-id',
  roomId: 'room_test',
  userId: 'user_test',
  botUserId: 'bot_test',
  taskId: 'task_test',
  token: 'short-lived-token',
  expiresAt: '2026-09-05T10:00:00.000Z'
};

function setup({
  permission = async () => 'microphone-device',
  prepareResponse,
  joinResponse,
  startResponse,
  deleteResponse,
  deleteTimeoutMs = 25,
  now = () => Date.parse(session.expiresAt) - 900000,
  setTimeoutFn,
  clearTimeoutFn
} = {}) {
  const trace = [];
  const states = [];
  const transcripts = [];
  const errors = [];
  const requests = [];
  const music = { paused: false, pause() { this.paused = true; } };
  const engine = new FakeEngine(trace, joinResponse);
  const createCalls = [];
  const fetchFn = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push({ url, pathname, options });
    if (options.method === 'POST' && pathname === '/rtc/session') {
      trace.push('prepare-session');
      return prepareResponse ? prepareResponse() : response({ status: 201, body: session });
    }
    if (options.method === 'POST' && pathname === `/rtc/session/${session.sessionId}/start`) {
      trace.push('start-ai');
      return startResponse ? startResponse() : response({ body: { sessionId: session.sessionId, state: 'started' } });
    }
    if (options.method === 'DELETE' && pathname === `/rtc/session/${session.sessionId}`) {
      trace.push('delete-session');
      return deleteResponse ? deleteResponse() : response({ status: 204 });
    }
    throw new Error(`Unexpected request: ${options.method} ${pathname}`);
  };
  const controller = new RtcVoiceController({
    endpoint: 'https://jarvis-voice.onrender.com',
    rtc: {
      ...RTC,
      createEngine(appId, config) {
        createCalls.push({ appId, config });
        return engine;
      },
      destroyEngine(value) {
        assert.equal(value, engine);
        trace.push('destroy-engine');
      }
    },
    requestPermission: permission,
    fetchFn,
    deleteTimeoutMs,
    now,
    setTimeoutFn,
    clearTimeoutFn,
    music,
    onState: state => states.push(state),
    onTranscript: value => transcripts.push(value),
    onError: value => errors.push(value)
  });
  return { controller, engine, trace, states, transcripts, errors, requests, music, createCalls };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

for (const code of Object.values(RTC.ErrorCode)) {
  test(`SDK terminal onError ${code} releases all session resources`, async () => {
    const { controller, engine, trace } = setup();
    await controller.start();
    engine.emit(RTC.events.onError, { errorCode: code });
    await flush();
    assert.equal(controller.state, 'error');
    assert.deepEqual(trace.slice(trace.indexOf('delete-session')), [
      'delete-session', 'leave-room', 'release-microphone', 'destroy-engine'
    ]);
  });
}

test('local expiresAt deadline ends session and a stale timer cannot end its replacement', async () => {
  const timers = new Map();
  let id = 0;
  const { controller, trace } = setup({
    setTimeoutFn: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeoutFn: timer => timers.delete(timer)
  });
  await controller.start();
  assert.equal(timers.size, 1);
  const stale = timers.get(1);
  assert.equal(stale.delay, 900000);
  stale.callback();
  await flush();
  assert.equal(controller.state, 'stopped');
  assert.equal(timers.size, 0);
  assert.deepEqual(trace.slice(trace.indexOf('delete-session')), [
    'delete-session', 'leave-room', 'release-microphone', 'destroy-engine'
  ]);
  await controller.start();
  stale.callback();
  await flush();
  assert.equal(controller.state, 'listening');
  assert.equal(timers.size, 1);
  await controller.stop();
  assert.equal(timers.size, 0);
});

test('a session already expired at prepare cannot capture or start remote AI', async () => {
  const { controller, trace } = setup({ now: () => Date.parse(session.expiresAt) });
  await assert.rejects(controller.start());
  assert.equal(controller.state, 'error');
  assert.ok(trace.includes('delete-session'));
  assert.equal(trace.includes('capture'), false);
  assert.equal(trace.includes('start-ai'), false);
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await flush();
  }
  assert.fail('Timed out waiting for test condition');
}

function aigcTlv(tag, payload) {
  const value = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(8 + value.length);
  for (let index = 0; index < 4; index += 1) bytes[index] = tag.charCodeAt(index);
  new DataView(bytes.buffer).setUint32(4, value.length, false);
  bytes.set(value, 8);
  return bytes.buffer;
}

test('prepares the session, joins audio-only RTC, then starts AI in order', async () => {
  const { controller, engine, trace, states, music, createCalls } = setup();

  await controller.start();

  assert.deepEqual(trace.filter(value => [
    'prepare-session', 'join-room', 'start-ai'
  ].includes(value)), ['prepare-session', 'join-room', 'start-ai']);
  assert.deepEqual(states, ['permission', 'preparing', 'joining', 'starting', 'listening']);
  assert.equal(controller.state, 'listening');
  assert.equal(music.paused, true);
  assert.deepEqual(createCalls, [{
    appId: session.appId,
    config: { autoPlayPolicy: RTC.RTCAutoPlayPolicy.AUTO_PLAY }
  }]);
  assert.equal(engine.captureDeviceId, 'microphone-device');
  assert.deepEqual(engine.joinArgs, [
    session.token,
    session.roomId,
    { userId: session.userId },
    {
      isAutoPublish: true,
      isAutoSubscribeAudio: true,
      isAutoSubscribeVideo: false,
      roomProfileType: RTC.RoomProfileType.chat
    }
  ]);
});

test('permission denial becomes a visible error without preparing a session', async () => {
  const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
  const { controller, trace, errors } = setup({ permission: async () => { throw denied; } });

  await assert.rejects(() => controller.start(), denied);

  assert.equal(controller.state, 'error');
  assert.equal(trace.includes('prepare-session'), false);
  assert.deepEqual(errors, [{
    code: 'MICROPHONE_UNAVAILABLE',
    message: '无法使用麦克风，请检查浏览器权限后重试。'
  }]);
});

test('remote bot audio changes the session from listening to speaking', async () => {
  const { controller, engine } = setup();
  await controller.start();

  engine.emit(RTC.events.onRemoteAudioFirstFrame, { userId: session.botUserId, isScreen: false });

  assert.equal(controller.state, 'speaking');
});

test('official AIGC subv room messages map user and bot text to the homepage transcript', async () => {
  const { controller, engine, transcripts } = setup();
  await controller.start();

  engine.emit(RTC.events.onRoomBinaryMessageReceived, {
    userId: session.botUserId,
    message: aigcTlv('subv', {
      data: [
        { userId: session.userId, text: '你好', definite: true, sequence: 1, language: 'zh' },
        { userId: session.botUserId, text: '我在', definite: false, sequence: 1, language: 'zh' }
      ]
    })
  });

  assert.deepEqual(transcripts, [
    { speaker: 'user', text: '你好', final: true },
    { speaker: 'assistant', text: '我在', final: false }
  ]);
  assert.equal(controller.state, 'speaking');
});

test('official AIGC conv messages update speaking and listening state', async () => {
  const { controller, engine } = setup();
  await controller.start();

  engine.emit(RTC.events.onRoomBinaryMessageReceived, {
    userId: session.botUserId,
    message: aigcTlv('conv', { Stage: { Code: 3, Description: 'Speaking' } })
  });
  assert.equal(controller.state, 'speaking');

  engine.emit(RTC.events.onRoomBinaryMessageReceived, {
    userId: session.botUserId,
    message: aigcTlv('conv', { Stage: { Code: 5, Description: 'Finished' } })
  });
  assert.equal(controller.state, 'listening');
});

test('malformed and unknown AIGC room messages are ignored by the controller', async () => {
  const { controller, engine, transcripts } = setup();
  await controller.start();

  engine.emit(RTC.events.onRoomBinaryMessageReceived, {
    userId: session.botUserId,
    message: new Uint8Array([0x73, 0x75, 0x62]).buffer
  });
  engine.emit(RTC.events.onRoomBinaryMessageReceived, {
    userId: session.botUserId,
    message: aigcTlv('tool', { data: [{ text: 'must be ignored' }] })
  });

  assert.deepEqual(transcripts, []);
  assert.equal(controller.state, 'listening');
});

test('remote audio autoplay failure is reported and cleans up the live session', async () => {
  const { controller, engine, errors, trace } = setup();
  await controller.start();

  engine.emit(RTC.events.onAutoplayFailed, { userId: session.botUserId, kind: 'audio' });
  await flush();

  assert.equal(controller.state, 'error');
  assert.deepEqual(errors.at(-1), {
    code: 'AUTOPLAY_BLOCKED',
    message: '浏览器阻止了 JARVIS 的声音播放，请再次点击麦克风重试。'
  });
  assert.ok(trace.includes('delete-session'));
  assert.ok(trace.includes('release-microphone'));
});

test('autoplay failure while start AI is pending cannot revive a destroyed session', async () => {
  const pendingStart = deferred();
  const { controller, engine, errors, trace, states } = setup({
    startResponse: () => pendingStart.promise
  });
  const starting = controller.start();
  await waitFor(() => controller.state === 'starting');

  engine.emit(RTC.events.onAutoplayFailed, { userId: session.botUserId, kind: 'audio' });
  await waitFor(() => trace.includes('destroy-engine'));
  assert.equal(controller.state, 'error');
  assert.equal(errors.at(-1).code, 'AUTOPLAY_BLOCKED');

  pendingStart.resolve(response({ body: { sessionId: session.sessionId, state: 'started' } }));
  await starting;

  assert.equal(controller.state, 'error');
  assert.equal(states.slice(states.lastIndexOf('error') + 1).includes('listening'), false);
});

test('a fresh session can start after failure cleanup without waiting for the old start response', async () => {
  const pendingStart = deferred();
  let startCalls = 0;
  const { controller, engine, trace } = setup({
    startResponse: () => {
      startCalls += 1;
      return startCalls === 1
        ? pendingStart.promise
        : response({ body: { sessionId: session.sessionId, state: 'started' } });
    }
  });
  const staleStart = controller.start();
  await waitFor(() => controller.state === 'starting');
  engine.emit(RTC.events.onAutoplayFailed, { userId: session.botUserId, kind: 'audio' });
  await waitFor(() => trace.includes('destroy-engine'));

  await controller.start();
  assert.equal(controller.state, 'listening');

  pendingStart.resolve(response({ body: { sessionId: session.sessionId, state: 'started' } }));
  await staleStart;
  assert.equal(controller.state, 'listening');
});

test('three consecutive RTC disconnects end and clean up the session', async () => {
  const { controller, engine, errors, trace } = setup();
  await controller.start();

  engine.emit(RTC.events.onConnectionStateChanged, { state: RTC.ConnectionState.CONNECTION_STATE_DISCONNECTED });
  engine.emit(RTC.events.onConnectionStateChanged, { state: RTC.ConnectionState.CONNECTION_STATE_RECONNECTING });
  assert.equal(controller.state, 'listening');
  engine.emit(RTC.events.onConnectionStateChanged, { state: RTC.ConnectionState.CONNECTION_STATE_LOST });
  await flush();

  assert.equal(controller.state, 'error');
  assert.equal(errors.at(-1).code, 'RTC_CONNECTION_FAILED');
  assert.ok(trace.includes('delete-session'));
});

test('stop asks the server first, then leaves, releases capture, and destroys RTC', async () => {
  const { controller, trace, requests } = setup();
  await controller.start();

  await controller.stop();

  assert.equal(controller.state, 'stopped');
  assert.deepEqual(trace.slice(trace.indexOf('delete-session')), [
    'delete-session', 'leave-room', 'release-microphone', 'destroy-engine'
  ]);
  assert.equal(requests.at(-1).options.keepalive, false);
});

test('a DELETE that never resolves cannot hold the microphone indefinitely', async () => {
  const { controller, trace } = setup({
    deleteResponse: () => new Promise(() => {}),
    deleteTimeoutMs: 20
  });
  await controller.start();

  const stopping = controller.stop();
  assert.equal(trace.at(-1), 'delete-session');
  await Promise.race([
    stopping,
    delay(250).then(() => assert.fail('stop did not release local RTC resources in time'))
  ]);

  assert.deepEqual(trace.slice(trace.indexOf('delete-session')), [
    'delete-session', 'leave-room', 'release-microphone', 'destroy-engine'
  ]);
  assert.equal(controller.state, 'stopped');
});

test('a restarted session gets a fresh cleanup instead of reusing the previous stop', async () => {
  const { controller, trace } = setup();
  await controller.start();
  await controller.stop();

  await controller.start();
  await controller.stop();

  assert.equal(trace.filter(value => value === 'delete-session').length, 2);
  assert.equal(trace.filter(value => value === 'leave-room').length, 2);
  assert.equal(trace.filter(value => value === 'release-microphone').length, 2);
  assert.equal(trace.filter(value => value === 'destroy-engine').length, 2);
});

test('page hide and before-unload each trigger keepalive cleanup once', async () => {
  for (const eventName of ['pagehide', 'beforeunload']) {
    const listeners = new Map();
    const target = {
      addEventListener(name, listener) { listeners.set(name, listener); },
      removeEventListener(name) { listeners.delete(name); }
    };
    const calls = [];
    const unbind = bindRtcLifecycle({ stop: options => { calls.push(options); } }, target);

    listeners.get(eventName)();
    listeners.get(eventName)();

    assert.deepEqual(calls, [{ keepalive: true }], eventName);
    unbind();
    assert.equal(listeners.size, 0);
  }
});

test('unload cleanup starts the keepalive DELETE synchronously for a live session', async () => {
  const { controller, requests } = setup();
  await controller.start();

  const stopping = controller.stop({ keepalive: true });

  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(requests.at(-1).options.keepalive, true);
  await stopping;
});

test('pagehide while start AI is pending cancels and begins cleanup immediately', async () => {
  const pendingStart = deferred();
  const { controller, trace, requests, states } = setup({
    startResponse: () => pendingStart.promise
  });
  const starting = controller.start();
  await waitFor(() => controller.state === 'starting');

  const listeners = new Map();
  const target = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); }
  };
  bindRtcLifecycle(controller, target);
  listeners.get('pagehide')();

  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(requests.at(-1).options.keepalive, true);
  assert.ok(trace.includes('leave-room'));

  pendingStart.resolve(response({ body: { sessionId: session.sessionId, state: 'started' } }));
  await starting;
  await waitFor(() => controller.state === 'stopped');
  assert.equal(states.slice(states.lastIndexOf('stopped') + 1).includes('listening'), false);
});

test('a session returned after keepalive stop is deleted without reviving the old start', async () => {
  const pendingPrepare = deferred();
  const { controller, trace, states, requests } = setup({
    prepareResponse: () => pendingPrepare.promise
  });
  const starting = controller.start();
  await waitFor(() => controller.state === 'preparing');

  await controller.stop({ keepalive: true });
  assert.equal(controller.state, 'stopped');
  pendingPrepare.resolve(response({ status: 201, body: session }));
  await starting;

  assert.ok(trace.includes('delete-session'));
  const deletion = requests.find(request => request.options.method === 'DELETE');
  assert.equal(deletion.options.keepalive, true);
  assert.equal(states.slice(states.lastIndexOf('stopped') + 1).includes('listening'), false);
});

test('pagehide upgrades an in-flight ordinary stop to a keepalive DELETE', async () => {
  const pendingDelete = deferred();
  const { controller, requests } = setup({
    deleteResponse: () => pendingDelete.promise,
    deleteTimeoutMs: 100
  });
  await controller.start();

  const stopping = controller.stop();
  const listeners = new Map();
  const target = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); }
  };
  bindRtcLifecycle(controller, target);
  listeners.get('pagehide')();

  const deletions = requests.filter(request => request.options.method === 'DELETE');
  assert.ok(deletions.some(request => request.options.keepalive === true));
  assert.ok(deletions.every(request => new URL(request.url).pathname === `/rtc/session/${session.sessionId}`));

  pendingDelete.resolve(response({ status: 204 }));
  await stopping;
});

test('pagehide while join is pending deletes the known session and releases RTC immediately', async () => {
  const pendingJoin = deferred();
  const { controller, trace, requests } = setup({ joinResponse: () => pendingJoin.promise });
  const starting = controller.start();
  await waitFor(() => controller.state === 'joining');

  const stopping = controller.stop({ keepalive: true });
  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(requests.at(-1).options.keepalive, true);
  assert.ok(trace.includes('leave-room'));
  pendingJoin.resolve();
  await Promise.all([starting, stopping]);

  assert.equal(controller.state, 'stopped');
  assert.ok(trace.includes('release-microphone'));
});

test('the RTC entry imports the installed SDK and package build bundles it first', async () => {
  const [entry, packageRaw] = await Promise.all([
    readFile('assets/js/voice/rtc-entry.js', 'utf8'),
    readFile('package.json', 'utf8')
  ]);
  const packageJson = JSON.parse(packageRaw);

  assert.match(entry, /from ['"]@volcengine\/rtc['"]/);
  assert.equal(packageJson.scripts['build:rtc'], 'node scripts/build-rtc.mjs');
  assert.match(packageJson.scripts.build, /^pnpm build:rtc && /);
});
