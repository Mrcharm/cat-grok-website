import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { expandLearningPlan } from '../scripts/lib/learning-plan.mjs';

const loadPlan = async () => JSON.parse(await readFile('data/learning-plan.json', 'utf8'));

test('90 天计划从 2026-07-26 连续安排到 2026-10-23', async () => {
  const tasks = expandLearningPlan(await loadPlan());
  assert.equal(tasks.length, 90);
  assert.equal(tasks[0].date, '2026-07-26');
  assert.equal(tasks.at(-1).date, '2026-10-23');
  assert.equal(new Set(tasks.map(task => task.date)).size, 90);
});

test('每天都包含 30 分钟执行策略、资料、产物和验收标准', async () => {
  const tasks = expandLearningPlan(await loadPlan());
  for (const task of tasks) {
    assert.match(task.method, /30 分钟/);
    assert.equal(task.steps.length, 3);
    assert.ok(task.resources.length >= 1, task.id + ' missing resources');
    assert.ok(task.deliverable.length >= 8, task.id + ' deliverable too short');
    assert.ok(task.completion.length >= 8, task.id + ' completion too short');
    assert.ok(task.phaseTitle);
    assert.ok(task.weekTitle);
  }
});

test('四个工程方法仓库都进入学习日历', async () => {
  const tasks = expandLearningPlan(await loadPlan());
  const urls = tasks.flatMap(task => task.resources.map(resource => resource.url));
  for (const url of [
    'https://github.com/Fission-AI/OpenSpec',
    'https://github.com/garrytan/gstack',
    'https://github.com/github/spec-kit',
    'https://github.com/tradecatlabs/vibe-coding-cn'
  ]) {
    assert.ok(urls.includes(url), 'missing required resource ' + url);
  }
});

test('每个周五都标记为周报素材整理日', async () => {
  const tasks = expandLearningPlan(await loadPlan());
  const fridays = tasks.filter(task => new Date(task.date + 'T12:00:00').getDay() === 5);
  assert.equal(fridays.length, 13);
  assert.ok(fridays.every(task => task.isWeeklyReportDay));
});
