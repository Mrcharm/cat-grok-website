import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'timeline/index.html',
  'writing/index.html',
  'projects/index.html',
  'about/index.html',
  'action/index.html',
  'blog/feishu-agent-build-guide.html'
];

for (const file of required) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('猫哥') || !home.includes('今日行动')) {
  throw new Error('首页缺少猫哥身份或今日行动入口');
}
console.log('smoke: required pages and homepage markers are present');
