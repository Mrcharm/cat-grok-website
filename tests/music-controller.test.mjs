import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicController } from '../assets/js/site.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function createMusicFixture() {
  const timers = [];
  const storageValues = new Map();
  const storage = {
    getItem(key) { return storageValues.get(key) ?? null; },
    setItem(key, value) { storageValues.set(key, value); },
    removeItem(key) { storageValues.delete(key); }
  };
  const panel = {
    classList: classList(['music-panel', 'open']),
    frame: null,
    querySelector(selector) { return selector === 'iframe' ? this.frame : null; }
  };
  const makeFrame = () => ({
    src: '',
    cloneNode() { return makeFrame(); },
    replaceWith(next) { panel.frame = next; }
  });
  panel.frame = makeFrame();
  const button = {
    attrs: new Map([['aria-expanded', 'true']]),
    addEventListener() {},
    removeEventListener() {},
    getAttribute(name) { return this.attrs.get(name); },
    setAttribute(name, value) { this.attrs.set(name, value); }
  };
  const unlock = { hidden: true, addEventListener() {}, removeEventListener() {} };
  const root = {
    querySelector(selector) {
      if (selector === '#music-panel') return panel;
      if (selector === '.music-btn') return button;
      if (selector === '.music-unlock') return unlock;
      return null;
    }
  };
  return {
    panel, button, unlock, storage,
    runTimer(ms) { timers.filter(item => item.ms === ms).forEach(item => item.fn()); },
    dependencies: {
      root,
      storage,
      schedule(fn, ms) { timers.push({ fn, ms }); return timers.length; },
      cancel() {}
    }
  };
}

test('首次加载立即使用指定歌单和 auto=1', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  assert.match(fixture.panel.frame.src, /id=885054268/);
  assert.match(fixture.panel.frame.src, /auto=1/);
  assert.equal(fixture.panel.classList.contains('open'), true);
});

test('1.5 秒后提供点击开启且不声称正在播放', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  fixture.runTimer(1500);
  assert.equal(fixture.unlock.hidden, false);
  assert.equal(String(fixture.button.textContent || '').includes('正在播放'), false);
});

test('用户点击开启时重建 iframe 并记录当前会话', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  const firstFrame = fixture.panel.frame;
  controller.unlock();
  assert.notEqual(fixture.panel.frame, firstFrame);
  assert.match(fixture.panel.frame.src, /auto=1/);
  assert.equal(fixture.storage.getItem('jarvis-music-unlocked'), '1');
  assert.equal(fixture.unlock.hidden, true);
});

test('用户关闭后当前会话不再强制打开', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  controller.toggle(false);
  assert.equal(fixture.storage.getItem('jarvis-music-muted'), '1');
  assert.equal(fixture.panel.classList.contains('open'), false);
  assert.equal(fixture.panel.frame.src, 'about:blank');
});

