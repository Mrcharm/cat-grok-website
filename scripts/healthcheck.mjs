#!/usr/bin/env node
// 站点巡检：用本机 Chrome + CDP 驱动真实浏览器，检查四类健康项。
//
//   1. 页面可达与产物一致   四个页面能加载；生成产物与 data/*.json 同步
//   2. 音乐保活            导航/点击不得重建 #background-music-frame（历史 bug 回归）
//   3. 模块切换            SPA 导航真的换掉 <main>，且不整页刷新
//   4. 语音中继            中继 HTTP 可达 + WebSocket 协议握手成功
//
// 用法：
//   node scripts/healthcheck.mjs                     # 检查本地 build 产物（起临时静态服务）
//   node scripts/healthcheck.mjs --online            # 检查线上 https://mrcharm.github.io/cat-grok-website/
//   node scripts/healthcheck.mjs --url <URL>         # 检查任意已部署地址
//   node scripts/healthcheck.mjs --no-report         # 不写报告文件
//
// 退出码：0 = 全部通过；1 = 有 FAIL；2 = 脚本自身故障（此时结论不可信）。

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import https from 'node:https';
import WebSocket from 'ws';

// 按协议选 http/https 模块
const httpGet = url => new Promise((resolve, reject) => {
  const client = url.startsWith('https:') ? https : http;
  const req = client.get(url, { timeout: 90000 }, res => {
    let d = ''; res.on('data', c => (d += c));
    res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 200) }));
  });
  req.on('timeout', () => { req.destroy(new Error('timeout')); });
  req.on('error', reject);
});

const REPO = resolve(import.meta.dirname, '..');
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const DEFAULT_ONLINE = 'https://mrcharm.github.io/cat-grok-website/';
const RELAY = 'https://jarvis-doubao-voice.onrender.com';
const PAGES = [
  { path: '', route: 'home', h1: null },
  { path: 'articles/', route: 'articles', h1: '技术文章' },
  { path: 'skills/', route: 'skills', h1: '技能库' },
  { path: 'portfolio/', route: 'portfolio', h1: '作品集' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const argOf = name => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

// ---------- 静态服务（本地模式用，支持 Range，避免视频/音频表现失真） ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.zip': 'application/zip'
};

async function startStaticServer(root = REPO) {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = join(root, rel);
      if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end('not found'); return; }
      const body = await readFile(file);
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'content-length': body.length });
      res.end(body);
    } catch (error) {
      res.writeHead(500).end(String(error.message));
    }
  });
  server.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  return { server, port: server.address().port };
}

// ---------- CDP ----------
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.handlers = new Map();
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else if (msg.method) (this.handlers.get(msg.method) || []).forEach(fn => fn(msg.params));
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 64e6 });
    await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
    return new CDP(ws);
  }
  on(m, fn) { if (!this.handlers.has(m)) this.handlers.set(m, []); this.handlers.get(m).push(fn); }
  once(m) { return new Promise(r => this.on(m, r)); }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 30000);
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

