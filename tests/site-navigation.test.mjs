import test from 'node:test';
import assert from 'node:assert/strict';
import { initSiteNavigation } from '../assets/js/site.js';

test('菜单按钮切换 aria-expanded 与导航打开状态', () => {
  const listeners = {};
  const button = {
    value: 'false',
    addEventListener(type, handler) { listeners[type] = handler; },
    getAttribute() { return this.value; },
    setAttribute(name, value) {
      if (name === 'aria-expanded') this.value = value;
    }
  };
  const nav = {
    dataset: {},
    querySelectorAll() { return []; }
  };
  const root = {
    querySelector(selector) {
      return selector === '.menu-button' ? button : nav;
    }
  };

  initSiteNavigation(root);
  listeners.click();

  assert.equal(button.value, 'true');
  assert.equal(nav.dataset.open, 'true');
});
