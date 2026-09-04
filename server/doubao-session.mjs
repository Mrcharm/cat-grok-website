import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  EVENTS,
  decodeServerFrame,
  encodeAudio,
  encodeFinishSession,
  encodeStartConnection,
  encodeStartSession,
  encodeTextQuery
} from './doubao-protocol.mjs';

const RESOURCE_ID = 'volc.speech.dialog';
const APP_KEY = 'PlgvMymc7f3tQnJ6';

const defaultConnect = (url, options) => new Promise((resolve, reject) => {
  const socket = new WebSocket(url, options);
  socket.once('open', () => resolve(socket));
  socket.once('error', reject);
});

const sessionOptions = config => ({
  asr: { extra: { end_smooth_window_ms: 1000 } },
  tts: {
    speaker: config.speaker,
    audio_config: { channel: 1, format: 'pcm_s16le', sample_rate: 24000 }
  },
  dialog: {
    bot_name: 'JARVIS',
    system_role: '你是猫哥的中文 AI 伙伴 JARVIS。回答自然、简洁、坦诚，不假装记得未提供的信息。',
    speaking_style: '语速适中，语气自然温暖，避免夸张和冗长。',
    extra: { strict_audit: false, recv_timeout: 120, input_mod: 'audio' }
  }
});

class DoubaoSession extends EventEmitter {
  #socket;
  #config;
  #sessionId;
  #ready = false;
  #closed = false;

  constructor(socket, config) {
    super();
    this.#socket = socket;
    this.#config = config;
    socket.on('message', data => this.#receive(data));
    socket.on('error', () => this.#emitSafeError('UPSTREAM_CONNECTION_FAILED', '实时语音服务连接失败，请稍后重试。'));
    socket.on('close', () => {
      this.#closed = true;
      this.#ready = false;
      this.emit('closed');
    });
    socket.send(encodeStartConnection());
  }

  get ready() { return this.#ready; }

  sendAudio(pcm) {
    if (!this.#ready || !this.#sessionId) throw new Error('Doubao session is not ready');
    this.#socket.send(encodeAudio(this.#sessionId, pcm));
  }

  sendText(text) {
    if (!this.#ready || !this.#sessionId) throw new Error('Doubao session is not ready');
    const content = text?.trim();
    if (!content) throw new Error('Text query must not be empty');
    this.#socket.send(encodeTextQuery(this.#sessionId, content));
  }

  close() {
    if (this.#closed) return;
    if (this.#ready && this.#sessionId) {
      this.#socket.send(encodeFinishSession(this.#sessionId));
    }
    this.#closed = true;
    this.#ready = false;
    this.#socket.close();
  }

  #emitSafeError(code, message) {
    this.emit('safe-error', { code, message });
  }

  #receive(data) {
    let message;
    try {
      message = decodeServerFrame(data);
    } catch {
      this.#emitSafeError('UPSTREAM_PROTOCOL_ERROR', '实时语音数据解析失败，请重新连接。');
      return;
    }

    if (message.errorCode !== undefined) {
      this.#emitSafeError('UPSTREAM_REJECTED', '实时语音服务暂时不可用，请检查服务配置或额度。');
      return;
    }

    switch (message.event) {
      case EVENTS.CONNECTION_STARTED:
        this.#sessionId = message.sessionId;
        this.#socket.send(encodeStartSession(this.#sessionId, sessionOptions(this.#config)));
        break;
      case EVENTS.SESSION_STARTED:
        this.#ready = true;
        this.emit('ready');
        break;
      case EVENTS.ASR_INFO:
        this.emit('interrupted');
        break;
      case EVENTS.ASR_RESPONSE: {
        const text = message.payload?.results?.[0]?.text;
        if (text) this.emit('transcript', { speaker: 'user', text, final: true });
        break;
      }
      case EVENTS.CHAT_RESPONSE: {
        const text = message.payload?.content;
        if (text) this.emit('transcript', { speaker: 'assistant', text, final: false });
        break;
      }
      case EVENTS.CHAT_ENDED:
        this.emit('transcript-end', { speaker: 'assistant' });
        break;
      case EVENTS.TTS_RESPONSE:
        this.emit('audio', message.payload);
        break;
      case EVENTS.TTS_ENDED:
        this.emit('turn-complete');
        break;
    }
  }
}

export async function createDoubaoSession({
  config,
  connect = defaultConnect,
  connectId = randomUUID()
}) {
  const headers = {
    'X-Api-App-ID': config.appId,
    'X-Api-Access-Key': config.accessKey,
    'X-Api-Resource-Id': RESOURCE_ID,
    'X-Api-App-Key': APP_KEY,
    'X-Api-Connect-Id': connectId
  };
  const socket = await connect(config.doubaoWsUrl, { headers });
  return new DoubaoSession(socket, config);
}
