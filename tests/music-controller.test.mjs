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

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    dispatch(type) { listeners.get(type)?.({ type }); },
    has(type) { return listeners.has(type); }
  };
}

function createMusicFixture() {
  const interactionTarget = eventTarget();
  const buttonEvents = eventTarget();
  const button = {
    ...buttonEvents,
    attrs: new Map([['aria-pressed', 'true']]),
    classList: classList(['music-btn', 'playing']),
    getAttribute(name) { return this.attrs.get(name); },
    setAttribute(name, value) { this.attrs.set(name, value); }
  };
  const makeFrame = () => ({
    src: '',
    cloneNode() { return makeFrame(); },
    replaceWith(next) { root.frame = next; }
  });
  const root = {
    frame: makeFrame(),
    querySelector(selector) {
      if (selector === '#background-music-frame') return this.frame;
      if (selector === '.music-btn') return button;
      return null;
    }
  };
  return { root, button, interactionTarget, dependencies: { root, interactionTarget } };
}

test('首次加载立即尝试播放《鲜花》单曲', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  assert.match(fixture.root.frame.src, /type=2/);
  assert.match(fixture.root.frame.src, /id=2086327879/);
  assert.match(fixture.root.frame.src, /auto=1/);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.button.getAttribute('aria-label'), '停止背景音乐：《鲜花》');
});

test('点击音乐按钮停止，再次点击恢复', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  fixture.button.dispatch('click');
  assert.equal(fixture.root.frame.src, 'about:blank');
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.button.classList.contains('playing'), false);
  fixture.button.dispatch('click');
  assert.match(fixture.root.frame.src, /id=2086327879/);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.button.classList.contains('playing'), true);
});

test('首次页面交互重建 iframe 以恢复被拦截的自动播放', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  const initialFrame = fixture.root.frame;
  fixture.interactionTarget.dispatch('pointerdown');
  assert.notEqual(fixture.root.frame, initialFrame);
  assert.match(fixture.root.frame.src, /id=2086327879/);
  assert.equal(fixture.interactionTarget.has('pointerdown'), false);
  assert.equal(fixture.interactionTarget.has('keydown'), false);
});

test('用户主动停止后，其他页面交互不会恢复音乐', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  controller.stop();
  fixture.interactionTarget.dispatch('keydown');
  assert.equal(fixture.root.frame.src, 'about:blank');
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'false');
});
