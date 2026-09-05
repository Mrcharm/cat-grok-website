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
    onSubtitleMessageReceived: 'onSubtitleMessageReceived',
    onAutoplayFailed: 'onAutoplayFailed',
    onConnectionStateChanged: 'onConnectionStateChanged'
  },
  MediaType: { AUDIO: 1 },
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
  constructor(trace) {
    this.trace = trace;
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

function setup({ permission = async () => 'microphone-device' } = {}) {
  const trace = [];
  const states = [];
  const transcripts = [];
  const errors = [];
  const requests = [];
  const music = { paused: false, pause() { this.paused = true; } };
  const engine = new FakeEngine(trace);
  const createCalls = [];
  const fetchFn = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push({ url, pathname, options });
    if (options.method === 'POST' && pathname === '/rtc/session') {
      trace.push('prepare-session');
      return response({ status: 201, body: session });
    }
    if (options.method === 'POST' && pathname === `/rtc/session/${session.sessionId}/start`) {
      trace.push('start-ai');
      return response({ body: { sessionId: session.sessionId, state: 'started' } });
    }
    if (options.method === 'DELETE' && pathname === `/rtc/session/${session.sessionId}`) {
      trace.push('delete-session');
      return response({ status: 204 });
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
    music,
    onState: state => states.push(state),
    onTranscript: value => transcripts.push(value),
    onError: value => errors.push(value)
  });
  return { controller, engine, trace, states, transcripts, errors, requests, music, createCalls };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

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

test('RTC subtitle events map user and bot text to the homepage transcript', async () => {
  const { controller, engine, transcripts } = setup();
  await controller.start();

  engine.emit(RTC.events.onSubtitleMessageReceived, [
    { userId: session.userId, text: '你好', definite: true, sequence: 1, language: 'zh' },
    { userId: session.botUserId, text: '我在', definite: false, sequence: 1, language: 'zh' }
  ]);

  assert.deepEqual(transcripts, [
    { speaker: 'user', text: '你好', final: true },
    { speaker: 'assistant', text: '我在', final: false }
  ]);
  assert.equal(controller.state, 'speaking');
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
