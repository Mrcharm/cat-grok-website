const ACTIVE_STATES = new Set([
  'permission',
  'preparing',
  'joining',
  'starting',
  'listening',
  'speaking'
]);

const STOP_REQUESTED = Symbol('stop-requested');

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
  #disconnects = 0;
  #engine = null;
  #session = null;
  #startPromise = null;
  #stopPromise = null;
  #cleanupPromise = null;
  #stopRequested = false;

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
    maxDisconnects = 3
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
  }

  #setState(state) {
    this.state = state;
    this.#onState(state);
  }

  #ensureRunning() {
    if (this.#stopRequested) throw STOP_REQUESTED;
  }

  start() {
    if (ACTIVE_STATES.has(this.state)) return this.#startPromise || Promise.resolve();
    this.#stopRequested = false;
    const run = this.#start();
    const tracked = run.finally(() => {
      if (this.#startPromise === tracked) this.#startPromise = null;
    });
    this.#startPromise = tracked;
    return tracked;
  }

  async #start() {
    try {
      this.#music.pause();
      this.#setState('permission');
      const deviceId = await this.#requestPermission();
      this.#ensureRunning();

      this.#setState('preparing');
      const prepared = await expectResponse(await this.#fetch(sessionUrl(this.#origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      }));
      this.#session = await prepared.json();
      this.#ensureRunning();

      this.#engine = this.#rtc.createEngine(this.#session.appId, {
        autoPlayPolicy: this.#rtc.RTCAutoPlayPolicy.AUTO_PLAY
      });
      this.#bindEngineEvents();
      await this.#engine.startAudioCapture(deviceId || undefined);
      this.#ensureRunning();

      this.#setState('joining');
      await this.#engine.joinRoom(
        this.#session.token,
        this.#session.roomId,
        { userId: this.#session.userId },
        {
          isAutoPublish: true,
          isAutoSubscribeAudio: true,
          isAutoSubscribeVideo: false,
          roomProfileType: this.#rtc.RoomProfileType.chat
        }
      );
      this.#ensureRunning();

      this.#setState('starting');
      await expectResponse(await this.#fetch(
        sessionUrl(this.#origin, `/${encodeURIComponent(this.#session.sessionId)}/start`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        }
      ));
      this.#ensureRunning();
      this.#setState('listening');
    } catch (cause) {
      if (cause === STOP_REQUESTED) return;
      const error = this.state === 'permission' ? ERROR_MESSAGES.microphone : ERROR_MESSAGES.service;
      await this.#fail(error);
      throw cause;
    }
  }

  #bindEngineEvents() {
    const events = this.#rtc.events;
    this.#engine.on(events.onRemoteAudioFirstFrame, event => {
      if (event?.userId === this.#session?.botUserId) this.#setState('speaking');
    });
    this.#engine.on(events.onSubtitleMessageReceived, messages => {
      for (const message of messages || []) {
        if (!message?.text || !this.#session) continue;
        const speaker = message.userId === this.#session.userId ? 'user' : 'assistant';
        this.#onTranscript({ speaker, text: message.text, final: Boolean(message.definite) });
        this.#setState(speaker === 'assistant' ? 'speaking' : 'listening');
      }
    });
    this.#engine.on(events.onAutoplayFailed, event => {
      if (event?.kind === 'audio' && event.userId === this.#session?.botUserId) {
        void this.#fail(ERROR_MESSAGES.autoplay);
      }
    });
    this.#engine.on(events.onConnectionStateChanged, event => {
      const states = this.#rtc.ConnectionState;
      if ([states.CONNECTION_STATE_CONNECTED, states.CONNECTION_STATE_RECONNECTED].includes(event?.state)) {
        this.#disconnects = 0;
        return;
      }
      if (![states.CONNECTION_STATE_DISCONNECTED, states.CONNECTION_STATE_RECONNECTING, states.CONNECTION_STATE_LOST].includes(event?.state)) {
        return;
      }
      this.#disconnects += 1;
      if (this.#disconnects >= this.#maxDisconnects) void this.#fail(ERROR_MESSAGES.connection);
    });
  }

  async #fail(error) {
    if (this.state !== 'error') {
      this.#setState('error');
      this.#onError(error);
    }
    await this.#cleanup({ keepalive: false });
  }

  stop({ keepalive = false } = {}) {
    this.#stopRequested = true;
    if (this.#stopPromise) return this.#stopPromise;
    const run = (async () => {
      if (this.#startPromise) await this.#startPromise.catch(() => {});
      await this.#cleanup({ keepalive });
      this.#setState('stopped');
    })();
    const tracked = run.finally(() => {
      if (this.#stopPromise === tracked) this.#stopPromise = null;
    });
    this.#stopPromise = tracked;
    return tracked;
  }

  #cleanup({ keepalive }) {
    if (this.#cleanupPromise) return this.#cleanupPromise;
    const run = (async () => {
      const session = this.#session;
      const engine = this.#engine;
      this.#session = null;
      this.#engine = null;
      this.#disconnects = 0;

      if (session) {
        await this.#fetch(
          sessionUrl(this.#origin, `/${encodeURIComponent(session.sessionId)}`),
          { method: 'DELETE', keepalive }
        ).catch(() => {});
      }
      if (engine) {
        await engine.leaveRoom().catch(() => {});
        await engine.stopAudioCapture().catch(() => {});
        this.#rtc.destroyEngine(engine);
      }
    })();
    const tracked = run.finally(() => {
      if (this.#cleanupPromise === tracked) this.#cleanupPromise = null;
    });
    this.#cleanupPromise = tracked;
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
