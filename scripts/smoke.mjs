import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'articles/index.html',
  'skills/index.html',
  'portfolio/index.html'
];

for (const file of required) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('MR.C') || !home.includes('JARVIS') || !home.includes('id=885054268&amp;auto=1')) {
  throw new Error('首页缺少统一品牌或音乐播放器');
}
console.log('smoke: four JARVIS pages and persistent music markers are present');