// 注入探针：用 expando 属性判断背景音乐元素是否被替换（cloneNode 不复制 expando），
// 这也是历史教训 —— dataset 会被 cloneNode(false) 一起复制，导致误判「没被换」。
const INSTRUMENT = `(() => {
  window.__hc = [];
  const stamp = (kind, extra) => window.__hc.push(Object.assign({ t: Math.round(performance.now()), kind }, extra || {}));
  window.__hcNav = { pushState: 0, replaceState: 0, popstate: 0, mainReplaced: 0 };
  for (const name of ['pushState', 'replaceState']) {
    const orig = history[name].bind(history);
    history[name] = function (...args) { window.__hcNav[name] += 1; stamp('nav:' + name, { url: String(args[2] || '') }); return orig(...args); };
  }
  const main = document.querySelector('main');
  if (main) {
    window.__hcMain = main;
    // SPA 导航走 main.replaceWith(newMain)，整个 <main> 节点被换掉，
    // 所以必须监听父节点的 childList，挂在 main 自己身上永远看不到。
    const host = main.parentElement || document.body;
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes || []) if (n.tagName === 'MAIN') { window.__hcNav.mainReplaced += 1; stamp('main-replaced'); }
        for (const n of m.removedNodes || []) if (n.tagName === 'MAIN') { window.__hcNav.mainReplaced += 1; stamp('main-removed'); }
      }
    });
    mo.observe(host, { childList: true });
  }
  const frame = document.querySelector('#background-music-frame');
  if (frame) frame.__hcOriginal = true;
  const frameMo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') stamp('music-src-set', { src: String(m.target.getAttribute('src') || '').slice(0, 40) });
      for (const n of m.addedNodes || []) if (n.id === 'background-music-frame') stamp('music-added');
      for (const n of m.removedNodes || []) if (n.id === 'background-music-frame') stamp('music-removed');
    }
  });
  frameMo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  return {
    ok: true,
    hasFrame: !!frame,
    musicTag: frame ? frame.tagName : null,
    musicAutoplay: frame ? frame.hasAttribute('autoplay') : false,
    musicSrc: frame ? String(frame.getAttribute('src') || '') : null
  };
})()`;

const SNAPSHOT = `({
  path: location.pathname,
  h1: (document.querySelector('main h1') || {}).textContent ? document.querySelector('main h1').textContent.trim() : null,
  mainSameNode: document.querySelector('main') === window.__hcMain,
  frameExists: !!document.querySelector('#background-music-frame'),
  frameSameNode: (() => { const f = document.querySelector('#background-music-frame'); return f ? f.__hcOriginal === true : 'MISSING'; })(),
  frameSrc: (() => { const f = document.querySelector('#background-music-frame'); return f ? String(f.getAttribute('src') || '').slice(0, 34) : null; })(),
  title: document.title
})`;

async function launchChrome(port) {
  const chromePath = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!chromePath) throw new Error('未找到 Chrome，可检查 CHROME_CANDIDATES');
  const userDataDir = join(tmpdir(), 'jarvis-health-' + Date.now());
  const child = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { await getJSON(`http://127.0.0.1:${port}/json/version`); return { child, chromePath }; }
    catch { await sleep(250); }
  }
  child.kill();
  throw new Error('Chrome 未在 20s 内就绪');
}

// ---------- 四项检查 ----------

