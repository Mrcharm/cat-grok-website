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
  const bag = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatch(type, event = { type }) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    },
    count(type) { return (listeners.get(type) || new Set()).size; },
    has(type) { return bag.count(type) > 0; }
  };
  return bag;
}

// 真实 <audio> 的行为：play() 同步把 paused 置 false 并触发 play 事件，被自动播放
// 策略拒绝时返回一个 rejected promise。autoPlayOk 可在测试中途翻转，用来模拟
// 「进站被拦 → 访客一交互，策略就放行」。
function createAudio({ autoPlayOk = true } = {}) {
  const events = eventTarget();
  const audio = {
    tagName: 'AUDIO',
    paused: true,
    ended: false,
    src: 'assets/music/want-part2.mp3',
    autoPlayOk,
    playCalls: 0,
    pauseCalls: 0,
    play() {
      audio.playCalls += 1;
      if (!audio.autoPlayOk) return Promise.reject(new Error('NotAllowedError'));
      audio.paused = false;
      audio.dispatch('play', { type: 'play' });
      return Promise.resolve();
    },
    pause() {
      audio.pauseCalls += 1;
      audio.paused = true;
      audio.dispatch('pause', { type: 'pause' });
    }
  };
  return Object.assign(audio, events);
}

function createMusicFixture(options = {}) {
  const interactionTarget = eventTarget();
  const buttonEvents = eventTarget();
  const bodyTarget = { tagName: 'BODY' };
  const buttonTarget = { tagName: 'BUTTON' };
  const button = {
    ...buttonEvents,
    attrs: new Map([['aria-pressed', 'true']]),
    classList: classList(['music-btn', 'playing']),
    getAttribute(name) { return this.attrs.get(name); },
    setAttribute(name, value) { this.attrs.set(name, value); },
    contains(node) { return node === buttonTarget; }
  };
  const audio = createAudio(options);
  const root = {
    audio,
    querySelector(selector) {
      if (selector === '#background-music-frame') return this.audio;
      if (selector === '.music-btn') return button;
      return null;
    }
  };
  return { root, audio, button, interactionTarget, bodyTarget, buttonTarget, dependencies: { root, interactionTarget } };
}

test('进站立即尝试播放《我想part2》，不重建任何元素', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  assert.equal(fixture.audio.playCalls, 1);
  assert.equal(fixture.audio.paused, false);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.button.getAttribute('aria-label'), '停止背景音乐：《我想part2》');
  // 已经出声，就不该再留着手势监听去重复触发
  assert.equal(fixture.interactionTarget.has('pointerdown'), false);
  assert.equal(fixture.interactionTarget.has('keydown'), false);
});

test('自动播放被浏览器拦下时，访客的第一次交互立刻续上', () => {
  const fixture = createMusicFixture({ autoPlayOk: false });
  createMusicController(fixture.dependencies).start();

  assert.equal(fixture.audio.playCalls, 1, '进站时先试一次');
  assert.equal(fixture.interactionTarget.has('pointerdown'), true, '被拦后要等手势');
  assert.equal(fixture.interactionTarget.has('keydown'), true);
  assert.equal(fixture.interactionTarget.has('touchstart'), true);

  fixture.audio.autoPlayOk = true; // 有用户激活了，策略放行
  fixture.interactionTarget.dispatch('pointerdown', { target: fixture.bodyTarget });

  assert.equal(fixture.audio.playCalls, 2);
  assert.equal(fixture.audio.paused, false);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');

  // 出声后监听必须撤掉，否则以后每次点击都会再打一次 play()
  assert.equal(fixture.interactionTarget.has('pointerdown'), false);
  fixture.interactionTarget.dispatch('pointerdown', { target: fixture.bodyTarget });
  assert.equal(fixture.audio.playCalls, 2);
});

test('导航与筛选点击既不停播也不改动播放器', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();

  fixture.interactionTarget.dispatch('pointerdown', { target: fixture.bodyTarget });
  fixture.interactionTarget.dispatch('keydown', { target: fixture.bodyTarget });

  assert.equal(fixture.audio.paused, false);
  assert.equal(fixture.audio.pauseCalls, 0);
  assert.equal(fixture.audio.src, 'assets/music/want-part2.mp3');
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
});

test('音乐按钮停止后可恢复', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();

  fixture.button.dispatch('click');
  assert.equal(fixture.audio.paused, true);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.button.classList.contains('playing'), false);

  fixture.button.dispatch('click');
  assert.equal(fixture.audio.paused, false);
  assert.equal(fixture.audio.playCalls, 2);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.button.classList.contains('playing'), true);
});

test('用户主动停止后，页面交互不会把音乐放回来', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  controller.stop();

  fixture.interactionTarget.dispatch('keydown', { target: fixture.bodyTarget });
  fixture.interactionTarget.dispatch('pointerdown', { target: fixture.bodyTarget });

  assert.equal(fixture.audio.playCalls, 1, '只有进站那一次尝试');
  assert.equal(fixture.audio.paused, true);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'false');
});

test('第一次交互正好点在音乐按钮上时，不会先播起来再被按钮停掉', () => {
  const fixture = createMusicFixture({ autoPlayOk: false });
  createMusicController(fixture.dependencies).start();
  fixture.audio.autoPlayOk = true;

  // pointerdown 落在按钮内部 —— 必须让位给按钮自己的 click
  fixture.interactionTarget.dispatch('pointerdown', { target: fixture.buttonTarget });
  assert.equal(fixture.audio.playCalls, 1);

  fixture.button.dispatch('click');
  assert.equal(fixture.audio.playCalls, 2);
  assert.equal(fixture.audio.paused, false);
  assert.equal(fixture.button.getAttribute('aria-pressed'), 'true');
});

test('自动播放被拒时按钮如实显示未播放，语音模块据此判断', async () => {
  const fixture = createMusicFixture({ autoPlayOk: false });
  createMusicController(fixture.dependencies).start();
  await Promise.resolve();

  assert.equal(fixture.button.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.button.classList.contains('playing'), false);
});
