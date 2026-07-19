# 猫哥个人生命档案站融合升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 将现有“2031 成长主页”和原“智能体团队养成日记”融合成一个以猫哥本人为主角、可持续记录职业/学习/生活/作品并提供每日行动引导的 GitHub Pages 站点。

**Architecture:** 保持无服务端的静态多页站点。结构化 JSON 保存个人、路线图和脱敏任务，Markdown 保存文章与作品；Node 构建脚本验证数据、生成页面和索引，浏览器端 ES modules 只负责导航与行动舱交互。每日完成证据存入 localStorage，公开仓库不保存私人复盘。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES modules、Node.js 20+、node:test、markdown-it、gray-matter、GitHub Pages。

## Global Constraints

- 最终只发布到 https://mrcharm.github.io/cat-grok-website/，不创建第二个公开站点。
- 猫哥本人是唯一主叙事；智能体团队只能作为“作品档案”出现。
- 主色使用清爽蓝色，保留原站明亮、圆润、轻卡通但不幼稚的气质，不使用紫色作为主色。
- 公开内容遵循“精选公开”；公司、客户、家庭、账户和交易证据必须脱敏。
- 今日行动必须包含：唯一任务、执行理由、30 分钟步骤、资料/方法论、完成标准、计时器、证据/复盘、月历、看板、导入/导出。
- 任务定义可以公开；完成状态、证据和复盘默认只保存在当前浏览器。
- 保留现有 blog/feishu-agent-build-guide.html 原链接。
- 支持 /cat-grok-website/ 子路径、手机/平板/桌面视口、键盘操作和 prefers-reduced-motion。
- 生成文件与源文件都提交到仓库，使 GitHub Pages 不依赖服务器端构建。
- 不添加账户、数据库、在线 AI 教练、自动读取工作系统或投资账户等第一版范围外能力。

---

### Task 1: 建立可重复的验证与构建基线

**Files:**
- Create: package.json
- Create: .gitignore
- Create: tests/repository-baseline.test.mjs
- Modify: TOOLS.md

**Interfaces:**
- Consumes: 当前根目录 index.html、styles.css、script.js、blog/feishu-agent-build-guide.html。
- Produces: npm test 基线入口；后续任务在此基础上逐步接入校验、构建和 smoke。

- [ ] **Step 1: 写基线失败测试**

在 tests/repository-baseline.test.mjs 写入：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('保留飞书 Agent 原链接', async () => {
  await access('blog/feishu-agent-build-guide.html');
});

test('首页明确以猫哥本人为主叙事', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /你好，我是猫哥|我是猫哥/);
});
~~~

- [ ] **Step 2: 运行测试并记录现有基线**

Run: node --test tests/repository-baseline.test.mjs

Expected: PASS 2 tests；如果失败，先记录现状，不修改原文章。

- [ ] **Step 3: 添加项目脚本和仓库忽略规则**

package.json 使用：

~~~json
{
  "name": "cat-grok-website",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests"
  },
  "dependencies": {
    "gray-matter": "4.0.3",
    "markdown-it": "14.1.0"
  }
}
~~~

.gitignore 至少包含：

~~~gitignore
node_modules/
.superpowers/
*.log
~~~

TOOLS.md 此阶段补充 Node 20+、npm install 和 npm test；Task 3 再补充完整构建命令。

- [ ] **Step 4: 安装依赖并生成锁文件**

Run: npm install

Expected: 生成 package-lock.json，输出 0 vulnerabilities 或仅记录上游告警。

- [ ] **Step 5: 验证并提交基线**

Run: npm test

Expected: PASS，现有两个基线测试通过。

Commit:

~~~powershell
git add package.json package-lock.json .gitignore TOOLS.md tests/repository-baseline.test.mjs
git commit -m "chore: add static site build baseline"
~~~

---

### Task 2: 定义结构化内容契约并迁移当前首页数据

**Files:**
- Create: data/profile.json
- Create: data/roadmap.json
- Create: data/tasks.json
- Create: scripts/validate-content.mjs
- Create: tests/content-contract.test.mjs
- Modify: package.json

**Interfaces:**
- Consumes: 当前 index.html 的身份、四类资产、2031 路线；当前 script.js 的 30 条任务。
- Produces: loadAndValidateContent() 返回 { profile, roadmap, tasks }；每条任务具有 id、date、asset、title、why、deliverable、method、steps、resources、completion。

- [ ] **Step 1: 写内容契约失败测试**

tests/content-contract.test.mjs 写入：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndValidateContent } from '../scripts/validate-content.mjs';

test('个人资料包含职业、学习、生活三条主线', async () => {
  const { profile } = await loadAndValidateContent();
  assert.deepEqual(profile.lifeLines.map(item => item.id), ['career', 'learning', 'life']);
});

test('路线图覆盖 2026 到 2031', async () => {
  const { roadmap } = await loadAndValidateContent();
  assert.equal(roadmap.years.at(0).year, 2026);
  assert.equal(roadmap.years.at(-1).year, 2031);
});

test('30 条任务都有执行策略和资料', async () => {
  const { tasks } = await loadAndValidateContent();
  assert.equal(tasks.length, 30);
  for (const task of tasks) {
    assert.match(task.id, /^d\d{2}$/);
    assert.ok(task.why.length >= 12);
    assert.equal(task.steps.length, 3);
    assert.ok(task.method.length >= 8);
    assert.ok(task.resources.length >= 1);
    assert.ok(task.completion.length >= 8);
  }
});

