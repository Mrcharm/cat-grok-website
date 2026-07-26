import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
import { buildMonthCells, localDateISO, weekEndingFridayISO } from '../assets/js/action-page.js';

test('行动页包含完整执行闭环', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  for (const id of [
    'today-task',
    'task-why',
    'task-method',
    'task-resources',
    'task-completion',
    'timer',
    'evidence',
    'review',
    'calendar-grid',
    'kanban-next',
    'kanban-doing',
    'kanban-complete',
    'export-progress',
    'import-progress'
    ,'phase-progress'
    ,'public-note'
    ,'export-weekly'
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test('行动页明确是 90 天 AI 产品经理训练而不是 30 天泛计划', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  assert.match(html, /90 天 AI 产品经理成长计划/);
  assert.match(html, /每天 30 分钟/);
  assert.doesNotMatch(html, /30 天行动日历/);
});

test('任务 JSON 以 application/json 注入而不是拼接可执行代码', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  assert.match(html, /<script type="application\/json" id="action-data">/);
  assert.doesNotMatch(html, /window\.ACTION_TASKS\s*=/);
});

test('本地日期格式不受 UTC 跨日影响', () => {
  const date = new Date(2026, 6, 20, 0, 5);
  assert.equal(localDateISO(date), '2026-07-20');
});

test('月历以周一开始并补齐整周', () => {
  const tasks = [{ id: 'd01', date: '2026-07-20', title: '任务' }];
  const cells = buildMonthCells(2026, 6, tasks, '2026-07-20', new Set(['d01']));
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0], null);
  const taskCell = cells.find(cell => cell?.task?.id === 'd01');
  assert.equal(taskCell.day, 20);
  assert.equal(taskCell.today, true);
  assert.equal(taskCell.done, true);
});

test('周报日期在周日至周四指向即将到来的周五', () => {
  assert.equal(weekEndingFridayISO(new Date(2026, 6, 26)), '2026-07-31');
  assert.equal(weekEndingFridayISO(new Date(2026, 6, 30)), '2026-07-31');
  assert.equal(weekEndingFridayISO(new Date(2026, 6, 31)), '2026-07-31');
  assert.equal(weekEndingFridayISO(new Date(2026, 7, 1)), '2026-07-31');
});
