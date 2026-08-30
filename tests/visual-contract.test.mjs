import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('JARVIS 主题使用青蓝色且支持减少动效', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /--jarvis-cyan:\s*#38e1ff/i);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('固定页头和选中态不会改变导航几何', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /html\s*\{[^}]*scrollbar-gutter:\s*stable/s);
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.site-header\s*\{[^}]*height:\s*64px/s);
  assert.match(css, /\.nav a\s*\{[^}]*min-width:\s*64px/s);
  assert.doesNotMatch(css.match(/\.nav a\[aria-current[^}]*\}/s)?.[0] || '', /font-weight|padding|font-size|min-width/);
});

test('移动端只隐藏音乐文字并保留声波入口', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.doesNotMatch(css, /\.music-btn span\s*\{\s*display:\s*none/);
  assert.match(css, /\.music-btn\s*>\s*span:last-child\s*\{\s*display:\s*none/);
});