// 1) 四页可达 + 产物与数据源一致
async function checkPagesAndBuild(cdp) {
  const findings = [];
  const pages = [];
  for (const page of PAGES) {
    const url = new URL(page.path, cdp.baseUrl).href;
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    try { await Promise.race([loaded, sleep(15000)]); } catch {}
    await sleep(700);
    const snap = await cdp.eval(SNAPSHOT);
    const ok = snap && snap.title && (page.h1 === null || snap.h1 === page.h1);
    pages.push({ name: page.path || '(首页)', url, title: snap?.title, h1: snap?.h1, ok });
    if (!ok) findings.push({ severity: 'FAIL', check: 'page', detail: `${page.path || '首页'} 未正确渲染（期望 h1=${page.h1}，实得 ${snap?.h1}）` });
  }

  // 产物一致性：buildSite({write:false}) 的结果应与磁盘上的产物逐字节一致
  let build = { consistent: true, diffs: [] };
  if (process.argv.includes('--root')) {
    build = { consistent: null, diffs: [], error: '--root 模式下不比对产物（副本的 data/ 未必对应）' };
  } else try {
    const mod = await import(new URL('./build.mjs', import.meta.url).href);
    if (typeof mod.buildSite === 'function') {
      const files = await mod.buildSite({ write: false });
      for (const [name, content] of files) {
        let current = '';
        try { current = await readFile(join(REPO, name), 'utf8'); } catch {}
        if (current !== content) build.diffs.push(name);
      }
      build.consistent = build.diffs.length === 0;
    }
  } catch (error) {
    build = { consistent: null, diffs: [], error: String(error.message) };
  }
  if (build.consistent === false) {
    findings.push({ severity: 'FAIL', check: 'build', detail: `生成产物与 data/*.json 不同步：${build.diffs.join(', ')}`, fix: '跑 pnpm build 重新生成' });
  }

  // 线上部署一致性：抓线上 HTML，与本地 build 产物做「去缓存戳后」比对。
  // 只查关键指纹，不做整页 diff —— 线上可能有 CDN 注入或时间相关内容。
  let deploy = { checked: false };
  if (cdp.mode === 'remote' && !process.argv.includes('--root')) {
    try {
      const mod = await import(new URL('./build.mjs', import.meta.url).href);
      const files = await mod.buildSite({ write: false });
      const local = new Map(files);
      const probes = [];
      for (const name of ['index.html', 'articles/index.html', 'skills/index.html', 'portfolio/index.html']) {
        let remoteHtml = '';
        try {
          const res = await fetch(new URL(name, cdp.baseUrl).href, { cache: 'no-store' });
          remoteHtml = await res.text();
        } catch (error) {
          probes.push({ name, ok: false, reason: 'fetch 失败：' + error.message });
          continue;
        }
        const localHtml = local.get(name) || '';
        // 抽关键指纹：页面标题、主容器标记、脚本版本戳
        const fingerprint = html => ({
          title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '',
          module: (html.match(/data-page-module="([^"]*)"/) || [])[1] || '',
          siteJs: (html.match(/assets\/js\/site\.js\?v=([0-9a-z]+)/) || [])[1] || '',
          css: (html.match(/assets\/styles\/site\.css\?v=([0-9a-z]+)/) || [])[1] || ''
        });
        const lf = fingerprint(localHtml), rf = fingerprint(remoteHtml);
        const mismatch = Object.keys(lf).filter(k => lf[k] !== rf[k]);
        probes.push({ name, ok: mismatch.length === 0, local: lf, remote: rf, mismatch });
        if (mismatch.length) {
          findings.push({
            severity: 'FAIL', check: 'deploy',
            detail: `线上 ${name} 与本地构建不一致（字段：${mismatch.join(', ')}）：线上 ${JSON.stringify(rf)} vs 本地 ${JSON.stringify(lf)}`,
            fix: '线上部署落后。检查 push 是否成功、GitHub Pages 是否构建完成；确认后重新 push 或等 Pages 完成'
          });
        }
      }
      deploy = { checked: true, probes };
    } catch (error) {
      deploy = { checked: false, error: String(error.message) };
    }
  }
  return { pages, build, deploy, findings };
}

