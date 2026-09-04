import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'articles/index.html',
  'skills/index.html',
  'portfolio/index.html'
];

for (const file of required) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('MR.C') || !home.includes('JARVIS') || !home.includes('type=2&amp;id=2086327879&amp;auto=1')) {
  throw new Error('首页缺少统一品牌或《鲜花》背景音乐');
}
if (!home.includes('assets/js/voice/realtime-voice.js') || home.includes('const REPLIES') || home.includes('speechSynthesis')) {
  throw new Error('首页未正确启用豆包实时语音入口');
}
console.log('smoke: four JARVIS pages, Flowers music, and realtime voice markers are present');
