import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { isAllowedOrigin, loadRtcConfig } from './config.mjs';
import { createRtcOpenApi } from './rtc-openapi.mjs';
import { createRtcSessionStore } from './rtc-session-store.mjs';

const MAX_JSON_BYTES = 8 * 1024;

const json = (response, status, payload, origin) => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
};

const empty = (response, status, origin) => {
  const headers = { 'cache-control': 'no-store' };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  response.writeHead(status, headers);
  response.end();
};

const readBody = async request => {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    request.resume();
    const error = new Error('body_too_large');
    error.status = 413;
    throw error;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      const error = new Error('body_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const parseJsonBody = body => {
  if (body.length === 0) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.status = 400;
    throw error;
  }
};

const pathSessionId = pathname => {
  const match = /^\/rtc\/session\/([^/]+)(?:\/start)?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

export function createVoiceServer({
  config,
  rtcApi = createRtcOpenApi({ config }),
  tokenFactory,
  setTimeoutFn,
  clearTimeoutFn
}) {
  let store;
  const stopSession = sessionId => store.stop(
    sessionId,
    rtcApi.stopVoiceChat?.bind(rtcApi) || (async () => {})
  );
  store = createRtcSessionStore({
    config,
    tokenFactory,
    setTimeoutFn,
    clearTimeoutFn,
    onExpire: stopSession
  });

  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === '/healthz') {
      json(response, 200, { ok: true });
      return;
    }

    if (!pathname.startsWith('/rtc/session')) {
      json(response, 404, { error: 'not_found' });
      return;
    }

    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, config.allowedOrigins)) {
      json(response, 403, { error: 'origin_not_allowed' });
      return;
    }
    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      json(response, error.status || 400, { error: error.message }, origin);
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'cache-control': 'no-store',
        vary: 'Origin'
      });
      response.end();
      return;
    }

    if (request.method === 'POST') {
      try {
        parseJsonBody(body);
      } catch (error) {
        json(response, error.status || 400, { error: error.message }, origin);
        return;
      }
    }

    if (request.method === 'POST' && pathname === '/rtc/session') {
      let session;
      try {
        session = store.create(request.socket.remoteAddress || 'unknown');
      } catch {
        json(response, 500, { error: 'session_unavailable' }, origin);
        return;
      }
      if (!session) {
        json(response, 429, { error: 'session_limit' }, origin);
        return;
      }
      json(response, 201, store.public(session), origin);
      return;
    }

    const sessionId = pathSessionId(pathname);
    if (request.method === 'POST' && sessionId && pathname.endsWith('/start')) {
      try {
        const session = await store.start(sessionId, rtcApi.startVoiceChat.bind(rtcApi));
        if (!session) {
          json(response, 404, { error: 'session_not_found' }, origin);
          return;
        }
        json(response, 200, { sessionId, state: 'started' }, origin);
      } catch (error) {
        json(response, 502, { error: error.code || 'RTC_UPSTREAM' }, origin);
      }
      return;
    }

    if (request.method === 'DELETE' && sessionId && pathname === `/rtc/session/${encodeURIComponent(sessionId)}`) {
      try {
        await stopSession(sessionId);
        empty(response, 204, origin);
      } catch (error) {
        json(response, 502, { error: error.code || 'RTC_UPSTREAM' }, origin);
      }
      return;
    }

    json(response, 404, { error: 'not_found' }, origin);
  });

  // WebSocket voice transport remains in the repository for its later migration,
  // but this HTTP-only phase never accepts an upgrade.
  server.on('upgrade', (_request, socket) => {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
  });

  return {
    server,
    close(callback) {
      Promise.all(store.sessionIds().map(sessionId => stopSession(sessionId).catch(() => {})))
        .finally(() => server.close(callback));
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadRtcConfig();
  const app = createVoiceServer({ config });
  app.server.listen(config.port || 8787, '0.0.0.0', () => {
    console.log('JARVIS RTC session API listening');
  });
}
