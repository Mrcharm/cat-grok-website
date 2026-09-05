const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const PCM_FRAME_BYTES = 640;
const ACTIVE_STATES = new Set(['permission', 'connecting', 'listening', 'speaking']);
const START_CANCELLED = Symbol('start-cancelled');
export const CONNECTION_TIMEOUT_MS = 75_000;

export function downsampleToPcm16(input, inputRate, targetRate = INPUT_SAMPLE_RATE) {
  const ratio = inputRate / targetRate;
  const length = Math.floor(input.length / ratio);
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(output.buffer);
}

export class PcmFrameBuffer {
  constructor(onFrame, frameBytes = PCM_FRAME_BYTES) {
    this.onFrame = onFrame;
    this.frameBytes = frameBytes;
    this.chunks = [];
    this.bytes = 0;
  }

  append(chunk) {
    if (!chunk?.byteLength) return;
    this.chunks.push(chunk.slice());
    this.bytes += chunk.byteLength;
    while (this.bytes >= this.frameBytes) this.onFrame(this.take(this.frameBytes));
  }

  take(size) {
    const output = new Uint8Array(size);
    let offset = 0;
    while (offset < size && this.chunks.length) {
      const chunk = this.chunks[0];
      const count = Math.min(size - offset, chunk.byteLength);
      output.set(chunk.subarray(0, count), offset);
      offset += count;
      this.bytes -= count;
      if (count === chunk.byteLength) this.chunks.shift();
      else this.chunks[0] = chunk.subarray(count);
    }
    return output;
  }

  clear() {
    this.chunks = [];
    this.bytes = 0;
  }
}

export class MicrophoneActivityMonitor {
  constructor({ timeoutMs = 4000, silenceThreshold = 0.0001 } = {}) {
    this.timeoutMs = timeoutMs;
    this.silenceThreshold = silenceThreshold;
    this.silentSince = null;
  }

  observe({ now, muted, peak }) {
    if (!muted) {
      this.silentSince = null;
      return false;
    }
    if (this.silentSince === null) this.silentSince = now;
    return now - this.silentSince >= this.timeoutMs;
  }

  reset() {
    this.silentSince = null;
  }
}

const bytesToBase64 = bytes => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = value => {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
};

const eventText = event => event?.text || event?.delta || event?.transcript || '';

class PcmStreamPlayer {
  constructor(AudioContextCtor) {
    this.AudioContextCtor = AudioContextCtor;
    this.context = null;
    this.nextPlayTime = 0;
    this.sources = new Set();
    this.epoch = 0;
  }

