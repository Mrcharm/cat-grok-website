import test from 'node:test';
import assert from 'node:assert/strict';
import { DuplexVoiceController, MicrophoneActivityMonitor, PcmFrameBuffer, downsampleToPcm16 } from '../assets/js/voice/duplex-controller.js';

test('PCM capture is downsampled to signed 16-bit mono and emitted in exact 20ms frames', () => {
  const input = new Float32Array(960);
  input.fill(0.5);
  const pcm = downsampleToPcm16(input, 48_000);
  assert.equal(pcm.byteLength, 640);

  const frames = [];
  const buffer = new PcmFrameBuffer(frame => frames.push(frame));
  buffer.append(pcm.subarray(0, 111));
  buffer.append(pcm.subarray(111));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].byteLength, 640);
});

test('microphone monitor stops a persistently muted device but never guesses from ordinary silence', () => {
  const monitor = new MicrophoneActivityMonitor({ timeoutMs: 2000, silenceThreshold: 0.0001 });
  assert.equal(monitor.observe({ now: 0, muted: true, peak: 0 }), false);
  assert.equal(monitor.observe({ now: 1999, muted: true, peak: 0 }), false);
  assert.equal(monitor.observe({ now: 2000, muted: true, peak: 0 }), true);

  monitor.reset();
  assert.equal(monitor.observe({ now: 10, muted: false, peak: 0 }), false);
  assert.equal(monitor.observe({ now: 1000, muted: false, peak: 0.1 }), false);
  assert.equal(monitor.observe({ now: 2999, muted: false, peak: 0 }), false);
  assert.equal(monitor.observe({ now: 30_000, muted: false, peak: 0 }), false);
});

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];
  constructor() {
    this.readyState = FakeSocket.CONNECTING;
    this.listeners = new Map();
    this.sent = [];
    FakeSocket.instances.push(this);
  }
  addEventListener(name, callback) {
    const handlers = this.listeners.get(name) || [];
    handlers.push(callback);
    this.listeners.set(name, handlers);
  }
  emit(name, value = {}) {
    if (name === 'open') this.readyState = FakeSocket.OPEN;
    for (const callback of this.listeners.get(name) || []) callback(value);
  }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = FakeSocket.CLOSED; this.emit('close'); }
}

class FakeAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 48000;
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  async resume() {}
  async close() { this.state = 'closed'; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null }; }
}

const waitTurn = () => new Promise(resolve => setTimeout(resolve, 0));

test('audio pump waits for session.created instead of racing the upstream session', async () => {
  FakeSocket.instances = [];
  const track = { muted: false, readyState: 'live', stop() {} };
  const controller = new DuplexVoiceController({
    endpoint: 'https://voice.invalid',
    mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }) },
    WebSocketCtor: FakeSocket,
    AudioContextCtor: FakeAudioContext
  });
  const starting = controller.start();
  await waitTurn();
  const socket = FakeSocket.instances[0];
  socket.emit('open');
  await starting;
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(socket.sent, []);

  socket.emit('message', { data: JSON.stringify({ type: 'session.created' }) });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(socket.sent[0].type, 'input_audio_buffer.append');
  await controller.stop();
});

test('stop during a pending permission request cannot reopen a stale session', async () => {
  FakeSocket.instances = [];
  let resolvePermission;
  let stopped = false;
  const permission = new Promise(resolve => { resolvePermission = resolve; });
  const track = { muted: false, readyState: 'live', stop() { stopped = true; } };
  const controller = new DuplexVoiceController({
    endpoint: 'https://voice.invalid',
    mediaDevices: { getUserMedia: () => permission },
    WebSocketCtor: FakeSocket,
    AudioContextCtor: FakeAudioContext
  });
  const starting = controller.start();
  await waitTurn();
  await controller.stop();
  resolvePermission({ getAudioTracks: () => [track], getTracks: () => [track] });
  await starting;
  assert.equal(stopped, true);
  assert.equal(FakeSocket.instances.length, 0);
  assert.equal(controller.state, 'stopped');
});
