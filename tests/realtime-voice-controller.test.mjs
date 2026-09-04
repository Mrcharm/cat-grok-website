import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeVoiceController } from '../assets/js/voice/realtime-voice.js';

class FakeSocket {
  readyState = 0;
  binaryType = '';
  sent = [];
  closed = false;
  listeners = new Map();
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  emit(name, event = {}) {
    for (const listener of this.listeners.get(name) || []) listener(event);
  }
  open() { this.readyState = 1; this.emit('open'); }
  receiveJson(message) { this.emit('message', { data: JSON.stringify(message) }); }
  receiveAudio(bytes) { this.emit('message', { data: bytes.buffer }); }
  send(value) { this.sent.push(value); }
  close() { this.closed = true; this.readyState = 3; }
}

const setup = () => {
  const socket = new FakeSocket();
  const capture = {
    started: false,
    stopped: false,
    async start(onChunk) { this.started = true; this.onChunk = onChunk; },
    async stop() { this.stopped = true; }
  };
  const player = {
    unlocked: false,
    queued: [],
    interruptCalls: 0,
    closed: false,
    async unlock() { this.unlocked = true; },
    enqueue(value) { this.queued.push(value); },
    interrupt() { this.interruptCalls += 1; },
    async close() { this.closed = true; }
  };
  const states = [];
  const transcripts = [];
  const errors = [];
  const music = { paused: false, pause() { this.paused = true; } };
  const controller = new RealtimeVoiceController({
    endpoint: 'wss://voice.example/voice',
    socketFactory: () => socket,
    capture,
    player,
    music,
    onState: state => states.push(state),
    onTranscript: transcript => transcripts.push(transcript),
    onError: error => errors.push(error)
  });
  return { controller, socket, capture, player, music, states, transcripts, errors };
};

test('one click unlocks audio, pauses music, and starts a session', async () => {
  const { controller, socket, capture, player, music, states } = setup();
  await controller.start();
  assert.equal(controller.state, 'connecting');
  assert.equal(capture.started, true);
  assert.equal(player.unlocked, true);
  assert.equal(music.paused, true);
  assert.deepEqual(states, ['permission', 'connecting']);
  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: 'client.start' });
});

test('ready session streams microphone PCM and accepts text', async () => {
  const { controller, socket, capture } = setup();
  await controller.start();
  socket.open();
  socket.receiveJson({ type: 'server.ready' });
  assert.equal(controller.state, 'listening');
  capture.onChunk(new Uint8Array([1, 2]));
  controller.sendText('文字问题');
  assert.deepEqual(new Uint8Array(socket.sent[1]), new Uint8Array([1, 2]));
  assert.deepEqual(JSON.parse(socket.sent[2]), { type: 'client.text', text: '文字问题' });
});

test('server events update transcripts and interrupt queued audio', async () => {
  const { controller, socket, player, transcripts } = setup();
  await controller.start();
  socket.open();
  socket.receiveJson({ type: 'server.ready' });
  socket.receiveJson({ type: 'server.transcript', speaker: 'user', text: '你好', final: true });
  socket.receiveAudio(new Uint8Array([1, 2]));
  assert.equal(controller.state, 'speaking');
  socket.receiveJson({ type: 'server.state', state: 'interrupted' });
  assert.equal(controller.state, 'listening');
  assert.deepEqual(transcripts, [{ speaker: 'user', text: '你好', final: true }]);
  assert.equal(player.queued.length, 1);
  assert.equal(player.interruptCalls, 1);
});

test('stop releases microphone, player, and socket', async () => {
  const { controller, socket, capture, player } = setup();
  await controller.start();
  socket.open();
  socket.receiveJson({ type: 'server.ready' });
  await controller.stop();
  assert.equal(controller.state, 'stopped');
  assert.equal(capture.stopped, true);
  assert.equal(player.closed, true);
  assert.equal(socket.closed, true);
  assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: 'client.stop' });
});

test('microphone denial enters a visible error state', async () => {
  const { controller, capture, errors } = setup();
  capture.start = async () => { throw new Error('NotAllowedError'); };
  await assert.rejects(() => controller.start(), /NotAllowedError/);
  assert.equal(controller.state, 'error');
  assert.deepEqual(errors, [{
    code: 'MICROPHONE_UNAVAILABLE',
    message: '无法使用麦克风，请检查浏览器权限后重试。'
  }]);
});