// 2)+3) 音乐保活 与 模块切换（同一次点击序列里同时观测）
async function checkMusicAndNavigation(cdp) {
  const findings = [];
  const steps = [];
  await cdp.send('Page.navigate', { url: cdp.baseUrl });
  await sleep(1800);
  const inst = await cdp.eval(INSTRUMENT);
  if (!inst?.hasFrame) findings.push({ severity: 'FAIL', check: 'music', detail: '首页找不到背景音乐元素 #background-music-frame' });
  if (inst?.hasFrame && inst.musicTag !== 'AUDIO') {
    findings.push({ severity: 'FAIL', check: 'music', detail: `背景音乐应为自托管 <audio>，实际是 <${inst.musicTag}>`, fix: 'layout.mjs 的 persistentShell() 输出 <audio src="...assets/music/want-part2.mp3">' });
  }
  if (inst?.hasFrame && !inst.musicAutoplay) {
    findings.push({ severity: 'WARN', check: 'music', detail: '背景音乐缺少 autoplay，进站不会自己起播', fix: '给 <audio> 加 autoplay 属性' });
  }
  if (inst?.musicSrc && !/assets\/music\//.test(inst.musicSrc)) {
    findings.push({ severity: 'WARN', check: 'music', detail: `背景音乐未指向自托管音频：${inst.musicSrc}`, fix: 'src 应指向 assets/music/want-part2.mp3' });
  }

  const pointOf = sel => cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  const clickAt = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(40);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };

  // 导航是 SPA 的：除音乐按钮外，任何点击都不该动音乐元素
  const cases = [
    { name: '导航 → 文章', sel: '#site-nav a[data-route="articles"]', expectNav: true, expectFrameTouch: false },
    { name: '导航 → 技能', sel: '#site-nav a[data-route="skills"]', expectNav: true, expectFrameTouch: false },
    { name: '导航 → 作品集', sel: '#site-nav a[data-route="portfolio"]', expectNav: true, expectFrameTouch: false },
    { name: '音乐按钮（主动停止，允许动音乐元素）', sel: '.music-btn', expectNav: false, expectFrameTouch: true }
  ];

  for (const c of cases) {
    await cdp.eval('window.__hc = []; window.__hcNav.mainReplaced = 0; window.__hcNav.pushState = 0;');
    const pt = await pointOf(c.sel);
    if (!pt) { steps.push({ name: c.name, skipped: 'element not found' }); findings.push({ severity: 'FAIL', check: 'dom', detail: `找不到元素 ${c.sel}` }); continue; }
    const before = await cdp.eval(SNAPSHOT);
    await clickAt(pt.x, pt.y);
    await sleep(1300);
    const after = await cdp.eval(SNAPSHOT);
    const events = await cdp.eval('window.__hc');
    const nav = await cdp.eval('window.__hcNav');

    const frameTouched = (events || []).some(e => e.kind.startsWith('music-'));
    const navigated = before.path !== after.path;
    const mainReplaced = (nav?.mainReplaced || 0) > 0;
    const step = { name: c.name, from: before.path, to: after.path, frameTouched, navigated, mainReplaced, events };
    steps.push(step);

    if (!c.expectFrameTouch && frameTouched) {
      findings.push({ severity: 'FAIL', check: 'music', detail: `「${c.name}」重建了背景音乐元素 —— 会打断正在播的歌`, fix: '检查 assets/js/site.js 的 createMusicController，任何点击都不该重建/替换音乐元素' });
    }
    if (c.expectNav && !navigated) {
      findings.push({ severity: 'FAIL', check: 'nav', detail: `「${c.name}」点击后 URL 未变化（SPA 导航静默失效）`, fix: '检查 site.js 的 navigate()，AbortError 分支会静默 return false' });
    }
    if (c.expectNav && navigated && !mainReplaced) {
      findings.push({ severity: 'WARN', check: 'nav', detail: `「${c.name}」URL 变了但 <main> 未替换，可能是整页刷新（会重建音乐元素）` });
    }
  }

  const frameAlive = steps.filter(s => !s.expectFrameTouch && !s.skipped).every(s => s.frameSameNode !== false && !s.frameTouched);
  return { steps, frameAlive, findings };
}

