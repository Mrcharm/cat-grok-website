import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import { isAllowedOrigin, loadVoiceConfig } from './config.mjs';

const MAX_MESSAGE_BYTES = 128 * 1024;
const MAX_BUFFERED_BYTES = 256 * 1024;
const PCM_FRAME_BYTES = 640;
const GREETING = '你好，我是 JARVIS。语音连接成功。';

const SESSION_CREATE = Object.freeze({
  type: 'session.create',
  session: {
    model: '1.2.6.1',
    instructions: '你是 JARVIS，猫哥的中文 AI 语音陪伴助手。回答自然、简洁、真诚。不要使用工具、联网、位置、音乐或录音能力。',
    audio: {
      input: { format: { type: 'pcm', sample_rate: 16000 } },
      output: {
        format: { type: 'pcm', sample_rate: 24000 },
        voice: 'zh_male_yunzhou_jupiter_bigtts',
        speed: 0,
        loudness: 0
      }
    },
    tools: []
  },
  extension: { extra: { enable_proactive_speak: false } }
});

const writeHttpError = (socket, status, label) => {
  socket.write(`HTTP/1.1 ${status} ${label}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
};

const publicError = (socket, code, message) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'error', error: { code, message } }));
};

const parseClientMessage = data => {
  if (Buffer.byteLength(data) > MAX_MESSAGE_BYTES) throw new Error('MESSAGE_TOO_LARGE');
  let event;
  try {
    event = JSON.parse(data.toString());
  } catch {
    throw new Error('INVALID_MESSAGE');
  }
  if (event?.type === 'input_audio_buffer.append') {
    if (typeof event.audio !== 'string') throw new Error('INVALID_AUDIO');
    const audio = Buffer.from(event.audio, 'base64');
    if (audio.byteLength !== PCM_FRAME_BYTES || audio.toString('base64') !== event.audio) {
      throw new Error('INVALID_AUDIO');
    }
    return { type: event.type, audio: event.audio };
  }
  if (event?.type === 'input_audio_buffer.commit') return { type: event.type };
  if (event?.type === 'response.cancel') return { type: event.type };
  if (event?.type === 'speech_text_buffer.commit') {
    const text = typeof event.text === 'string' ? event.text.trim() : '';
    if (!text || text.length > 300) throw new Error('INVALID_TEXT');
    return { type: event.type, text };
  }
  throw new Error('UNSUPPORTED_MESSAGE');
};

export function createVoiceServer({ config }) {
  const sessions = new Set();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    if (request.method === 'GET' && pathname === '/healthz') {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404);
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/voice') return writeHttpError(socket, 404, 'Not Found');
    if (!isAllowedOrigin(request.headers.origin, config.allowedOrigins)) {
      return writeHttpError(socket, 403, 'Forbidden');
    }
    if (sessions.size >= config.maxConnections) {
      return writeHttpError(socket, 429, 'Too Many Requests');
    }
    wss.handleUpgrade(request, socket, head, browser => {
      wss.emit('connection', browser, request);
    });
  });

  wss.on('connection', browser => {
    const context = {
      browser,
      upstream: null,
      closing: false,
      browserClosed: false,
      upstreamClosed: false,
      timer: null,
      terminateTimer: null
    };
    sessions.add(context);
    const upstream = new WebSocket(config.upstreamUrl, {
      headers: {
        'X-Api-Key': config.apiKey,
        'X-Api-Connect-Id': randomUUID().replaceAll('-', '')
      },
      maxPayload: MAX_MESSAGE_BYTES,
      handshakeTimeout: 10000
    });
    context.upstream = upstream;

    const release = () => {
      if (!context.browserClosed || !context.upstreamClosed) return;
      clearTimeout(context.terminateTimer);
      sessions.delete(context);
    };
    const cleanup = (code = 1000, reason = 'closed') => {
      if (context.closing) return;
      context.closing = true;
      clearTimeout(context.timer);
      if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(browser.readyState)) browser.close(code, reason);
      if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(upstream.readyState)) upstream.close(code, reason);
      context.terminateTimer = setTimeout(() => {
        if (!context.browserClosed) browser.terminate();
        if (!context.upstreamClosed) upstream.terminate();
      }, 1000);
      context.terminateTimer.unref?.();
    };

    context.timer = setTimeout(() => cleanup(1000, 'session_timeout'), config.sessionTtlMs);
    context.timer.unref?.();

    upstream.on('open', () => upstream.send(JSON.stringify(SESSION_CREATE)));
    upstream.on('message', data => {
      let event;
      try {
        event = JSON.parse(data.toString());
      } catch {
        publicError(browser, 'UPSTREAM_PROTOCOL', '语音服务返回了无法处理的数据。');
        return cleanup(1011, 'upstream_protocol');
      }
      if (event?.type === 'error') {
        publicError(browser, 'UPSTREAM_ERROR', '语音服务暂不可用，请稍后重试。');
        return cleanup(1011, 'upstream_error');
      }
      if (browser.readyState === WebSocket.OPEN) {
        if (browser.bufferedAmount > MAX_BUFFERED_BYTES) return cleanup(1013, 'backpressure');
        browser.send(JSON.stringify(event));
      }
      if (event?.type === 'session.created' && upstream.readyState === WebSocket.OPEN) {
        upstream.send(JSON.stringify({ type: 'speech_text_buffer.commit', text: GREETING }));
      }
    });
    upstream.on('error', () => {
      publicError(browser, 'UPSTREAM_UNAVAILABLE', '暂时无法连接语音服务，请稍后重试。');
      cleanup(1011, 'upstream_unavailable');
    });
    upstream.on('close', () => {
      context.upstreamClosed = true;
      cleanup(1000, 'upstream_closed');
      release();
    });

    browser.on('message', data => {
      if (upstream.readyState !== WebSocket.OPEN) {
        publicError(browser, 'SESSION_NOT_READY', 'JARVIS 仍在连接，请稍等。');
        return;
      }
      if (upstream.bufferedAmount > MAX_BUFFERED_BYTES) return cleanup(1013, 'backpressure');
      try {
        upstream.send(JSON.stringify(parseClientMessage(data)));
      } catch (error) {
        publicError(browser, error.message, '语音数据无效，连接已结束。');
        cleanup(1008, 'invalid_message');
      }
    });
    browser.on('error', () => cleanup(1000, 'browser_error'));
    browser.on('close', () => {
      context.browserClosed = true;
      cleanup(1000, 'browser_closed');
      release();
    });
  });

  return {
    server,
    close(callback) {
      for (const context of [...sessions]) {
        context.browser.close(1001, 'server_shutdown');
        context.upstream?.close(1001, 'server_shutdown');
      }
      wss.close(() => server.close(callback));
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadVoiceConfig();
  const app = createVoiceServer({ config });
  app.server.listen(Number(process.env.PORT) || 8787, '0.0.0.0', () => {
    console.log('JARVIS Doubao realtime voice proxy listening');
  });
}
