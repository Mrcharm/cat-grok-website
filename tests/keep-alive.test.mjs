import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import {
  WARM_WINDOW,
  isWithinWarmWindow,
  resolveKeepAliveBaseUrl,
  startKeepAlive
} from '../server/keep-alive.mjs';

const atShanghaiHour = hour => new Date(Date.UTC(2026, 8, 12, (hour - 8 + 24) % 24, 0, 0));

test('keep-alive resolves the public url from the Render environment', () => {
  assert.equal(resolveKeepAliveBaseUrl({ KEEP_ALIVE_URL: 'https://explicit.example/' }), 'https://explicit.example');
  assert.equal(
    resolveKeepAliveBaseUrl({ KEEP_ALIVE_URL: 'https://explicit.example', RENDER_EXTERNAL_URL: 'https://render.example' }),
    'https://explicit.example'
  );
  assert.equal(resolveKeepAliveBaseUrl({ RENDER_EXTERNAL_URL: 'https://render.example/' }), 'https://render.example');
  assert.equal(resolveKeepAliveBaseUrl({ RENDER_EXTERNAL_HOSTNAME: 'render.example' }), 'https://render.example');
  assert.equal(resolveKeepAliveBaseUrl({}), '');
});

test('warm window only covers the advertised Shanghai hours', () => {
  assert.deepEqual({ ...WARM_WINDOW }, { startHour: 7, endHour: 24 });
  assert.equal(isWithinWarmWindow(atShanghaiHour(7)), true);
  assert.equal(isWithinWarmWindow(atShanghaiHour(23)), true);
  assert.equal(isWithinWarmWindow(atShanghaiHour(6)), false);
  assert.equal(isWithinWarmWindow(atShanghaiHour(0)), false);
});

test('keep-alive is skipped entirely when no public url is configured', () => {
  const lines = [];
  const handle = startKeepAlive({ baseUrl: '', log: line => lines.push(line) });
  assert.equal(handle, null);
  assert.match(lines.join('\n'), /disabled/);
});

test('keep-alive pings /healthz on the configured base url', async t => {
  const hits = [];
  const server = http.createServer((request, response) => {
    hits.push(request.url);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));

  const lines = [];
  let resolveLogged;
  const logged = new Promise(resolve => { resolveLogged = resolve; });
  const handle = startKeepAlive({
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    intervalMs: 60_000,
    window: { startHour: 0, endHour: 24 },
    log: line => {
      lines.push(line);
      if (line.includes('200')) resolveLogged();
    }
  });
  t.after(() => handle.stop());

  await logged;
  assert.deepEqual(hits, ['/healthz']);
  assert.match(lines.join('\n'), /\[keep-alive\] 200 .*\/healthz \d+ms/);
});

test('keep-alive stays quiet outside the warm window', async () => {
  const lines = [];
  const handle = startKeepAlive({
    baseUrl: 'https://never-called.invalid',
    intervalMs: 60_000,
    window: { startHour: 24, endHour: 24 },
    log: line => lines.push(line)
  });
  handle.stop();
  assert.match(lines.join('\n'), /outside warm window/);
});
