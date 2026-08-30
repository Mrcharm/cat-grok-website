import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
import { loadAndValidateContent } from '../scripts/validate-content.mjs';

test('学习日记不再作为第五个公开页面', async () => {
  const files = await buildSite({ write: false });
  assert.equal(files.has('action/index.html'), false);
});

test('90 天 AI 产品经理训练数据仍完整保留', async () => {
  const { tasks } = await loadAndValidateContent();
  assert.equal(tasks.length, 90);
  assert.equal(tasks.every(task => task.method && task.steps?.length === 3), true);
});
