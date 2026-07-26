import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyReport } from '../scripts/generate-weekly-report.mjs';

const valid = {
  schema: 'mrcharm-weekly-public-v1',
  weekEnding: '2026-07-31',
  generatedAt: '2026-07-31T09:00:00.000Z',
  items: [{
    id: 'ai001',
    date: '2026-07-27',
    title: '判断 AI 是否适合这个问题',
    phaseTitle: 'AI 系统判断',
    publicNote: '完成机会判断表，识别出两个不该使用 AI 的环节。'
  }]
};

test('由公开素材生成可发布 Markdown', () => {
  const report = buildWeeklyReport(valid);
  assert.equal(report.slug, 'weekly-2026-07-31');
  assert.match(report.markdown, /本周完成/);
  assert.match(report.markdown, /完成机会判断表/);
  assert.doesNotMatch(report.markdown, /evidence|review|checks/);
});

test('没有公开素材时拒绝生成空洞周报', () => {
  assert.throws(
    () => buildWeeklyReport({ ...valid, items: [] }),
    /no public weekly items/
  );
});

test('输入一旦含私密字段就拒绝生成', () => {
  const unsafe = structuredClone(valid);
  unsafe.items[0].evidence = '内部材料';
  assert.throws(() => buildWeeklyReport(unsafe), /private field/);
});