// 4) 语音中继：HTTP 可达 + WebSocket 协议握手
async function checkVoiceRelay() {
  const findings = [];
  const result = { url: RELAY, http: null, handshake: null, latencyMs: null };

  const t0 = Date.now();
  try {
    const health = await httpGet(RELAY + '/healthz');
    result.latencyMs = Date.now() - t0;
    result.http = health;
    if (health.status !== 200) findings.push({ severity: 'FAIL', check: 'voice', detail: `中继 /healthz 返回 ${health.status}` });
    if (result.latencyMs > 5000) {
      findings.push({ severity: 'WARN', check: 'voice', detail: `中继响应 ${result.latencyMs}ms，超过 5s（Render 免费实例冷启动约 32s）`, fix: '这是已知的冷启动现象，非缺陷。确认 server/keep-alive.mjs 的保活是否在运行（Render 环境变量 RENDER_EXTERNAL_URL 是否注入）' });
    }
  } catch (error) {
    result.http = { error: String(error.message) };
    findings.push({ severity: 'FAIL', check: 'voice', detail: `中继 /healthz 不可达：${error.message}`, fix: '检查 Render 服务是否 Running；Free 实例休眠时首个请求需 ~32s' });
  }

  // 协议握手：连上 /voice，确认收到 session.created
  try {
    const ws = new WebSocket(RELAY.replace(/^https/, 'wss') + '/voice', { origin: 'https://mrcharm.github.io', handshakeTimeout: 30000 });
    const handshake = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('握手超时 30s')), 30000);
      ws.once('message', raw => {
        clearTimeout(timer);
        try { resolve(JSON.parse(raw.toString())); } catch (e) { reject(new Error('首个消息非 JSON')); }
      });
      ws.once('error', e => { clearTimeout(timer); reject(e); });
    });
    ws.close();
    result.handshake = { type: handshake.type, model: handshake.session?.model };
    if (handshake.type !== 'session.created') {
      findings.push({ severity: 'FAIL', check: 'voice', detail: `握手首个事件是 ${handshake.type}，期望 session.created` });
    }
  } catch (error) {
    result.handshake = { error: String(error.message) };
    findings.push({ severity: 'FAIL', check: 'voice', detail: `WebSocket 握手失败：${error.message}` });
  }

  findings.push({
    severity: 'INFO', check: 'voice',
    detail: '本次只验证中继可达与协议握手；回答内容正确性需手动跑 node scripts/verify-live-voice.mjs（要 API Key，不能进自动化）'
  });
  return { ...result, findings };
}

// ---------- 报告 ----------
function renderReport(run) {
  const icon = s => (s === 'PASS' ? '✅' : s === 'FAIL' ? '❌' : s === 'WARN' ? '⚠️' : 'ℹ️');
  const L = [];
  L.push('# JARVIS 站点巡检报告', '');
  L.push(`- 时间：${run.startedAt}`);
  L.push(`- 目标：${run.target}${run.mode === 'local' ? '（本地 build 产物）' : '（线上）'}`);
  L.push(`- 结论：**${run.status}**（${run.summary.pass} 通过 / ${run.summary.fail} 失败 / ${run.summary.warn} 警告）`);
  L.push(`- 耗时：${run.durationMs}ms`, '');
  for (const section of run.sections) {
    L.push(`## ${icon(section.status)} ${section.title}`, '');
    for (const line of section.lines) L.push('- ' + line);
    L.push('');
  }
  const actionable = run.findings.filter(f => f.severity === 'FAIL' || f.severity === 'WARN');
  L.push('## 待处理项', '');
  if (!actionable.length) L.push('无。', '');
  else for (const f of actionable) {
    L.push(`- ${icon(f.severity)} **[${f.check}]** ${f.detail}`);
    if (f.fix) L.push(`  - 修复建议：${f.fix}`);
  }
  return L.join('\n') + '\n';
}

