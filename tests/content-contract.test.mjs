import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndValidateContent } from '../scripts/validate-content.mjs';

test('个人资料包含职业、学习、生活三条主线', async () => {
  const { profile } = await loadAndValidateContent();
  assert.deepEqual(profile.lifeLines.map(item => item.id), ['career', 'learning', 'life']);
});

test('路线图覆盖 2026 到 2031', async () => {
  const { roadmap } = await loadAndValidateContent();
  assert.equal(roadmap.years.at(0).year, 2026);
  assert.equal(roadmap.years.at(-1).year, 2031);
});

test('30 条任务都有执行策略和资料', async () => {
  const { tasks } = await loadAndValidateContent();
  assert.equal(tasks.length, 30);
  for (const task of tasks) {
    assert.match(task.id, /^d\d{2}$/);
    assert.ok(task.why.length >= 12);
    assert.equal(task.steps.length, 3);
    assert.ok(task.method.length >= 8);
    assert.ok(task.resources.length >= 1);
    assert.ok(task.completion.length >= 8);
  }
});

test('任务文本不包含敏感内部标识', async () => {
  const { tasks } = await loadAndValidateContent();
  const text = JSON.stringify(tasks);
  for (const blocked of ['客户姓名', '内部表名', '账户密码', '银行卡号']) {
    assert.equal(text.includes(blocked), false);
  }
});
