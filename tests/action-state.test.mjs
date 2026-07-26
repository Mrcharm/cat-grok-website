import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionStore } from '../assets/js/action-state.js';

const tasks = [
  { id: 'd01', date: '2026-07-20', steps: ['a', 'b', 'c'] },
  { id: 'd02', date: '2026-07-21', steps: ['a', 'b', 'c'] }
];

const memory = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
};

test('损坏状态安全回退为空状态并保留原始内容', () => {
  const storage = memory();
  storage.setItem('test', '{bad json');
  const store = createActionStore({ storage, key: 'test', tasks });
  assert.deepEqual(store.getTaskState('d01'), {
    checks: [false, false, false],
    evidence: '',
    review: '',
    publicNote: '',
    done: false
  });
  assert.equal(store.getRecoveryPayload(), '{bad json');
});

test('当天无任务时选择下一条未完成任务', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.equal(store.getFocusTask('2026-07-19').id, 'd01');
});

test('进行中和已完成分类互斥', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  store.saveTask('d01', {
    checks: [true, false, false],
    evidence: '',
    review: '',
    done: false
  });
  const groups = store.classifyTasks();
  assert.deepEqual(groups.doing.map(item => item.id), ['d01']);
  assert.deepEqual(groups.next.map(item => item.id), ['d02']);
  assert.deepEqual(groups.complete, []);
});

test('导入拒绝未知任务 ID', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.throws(
    () => store.importState('{"version":2,"tasks":{"d99":{"done":true}}}'),
    /unknown task/
  );
});

test('导入不能绕过完成证据与清单约束', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.throws(() => store.importState(JSON.stringify({
    version: 2,
    tasks: {
      d01: {
        checks: [true, false, true],
        evidence: '',
        review: '',
        done: true
      }
    }
  })), /completed task must include all checks and evidence/);
});

test('没有完成三步并留下证据时不能完成任务', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.throws(() => store.completeTask('d01', {
    checks: [true, true, false],
    evidence: '',
    review: ''
  }), /complete all steps and add evidence/);
});

test('旧版数字 ID 进度迁移到 v2 字符串 ID', () => {
  const storage = memory();
  storage.setItem('legacy', JSON.stringify({
    tasks: {
      1: { checks: [true, true, true], evidence: '截图', done: true }
    }
  }));
  const store = createActionStore({
    storage,
    key: 'test',
    legacyKey: 'legacy',
    tasks
  });
  assert.equal(store.getTaskState('d01').done, true);
  assert.equal(store.getTaskState('d01').evidence, '截图');
  assert.equal(storage.getItem('legacy'), null);
});

test('周报导出只包含主动填写的公开素材，不泄露证据和私人复盘', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  store.saveTask('d01', {
    checks: [true, true, true],
    evidence: '内部项目截图和文件路径',
    review: '只给自己看的复盘',
    publicNote: '完成 AI 产品机会判断表，明确先做工作流而不是 Agent。',
    done: true
  });
  const exported = JSON.parse(store.exportWeeklyPublic('2026-07-24'));
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].publicNote, '完成 AI 产品机会判断表，明确先做工作流而不是 Agent。');
  for (const key of ['evidence', 'review', 'checks']) {
    assert.equal(key in exported.items[0], false);
  }
  assert.doesNotMatch(JSON.stringify(exported), /内部项目截图|只给自己看的复盘/);
});
