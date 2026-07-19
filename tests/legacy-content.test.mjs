import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('智能体团队代表内容仍可访问', async () => {
  const html = (await buildSite({ write: false })).get('projects/agent-team/index.html');
  for (const text of [
    '成长里程碑',
    '阿文（核心调度智能体）',
    '股票助手',
    '内容创作助手',
    '网站搭建助手',
    '精准匹配需求',
    'Claw 是什么',
    '飞书智能体搭建全流程'
  ]) {
    assert.match(html, new RegExp(text.replace(/[（）]/g, '.')));
  }
});

test('作品页明确它只是猫哥的一项实践', async () => {
  const html = (await buildSite({ write: false })).get('projects/agent-team/index.html');
  assert.match(html, /一项实践|作品档案/);
  assert.doesNotMatch(html, /GMT\+|中国标准时间/);
});
