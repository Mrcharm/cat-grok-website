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

test('公开仓库不保留本机认证说明和认证测试文件', async () => {
  await assert.rejects(access('test_auth_push.txt'));
  const tools = await readFile('TOOLS.md', 'utf8');
  assert.doesNotMatch(tools, /当前地址|Token 使用方法|Token.*\.env|browser preview URL/i);
});
