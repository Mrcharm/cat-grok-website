import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('作品集保留 JARVIS 和数据产品代表作', async () => {
  const html = (await buildSite({ write: false })).get('portfolio/index.html');
  for (const text of ['JARVIS 陪伴系统', '数据血缘与知识图谱平台', 'AI 数据研发 Copilot']) {
    assert.match(html, new RegExp(text));
  }
});

