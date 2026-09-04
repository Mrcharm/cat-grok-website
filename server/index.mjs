import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, isAllowedOrigin } from './config.mjs';
import { createDoubaoSession } from './doubao-session.mjs';

const sendJson = (socket, message) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

const publicError = (socket, code, message) => sendJson(socket, {
  type: 'server.error',
  code,
  message
});

export function createVoiceServer({ config, upstreamFactory = createDoubaoSession }) {
  const connectionsByIp = new Map();
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/voice' || !isAllowedOrigin(origin, config.allowedOrigins)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const ip = request.socket.remoteAddress || 'unknown';
    const active = connectionsByIp.get(ip) || 0;
    if (active >= config.maxConnectionsPerIp) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    connectionsByIp.set(ip, active + 1);
    wss.handleUpgrade(request, socket, head, client => {
      wss.emit('connection', client, request, ip);
    });
  });

  wss.on('connection', (client, _request, ip) => {
    let upstream;
    let starting = false;
    let cleaned = false;
    const timeout = setTimeout(() => client.close(1000, 'session_limit'), config.maxSessionMs);

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeout);
      upstream?.close();
      const active = connectionsByIp.get(ip) || 1;
      if (active <= 1) connectionsByIp.delete(ip);
      else connectionsByIp.set(ip, active - 1);
    };

    client.on('close', cleanup);
    client.on('error', cleanup);
    client.on('message', async (data, isBinary) => {
      if (isBinary) {
        if (!upstream?.ready) {
          publicError(client, 'SESSION_NOT_READY', '实时语音尚未连接，请稍候。');
          return;
        }
        upstream.sendAudio(Buffer.from(data));
        return;
      }

      let message;
      try {
        message = JSON.parse(data.toString('utf8'));
      } catch {
        publicError(client, 'INVALID_MESSAGE', '无法识别客户端消息。');
        return;
      }

      if (message.type === 'client.stop') {
        cleanup();
        client.close(1000, 'client_stop');
        return;
      }
      if (message.type === 'client.text') {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        if (!upstream?.ready) {
          publicError(client, 'SESSION_NOT_READY', '实时语音尚未连接，请稍候。');
        } else if (!text || text.length > 300) {
          publicError(client, 'INVALID_TEXT', '文字内容必须为 1 至 300 个字符。');
        } else {
          upstream.sendText(text);
        }
        return;
      }
      if (message.type !== 'client.start' || upstream || starting) {
        publicError(client, 'INVALID_STATE', '当前会话状态不接受该操作。');
        return;
      }

      starting = true;
      try {
        upstream = await upstreamFactory({ config });
        upstream.on('ready', () => sendJson(client, { type: 'server.ready' }));
        upstream.on('transcript', transcript => sendJson(client, {
          type: 'server.transcript',
          ...transcript
        }));
        upstream.on('audio', pcm => {
          if (client.readyState === WebSocket.OPEN) client.send(pcm, { binary: true });
        });
        upstream.on('interrupted', () => sendJson(client, {
          type: 'server.state',
          state: 'interrupted'
        }));
        upstream.on('turn-complete', () => sendJson(client, {
          type: 'server.state',
          state: 'listening'
        }));
        upstream.on('safe-error', error => publicError(client, error.code, error.message));
        upstream.on('closed', () => sendJson(client, {
          type: 'server.state',
          state: 'closed'
        }));
      } catch {
        publicError(client, 'UPSTREAM_CONNECTION_FAILED', '实时语音服务连接失败，请稍后重试。');
      } finally {
        starting = false;
      }
    });
  });

  return {
    server,
    close(callback) {
      for (const client of wss.clients) client.terminate();
      wss.close(() => server.close(callback));
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const app = createVoiceServer({ config });
  app.server.listen(config.port, '0.0.0.0', () => {
    console.log(`JARVIS realtime voice proxy listening on port ${config.port}`);
  });
}
