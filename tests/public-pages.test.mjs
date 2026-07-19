import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('人生轨迹覆盖三条主线并包含未来路线', async () => {
  const html = (await buildSite({ write: false })).get('timeline/index.html');
  for (const text of ['职业成长', '学习认知', '生活体验', '2031']) {
    assert.match(html, new RegExp(text));
  }
});

test('写作页只公开 published 内容', async () => {
  const html = (await buildSite({ write: false })).get('writing/index.html');
  assert.match(html, /飞书智能体搭建全流程/);
  assert.doesNotMatch(html, /为什么企业数据 Agent 的第一版不应该追求多智能体/);
});

test('关于页说明能力组合而不是虚构履历', async () => {
  const html = (await buildSite({ write: false })).get('about/index.html');
  for (const text of ['银行与数据平台', 'AI 产品设计', 'Agent 系统实践', '产业研究']) {
    assert.match(html, new RegExp(text));
  }
});
