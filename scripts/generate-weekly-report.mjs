import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PRIVATE_FIELDS = new Set(['evidence', 'review', 'checks', 'tasks', 'storage']);
const ITEM_FIELDS = new Set(['id', 'date', 'title', 'phaseTitle', 'publicNote']);

const requireText = (value, label, max = 2000) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(label + ' must be non-empty text');
  }
  if (value.length > max) throw new Error(label + ' is too long');
  return value.trim();
};

const assertNoPrivateFields = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_FIELDS.has(key)) throw new Error('private field is not allowed: ' + key);
    assertNoPrivateFields(child);
  }
};

const yamlText = value => JSON.stringify(String(value));

export function buildWeeklyReport(input) {
  assertNoPrivateFields(input);
  if (input?.schema !== 'mrcharm-weekly-public-v1') {
    throw new Error('invalid weekly schema');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekEnding || '')) {
    throw new Error('invalid week ending');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('no public weekly items');
  }

  const items = input.items.map((item, index) => {
    for (const key of Object.keys(item)) {
      if (!ITEM_FIELDS.has(key)) throw new Error('unsupported weekly item field: ' + key);
    }
    return {
      id: requireText(item.id, 'items[' + index + '].id', 30),
      date: requireText(item.date, 'items[' + index + '].date', 10),
      title: requireText(item.title, 'items[' + index + '].title', 120),
      phaseTitle: requireText(item.phaseTitle, 'items[' + index + '].phaseTitle', 120),
      publicNote: requireText(item.publicNote, 'items[' + index + '].publicNote', 1000)
    };
  });

  const slug = 'weekly-' + input.weekEnding;
  const title = 'AI 产品经理成长周报 · ' + input.weekEnding;
  const summary = '记录本周已确认可公开的学习产物与产品判断，不包含私人打卡和内部项目材料。';
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.phaseTitle)) grouped.set(item.phaseTitle, []);
    grouped.get(item.phaseTitle).push(item);
  }
  const sections = [...grouped].map(([phase, phaseItems]) => (
    '## ' + phase + '\n\n' +
    phaseItems.map(item => (
      '### ' + item.date + ' · ' + item.title + '\n\n' +
      item.publicNote
    )).join('\n\n')
  )).join('\n\n');

  const markdown = [
    '---',
    'title: ' + yamlText(title),
    'slug: ' + slug,
    'date: ' + input.weekEnding,
    'summary: ' + yamlText(summary),
    'status: published',
    'category: AI 产品成长周报',
    '---',
    '',
    '这是一份只基于本周主动标记为“可公开”的素材生成的记录。',
    '',
    '## 本周完成',
    '',
    sections,
    '',
    '## 仍然保留的边界',
    '',
    '- 这里不公开学习证据、私人复盘、公司内部数据或未核实的业务结果。',
    '- 完成学习任务不等于已经具备生产落地能力，结论仍需通过真实用户和评测验证。',
    ''
  ].join('\n');

  return { slug, title, markdown };
}

export async function generateWeeklyReport(inputPath, outputDirectory = 'content/posts') {
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const report = buildWeeklyReport(input);
  const outputPath = path.join(outputDirectory, report.slug + '.md');
  await writeFile(outputPath, report.markdown, 'utf8');
  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('usage: node scripts/generate-weekly-report.mjs <weekly-public.json> [output-directory]');
  }
  const outputPath = await generateWeeklyReport(inputPath, process.argv[3]);
  console.log('weekly report: ' + outputPath);
}
