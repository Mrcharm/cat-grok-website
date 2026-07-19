import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('主色为蓝色且不保留紫色主题 token', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /--blue-600:\s*#1677d2/);
  assert.match(css, /--sky-50:\s*#eef8ff/);
  assert.doesNotMatch(css, /--purple|#7c3aed|#8b5cf6/i);
});

test('支持移动端和减少动效', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