  async start() {
    if (!this.context || this.context.state === 'closed') {
      this.context = new this.AudioContextCtor({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.nextPlayTime = Math.max(this.context.currentTime + 0.04, this.nextPlayTime);
  }

  async enqueue(bytes) {
    if (bytes.byteLength < 2) return;
    const epoch = this.epoch;
    await this.start();
    if (epoch !== this.epoch || !this.context || this.context.state === 'closed') return;
    const samples = Math.floor(bytes.byteLength / 2);
    const buffer = this.context.createBuffer(1, samples, OUTPUT_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples; index += 1) channel[index] = view.getInt16(index * 2, true) / 32768;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => this.sources.delete(source);
    this.sources.add(source);
    const startAt = Math.max(this.nextPlayTime, this.context.currentTime + 0.01);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
  }

  clear() {
    this.epoch += 1;
    for (const source of this.sources) {
      try { source.stop(); } catch {}
    }
    this.sources.clear();
    this.nextPlayTime = 0;
  }

  async stop() {
    this.clear();
    if (this.context && this.context.state !== 'closed') await this.context.close().catch(() => {});
    this.context = null;
    this.nextPlayTime = 0;
  }
}

function websocketUrl(endpoint) {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/voice`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export class DuplexVoiceController {
  constructor({
    endpoint,
    mediaDevices = navigator.mediaDevices,
    WebSocketCtor = WebSocket,
    AudioContextCtor = window.AudioContext || window.webkitAudioContext,
    music = { pause() {} },
    onState = () => {},
    onTranscript = () => {},
    onError = () => {},
    onDiagnostic = () => {}
  }) {
    this.endpoint = endpoint;
    this.mediaDevices = mediaDevices;
    this.WebSocketCtor = WebSocketCtor;
    this.AudioContextCtor = AudioContextCtor;
    this.music = music;
    this.onState = onState;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onDiagnostic = onDiagnostic;
    this.state = 'idle';
    this.generation = 0;
    this.sessionReady = false;
  }

  setState(state) {
    this.state = state;
    this.onState(state);
  }

  async start() {
    if (ACTIVE_STATES.has(this.state)) return;
    const generation = ++this.generation;
    const session = {
      generation,
      stopping: false,
      pendingFrames: [],
      monitor: new MicrophoneActivityMonitor(),
      player: new PcmStreamPlayer(this.AudioContextCtor),
      sessionReady: false,
      canceledResponseIds: new Set(),
      cancellationPending: false,
      activeResponseId: null
    };
    session.frameBuffer = new PcmFrameBuffer(frame => {
      session.pendingFrames.push(frame);
      if (session.pendingFrames.length > 5) session.pendingFrames.shift();
    });
    this.session = session;
    this.sessionReady = false;
    this.music.pause();
    this.setState('permission');
    try {
      // Called inside the click gesture, before the asynchronous permission prompt.
      const outputReady = session.player.start();
      outputReady.catch(() => {});
      this.onDiagnostic({ microphone: 'permission', output: session.player.context?.state, audioChunks: 0 });
      const stream = await this.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      if (!this.isCurrent(session)) {
        for (const track of stream.getTracks()) track.stop();
        throw START_CANCELLED;
      }
      session.stream = stream;
      session.track = stream.getAudioTracks()[0];
      if (!session.track) throw new Error('microphone_missing');
      session.captureContext = new this.AudioContextCtor();
      await session.captureContext.resume();
      if (!this.isCurrent(session)) throw START_CANCELLED;
      await outputReady;
      if (!this.isCurrent(session)) throw START_CANCELLED;
      this.setupCapture(session);
      this.setState('connecting');
      await this.connect(session);
      if (!this.isCurrent(session)) throw START_CANCELLED;
      this.startPumps(session);
    } catch (cause) {
      if (cause === START_CANCELLED || !this.isCurrent(session)) {
        await this.cleanup(session);
        return;
      }
      await this.fail(
        this.state === 'permission'
          ? '无法使用麦克风，请检查浏览器和系统权限后重试。'
          : '实时语音服务暂不可用，请稍后重试。',
        cause,
        session
      );
      throw cause;
    }
  }

  isCurrent(session) {
    return Boolean(session && this.session === session && session.generation === this.generation && !session.stopping);
  }

  setupCapture(session) {
    session.source = session.captureContext.createMediaStreamSource(session.stream);
    session.processor = session.captureContext.createScriptProcessor(1024, 1, 1);
    session.processor.onaudioprocess = event => {
      if (!this.isCurrent(session)) return;
      const input = event.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let index = 0; index < input.length; index += 1) peak = Math.max(peak, Math.abs(input[index]));
      session.lastPeak = Math.max(session.lastPeak || 0, peak);
      session.frameBuffer.append(downsampleToPcm16(input, session.captureContext.sampleRate));
    };
    session.source.connect(session.processor);
    session.processor.connect(session.captureContext.destination);
  }

  connect(session) {
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketCtor(websocketUrl(this.endpoint));
      session.socket = socket;
      let settled = false;
      const finish = callback => value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const timeout = setTimeout(finish(() => reject(new Error('connection_timeout'))), CONNECTION_TIMEOUT_MS);
      socket.addEventListener('open', () => {
        if (!this.isCurrent(session)) return finish(reject)(START_CANCELLED);
        finish(resolve)();
      }, { once: true });
      socket.addEventListener('message', event => {
        if (this.isCurrent(session)) this.handleMessage(event.data, session);
      });
      socket.addEventListener('error', () => finish(reject)(new Error('connection_failed')), { once: true });
      socket.addEventListener('close', () => {
        if (!settled) finish(reject)(START_CANCELLED);
        if (this.isCurrent(session)) void this.fail('实时语音连接已中断，请重新开始。', undefined, session);
      });
    });
  }

  startPumps(session) {
    const silence = new Uint8Array(PCM_FRAME_BYTES);
    session.audioTimer = setInterval(() => {
      if (!this.isCurrent(session) || !session.sessionReady || session.track?.muted || session.track?.readyState === 'ended' || session.socket?.readyState !== this.WebSocketCtor.OPEN) return;
      const frame = session.pendingFrames.shift() || silence;
      session.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: bytesToBase64(frame) }));
    }, 20);
    session.activityTimer = setInterval(() => {
      if (!this.isCurrent(session)) return;
      const muted = Boolean(session.track?.muted || session.track?.readyState === 'ended');
      const peak = session.lastPeak || 0;
      session.lastPeak = 0;
      session.monitor.observe({ now: Date.now(), muted, peak });
      this.onDiagnostic({
        microphone: muted ? 'muted' : peak > 0.001 ? 'receiving' : 'ready',
        output: session.player.context?.state || 'closed',
        audioChunks: session.audioChunks || 0
      });
    }, 250);
  }

  handleMessage(raw, session = this.session) {
    if (!this.isCurrent(session)) return;
    let event;
    try { event = JSON.parse(raw); } catch { return; }
    switch (event.type) {
      case 'session.created':
        session.sessionReady = true;
        this.sessionReady = true;
        this.setState('listening');
        break;
      case 'response.created': {
        this.acceptResponseEvent(session, event);
        break;
      }
      case 'conversation.item.input_audio_transcription.started':
        if (session.socket?.readyState === this.WebSocketCtor.OPEN) {
          session.socket.send(JSON.stringify({ type: 'response.cancel' }));
        }
        if (session.activeResponseId) session.canceledResponseIds.add(session.activeResponseId);
        session.cancellationPending = true;
        session.player.clear();
        this.userTranscript = '';
        this.setState('listening');
        break;
      case 'conversation.item.input_audio_transcription.delta': {
        this.userTranscript = eventText(event);
        if (this.userTranscript) this.onTranscript({ speaker: 'user', text: this.userTranscript });
        break;
      }
      case 'conversation.item.input_audio_transcription.completed':
        this.userTranscript = eventText(event) || this.userTranscript || '';
        this.assistantTranscript = '';
        if (this.userTranscript) this.onTranscript({ speaker: 'user', text: this.userTranscript });
        break;
      case 'response.output_text.delta':
        if (!this.acceptResponseEvent(session, event)) break;
        this.assistantTranscript = `${this.assistantTranscript || ''}${eventText(event)}`;
        if (this.assistantTranscript) this.onTranscript({ speaker: 'assistant', text: this.assistantTranscript });
        this.setState('speaking');
        break;
      case 'response.output_text.done':
        if (!this.acceptResponseEvent(session, event)) break;
        this.assistantTranscript = eventText(event) || this.assistantTranscript || '';
        if (this.assistantTranscript) this.onTranscript({ speaker: 'assistant', text: this.assistantTranscript });
        this.setState('speaking');
        break;
      case 'response.output_audio.started':
        if (!this.acceptResponseEvent(session, event)) break;
        this.setState('speaking');
        break;
      case 'response.output_audio.delta': {
        if (!this.acceptResponseEvent(session, event)) break;
        const audio = event.audio || event.delta;
        if (audio) {
          session.audioChunks = (session.audioChunks || 0) + 1;
          void session.player.enqueue(base64ToBytes(audio)).catch(() => {
          if (this.isCurrent(session)) return this.fail('JARVIS 的声音播放失败，请重新开始。', undefined, session);
          });
        }
        break;
      }
      case 'response.output_audio.done':
      case 'response.done':
        if (!this.acceptResponseEvent(session, event)) break;
        this.setState('listening');
        break;
      case 'error':
        void this.fail(event.error?.message || '实时语音服务暂不可用，请稍后重试。');
        break;
      default:
        break;
    }
  }

  acceptResponseEvent(session, event) {
    const responseId = event.response_id || event.response?.id;
    if (responseId && session.canceledResponseIds.has(responseId)) return false;
    if (session.cancellationPending) {
      if (!responseId) return false;
      session.cancellationPending = false;
    }
    if (responseId) session.activeResponseId = responseId;
    return true;
  }

  sendText(text) {
    const clean = String(text || '').trim();
    const session = this.session;
    if (!clean || !this.isCurrent(session) || !session.sessionReady || session.socket?.readyState !== this.WebSocketCtor.OPEN) return false;
    session.socket.send(JSON.stringify({ type: 'speech_text_buffer.commit', text: clean.slice(0, 300) }));
    this.onTranscript({ speaker: 'user', text: clean.slice(0, 300) });
    return true;
  }

  async resumeOutput() {
    if (this.session && this.isCurrent(this.session)) await this.session.player.start();
  }

  async fail(message, cause, session = this.session) {
    if (!this.isCurrent(session)) return;
    this.onError({ code: 'VOICE_UNAVAILABLE', message, cause });
    this.setState('error');
    await this.cleanup(session);
  }

  async stop() {
    this.generation += 1;
    const session = this.session;
    if (session?.socket?.readyState === this.WebSocketCtor.OPEN) {
      session.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
    await this.cleanup(session);
    if (this.session === session) this.session = null;
    this.setState('stopped');
  }

  async cleanup(session = this.session) {
    if (!session || session.stopping) return;
    session.stopping = true;
    clearInterval(session.audioTimer);
    clearInterval(session.activityTimer);
    session.frameBuffer.clear();
    session.pendingFrames = [];
    session.processor?.disconnect();
    session.source?.disconnect();
    for (const track of session.stream?.getTracks?.() || []) track.stop();
    if (session.socket && [this.WebSocketCtor.OPEN, this.WebSocketCtor.CONNECTING].includes(session.socket.readyState)) session.socket.close();
    await session.captureContext?.close?.().catch(() => {});
    await session.player.stop();
    session.monitor.reset();
    if (this.session === session) {
      this.sessionReady = false;
    }
  }
}

const STATE_LABELS = {
  idle: 'JARVIS 已就绪',
  permission: '正在请求麦克风权限…',
  connecting: '正在连接 JARVIS…',
  listening: '正在聆听，可以直接说话',
  speaking: 'JARVIS 正在回复，开口即可打断',
  stopped: '语音对话已结束',
  error: '实时语音暂不可用'
};

const mountedVoices = new WeakMap();

export function bootDuplexVoice({ root = document } = {}) {
  const dock = root.querySelector('#voiceDock');
  const button = root.querySelector('#voiceBtn');
  const status = root.querySelector('#voiceStatus');
  const transcript = root.querySelector('#transcriptToast');
  const input = root.querySelector('#userInput');
  const send = root.querySelector('#sendBtn');
  if (!dock || !button || !status || !transcript || !input || !send) return null;
  if (mountedVoices.has(dock)) return mountedVoices.get(dock);
  status.textContent = STATE_LABELS.idle;
  dock.dataset.voiceState = 'idle';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', '开始实时语音对话');

  const diagnostic = root.createElement('span');
  diagnostic.className = 'voice-diagnostic';
  diagnostic.id = 'voiceDiagnostic';
  const resume = root.createElement('button');
  resume.type = 'button';
  resume.className = 'voice-resume';
  resume.textContent = '开启回复声音';
  resume.hidden = true;
  dock.append(diagnostic, resume);

  const showMessage = (speaker, text) => {
    transcript.replaceChildren();
    const name = root.createElement('strong');
    name.textContent = speaker === 'user' ? '你' : 'JARVIS';
    const content = root.createElement('span');
    content.textContent = text;
    transcript.append(name, root.createElement('br'), content);
    transcript.classList.add('show');
  };
  const endpoint = dock.dataset.voiceEndpoint?.trim();
  if (!endpoint) {
    button.addEventListener('click', () => showMessage('assistant', '实时语音服务尚未配置。'));
    return null;
  }

  const controller = new DuplexVoiceController({
    endpoint,
    music: { pause: () => {
      const musicButton = root.querySelector('.music-btn');
      if (musicButton?.getAttribute('aria-pressed') === 'true') musicButton.click();
    } },
    onState(state) {
      dock.dataset.voiceState = state;
      status.textContent = STATE_LABELS[state];
      const active = ACTIVE_STATES.has(state);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? '结束实时语音对话' : '开始实时语音对话');
      if (!active) { diagnostic.textContent = ''; resume.hidden = true; }
    },
    onTranscript: value => showMessage(value.speaker, value.text),
    onError: error => showMessage('assistant', error.message),
    onDiagnostic({ microphone, output, audioChunks }) {
      const mic = microphone === 'permission' ? '等待麦克风授权' : microphone === 'muted' ? '麦克风未提供输入，可输入文字' : microphone === 'receiving' ? '正在收到你的声音' : '麦克风已连接';
      const speaker = output === 'running' ? '播放通道已开启' : '回复声音等待授权';
      const text = `${mic} · ${speaker} · 已接收 ${audioChunks} 段音频`;
      if (diagnostic.textContent !== text) diagnostic.textContent = text;
      resume.hidden = output === 'running';
    }
  });

  const toggleVoice = () => {
    transcript.replaceChildren();
    transcript.classList.remove('show');
    const action = ACTIVE_STATES.has(controller.state) ? controller.stop() : controller.start();
    action.catch(() => {});
  };
  button.addEventListener('click', toggleVoice);
  const heroTrigger = root.querySelector('[data-focus-voice]');
  heroTrigger?.addEventListener('click', toggleVoice);
  const resumeVoice = () => controller.resumeOutput().catch(() => showMessage('assistant', '播放未开启，请检查浏览器或系统声音设置。'));
  resume.addEventListener('click', resumeVoice);
  const sendText = () => {
    if (controller.sendText(input.value)) input.value = '';
    else if (input.value.trim()) showMessage('assistant', '请先连接实时语音，再发送文字。');
  };
  send.addEventListener('click', sendText);
  const inputKey = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendText();
    }
  };
  input.addEventListener('keydown', inputKey);
  const cleanup = () => void controller.stop();
  root.defaultView?.addEventListener('pagehide', cleanup, { once: true });
  root.defaultView?.addEventListener('beforeunload', cleanup, { once: true });
  controller.destroy = () => {
    controller.onState = () => {};
    controller.onError = () => {};
    controller.onDiagnostic = () => {};
    controller.onTranscript = () => {};
    button.removeEventListener('click', toggleVoice);
    heroTrigger?.removeEventListener('click', toggleVoice);
    send.removeEventListener('click', sendText);
    input.removeEventListener('keydown', inputKey);
    resume.removeEventListener('click', resumeVoice);
    diagnostic.remove();
    resume.remove();
    root.defaultView?.removeEventListener('pagehide', cleanup);
    root.defaultView?.removeEventListener('beforeunload', cleanup);
    mountedVoices.delete(dock);
    cleanup();
  };
  mountedVoices.set(dock, controller);
  return controller;
}
