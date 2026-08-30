import test from 'node:test';
import assert from 'node:assert/strict';
import { createSiteNavigator, initSiteNavigation, routeKey } from '../assets/js/site.js';

test('菜单按钮切换 aria-expanded 与导航打开状态', () => {
  const listeners = {};
  const button = {
    value: 'false',
    addEventListener(type, handler) { listeners[type] = handler; },
    getAttribute() { return this.value; },
    setAttribute(name, value) { if (name === 'aria-expanded') this.value = value; }
  };
  const nav = { dataset: {}, querySelectorAll() { return []; } };
  const root = { querySelector(selector) { return selector === '.menu-button' ? button : nav; } };

  initSiteNavigation(root, { addEventListener() {}, getComputedStyle() { return { display: 'block' }; } });
  listeners.click();

  assert.equal(button.value, 'true');
  assert.equal(nav.dataset.open, 'true');
});

test('识别根目录和 GitHub Pages 子目录的四个公开路由', () => {
  assert.equal(routeKey('https://example.test/'), 'home');
  assert.equal(routeKey('https://example.test/articles/'), 'articles');
  assert.equal(routeKey('https://example.test/cat-grok-website/skills/'), 'skills');
  assert.equal(routeKey('https://example.test/cat-grok-website/portfolio/'), 'portfolio');
  assert.equal(routeKey('https://example.test/action/'), null);
});

test('站内导航只渲染主体并保留公共外壳对象', async () => {
  const shell = { header: {}, frame: {}, main: { name: 'home' } };
  const history = [];
  const activated = [];
  const navigator = createSiteNavigator({
    location: { href: 'https://example.test/' },
    history: { pushState(state, _, href) { history.push({ state, href }); } },
    fetchImpl: async () => ({ ok: true, text: async () => '<html>articles</html>' }),
    parsePage: () => ({ main: { name: 'articles' }, title: '技术文章', route: 'articles' }),
    renderPage(page) { shell.main = page.main; },
    lifecycle: { deactivate() {}, activate(route) { activated.push(route); } },
    assign() { throw new Error('不应降级跳转'); }
  });

  const header = shell.header;
  const frame = shell.frame;
  assert.equal(await navigator.navigate('https://example.test/articles/'), true);

  assert.equal(shell.header, header);
  assert.equal(shell.frame, frame);
  assert.equal(shell.main.name, 'articles');
  assert.deepEqual(history[0].state, { path: '/articles/' });
  assert.deepEqual(activated, ['articles']);
});

test('目标获取失败时退回普通跳转', async () => {
  let assigned = '';
  const navigator = createSiteNavigator({
    location: { href: 'https://example.test/' },
    history: { pushState() {} },
    fetchImpl: async () => { throw new Error('offline'); },
    parsePage() {},
    renderPage() {},
    lifecycle: { deactivate() {}, activate() {} },
    assign(href) { assigned = href; }
  });

  assert.equal(await navigator.navigate('https://example.test/skills/'), false);
  assert.equal(assigned, 'https://example.test/skills/');
});