test('任务文本不包含敏感内部标识', async () => {
  const { tasks } = await loadAndValidateContent();
  const text = JSON.stringify(tasks);
  for (const blocked of ['客户姓名', '内部表名', '账户密码', '银行卡号']) {
    assert.equal(text.includes(blocked), false);
  }
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/content-contract.test.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND for scripts/validate-content.mjs。

- [ ] **Step 3: 实现数据读取和严格校验**

scripts/validate-content.mjs 的核心接口：

~~~js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const requireText = (value, label, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw new Error(label + ' must be a non-empty string');
  }
};

export async function loadAndValidateContent() {
  const [profile, roadmap, tasks] = await Promise.all([
    readJson('data/profile.json'),
    readJson('data/roadmap.json'),
    readJson('data/tasks.json')
  ]);

  if (profile.lifeLines?.length !== 3) throw new Error('profile.lifeLines must contain 3 items');
  if (roadmap.years?.length !== 5) throw new Error('roadmap.years must contain 5 stages');
  if (tasks.length !== 30) throw new Error('tasks must contain 30 items');

  const ids = new Set();
  const assets = new Set(['influence', 'income', 'technical', 'life']);
  for (const task of tasks) {
    if (ids.has(task.id)) throw new Error('duplicate task id: ' + task.id);
    ids.add(task.id);
    requireText(task.id, 'task.id');
    requireText(task.date, 'task.date');
    requireText(task.title, 'task.title');
    if (!assets.has(task.asset)) throw new Error(task.id + ' has invalid asset');
    requireText(task.why, 'task.why', 12);
    requireText(task.method, 'task.method', 8);
    requireText(task.completion, 'task.completion', 8);
    if (!Array.isArray(task.steps) || task.steps.length !== 3) throw new Error(task.id + ' must have 3 steps');
    if (!Array.isArray(task.resources) || task.resources.length < 1) throw new Error(task.id + ' needs resources');
  }
  return { profile, roadmap, tasks };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await loadAndValidateContent();
  console.log('content: profile, roadmap and 30 tasks are valid');
}
~~~

同时把 package.json 的 scripts 扩展为：

~~~json
{
  "scripts": {
    "test": "node --test tests",
    "validate": "node scripts/validate-content.mjs"
  }
}
~~~

- [ ] **Step 4: 迁移真实内容到三个数据文件**

data/profile.json 必须以以下字段开头，并完整迁移当前首页四项能力与三条人生线：

~~~json
{
  "name": "猫哥",
  "tagline": "把经历沉淀成作品，把判断变成系统，把生活过成长期主义。",
  "role": "银行数据、AI 产品与智能体实践交叉地带的产品经理",
  "current": {
    "career": "企业数据研发 AI Agent 与 AI 产品系统设计",
    "learning": "RAG、Agent、MCP、评估与安全治理",
    "life": "身体、重要关系和稳定节奏",
    "month": "完成四类复利资产的第一个可验证闭环"
  },
  "lifeLines": [
    {"id": "career", "title": "职业成长", "summary": "从执行型产品经理走向拥有作品和行业影响力的人"},
    {"id": "learning", "title": "学习认知", "summary": "用架构决策、实验和写作积累 AI 系统设计能力"},
    {"id": "life", "title": "生活体验", "summary": "让身体、关系和节奏支撑长期创造"}
  ]
}
~~~

data/tasks.json 将当前 30 条任务逐条迁移，ID 统一为 d01 至 d30，并为每条补齐 why、method、resources、completion。第一条采用以下完整形态，余下 29 条保持同一契约且不得用临时文案：

~~~json
{
  "id": "d01",
  "date": "2026-07-20",
  "asset": "influence",
  "title": "五年反向设计：职业",
  "why": "先定义五年后的可验证结果，避免把忙碌误当作职业升级。",
  "deliverable": "一份能被检验的 2031 职业画像。",
  "method": "未来履历法：从别人如何介绍你反推今年必须留下的证据。",
  "steps": [
    "写出 2031 年别人如何用一句话介绍你",
    "写职业位置、外部收入、AI 代表作三个结果",
    "列出三件未来五年明确不追求的事"
  ],
  "resources": [
    {"label": "本站 2031 北极星", "url": "../timeline/#roadmap-2031"}
  ],
  "completion": "保存一页职业画像，并写明三个结果指标和三个不追求事项。"
}
~~~

- [ ] **Step 5: 运行契约测试和校验**

Run: npm run validate && node --test tests/content-contract.test.mjs

Expected: content: profile, roadmap and 30 tasks are valid；PASS 4 tests。

- [ ] **Step 6: 提交内容模型**

~~~powershell
git add data scripts/validate-content.mjs tests/content-contract.test.mjs package.json
git commit -m "feat: define personal archive content contracts"
~~~

---

### Task 3: 建立 Markdown 内容源与静态多页构建器

**Files:**
- Create: content/projects/agent-team.md
- Create: content/projects/data-ai-copilot.md
- Create: content/posts/feishu-agent-build-guide.md
- Create: content/posts/first-month-note.md
- Create: scripts/lib/content.mjs
- Create: scripts/lib/render.mjs
- Create: scripts/build.mjs
- Create: scripts/smoke.mjs
- Create: scripts/templates/layout.mjs
- Create: scripts/templates/pages.mjs
- Create: tests/build.test.mjs
- Modify: package.json
- Modify: TOOLS.md
- Generate: index.html
- Generate: timeline/index.html
- Generate: writing/index.html
- Generate: projects/index.html
- Generate: about/index.html
- Generate: action/index.html
- Generate: projects/agent-team/index.html
- Generate: projects/data-ai-copilot/index.html

**Interfaces:**
- Consumes: loadAndValidateContent()；content/posts/*.md；content/projects/*.md。
- Produces: loadMarkdownCollection(directory) => Array<ContentItem>；renderPages({ profile, roadmap, tasks, posts, projects }) => Map<path, html>。

- [ ] **Step 1: 写构建失败测试**

tests/build.test.mjs 写入：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('生成六个主页面和两个作品详情', async () => {
  const files = await buildSite({ write: false });
  for (const path of [
    'index.html',
    'timeline/index.html',
    'writing/index.html',
    'projects/index.html',
    'about/index.html',
    'action/index.html',
    'projects/agent-team/index.html',
    'projects/data-ai-copilot/index.html'
  ]) assert.ok(files.has(path), path);
});

test('所有生成页面使用相对根路径且有唯一主标题', async () => {
  const files = await buildSite({ write: false });
  for (const [path, html] of files) {
    assert.equal((html.match(/<h1\b/g) || []).length, 1, path);
    assert.doesNotMatch(html, /href="\/assets\//, path);
  }
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/build.test.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND for scripts/build.mjs。

- [ ] **Step 3: 实现 Markdown 读取器**

scripts/lib/content.mjs：

~~~js
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

export async function loadMarkdownCollection(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.md')).sort();
  return Promise.all(names.map(async name => {
    const raw = await readFile(path.join(directory, name), 'utf8');
    const { data, content } = matter(raw);
    for (const field of ['title', 'slug', 'date', 'summary', 'status']) {
      if (!data[field]) throw new Error(directory + '/' + name + ' missing ' + field);
    }
    return {
      ...data,
      source: name,
      bodyHtml: markdown.render(content),
      url: data.url || directory.replace('content/', '') + '/' + data.slug + '/'
    };
  }));
}
~~~

- [ ] **Step 4: 实现布局和页面渲染接口**

scripts/templates/layout.mjs 提供：

~~~js
const escape = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function layout({ title, description, depth = 0, active, body, pageClass = '' }) {
  const root = '../'.repeat(depth);
  const nav = [
    ['home', '首页', root + 'index.html'],
    ['timeline', '人生轨迹', root + 'timeline/'],
    ['writing', '写作', root + 'writing/'],
    ['projects', '作品', root + 'projects/'],
    ['about', '关于我', root + 'about/'],
    ['action', '今日行动', root + 'action/']
  ].map(([id, label, href]) =>
    '<a href="' + href + '"' + (active === id ? ' aria-current="page"' : '') + '>' + label + '</a>'
  ).join('');

  return '<!doctype html><html lang="zh-CN"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="' + escape(description) + '">' +
    '<meta name="theme-color" content="#eaf5ff">' +
    '<title>' + escape(title) + '</title>' +
    '<link rel="stylesheet" href="' + root + 'assets/styles/site.css"></head>' +
    '<body class="' + pageClass + '"><a class="skip-link" href="#main">跳到主要内容</a>' +
    '<header class="site-header"><a class="brand" href="' + root + '">🐱 <strong>猫哥</strong></a>' +
    '<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">菜单</button>' +
    '<nav id="site-nav" aria-label="主导航">' + nav + '</nav></header>' +
    '<main id="main">' + body + '</main>' +
    '<footer><strong>猫哥 · 向 2031 生长</strong><span>精选公开，长期更新。</span></footer>' +
    '<script type="module" src="' + root + 'assets/js/site.js"></script></body></html>';
}
~~~

scripts/lib/render.mjs 集中写文件：

~~~js
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeGeneratedFiles(files) {
  for (const [relative, html] of files) {
    await mkdir(path.dirname(relative), { recursive: true });
    await writeFile(relative, html, 'utf8');
  }
}
~~~

- [ ] **Step 5: 实现 buildSite 并生成页面**

scripts/build.mjs 必须导出 buildSite：

~~~js
import { pathToFileURL } from 'node:url';
import { loadAndValidateContent } from './validate-content.mjs';
import { loadMarkdownCollection } from './lib/content.mjs';
import { writeGeneratedFiles } from './lib/render.mjs';
import { renderPages } from './templates/pages.mjs';

export async function buildSite({ write = true } = {}) {
  const data = await loadAndValidateContent();
  const [posts, projects] = await Promise.all([
    loadMarkdownCollection('content/posts'),
    loadMarkdownCollection('content/projects')
  ]);
  const files = renderPages({ ...data, posts, projects });
  if (write) await writeGeneratedFiles(files);
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log('build: generated ' + files.size + ' pages');
}
~~~

scripts/templates/pages.mjs 为六个主页面和所有 published 作品生成 Map；首页、人生轨迹、写作、作品、关于我、今日行动分别只有一个 h1。

- [ ] **Step 6: 添加首批 Markdown 源内容**

每个 Markdown 使用统一 front matter：

~~~markdown
---
title: 智能体团队养成日记
slug: agent-team
date: 2026-03-26
summary: 猫哥用协调器模式搭建四人智能体团队的阶段实践。
status: published
category: AI 实践
---

这不是猫哥的全部身份，而是一次把 AI 从单点助手组织成协作团队的实践。
~~~

content/posts/first-month-note.md 必须标为 draft，构建器只在写作列表展示 published 内容，避免把计划中文案伪装成已经发布的文章。

content/posts/feishu-agent-build-guide.md 作为现有文章的索引元数据，status 为 published，url 固定为 blog/feishu-agent-build-guide.html；构建器不得覆盖现有 HTML 正文。

- [ ] **Step 7: 接入完整构建和 smoke 命令**

package.json 的 scripts 扩展为：

~~~json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "validate": "node scripts/validate-content.mjs",
    "test": "node --test tests",
    "smoke": "node scripts/smoke.mjs",
    "check": "npm run validate && npm test && npm run build && npm run smoke"
  }
}
~~~

scripts/smoke.mjs 使用明确的公开页面清单：

~~~js
import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html', 'timeline/index.html', 'writing/index.html',
  'projects/index.html', 'about/index.html', 'action/index.html',
  'blog/feishu-agent-build-guide.html'
];
for (const file of required) await access(file);
const home = await readFile('index.html', 'utf8');
if (!home.includes('猫哥') || !home.includes('今日行动')) {
  throw new Error('首页缺少猫哥身份或今日行动入口');
}
console.log('smoke: required pages and homepage markers are present');
~~~

TOOLS.md 补充 npm run validate、npm run build、npm run check 和本地静态服务器命令。

- [ ] **Step 8: 构建、测试并提交**

Run: npm run build && node --test tests/build.test.mjs

Expected: build: generated 8 pages；PASS 2 tests。

Commit:

~~~powershell
git add content scripts package.json TOOLS.md tests/build.test.mjs index.html timeline writing projects about action
git commit -m "feat: generate personal archive pages from content sources"
~~~

---

### Task 4: 实现蓝色明亮轻卡通视觉系统

**Files:**
- Create: assets/styles/site.css
- Create: assets/js/site.js
- Create: tests/visual-contract.test.mjs
- Modify: scripts/templates/layout.mjs
- Regenerate: all generated HTML pages

**Interfaces:**
- Consumes: layout() 输出的 .site-header、.brand、.menu-button、#site-nav 和页面级 class。
- Produces: 统一 CSS tokens；initSiteNavigation() 处理移动菜单；所有页面共享蓝色视觉。

- [ ] **Step 1: 写视觉契约失败测试**

tests/visual-contract.test.mjs：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('主色为蓝色且不保留紫色主题 token', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /--blue-600:\s*#1677d2/);
  assert.match(css, /--sky-50:\s*#eef8ff/);
  assert.doesNotMatch(css, /--purple|#7c3aed|#8b5cf6/i);
});

test('支持移动端和减少动效', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/visual-contract.test.mjs

Expected: FAIL because assets/styles/site.css does not exist。

- [ ] **Step 3: 建立明确的颜色和组件 token**

assets/styles/site.css 起始 token 必须为：

~~~css
:root {
  --sky-50: #eef8ff;
  --sky-100: #dff1ff;
  --blue-100: #c9e7ff;
  --blue-300: #71bfff;
  --blue-600: #1677d2;
  --blue-700: #0f5fae;
  --ink-900: #17324d;
  --ink-600: #526c82;
  --white: #ffffff;
  --coral: #ff8066;
  --sun: #ffd563;
  --mint: #8fdcc3;
  --line: #cfe5f4;
  --radius-sm: 14px;
  --radius-md: 22px;
  --radius-lg: 32px;
  --shadow: 0 18px 50px rgba(36, 108, 166, .13);
  --content: 1180px;
}
~~~

同一文件实现：浅蓝背景、白色圆角卡片、蓝色主按钮、珊瑚/黄色/薄荷绿辅助标签、猫爪或圆点装饰、清晰 focus-visible、正文最大行长 70ch。禁止大面积深黑看板和蓝紫渐变。

- [ ] **Step 4: 实现移动导航**

assets/js/site.js：

~~~js
export function initSiteNavigation(root = document) {
  const button = root.querySelector('.menu-button');
  const nav = root.querySelector('#site-nav');
  if (!button || !nav) return;
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.dataset.open = String(!open);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    button.setAttribute('aria-expanded', 'false');
    nav.dataset.open = 'false';
  }));
}

initSiteNavigation();
~~~

- [ ] **Step 5: 运行视觉契约与构建**

Run: npm run build && node --test tests/visual-contract.test.mjs

Expected: PASS 2 tests；生成页均引用正确层级的 assets/styles/site.css。

- [ ] **Step 6: 提交蓝色视觉系统**

~~~powershell
git add assets scripts/templates index.html timeline writing projects about action tests/visual-contract.test.mjs
git commit -m "feat: add bright blue personal site visual system"
~~~

---

### Task 5: 完成以猫哥本人为中心的首页

**Files:**
- Modify: scripts/templates/pages.mjs
- Modify: data/profile.json
- Modify: data/roadmap.json
- Modify: assets/styles/site.css
- Create: tests/homepage.test.mjs
- Regenerate: index.html

**Interfaces:**
- Consumes: profile.current、profile.lifeLines、roadmap.northStar、roadmap.years、roadmap.month、roadmap.weekly、posts、projects。
- Produces: renderHomePage(model)；首页的 #now、#life-lines、#roadmap、#notes、#featured-projects、#home-about 六个区块。

- [ ] **Step 1: 写首页结构失败测试**

tests/homepage.test.mjs：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('首页顺序符合猫哥个人叙事', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  const ids = ['now', 'life-lines', 'roadmap', 'notes', 'featured-projects', 'home-about'];
  const positions = ids.map(id => html.indexOf('id="' + id + '"'));
  assert.ok(positions.every(value => value >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('智能体团队不出现在首页第一屏', async () => {
  const html = (await buildSite({ write: false })).get('index.html');
  const firstSectionEnd = html.indexOf('</section>');
  assert.equal(html.slice(0, firstSectionEnd).includes('智能体团队'), false);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/homepage.test.mjs

Expected: FAIL because required section IDs are absent。

- [ ] **Step 3: 实现首页七段内容**

renderHomePage() 按以下固定顺序输出：

1. Hero：猫哥一句话身份、当前阶段、正在解决的问题、2031 北极星。
2. 此刻的我：职业、学习、生活、本月重点四张卡片。
3. 三条人生线：职业成长、学习认知、生活体验。
4. 通往 2031：五年阶段、年度目标、月度目标、最近每周精选进展。
5. 近期记录：只展示 status=published 的最近三篇。
6. 作品档案：展示项目卡片；智能体团队可出现，但不做主视觉。
7. 关于我摘要：能力组合和 CSDN/GitHub 外部链接。

Hero 主按钮链接 action/，次按钮链接 writing/；不把执行日历直接塞进公开首页。

- [ ] **Step 4: 生成并验证首页**

Run: npm run build && node --test tests/homepage.test.mjs

Expected: PASS 2 tests；首页唯一 h1 包含“猫哥”。

- [ ] **Step 5: 提交首页**

~~~powershell
git add data/profile.json data/roadmap.json scripts/templates/pages.mjs assets/styles/site.css tests/homepage.test.mjs index.html
git commit -m "feat: center homepage on Cat Bro's life journey"
~~~

---

### Task 6: 完成人生轨迹、写作、关于我三个公开页面

**Files:**
- Create: data/timeline.json
- Modify: scripts/validate-content.mjs
- Modify: scripts/templates/pages.mjs
- Modify: assets/styles/site.css
- Create: tests/public-pages.test.mjs
- Regenerate: timeline/index.html
- Regenerate: writing/index.html
- Regenerate: about/index.html

**Interfaces:**
- Consumes: timeline entries { date, line, title, insight, links }；posts；profile。
- Produces: renderTimelinePage()、renderWritingPage()、renderAboutPage()。

- [ ] **Step 1: 写公开页失败测试**

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('人生轨迹覆盖三条主线并包含未来路线', async () => {
  const html = (await buildSite({ write: false })).get('timeline/index.html');
  for (const text of ['职业成长', '学习认知', '生活体验', '2031']) assert.match(html, new RegExp(text));
});

test('写作页只公开 published 内容', async () => {
  const html = (await buildSite({ write: false })).get('writing/index.html');
  assert.match(html, /飞书智能体搭建全流程/);
  assert.doesNotMatch(html, /first-month-note/);
});

test('关于页说明能力组合而不是虚构履历', async () => {
  const html = (await buildSite({ write: false })).get('about/index.html');
  for (const text of ['银行与数据平台', 'AI 产品设计', 'Agent 系统实践', '产业研究']) {
    assert.match(html, new RegExp(text));
  }
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/public-pages.test.mjs

Expected: 至少人生轨迹数据测试 FAIL。

- [ ] **Step 3: 添加脱敏轨迹数据并实现页面**

data/timeline.json 只写已经确认的公开节点；每项结构为：

~~~json
{
  "date": "2026-07",
  "line": "career",
  "title": "启动个人生命档案站",
  "insight": "公司的项目经验只有被整理成公开方法和作品，才会成为个人长期资产。",
  "links": [{"label": "查看作品", "url": "../projects/"}]
}
~~~

scripts/validate-content.mjs 将 timeline 加入返回值并校验 line 只能是 career、learning、life。pages.mjs 实现三个页面；时间线允许未来 2031 路线卡与历史事件并列，但未来项必须标注“目标”。

- [ ] **Step 4: 构建并测试**

Run: npm run validate && npm run build && node --test tests/public-pages.test.mjs

Expected: PASS 3 tests。

- [ ] **Step 5: 提交公开页面**

~~~powershell
git add data/timeline.json scripts/validate-content.mjs scripts/templates/pages.mjs assets/styles/site.css tests/public-pages.test.mjs timeline writing about
git commit -m "feat: add timeline writing and about archives"
~~~

---

### Task 7: 将原智能体团队网站完整收纳为作品档案

**Files:**
- Modify: content/projects/agent-team.md
- Create: data/agent-team.json
- Modify: scripts/validate-content.mjs
- Modify: scripts/templates/pages.mjs
- Modify: assets/styles/site.css
- Create: tests/legacy-content.test.mjs
- Regenerate: projects/agent-team/index.html
- Regenerate: projects/index.html

**Interfaces:**
- Consumes: git commit 3e5387b 中的原站内容；agent-team.json。
- Produces: 智能体团队作品详情，保留成长里程碑、四位成员、理念、成果、Claw 科普、技能与工具、飞书文章入口。

- [ ] **Step 1: 写原站内容保留测试**

tests/legacy-content.test.mjs：

~~~js
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
  ]) assert.match(html, new RegExp(text.replace(/[（）]/g, '.')));
});

test('作品页明确它只是猫哥的一项实践', async () => {
  const html = (await buildSite({ write: false })).get('projects/agent-team/index.html');
  assert.match(html, /一项实践|作品档案/);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/legacy-content.test.mjs

Expected: FAIL because agent-team detail is incomplete。

- [ ] **Step 3: 从原提交建立可追溯内容清单**

Run:

~~~powershell
git show 3e5387b:index.html | Select-String -Pattern 'carousel-text|team-card-name|philosophy-title|achievement-title|skill-name|article-title'
~~~

Expected: 输出 9 条里程碑、4 位成员、6 条理念、6 项成果、7 项技能和 3 篇文章标题。逐项录入 data/agent-team.json，不从旧 DOM 在运行时抓取。

- [ ] **Step 4: 实现作品详情**

agent-team.json 顶层键固定为：

~~~json
{
  "milestones": [],
  "members": [],
  "principles": [],
  "achievements": [],
  "science": [],
  "skills": [],
  "articles": [],
  "tools": []
}
~~~

pages.mjs 将这些内容渲染成作品详情的折叠式章节；飞书文章链接固定为 ../../blog/feishu-agent-build-guide.html。股票相关历史内容仅作为“当时做过的研究工具”陈述，不出现收益暗示或买入结论。

- [ ] **Step 5: 构建并验证内容数量**

Run: npm run build && node --test tests/legacy-content.test.mjs

Expected: PASS 2 tests；原飞书文章仍存在。

- [ ] **Step 6: 提交原站内容融合**

~~~powershell
git add content/projects/agent-team.md data/agent-team.json scripts/validate-content.mjs scripts/templates/pages.mjs assets/styles/site.css tests/legacy-content.test.mjs projects
git commit -m "feat: preserve agent team as a project archive"
~~~

---

### Task 8: 用 TDD 拆出行动舱状态引擎

**Files:**
- Create: assets/js/action-state.js
- Create: tests/action-state.test.mjs

**Interfaces:**
- Consumes: tasks 数组；Storage 兼容对象。
- Produces: createActionStore({ storage, key, tasks })，返回 getTaskState、saveTask、completeTask、getFocusTask、classifyTasks、exportState、importState、resetState、getRecoveryPayload。

- [ ] **Step 1: 写状态引擎失败测试**

tests/action-state.test.mjs：

~~~js
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

test('损坏状态安全回退为空状态', () => {
  const storage = memory();
  storage.setItem('test', '{bad json');
  const store = createActionStore({ storage, key: 'test', tasks });
  assert.deepEqual(store.getTaskState('d01'), { checks: [false, false, false], evidence: '', review: '', done: false });
  assert.equal(store.getRecoveryPayload(), '{bad json');
});

test('当天无任务时选择下一条未完成任务', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.equal(store.getFocusTask('2026-07-19').id, 'd01');
});

test('进行中和已完成分类互斥', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  store.saveTask('d01', { checks: [true, false, false], evidence: '', review: '', done: false });
  const groups = store.classifyTasks();
  assert.deepEqual(groups.doing.map(item => item.id), ['d01']);
  assert.deepEqual(groups.next.map(item => item.id), ['d02']);
});

test('导入拒绝未知任务 ID', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.throws(() => store.importState('{"version":2,"tasks":{"d99":{"done":true}}}'), /unknown task/);
});

test('没有完成三步并留下证据时不能完成任务', () => {
  const store = createActionStore({ storage: memory(), key: 'test', tasks });
  assert.throws(() => store.completeTask('d01', {
    checks: [true, true, false], evidence: '', review: ''
  }), /complete all steps and add evidence/);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/action-state.test.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND。

- [ ] **Step 3: 实现最小状态引擎**

assets/js/action-state.js 必须：

- 使用版本号 2 和键 mrcharm-growth-state-v2。
- 解析异常时保留原字符串供下载，再回退为空状态。
- 完成状态要求三项 checklist 全选且 evidence 非空。
- 导入时验证 version、任务 ID 和 checks 长度。
- classifyTasks() 返回 next、doing、complete 三个互斥数组。
- getFocusTask(date) 优先当天未完成任务，其次最早未完成任务；全部完成返回 null。
- resetState() 必须由 UI 二次确认后调用，状态层本身不弹窗。

核心构造器形态：

~~~js
const freshState = () => ({ version: 2, tasks: {} });

function validateImportedState(json, ids, tasks) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (parsed?.version !== 2 || !parsed.tasks || typeof parsed.tasks !== 'object') {
    throw new Error('invalid state version or tasks');
  }
  const normalized = {};
  for (const [id, value] of Object.entries(parsed.tasks)) {
    if (!ids.has(id)) throw new Error('unknown task: ' + id);
    const task = tasks.find(item => item.id === id);
    if (!Array.isArray(value.checks) || value.checks.length !== task.steps.length) {
      throw new Error('invalid checks for ' + id);
    }
    normalized[id] = {
      checks: value.checks.map(Boolean),
      evidence: String(value.evidence || ''),
      review: String(value.review || ''),
      done: Boolean(value.done)
    };
  }
  return { version: 2, tasks: normalized };
}

function readState(storage, key, ids, tasks) {
  let raw = null;
  try {
    raw = storage.getItem(key);
    if (!raw) return { state: freshState(), corruptRaw: null };
    return { state: validateImportedState(raw, ids, tasks), corruptRaw: null };
  } catch {
    return { state: freshState(), corruptRaw: raw };
  }
}

export function createActionStore({ storage, key = 'mrcharm-growth-state-v2', tasks }) {
  const ids = new Set(tasks.map(task => task.id));
  const empty = task => ({
    checks: task.steps.map(() => false),
    evidence: '',
    review: '',
    done: false
  });
  let { state, corruptRaw } = readState(storage, key, ids, tasks);

  return {
    getTaskState(id) {
      const task = tasks.find(item => item.id === id);
      if (!task) throw new Error('unknown task: ' + id);
      return state.tasks[id] || empty(task);
    },
    saveTask(id, value) {
      if (!ids.has(id)) throw new Error('unknown task: ' + id);
      state.tasks[id] = structuredClone(value);
      storage.setItem(key, JSON.stringify(state));
    },
    completeTask(id, value) {
      if (!value.checks.every(Boolean) || !value.evidence.trim()) {
        throw new Error('complete all steps and add evidence');
      }
      this.saveTask(id, { ...value, done: true });
    },
    getFocusTask(date) {
      return tasks.find(task => task.date === date && !this.getTaskState(task.id).done)
        || tasks.find(task => !this.getTaskState(task.id).done)
        || null;
    },
    classifyTasks() {
      const next = [], doing = [], complete = [];
      for (const task of tasks) {
        const value = this.getTaskState(task.id);
        if (value.done) complete.push(task);
        else if (value.checks.some(Boolean) || value.evidence || value.review) doing.push(task);
        else next.push(task);
      }
      return { next, doing, complete };
    },
    exportState() { return JSON.stringify(state, null, 2); },
    importState(json) {
      state = validateImportedState(json, ids, tasks);
      corruptRaw = null;
      storage.setItem(key, JSON.stringify(state));
    },
    resetState() {
      state = freshState();
      corruptRaw = null;
      storage.removeItem(key);
    },
    getRecoveryPayload() { return corruptRaw; }
  };
}
~~~

- [ ] **Step 4: 运行状态测试**

Run: node --test tests/action-state.test.mjs

Expected: PASS 5 tests。

- [ ] **Step 5: 提交状态引擎**

~~~powershell
git add assets/js/action-state.js tests/action-state.test.mjs
git commit -m "feat: add tested local action state engine"
~~~

---

### Task 9: 实现今日行动舱、日历、看板与导入导出

**Files:**
- Create: assets/js/action-page.js
- Modify: scripts/templates/pages.mjs
- Modify: assets/styles/site.css
- Create: tests/action-page.test.mjs
- Regenerate: action/index.html
- Delete after migration: script.js
- Delete after migration: styles.css

**Interfaces:**
- Consumes: #action-data 中构建器安全序列化的 data/tasks.json；createActionStore()。
- Produces: initActionPage(document, { tasks, storage, now })；页面元素 #today-task、#task-dialog、#calendar-grid、#kanban-next、#kanban-doing、#kanban-complete、#import-progress。

- [ ] **Step 1: 写行动页结构失败测试**

tests/action-page.test.mjs：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

test('行动页包含完整执行闭环', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  for (const id of [
    'today-task', 'task-why', 'task-method', 'task-resources',
    'task-completion', 'timer', 'evidence', 'review',
    'calendar-grid', 'kanban-next', 'kanban-doing', 'kanban-complete',
    'export-progress', 'import-progress'
  ]) assert.match(html, new RegExp('id="' + id + '"'));
});

test('任务 JSON 以 application/json 注入而不是拼接可执行代码', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  assert.match(html, /<script type="application\/json" id="action-data">/);
  assert.doesNotMatch(html, /window\.ACTION_TASKS\s*=/);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/action-page.test.mjs

Expected: FAIL because complete action page structure is absent。

- [ ] **Step 3: 生成完整行动页**

pages.mjs 将任务 JSON 中的 < 转义为 \u003c 后写入：

~~~js
const safeTasksJson = JSON.stringify(tasks).replaceAll('<', '\\u003c');
const actionScripts =
  '<script type="application/json" id="action-data">' + safeTasksJson + '</script>' +
  '<script type="module" src="../assets/js/action-page.js"></script>';
~~~

页面固定包含：

- 今日唯一任务卡：日期、标题、why、method、resources、completion。
- 30:00 计时器：开始、暂停、继续、归零；计时不写入公开数据。
- 三步 checklist、证据输入、私人复盘输入。
- 完成按钮只有在三步均勾选且证据非空时可成功。
- 月历：周一开头；当天、已完成、含任务三种状态可区分。
- 看板：接下来、进行中、已完成。
- 导出按钮、JSON 文件导入控件、重置按钮。
- 全部完成时显示月度复盘提示，不重新派发旧任务。

- [ ] **Step 4: 实现 UI 编排**

assets/js/action-page.js 起始流程：

~~~js
import { createActionStore } from './action-state.js';

const pageTasks = JSON.parse(document.querySelector('#action-data').textContent);

export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function initActionPage(
  root = document,
  { tasks = pageTasks, storage = localStorage, now = new Date() } = {}
) {
  const store = createActionStore({ storage, tasks });
  renderFocus(root, store.getFocusTask(localDateISO(now)));
  renderCalendar(root, tasks, store);
  renderBoard(root, store.classifyTasks());
  bindTaskDialog(root, tasks, store);
  bindBackupControls(root, store);
}

initActionPage();
~~~

导入使用 input type=file + File.text()；导出文件名为 mrcharm-growth-YYYY-MM-DD.json。localStorage 不可用时捕获异常、显示“可查看任务，但本机无法保存进度”，页面不得崩溃。

- [ ] **Step 5: 运行行动舱测试和手动 smoke**

Run: npm run build && node --test tests/action-page.test.mjs tests/action-state.test.mjs

Expected: PASS 7 tests。

Run:

~~~powershell
python -m http.server 4173
~~~

Expected manual checks at http://localhost:4173/action/:

1. 打开当天任务并完成一项 checklist。
2. 刷新后该项仍被选中。
3. 未填证据时不能完成。
4. 填证据并完成后，日历与看板同步更新。
5. 导出、重置、导入后恢复同一状态。
6. 关闭服务器。

- [ ] **Step 6: 删除旧单页资源并提交**

仅在所有生成页不再引用根目录 script.js 和 styles.css 后删除它们。

~~~powershell
git add assets data scripts/templates/pages.mjs tests/action-page.test.mjs action/index.html
git rm script.js styles.css
git commit -m "feat: deliver private local-first daily action cockpit"
~~~

---

### Task 10: 完成 SEO、分享图、链接和无障碍验收

**Files:**
- Modify: scripts/templates/layout.mjs
- Modify: assets/styles/site.css
- Replace: og.png
- Create: tests/site-quality.test.mjs
- Regenerate: all generated HTML pages

**Interfaces:**
- Consumes: 每页 title、description、canonicalPath、depth。
- Produces: canonical、Open Graph、Twitter card、theme color、可解析相对链接和 1200×630 蓝色分享图。

- [ ] **Step 1: 写质量失败测试**

tests/site-quality.test.mjs：

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';
import { stat } from 'node:fs/promises';

test('每页有 description canonical 和分享信息', async () => {
  const files = await buildSite({ write: false });
  for (const [path, html] of files) {
    assert.match(html, /<meta name="description"/, path);
    assert.match(html, /<link rel="canonical"/, path);
    assert.match(html, /<meta property="og:title"/, path);
    assert.match(html, /<meta property="og:image"/, path);
  }
});

test('分享图存在且不是空文件', async () => {
  const info = await stat('og.png');
  assert.ok(info.size > 20_000);
});
~~~

- [ ] **Step 2: 运行测试确认失败**

Run: node --test tests/site-quality.test.mjs

Expected: FAIL because canonical metadata is missing。

- [ ] **Step 3: 补齐页面元信息和相对链接**

layout() 接受 canonicalPath，并用现有 escape() 生成：

~~~js
const canonical = 'https://mrcharm.github.io/cat-grok-website/' + canonicalPath;
const socialMeta =
  '<link rel="canonical" href="' + escape(canonical) + '">' +
  '<meta property="og:type" content="website">' +
  '<meta property="og:title" content="' + escape(title) + '">' +
  '<meta property="og:description" content="' + escape(description) + '">' +
  '<meta property="og:url" content="' + escape(canonical) + '">' +
  '<meta property="og:image" content="https://mrcharm.github.io/cat-grok-website/og.png">' +
  '<meta name="twitter:card" content="summary_large_image">';
~~~

所有插值先 HTML escape；canonicalPath 只允许构建器生成的白名单路径。

- [ ] **Step 4: 生成蓝色新版分享图**

使用已批准的蓝色明亮轻卡通视觉：1200×630，浅蓝背景、猫哥标识、标题“猫哥 · 向 2031 生长”、副标题“职业 × 学习 × 生活 × 作品”，不出现紫色主视觉。替换根目录 og.png。

- [ ] **Step 5: 完整质量检查**

Run: npm run check

Expected:

- content validation PASS。
- 全部 node:test PASS。
- build 成功。
- smoke 输出 required pages and homepage markers are present。

- [ ] **Step 6: 提交质量改进**

~~~powershell
git add scripts/templates/layout.mjs assets/styles/site.css tests/site-quality.test.mjs og.png index.html timeline writing projects about action
git commit -m "feat: finish accessible metadata and blue social preview"
~~~

---

### Task 11: 本地视觉验收、回归检查并发布到原网址

**Files:**
- Modify if defects found: only the owning source file, then regenerate outputs
- Verify: all files tracked by git

**Interfaces:**
- Consumes: npm run check 完成的构建产物。
- Produces: 经过桌面/手机验收的 main 分支提交；原 GitHub Pages URL 展示融合后网站。

- [ ] **Step 1: 确认工作区和分支**

Run:

~~~powershell
git status --short
git branch --show-current
git log --oneline -12
~~~

Expected: 只有明确解释过的改动；分支为 main；不存在 .superpowers/ 或 node_modules/ 未跟踪噪音。

- [ ] **Step 2: 运行最终自动验证**

Run: npm run check

Expected: exit code 0；所有测试通过；构建和 smoke 均成功。

- [ ] **Step 3: 启动本地站点并做桌面验收**

Run: python -m http.server 4173

检查以下 URL：

- http://localhost:4173/
- http://localhost:4173/timeline/
- http://localhost:4173/writing/
- http://localhost:4173/projects/
- http://localhost:4173/projects/agent-team/
- http://localhost:4173/about/
- http://localhost:4173/action/
- http://localhost:4173/blog/feishu-agent-build-guide.html

Expected: 无横向溢出、无丢图、无 404；导航当前页状态正确；首页第一屏不以智能体团队为主角。

- [ ] **Step 4: 做手机与键盘验收**

在 390×844 和 768×1024 视口检查全部主页面；仅用 Tab、Shift+Tab、Enter、Escape 完成导航、打开/关闭任务、勾选清单、保存进度。开启 reduced motion 后无非必要过渡。

Expected: 主要操作可达，focus-visible 清楚，弹窗关闭后焦点回到触发按钮。

- [ ] **Step 5: 发布前检查外部与内部链接**

验证：

- CSDN 与 GitHub 使用 target="_blank" rel="noopener noreferrer"。
- 飞书文章原链接返回页面。
- 从二级和三级页面返回首页、写作、作品和行动页均正确。
- 所有公开任务无公司内部名称、客户信息、账户信息或私人完成证据。

- [ ] **Step 6: 推送 main**

Run:

~~~powershell
git status --short
git push origin main
~~~

Expected: push 成功。若 CLI 仍未认证，不在 URL、日志或提交中写入 token；改用用户已登录的 GitHub 授权流程，认证完成后重试。

- [ ] **Step 7: 验证原网址**

等待 GitHub Pages 部署完成后访问：

https://mrcharm.github.io/cat-grok-website/

Expected:

- 首页标题为“猫哥 · 向 2031 生长”。
- 主色为蓝色明亮卡通风。
- 六个主导航入口可用。
- 智能体团队位于作品档案。
- 今日行动可保存一条测试进度，刷新后恢复。
- og.png 和飞书 Agent 原文章均返回成功。

- [ ] **Step 8: 留下最终发布记录**

在 git log 中记录最终提交哈希和发布时间；向用户报告线上网址、验证结果、任务记录位置，以及后续更新内容时应提供的素材格式。不提交测试过程中产生的私人行动证据。

---

## Self-Review Mapping

- 规格第 1—5 节（目标、公开边界、信息架构）：Tasks 2、5、6。
- 智能体团队与旧内容保留：Task 7。
- 每日行动舱与本地隐私：Tasks 2、8、9。
- Markdown 更新流程与静态构建：Tasks 1、3。
- 蓝色明亮卡通视觉：Tasks 4、10。
- 状态与错误处理：Tasks 2、8、9。
- 手机、键盘、reduced motion、GitHub Pages 子路径：Tasks 4、10、11。
- 原网址发布与线上回归：Task 11。

计划中没有新增登录、数据库、在线 AI 教练或自动读取敏感系统。所有生成页面由源数据和模板产生，避免手工同时维护多份 HTML。
