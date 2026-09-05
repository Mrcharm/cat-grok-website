import test from 'node:test';
import assert from 'node:assert/strict';
import { CONNECTION_TIMEOUT_MS, DuplexVoiceController, MicrophoneActivityMonitor, PcmFrameBuffer, downsampleToPcm16 } from '../assets/js/voice/duplex-controller.js';

test('connection timeout accommodates a Render cold start', () => {
  assert.equal(CONNECTION_TIMEOUT_MS, 75_000);
});

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
  static starts = [];
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
  createBuffer(_channels, samples, sampleRate) {
    return { duration: samples / sampleRate, getChannelData: () => new Float32Array(samples) };
  }
  createBufferSource() {
    return { connect() {}, start: value => FakeAudioContext.starts.push(value), stop() {}, onended: null };
  }
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

test('a stale permission result cannot clean up a restarted session', async () => {
  FakeSocket.instances = [];
  let resolveFirstPermission;
  const firstPermission = new Promise(resolve => { resolveFirstPermission = resolve; });
  const oldTrack = { muted: false, readyState: 'live', stopped: false, stop() { this.stopped = true; } };
  const newTrack = { muted: false, readyState: 'live', stopped: false, stop() { this.stopped = true; } };
  let permissionRequest = 0;
  const controller = new DuplexVoiceController({
    endpoint: 'https://voice.invalid',
    mediaDevices: { getUserMedia: () => ++permissionRequest === 1
      ? firstPermission
      : Promise.resolve({ getAudioTracks: () => [newTrack], getTracks: () => [newTrack] }) },
    WebSocketCtor: FakeSocket,
    AudioContextCtor: FakeAudioContext
  });

  const staleStart = controller.start();
  await waitTurn();
  await controller.stop();
  const currentStart = controller.start();
  await waitTurn();
  const currentSocket = FakeSocket.instances[0];
  currentSocket.emit('open');
  await currentStart;
  currentSocket.emit('message', { data: JSON.stringify({ type: 'session.created' }) });

  resolveFirstPermission({ getAudioTracks: () => [oldTrack], getTracks: () => [oldTrack] });
  await staleStart;
  assert.equal(oldTrack.stopped, true);
  assert.equal(newTrack.stopped, false);
  assert.equal(currentSocket.readyState, FakeSocket.OPEN);
  assert.equal(controller.state, 'listening');
  await controller.stop();
});

test('a late close from an old socket cannot fail a restarted session', async () => {
  FakeSocket.instances = [];
  const tracks = [];
  const controller = new DuplexVoiceController({
    endpoint: 'https://voice.invalid',
    mediaDevices: { getUserMedia: async () => {
      const track = { muted: false, readyState: 'live', stop() {} };
      tracks.push(track);
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    } },
    WebSocketCtor: FakeSocket,
    AudioContextCtor: FakeAudioContext
  });

  const firstStart = controller.start();
  await waitTurn();
  const oldSocket = FakeSocket.instances[0];
  oldSocket.emit('open');
  await firstStart;
  await controller.stop();

  const secondStart = controller.start();
  await waitTurn();
  const currentSocket = FakeSocket.instances[1];
  currentSocket.emit('open');
  await secondStart;
  currentSocket.emit('message', { data: JSON.stringify({ type: 'session.created' }) });
  oldSocket.emit('close');
  await waitTurn();

  assert.equal(controller.state, 'listening');
  assert.equal(currentSocket.readyState, FakeSocket.OPEN);
  await controller.stop();
});

test('late audio from a canceled response is ignored until a clearly new response starts', async () => {
  FakeSocket.instances = [];
  FakeAudioContext.starts = [];
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
  socket.emit('message', { data: JSON.stringify({ type: 'session.created' }) });
  socket.emit('message', { data: JSON.stringify({ type: 'response.created', response: { id: 'r1' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'response.output_audio.delta', response_id: 'r1', delta: 'AAA=' }) });
  await waitTurn();
  assert.equal(FakeAudioContext.starts.length, 1);

  socket.emit('message', { data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }) });
  socket.emit('message', { data: JSON.stringify({ type: 'response.output_audio.delta', response_id: 'r1', delta: 'AAA=' }) });
  await waitTurn();
  assert.equal(FakeAudioContext.starts.length, 1);

  socket.emit('message', { data: JSON.stringify({ type: 'response.created', response: { id: 'r2' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'response.output_audio.delta', response_id: 'r2', delta: 'AAA=' }) });
  await waitTurn();
  assert.equal(FakeAudioContext.starts.length, 2);
  await controller.stop();
});