// ---------- 主流程 ----------
async function main() {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const online = process.argv.includes('--online');
  const explicit = argOf('--url');
  const rootArg = argOf('--root');
  const writeReport = !process.argv.includes('--no-report');
  const root = rootArg ? resolve(rootArg) : REPO;

  let staticSrv = null;
  let target, mode;
  if (explicit) { target = explicit; mode = 'remote'; }
  else if (online) { target = DEFAULT_ONLINE; mode = 'remote'; }
  else { staticSrv = await startStaticServer(root); target = `http://127.0.0.1:${staticSrv.port}/`; mode = 'local'; }

  const findings = [];
  const sections = [];
  let chrome = null, cdp = null, fatal = null;

  try {
    const port = 9350 + Math.floor(Math.random() * 100);
    const launched = await launchChrome(port);
    chrome = launched.child;
    const list = await getJSON(`http://127.0.0.1:${port}/json/list`);
    const wsUrl = (list.find(t => t.type === 'page') || list[0]).webSocketDebuggerUrl;
    cdp = await CDP.connect(wsUrl);
    cdp.baseUrl = target;
    cdp.mode = mode;
    cdp.eval = async expr => {
      try {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        return r.exceptionDetails ? { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text } : r.result.value;
      } catch (e) { return { __cdpError: String(e.message) }; }
    };
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const pages = await checkPagesAndBuild(cdp);
    findings.push(...pages.findings);
    sections.push({
      title: '页面可达与产物一致',
      status: pages.findings.some(f => f.severity === 'FAIL') ? 'FAIL' : 'PASS',
      lines: [
        ...pages.pages.map(p => `${p.ok ? '✅' : '❌'} ${p.name} → \`${p.url}\`（h1: ${p.h1 ?? '—'}）`),
        pages.build.consistent === true ? '✅ 生成产物与 data/*.json 一致'
          : pages.build.consistent === false ? `❌ 产物不同步：${pages.build.diffs.join(', ')}`
          : `ℹ️ 产物一致性检查跳过（${pages.build.error}）`,
        ...(pages.deploy.checked
          ? pages.deploy.probes.map(p => p.ok
            ? `✅ 线上 ${p.name} 与本地构建一致`
            : `❌ 线上 ${p.name} 落后于本地构建（差异字段：${(p.mismatch || []).join(', ')}）`)
          : mode === 'remote' ? [`ℹ️ 线上部署一致性未检查（${pages.deploy.error || '需要本地构建产物对比'}）`] : [])
      ]
    });

    const mn = await checkMusicAndNavigation(cdp);
    findings.push(...mn.findings);
    sections.push({
      title: '音乐保活与模块切换',
      status: mn.findings.some(f => f.severity === 'FAIL') ? 'FAIL' : 'PASS',
      lines: mn.steps.map(s => s.skipped
        ? `⚠️ ${s.name}：${s.skipped}`
        : `${s.frameTouched && !s.name.includes('音乐按钮') ? '❌' : '✅'} ${s.name}｜路径 ${s.from} → ${s.to}｜音乐元素被重建：${s.frameTouched ? '是' : '否'}｜<main> 被替换：${s.mainReplaced ? '是' : '否'}`)
    });

    const voice = await checkVoiceRelay();
    findings.push(...voice.findings);
    sections.push({
      title: '语音中继',
      status: voice.findings.some(f => f.severity === 'FAIL') ? 'FAIL' : 'PASS',
      lines: [
        voice.http?.error ? `❌ /healthz 不可达：${voice.http.error}` : `✅ /healthz ${voice.http.status}（${voice.latencyMs}ms）`,
        voice.handshake?.error ? `❌ 握手失败：${voice.handshake.error}` : `✅ 协议握手 session.created（model ${voice.handshake.model}）`
      ]
    });
  } catch (error) {
    fatal = String(error.stack || error.message || error);
    findings.push({ severity: 'FAIL', check: 'harness', detail: '巡检脚本自身故障，本轮结论不可信：' + fatal });
  } finally {
    if (cdp) cdp.close();
    if (chrome) { try { chrome.kill(); } catch {} }
    if (staticSrv) staticSrv.server.close();
  }

  const summary = {
    pass: sections.filter(s => s.status === 'PASS').length,
    fail: findings.filter(f => f.severity === 'FAIL').length,
    warn: findings.filter(f => f.severity === 'WARN').length
  };
  const run = {
    startedAt, target, mode, durationMs: Date.now() - t0,
    status: summary.fail ? 'FAIL' : summary.warn ? 'WARN' : 'PASS',
    summary, sections, findings, fatal
  };

  if (writeReport) {
    const dir = join(REPO, '.workbuddy', 'healthcheck');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'latest.json'), JSON.stringify(run, null, 2) + '\n', 'utf8');
    await writeFile(join(dir, 'latest.md'), renderReport(run), 'utf8');
  }

  console.log(renderReport(run));
  process.exitCode = fatal ? 2 : (summary.fail ? 1 : 0);
}

main().catch(error => {
  console.error('healthcheck 崩溃：', error);
  process.exit(2);
});
