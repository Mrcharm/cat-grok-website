import { parseAigcTlvMessage } from './rtc-aigc-message.js';

const ACTIVE_STATES = new Set([
  'permission',
  'preparing',
  'joining',
  'starting',
  'listening',
  'speaking'
]);

const START_CANCELLED = Symbol('start-cancelled');

const ERROR_MESSAGES = {
  microphone: {
    code: 'MICROPHONE_UNAVAILABLE',
    message: '无法使用麦克风，请检查浏览器权限后重试。'
  },
  connection: {
    code: 'RTC_CONNECTION_FAILED',
    message: '实时语音连接中断，请稍后重新开始。'
  },
  autoplay: {
    code: 'AUTOPLAY_BLOCKED',
    message: '浏览器阻止了 JARVIS 的声音播放，请再次点击麦克风重试。'
  },
  service: {
    code: 'VOICE_SERVICE_UNAVAILABLE',
    message: '实时语音服务暂不可用，请稍后重试。'
  }
};

function sessionUrl(origin, suffix = '') {
  return `${origin}/rtc/session${suffix}`;
}

async function expectResponse(response) {
  if (!response?.ok) {
    const error = new Error(`Voice service request failed (${response?.status || 'network'})`);
    error.status = response?.status;
    throw error;
  }
  return response;
}

