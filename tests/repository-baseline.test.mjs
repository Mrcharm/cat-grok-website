import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('保留飞书 Agent 原链接', async () => {
  await access('blog/feishu-agent-build-guide.html');
});

test('首页明确以猫哥本人为主叙事', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /你好，我是猫哥|我是猫哥/);
});
