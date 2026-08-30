import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('四个公开页面文件存在', async () => {
  for (const path of ['index.html', 'articles/index.html', 'skills/index.html', 'portfolio/index.html']) {
    await assert.doesNotReject(access(path), path);
  }
});

test('公开仓库不保留本机认证说明和认证测试文件', async () => {
  const ignore = await readFile('.gitignore', 'utf8');
  assert.doesNotMatch(ignore, /ghp_[A-Za-z0-9]+/);
  await assert.rejects(access('AUTH.md'));
});