function settleWithin(promise, timeoutMs) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    Promise.resolve(promise).catch(() => {}).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export class RtcVoiceController {
  #origin;
  #rtc;
  #requestPermission;
  #fetch;
  #music;
  #onState;
  #onTranscript;
  #onError;
  #maxDisconnects;
  #deleteTimeoutMs;
  #now;
  #setTimeout;
  #clearTimeout;
  #disconnects = 0;
  #generation = 0;
  #current = null;
  #startPromise = null;
  #stopPromise = null;

  state = 'idle';

  constructor({
    endpoint,
    rtc,
    requestPermission,
    fetchFn = (...args) => fetch(...args),
    music = { pause() {} },
    onState = () => {},
    onTranscript = () => {},
    onError = () => {},
    maxDisconnects = 3,
    deleteTimeoutMs = 1500,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  }) {
    this.#origin = new URL(endpoint).origin;
    this.#rtc = rtc;
    this.#requestPermission = requestPermission;
    this.#fetch = fetchFn;
    this.#music = music;
    this.#onState = onState;
    this.#onTranscript = onTranscript;
    this.#onError = onError;
    this.#maxDisconnects = maxDisconnects;
    this.#deleteTimeoutMs = deleteTimeoutMs;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
  }

  #setState(state) {
    this.state = state;
    this.#onState(state);
  }

  #isCurrent(context) {
    return this.#current === context
      && !context.cancelled
      && context.generation === this.#generation;
  }

  #ensureCurrent(context) {
    if (!this.#isCurrent(context)) throw START_CANCELLED;
  }

  start() {
    if (ACTIVE_STATES.has(this.state)) return this.#startPromise || Promise.resolve();
    const previous = this.#current;
    const generation = ++this.#generation;
    const run = (async () => {
      if (previous?.cleanupPromise) await previous.cleanupPromise.catch(() => {});
      if (generation !== this.#generation) return;
      const context = {
        generation,
        cancelled: false,
        session: null,
        engine: null,
        cleanupPromise: null,
        keepaliveRequested: false,
        deleteRecord: null,
        expiryTimer: null
      };
      this.#current = context;
      await this.#start(context);
    })();
    const tracked = run.finally(() => {
      if (this.#startPromise === tracked) this.#startPromise = null;
    });
    this.#startPromise = tracked;
    return tracked;
  }

  async #start(context) {
    try {
      this.#music.pause();
      this.#setState('permission');
      const deviceId = await this.#requestPermission();
      this.#ensureCurrent(context);

      this.#setState('preparing');
      const prepared = await expectResponse(await this.#fetch(sessionUrl(this.#origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      }));
      const session = await prepared.json();
      context.session = session;
      this.#ensureCurrent(context);

      const remainingMs = Date.parse(session.expiresAt) - this.#now();
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) throw new Error('Session expired');
      context.expiryTimer = this.#setTimeout(() => {
        if (this.#isCurrent(context)) void this.stop();
      }, Math.min(remainingMs, 900000));
      context.expiryTimer?.unref?.();

      const engine = this.#rtc.createEngine(session.appId, {
        autoPlayPolicy: this.#rtc.RTCAutoPlayPolicy.AUTO_PLAY
      });
      context.engine = engine;
      this.#bindEngineEvents(context);
      await engine.startAudioCapture(deviceId || undefined);
      this.#ensureCurrent(context);

      this.#setState('joining');
      await engine.joinRoom(
        session.token,
        session.roomId,
        { userId: session.userId },
        {
          isAutoPublish: true,
          isAutoSubscribeAudio: true,
          isAutoSubscribeVideo: false,
          roomProfileType: this.#rtc.RoomProfileType.chat
        }
      );
      this.#ensureCurrent(context);

      this.#setState('starting');
      await expectResponse(await this.#fetch(
        sessionUrl(this.#origin, `/${encodeURIComponent(session.sessionId)}/start`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        }
      ));
      this.#ensureCurrent(context);
      this.#setState('listening');
    } catch (cause) {
      if (cause === START_CANCELLED || !this.#isCurrent(context)) {
        await this.#cleanupContext(context);
        return;
      }
      const error = this.state === 'permission' ? ERROR_MESSAGES.microphone : ERROR_MESSAGES.service;
      await this.#fail(error, context);
      throw cause;
    }
  }

  #bindEngineEvents(context) {
    const events = this.#rtc.events;
    const engine = context.engine;
    const session = context.session;
    engine.on(events.onRemoteAudioFirstFrame, event => {
      if (this.#isCurrent(context) && event?.userId === session?.botUserId) this.#setState('speaking');
    });
    engine.on(events.onRoomBinaryMessageReceived, event => {
      if (!this.#isCurrent(context) || event?.userId !== session?.botUserId) return;
      let parsed;
      try {
        parsed = parseAigcTlvMessage(event.message);
      } catch {
        return;
      }
      if (!parsed) return;
      if (parsed.tag === 'subv') {
        for (const message of Array.isArray(parsed.payload.data) ? parsed.payload.data : []) {
          if (typeof message?.text !== 'string' || !message.text) continue;
          const speaker = message.userId === session.userId
            ? 'user'
            : message.userId === session.botUserId ? 'assistant' : null;
          if (!speaker) continue;
          this.#onTranscript({ speaker, text: message.text, final: Boolean(message.definite) });
          this.#setState(speaker === 'assistant' ? 'speaking' : 'listening');
        }
        return;
      }
      const stage = Number(parsed.payload?.Stage?.Code);
      if (stage === 3) this.#setState('speaking');
      if ([1, 2, 4, 5].includes(stage)) this.#setState('listening');
    });
    engine.on(events.onAutoplayFailed, event => {
      if (this.#isCurrent(context) && event?.kind === 'audio' && event.userId === session?.botUserId) {
        void this.#fail(ERROR_MESSAGES.autoplay, context);
      }
    });
    const codes = this.#rtc.ErrorCode;
    const terminalErrors = new Set([
      codes.TOKEN_EXPIRED, codes.RECONNECT_FAILED, codes.KICKED_OUT,
      codes.ROOM_DISMISS, codes.DUPLICATE_LOGIN, codes.RTM_DUPLICATE_LOGIN,
      codes.RTM_TOKEN_ERROR
    ].filter(value => value !== undefined));
    engine.on(events.onError, event => {
      if (this.#isCurrent(context) && terminalErrors.has(event?.errorCode)) {
        void this.#fail(ERROR_MESSAGES.connection, context);
      }
    });
    engine.on(events.onConnectionStateChanged, event => {
      if (!this.#isCurrent(context)) return;
      const states = this.#rtc.ConnectionState;
      if ([states.CONNECTION_STATE_CONNECTED, states.CONNECTION_STATE_RECONNECTED].includes(event?.state)) {
        this.#disconnects = 0;
        return;
      }
      if (![states.CONNECTION_STATE_DISCONNECTED, states.CONNECTION_STATE_RECONNECTING, states.CONNECTION_STATE_LOST].includes(event?.state)) {
        return;
      }
      this.#disconnects += 1;
      if (this.#disconnects >= this.#maxDisconnects) void this.#fail(ERROR_MESSAGES.connection, context);
    });
  }

  async #fail(error, context) {
    if (!this.#isCurrent(context)) return;
    context.cancelled = true;
    if (context.generation === this.#generation) this.#generation += 1;
    if (this.state !== 'error') {
      this.#setState('error');
      this.#onError(error);
    }
    await this.#cleanupContext(context);
    if (this.#current === context) this.#current = null;
  }

  stop({ keepalive = false } = {}) {
    const context = this.#current;
    if (context && keepalive) this.#requestKeepalive(context);
    if (this.#stopPromise) return this.#stopPromise;
    this.#generation += 1;
    if (context) context.cancelled = true;
    const run = (async () => {
      if (context) await this.#cleanupContext(context);
      if (this.#current === context) this.#current = null;
      this.#setState('stopped');
    })();
    const tracked = run.finally(() => {
      if (this.#stopPromise === tracked) this.#stopPromise = null;
    });
    this.#stopPromise = tracked;
    return tracked;
  }

  #sendDelete(session, keepalive) {
    try {
      return Promise.resolve(this.#fetch(
        sessionUrl(this.#origin, `/${encodeURIComponent(session.sessionId)}`),
        { method: 'DELETE', keepalive }
      )).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }

  #requestKeepalive(context) {
    if (context.keepaliveRequested) return;
    context.keepaliveRequested = true;
    const record = context.deleteRecord;
    if (!record || record.keepaliveSent) return;
    record.keepaliveSent = true;
    void this.#sendDelete(record.session, true);
  }

  #cleanupContext(context) {
    this.#clearTimeout(context.expiryTimer);
    context.expiryTimer = null;
    const session = context.session;
    const engine = context.engine;
    context.session = null;
    context.engine = null;
    if (!session && !engine) return context.cleanupPromise || Promise.resolve();

    const run = (async () => {
      this.#disconnects = 0;
      try {
        if (session) {
          const keepalive = context.keepaliveRequested;
          context.deleteRecord = { session, keepaliveSent: keepalive };
          const deletion = this.#sendDelete(session, keepalive);
          if (!keepalive) await settleWithin(deletion, this.#deleteTimeoutMs);
        }
      } finally {
        if (engine) {
          await engine.leaveRoom().catch(() => {});
          await engine.stopAudioCapture().catch(() => {});
          try {
            this.#rtc.destroyEngine(engine);
          } catch {}
        }
      }
    })();

    const combined = context.cleanupPromise
      ? Promise.allSettled([context.cleanupPromise, run]).then(() => {})
      : run;
    const tracked = combined.finally(() => {
      if (context.cleanupPromise === tracked) context.cleanupPromise = null;
    });
    context.cleanupPromise = tracked;
    return tracked;
  }
}

export function bindRtcLifecycle(controller, target = window) {
  let started = false;
  const cleanup = () => {
    if (started) return;
    started = true;
    void controller.stop({ keepalive: true });
  };
  target.addEventListener('pagehide', cleanup);
  target.addEventListener('beforeunload', cleanup);
  return () => {
    target.removeEventListener('pagehide', cleanup);
    target.removeEventListener('beforeunload', cleanup);
  };
}

const STATE_LABELS = {
  idle: 'JARVIS 已就绪',
  permission: '正在请求麦克风权限…',
  preparing: '正在准备实时语音…',
  joining: '正在连接 JARVIS…',
  starting: '正在唤醒 JARVIS…',
  listening: '正在聆听，可以直接说话',
  speaking: 'JARVIS 正在回复，开口即可打断',
  stopped: '语音对话已结束',
  error: '实时语音暂不可用'
};

export function bootRtcVoice({ root = document, rtc, requestPermission } = {}) {
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

  const endpoint = dock.dataset.voiceEndpoint?.trim();
  if (!endpoint) {
    button.addEventListener('click', () => showMessage('assistant', '实时语音服务尚未配置。'));
    return null;
  }

  const controller = new RtcVoiceController({
    endpoint,
    rtc,
    requestPermission,
    music: {
      pause() {
        const musicButton = root.querySelector('.music-btn');
        if (musicButton?.getAttribute('aria-pressed') === 'true') musicButton.click();
      }
    },
    onState(state) {
      dock.dataset.voiceState = state;
      status.textContent = STATE_LABELS[state];
      const active = ACTIVE_STATES.has(state);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? '结束实时语音对话' : '开始实时语音对话');
    },
    onTranscript: value => showMessage(value.speaker, value.text),
    onError: error => showMessage('assistant', error.message)
  });

  button.addEventListener('click', () => {
    const action = ACTIVE_STATES.has(controller.state) ? controller.stop() : controller.start();
    action.catch(() => {});
  });
  const explainTextOnly = () => {
    if (input.value.trim()) showMessage('assistant', 'RTC 实时对话请直接说话，当前不发送文字。');
  };
  send.addEventListener('click', explainTextOnly);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      explainTextOnly();
    }
  });
  bindRtcLifecycle(controller, root.defaultView);
  return controller;
}
