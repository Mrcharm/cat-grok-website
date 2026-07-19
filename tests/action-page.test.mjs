import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
import { buildMonthCells, localDateISO } from '../assets/js/action-page.js';

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
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
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
