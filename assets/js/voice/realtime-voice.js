import { PcmCapture } from './pcm-capture.js';
import { PcmPlayer } from './pcm-player.js';

const ACTIVE_STATES = new Set(['permission', 'connecting', 'listening', 'speaking', 'reconnecting']);

export class RealtimeVoiceController {
  #endpoint;
  #socketFactory;
  #capture;
  #player;
  #music;
  #onState;
  #onTranscript;
  #onError;
  #socket;
  #ready = false;
  #retry = 0;
  #manualStop = false;

  state = 'idle';

  constructor({
    endpoint,
    socketFactory = url => new WebSocket(url),
    capture = new PcmCapture(),
    player = new PcmPlayer(),
    music = { pause() {} },
    onState = () => {},
    onTranscript = () => {},
    onError = () => {}
  }) {
    this.#endpoint = endpoint;
    this.#socketFactory = socketFactory;
    this.#capture = capture;
    this.#player = player;
    this.#music = music;
    this.#onState = onState;
    this.#onTranscript = onTranscript;
    this.#onError = onError;
  }

  #setState(state) {
    this.state = state;
    this.#onState(state);
  }

  async start() {
    if (ACTIVE_STATES.has(this.state)) return;
    this.#manualStop = false;
    this.#retry = 0;
    this.#setState('permission');
    try {
      await this.#player.unlock();
      this.#music.pause();
      await this.#capture.start(chunk => {
        if (this.#ready && this.#socket?.readyState === 1) this.#socket.send(chunk);
      });
      this.#connect();
    } catch (cause) {
      this.#setState('error');
      const error = {
        code: 'MICROPHONE_UNAVAILABLE',
        message: '无法使用麦克风，请检查浏览器权限后重试。'
      };
      this.#onError(error);
      throw cause;
    }
  }

  #connect() {
    this.#ready = false;
    this.#setState(this.#retry ? 'reconnecting' : 'connecting');
    const socket = this.#socketFactory(this.#endpoint);
    this.#socket = socket;
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'client.start' })));
    socket.addEventListener('message', event => this.#receive(event.data));
    socket.addEventListener('error', () => {
      if (!this.#manualStop) this.#reportConnectionError();
    });
    socket.addEventListener('close', () => {
      this.#ready = false;
      if (!this.#manualStop) this.#scheduleReconnect();
    });
  }

  #receive(data) {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      this.#player.enqueue(data);
      this.#setState('speaking');
      return;
    }
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      data.arrayBuffer().then(value => {
        this.#player.enqueue(value);
        this.#setState('speaking');
      });
      return;
    }

    let message;
    try { message = JSON.parse(String(data)); } catch { return; }
    if (message.type === 'server.ready') {
      this.#ready = true;
      this.#retry = 0;
      this.#setState('listening');
    } else if (message.type === 'server.transcript') {
      this.#onTranscript({
        speaker: message.speaker,
        text: message.text,
        final: Boolean(message.final)
      });
    } else if (message.type === 'server.state' && message.state === 'interrupted') {
      this.#player.interrupt();
      this.#setState('listening');
    } else if (message.type === 'server.state' && message.state === 'listening') {
      this.#setState('listening');
    } else if (message.type === 'server.error') {
      this.#setState('error');
      this.#onError({ code: message.code, message: message.message });
    }
  }

  #scheduleReconnect() {
    const delays = [500, 1500, 3000];
    if (this.#retry >= delays.length) {
      this.#reportConnectionError();
      return;
    }
    const delay = delays[this.#retry];
    this.#retry += 1;
    this.#setState('reconnecting');
    setTimeout(() => {
      if (!this.#manualStop) this.#connect();
    }, delay);
  }

  #reportConnectionError() {
    this.#setState('error');
    this.#onError({
      code: 'VOICE_CONNECTION_FAILED',
      message: '实时语音连接中断，请稍后重新开始。'
    });
  }

  sendText(value) {
    const text = value?.trim();
    if (!text || !this.#ready || this.#socket?.readyState !== 1) return false;
    this.#socket.send(JSON.stringify({ type: 'client.text', text }));
    return true;
  }

  async stop() {
    this.#manualStop = true;
    this.#ready = false;
    if (this.#socket?.readyState === 1) {
      this.#socket.send(JSON.stringify({ type: 'client.stop' }));
    }
    this.#socket?.close();
    await this.#capture.stop();
    await this.#player.close();
    this.#setState('stopped');
  }
}

const STATE_LABELS = {
  idle: 'JARVIS 已就绪',
  permission: '正在请求麦克风权限…',
  connecting: '正在连接 JARVIS…',
  listening: '正在聆听，可以直接说话',
  speaking: 'JARVIS 正在回复，开口即可打断',
  reconnecting: '连接中断，正在重连…',
  stopped: '语音对话已结束',
  error: '实时语音暂不可用'
};

export function bootRealtimeVoice(root = document) {
  const dock = root.querySelector('#voiceDock');
  const button = root.querySelector('#voiceBtn');
  const status = root.querySelector('#voiceStatus');
  const transcript = root.querySelector('#transcriptToast');
  const input = root.querySelector('#userInput');
  const send = root.querySelector('#sendBtn');
  if (!dock || !button || !status || !transcript || !input || !send) return null;

  const showMessage = (speaker, text) => {
    transcript.replaceChildren();
    const name = root.createElement('strong');
    name.textContent = speaker === 'user' ? '你' : 'JARVIS';
    const content = root.createElement('span');
    content.textContent = text;
    transcript.append(name, root.createElement('br'), content);
    transcript.classList.add('show');
  };

  const endpoint = dock.dataset.voiceEndpoint;
  const controller = new RealtimeVoiceController({
    endpoint,
    music: {
      pause() {
        const musicButton = root.querySelector('.music-btn');
        if (musicButton?.getAttribute('aria-pressed') === 'true') musicButton.click();
      }
    },
    onState(state) {
      dock.dataset.voiceState = state;
      status.textContent = STATE_LABELS[state];
      button.setAttribute('aria-pressed', String(ACTIVE_STATES.has(state)));
      button.setAttribute('aria-label', ACTIVE_STATES.has(state) ? '结束实时语音对话' : '开始实时语音对话');
    },
    onTranscript(message) { showMessage(message.speaker, message.text); },
    onError(error) { showMessage('assistant', error.message); }
  });

  button.addEventListener('click', () => {
    if (!endpoint) {
      showMessage('assistant', '实时语音服务尚未配置。');
      return;
    }
    if (ACTIVE_STATES.has(controller.state)) controller.stop();
    else controller.start().catch(() => {});
  });

  const sendText = () => {
    const text = input.value.trim();
    if (!text) return;
    if (controller.sendText(text)) {
      showMessage('user', text);
      input.value = '';
    } else {
      showMessage('assistant', '请先点击麦克风，开始实时对话。');
    }
  };
  send.addEventListener('click', sendText);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); sendText(); }
  });
  root.defaultView?.addEventListener('pagehide', () => controller.stop());
  return controller;
}

if (typeof document !== 'undefined') bootRealtimeVoice(document);
