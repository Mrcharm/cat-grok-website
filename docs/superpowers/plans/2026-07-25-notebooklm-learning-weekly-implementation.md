# NotebookLM Learning Cards and Weekly Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a NotebookLM-grounded learning-card library and three-day study sprint to the existing action calendar, plus a privacy-safe Friday weekly-report publishing workflow.

**Architecture:** NotebookLM answers are captured as immutable research snapshots. A compiler validates that every published card appears verbatim in a snapshot, then produces public card/source JSON. The action page consumes the compiled cards and a separate sprint schedule while keeping learning state in an independent localStorage store. Weekly reports are generated only from an explicitly exported public payload and are published by a guarded recurring Codex automation.

**Tech Stack:** Node.js ESM, static HTML generation, vanilla JavaScript, CSS, localStorage, Node test runner, GitHub Pages, Codex cron automation, NotebookLM browser skill.

## Global Constraints

- Formal knowledge-card text must come from NotebookLM answer snapshots.
- OpenSpec, gstack, Spec Kit, and vibe-coding-cn are mandatory card groups.
- At least one additional NotebookLM topic group must be published.
- Official GitHub URLs are allowed as further reading but cannot silently supply card text.
- Existing 30-day action tasks and their local state must remain intact.
- Learning state uses a separate versioned localStorage key.
- Private evidence, reviews, self-test answers, and NotebookLM authentication state never enter public weekly-report exports.
- Weekly publication aborts on missing public input, dirty worktree, failed tests, remote conflict, or failed online verification.
- The site remains static and adds no login, database, server, or browser-side GitHub token.

---

### Task 1: Capture and compile NotebookLM evidence

**Files:**
- Create: `research/notebooklm/README.md`
- Create: `research/notebooklm/2026-07-25-topic-map.json`
- Create: `research/notebooklm/2026-07-25-required-repositories.json`
- Create: `scripts/compile-learning.mjs`
- Create: `tests/learning-compiler.test.mjs`
- Generate: `data/learning-cards.json`
- Generate: `data/learning-sources.json`

**Interfaces:**
- Consumes: NotebookLM answer snapshots with `{ snapshotId, notebook, notebookUrl, query, queriedAt, rawAnswer, citationMarkers, sourceLabels, topics, cards }`.
- Produces: `compileLearningSnapshots({ directory, write }) -> Promise<{ cards, sources, topics }>` and generated JSON files.

- [ ] **Step 1: Query NotebookLM for a complete topic map**

Run through the NotebookLM skill wrapper:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
$python='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python scripts/run.py ask_question.py `
  --notebook-id 'vibe-coding工程方法论' `
  --show-browser `
  --question '请仅依据本笔记本全部来源，输出完整主题地图。必须覆盖所有可检索主题，不限于四个 GitHub 仓库。每个主题给出稳定英文 id、中文标题、一句话范围、相关来源编号。不要写学习计划。'
```

Expected: NotebookLM returns a source-grounded topic map and ends with its follow-up reminder.

- [ ] **Step 2: Query mandatory repositories separately until each has usable evidence**

Run these four independent NotebookLM queries:

```text
只讨论 Fission-AI/OpenSpec，不得改答其他项目。仅依据本笔记本来源，输出：一句话定位；五个核心概念；proposal → specs → design → tasks → apply → archive 标准工作流；三个适用场景；三个不适用场景或代价；三个常见误区；六组同事问答。每个事实必须保留 NotebookLM 引用编号。若没有可用来源，只回答“当前笔记本无可用来源”。
```

```text
只讨论 github/spec-kit，不得改答其他项目。仅依据本笔记本来源，输出：一句话定位；五个核心概念；constitution → specify → clarify → plan → tasks → analyze → implement 标准工作流；三个适用场景；三个不适用场景或代价；三个常见误区；六组同事问答。每个事实必须保留 NotebookLM 引用编号。若没有可用来源，只回答“当前笔记本无可用来源”。
```

```text
只讨论 garrytan/gstack，不得改答其他项目。仅依据本笔记本来源，输出：一句话定位；五个核心概念；think → plan → build → review → test → ship → reflect 标准工作流；三个适用场景；三个不适用场景或代价；三个常见误区；六组同事问答。每个事实必须保留 NotebookLM 引用编号。若没有可用来源，只回答“当前笔记本无可用来源”。
```

```text
只讨论 tradecatlabs/vibe-coding-cn，不得改答其他项目。仅依据本笔记本来源，输出：一句话定位；Prompt → Skill → Context → Quality Gate → Git 工程闭环；五个核心概念；三个适用场景；三个不适用场景或代价；三个常见误区；六组同事问答。每个事实必须保留 NotebookLM 引用编号。若没有可用来源，只回答“当前笔记本无可用来源”。
```

Expected: all four return relevant, citation-bearing answers. If OpenSpec or Spec Kit still returns unrelated gstack content, use the NotebookLM browser UI to confirm/add the missing GitHub URL source, wait for ingestion, then rerun. Do not create a formal card for that repository before the query succeeds.

- [ ] **Step 3: Query all non-mandatory topic groups**

Feed the complete Step 1 topic-map answer back to NotebookLM with this exact query:

```text
依据上一份全量主题地图，排除 OpenSpec、gstack、Spec Kit、vibe-coding-cn 四个仓库专题后，为其余每一个主题各生成 6 张知识卡。不得漏掉主题。每张卡包含 id、group、groupLabel、front、back、why、misconception、citationMarkers。front、back、why、misconception 必须可以脱离上下文独立阅读，并且只能复述本笔记本来源。最后列出主题数、每个主题卡片数和总卡片数，供完整性核对。
```

Expected: at least one additional topic group, such as context management, quality gates, AI skills, memory systems, multi-agent collaboration, or glue coding.

- [ ] **Step 4: Write the failing compiler tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLearningSnapshots } from '../scripts/compile-learning.mjs';

test('每张正式卡片都逐字存在于 NotebookLM 原始回答', async () => {
  const result = await compileLearningSnapshots({
    directory: 'research/notebooklm',
    write: false
  });
  assert.ok(result.cards.length > 0);
  for (const card of result.cards) {
    assert.ok(card.provenance.snapshotId);
    assert.ok(card.provenance.query);
    assert.ok(card.provenance.citationMarkers.length > 0);
    assert.equal(card.provenance.verbatim, true);
  }
});

test('四个必修仓库和至少一个额外主题都有卡片', async () => {
  const result = await compileLearningSnapshots({
    directory: 'research/notebooklm',
    write: false
  });
  const groups = new Set(result.cards.map(card => card.group));
  for (const required of ['openspec', 'gstack', 'spec-kit', 'vibe-coding-cn']) {
    assert.ok(groups.has(required), required + ' missing');
  }
  assert.ok([...groups].some(group => ![
    'openspec', 'gstack', 'spec-kit', 'vibe-coding-cn'
  ].includes(group)));
});
```

- [ ] **Step 5: Run the compiler tests and verify RED**

Run:

```powershell
node --test tests/learning-compiler.test.mjs
```

Expected: FAIL because `scripts/compile-learning.mjs` does not exist.

- [ ] **Step 6: Implement the snapshot compiler**

Create `scripts/compile-learning.mjs` with these public functions:

```js
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

const containsCardText = (rawAnswer, card) => (
  rawAnswer.includes(card.front) &&
  rawAnswer.includes(card.back) &&
  rawAnswer.includes(card.why) &&
  rawAnswer.includes(card.misconception)
);

export async function compileLearningSnapshots({
  directory = 'research/notebooklm',
  write = true
} = {}) {
  const names = (await readdir(directory))
    .filter(name => name.endsWith('.json'))
    .sort();
  const snapshots = await Promise.all(
    names.map(name => readJson(path.join(directory, name)))
  );
  const cards = [];
  const sources = [];
  const topics = new Map();

  for (const snapshot of snapshots) {
    for (const field of [
      'snapshotId', 'notebook', 'notebookUrl', 'query',
      'queriedAt', 'rawAnswer'
    ]) {
      if (!String(snapshot[field] || '').trim()) {
        throw new Error(snapshot.snapshotId + ' missing ' + field);
      }
    }
    if (!Array.isArray(snapshot.citationMarkers) ||
        snapshot.citationMarkers.length === 0) {
      throw new Error(snapshot.snapshotId + ' has no citations');
    }
    sources.push({
      snapshotId: snapshot.snapshotId,
      notebook: snapshot.notebook,
      notebookUrl: snapshot.notebookUrl,
      query: snapshot.query,
      queriedAt: snapshot.queriedAt,
      citationMarkers: snapshot.citationMarkers,
      sourceLabels: snapshot.sourceLabels || []
    });
    for (const topic of snapshot.topics || []) topics.set(topic.id, topic);
    for (const card of snapshot.cards || []) {
      if (!containsCardText(snapshot.rawAnswer, card)) {
        throw new Error(card.id + ' is not verbatim NotebookLM output');
      }
      cards.push({
        ...card,
        provenance: {
          snapshotId: snapshot.snapshotId,
          notebook: snapshot.notebook,
          notebookUrl: snapshot.notebookUrl,
          query: snapshot.query,
          queriedAt: snapshot.queriedAt,
          citationMarkers: card.citationMarkers,
          verbatim: true
        }
      });
    }
  }

  const ids = new Set();
  for (const card of cards) {
    if (ids.has(card.id)) throw new Error('duplicate card id: ' + card.id);
    ids.add(card.id);
  }
  const result = { cards, sources, topics: [...topics.values()] };
  if (write) {
    await writeFile(
      'data/learning-cards.json',
      JSON.stringify(cards, null, 2) + '\n'
    );
    await writeFile(
      'data/learning-sources.json',
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        notebook: sources.at(0)?.notebook || '',
        notebookUrl: sources.at(0)?.notebookUrl || '',
        topics: result.topics,
        snapshots: sources
      }, null, 2) + '\n'
    );
  }
  return result;
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await compileLearningSnapshots();
  console.log('learning: compiled ' + result.cards.length + ' cards');
}
```

- [ ] **Step 7: Save NotebookLM snapshots and compile**

Save exact NotebookLM answers as JSON. Every `cards[].front`, `back`, `why`, and `misconception` string must occur verbatim inside `rawAnswer`.

Run:

```powershell
node scripts/compile-learning.mjs
node --test tests/learning-compiler.test.mjs
```

Expected: PASS and both generated data files exist.

- [ ] **Step 8: Commit the evidence pipeline**

```powershell
git add research/notebooklm scripts/compile-learning.mjs tests/learning-compiler.test.mjs data/learning-cards.json data/learning-sources.json
git commit -m "feat: compile NotebookLM-grounded learning cards"
```

---

### Task 2: Add the three-day sprint content contract

**Files:**
- Create: `data/learning-sprints.json`
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/content-contract.test.mjs`

**Interfaces:**
- Consumes: generated card IDs from `data/learning-cards.json`.
- Produces: `loadAndValidateContent()` fields `learningCards`, `learningSources`, and `learningSprints`.

- [ ] **Step 1: Write failing content-contract tests**

```js
test('学习冲刺覆盖三天并引用存在的 NotebookLM 卡片', async () => {
  const { learningCards, learningSprints } = await loadAndValidateContent();
  assert.deepEqual(
    learningSprints.map(day => day.date),
    ['2026-07-26', '2026-07-27', '2026-07-28']
  );
  const cardIds = new Set(learningCards.map(card => card.id));
  for (const day of learningSprints) {
    assert.match(day.id, /^learn-d0[1-3]$/);
    assert.ok(day.durationMinutes >= 75);
    assert.equal(day.steps.length, 3);
    assert.equal(day.selfTest.length, 3);
    assert.ok(day.cardIds.length >= 6);
    day.cardIds.forEach(id => assert.ok(cardIds.has(id), id));
  }
});

test('正式学习卡全部来自 NotebookLM 且包含额外主题', async () => {
  const { learningCards } = await loadAndValidateContent();
  const groups = new Set(learningCards.map(card => card.group));
  assert.deepEqual(
    ['openspec', 'gstack', 'spec-kit', 'vibe-coding-cn']
      .filter(group => !groups.has(group)),
    []
  );
  assert.ok(groups.size >= 5);
  learningCards.forEach(card => {
    assert.equal(card.provenance.verbatim, true);
    assert.ok(card.provenance.snapshotId);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/content-contract.test.mjs
```

Expected: FAIL because `learningSprints` and `learningCards` are undefined.

- [ ] **Step 3: Add the three sprint records**

Create `data/learning-sprints.json` with exactly these three records:

```json
[
  {
    "id": "learn-d01",
    "date": "2026-07-26",
    "title": "全景认知：四个项目分别解决什么",
    "goal": "能在 1 分钟内脱稿讲清四者定位与层级关系。",
    "durationMinutes": 75,
    "steps": [
      "阅读并翻完当天全部知识卡",
      "用银行数据研发场景完成一次映射练习",
      "闭卷回答三道自测并留下口述证据"
    ],
    "agenda": [
      {"minutes": 30, "label": "资料输入"},
      {"minutes": 25, "label": "场景练习"},
      {"minutes": 20, "label": "脱稿回忆"}
    ],
    "cardIds": [
      "vibe-prompt-skill-context",
      "vibe-quality-gate",
      "vibe-engineering-loop",
      "vibe-glue-coding",
      "landscape-four-layers",
      "landscape-minimal-stack"
    ],
    "selfTest": [
      "四个项目分别处于方法论、规格层和执行层的什么位置？",
      "为什么只有 Prompt 而没有 Context 和 Quality Gate 会失控？",
      "四者能否组合使用？给出最小组合。"
    ],
    "completion": "翻完全部卡片、完成三步并留下 1 分钟口述文件名。"
  },
  {
    "id": "learn-d02",
    "date": "2026-07-27",
    "title": "规格驱动：OpenSpec 与 Spec Kit",
    "goal": "能用同一需求解释两套流程，并给出有边界的选型理由。",
    "durationMinutes": 90,
    "steps": [
      "阅读并翻完 OpenSpec 与 Spec Kit 的全部指定卡片",
      "把同一银行数据研发需求分别映射到两套流程",
      "闭卷回答三道自测并保存差异表"
    ],
    "agenda": [
      {"minutes": 35, "label": "资料输入"},
      {"minutes": 35, "label": "双流程映射"},
      {"minutes": 20, "label": "闭卷比较"}
    ],
    "cardIds": [
      "openspec-specs-truth",
      "openspec-delta-specs",
      "openspec-artifact-flow",
      "spec-kit-constitution",
      "spec-kit-core-flow",
      "compare-open-vs-spec"
    ],
    "selfTest": [
      "OpenSpec 的 specs 与 changes 分别表示什么？",
      "Spec Kit 的 constitution 为什么放在 specify 之前？",
      "面对已有银行数据平台的小功能改造，你选择哪套流程，为什么？"
    ],
    "completion": "完成六张卡片、双流程映射、三道自测和一份差异表。"
  },
  {
    "id": "learn-d03",
    "date": "2026-07-28",
    "title": "工程闭环：gstack 与四者组合",
    "goal": "能回答常见追问，并为真实项目选择最小工具组合。",
    "durationMinutes": 90,
    "steps": [
      "阅读并翻完 gstack 与组合选型卡片",
      "完成四者组合决策树和十二道追问",
      "录制五分钟脱稿说明并留下文件名"
    ],
    "agenda": [
      {"minutes": 30, "label": "gstack 工作流"},
      {"minutes": 35, "label": "组合与选型"},
      {"minutes": 25, "label": "口述答辩"}
    ],
    "cardIds": [
      "gstack-sprint",
      "gstack-office-hours-autoplan",
      "gstack-review-qa-ship",
      "compose-four-projects",
      "selection-decision-tree",
      "oral-defense-common-mistakes"
    ],
    "selfTest": [
      "gstack 为什么不能替代规格层？",
      "一个小项目是否需要同时使用 OpenSpec 和 Spec Kit？",
      "为银行数据研发 AI Copilot 给出最小工具组合及理由。"
    ],
    "completion": "完成六张卡片、决策树、十二道追问和五分钟口述录音。"
  }
]
```

The NotebookLM snapshot normalization in Task 1 must assign these stable card IDs to the matching NotebookLM card texts. IDs and grouping labels may be normalized locally; front, back, why, and misconception may not be rewritten.

- [ ] **Step 4: Extend content loading and validation**

Modify `loadAndValidateContent()` to read:

```js
const [
  profile, roadmap, tasks, timeline, agentTeam,
  learningCards, learningSources, learningSprints
] = await Promise.all([
  readJson('data/profile.json'),
  readJson('data/roadmap.json'),
  readJson('data/tasks.json'),
  readJson('data/timeline.json'),
  readJson('data/agent-team.json'),
  readJson('data/learning-cards.json'),
  readJson('data/learning-sources.json'),
  readJson('data/learning-sprints.json')
]);
```

Add exact validation:

```js
const cardIds = new Set(learningCards.map(card => card.id));
if (learningSprints.length !== 3) {
  throw new Error('learningSprints must contain 3 days');
}
for (const card of learningCards) {
  requireText(card.id, 'learningCard.id');
  requireText(card.group, card.id + '.group');
  requireText(card.front, card.id + '.front', 8);
  requireText(card.back, card.id + '.back', 12);
  requireText(card.why, card.id + '.why', 8);
  requireText(card.misconception, card.id + '.misconception', 8);
  if (card.provenance?.verbatim !== true) {
    throw new Error(card.id + ' is not NotebookLM-grounded');
  }
}
for (const day of learningSprints) {
  if (day.cardIds.length < 6) throw new Error(day.id + ' needs 6 cards');
  day.cardIds.forEach(id => {
    if (!cardIds.has(id)) throw new Error(day.id + ' unknown card: ' + id);
  });
  if (day.steps.length !== 3 || day.selfTest.length !== 3) {
    throw new Error(day.id + ' needs 3 steps and 3 self-test questions');
  }
}
```

Return all three new values.

- [ ] **Step 5: Run validation tests and commit**

```powershell
node --test tests/content-contract.test.mjs
node scripts/validate-content.mjs
git add data/learning-sprints.json scripts/validate-content.mjs tests/content-contract.test.mjs
git commit -m "feat: define three-day learning sprint"
```

Expected: PASS and validator reports 30 action tasks plus 3 learning days.

---

### Task 3: Build an isolated learning-state engine

**Files:**
- Create: `assets/js/learning-state.js`
- Create: `tests/learning-state.test.mjs`

**Interfaces:**
- Consumes: `learningSprints` and `learningCards`.
- Produces: `createLearningStore({ storage, key, sprints, cards })`.

- [ ] **Step 1: Write failing state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStore } from '../assets/js/learning-state.js';

const cards = [
  { id: 'c1' }, { id: 'c2' }
];
const sprints = [{
  id: 'learn-d01',
  date: '2026-07-26',
  cardIds: ['c1', 'c2'],
  steps: ['a', 'b', 'c'],
  selfTest: ['q1', 'q2', 'q3']
}];
const memory = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
};

test('学习状态与行动状态使用独立 key', () => {
  const storage = memory();
  const store = createLearningStore({
    storage,
    key: 'learning-test',
    sprints,
    cards
  });
  store.setCardLevel('c1', 'mastered');
  assert.ok(storage.getItem('learning-test'));
  assert.equal(storage.getItem('mrcharm-action-v2'), null);
});

test('未看完卡片、未完成三步或无证据时不能打卡', () => {
  const store = createLearningStore({
    storage: memory(),
    key: 'learning-test',
    sprints,
    cards
  });
  assert.throws(() => store.completeDay('learn-d01', {
    checks: [true, true, true],
    reviewedCardIds: ['c1'],
    selfTestAnswers: ['a1', 'a2', 'a3'],
    evidence: ''
  }), /review all cards and add evidence/);
});

test('完成后能按日期查询学习打卡', () => {
  const store = createLearningStore({
    storage: memory(),
    key: 'learning-test',
    sprints,
    cards
  });
  store.completeDay('learn-d01', {
    checks: [true, true, true],
    reviewedCardIds: ['c1', 'c2'],
    selfTestAnswers: ['a1', 'a2', 'a3'],
    evidence: '口述-0726.m4a'
  });
  assert.equal(store.getDayState('learn-d01').done, true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/learning-state.test.mjs
```

Expected: FAIL because `learning-state.js` does not exist.

- [ ] **Step 3: Implement the store**

Implement:

```js
const freshState = () => ({ version: 1, cards: {}, days: {}, weeklyDraft: {} });

export function createLearningStore({
  storage,
  key = 'mrcharm-learning-v1',
  sprints,
  cards
}) {
  const cardIds = new Set(cards.map(card => card.id));
  const sprintById = new Map(sprints.map(day => [day.id, day]));
  let state = freshState();
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 1) state = parsed;
    }
  } catch {
    state = freshState();
  }
  const persist = () => storage.setItem(key, JSON.stringify(state));

  return {
    getCardState(id) {
      if (!cardIds.has(id)) throw new Error('unknown card: ' + id);
      return state.cards[id] || { level: 'new', reviewed: false };
    },
    setCardLevel(id, level) {
      if (!cardIds.has(id)) throw new Error('unknown card: ' + id);
      if (!['new', 'review', 'mastered'].includes(level)) {
        throw new Error('invalid card level');
      }
      state.cards[id] = { level, reviewed: level !== 'new' };
      persist();
    },
    getDayState(id) {
      if (!sprintById.has(id)) throw new Error('unknown sprint: ' + id);
      return state.days[id] || {
        checks: [false, false, false],
        reviewedCardIds: [],
        selfTestAnswers: ['', '', ''],
        evidence: '',
        done: false
      };
    },
    saveDay(id, value) {
      if (!sprintById.has(id)) throw new Error('unknown sprint: ' + id);
      state.days[id] = { ...value, done: Boolean(value.done) };
      persist();
    },
    completeDay(id, value) {
      const sprint = sprintById.get(id);
      if (!sprint) throw new Error('unknown sprint: ' + id);
      const reviewed = new Set(value.reviewedCardIds || []);
      const valid = value.checks?.every(Boolean) &&
        sprint.cardIds.every(cardId => reviewed.has(cardId)) &&
        value.selfTestAnswers?.length === 3 &&
        value.selfTestAnswers.every(answer => String(answer).trim()) &&
        String(value.evidence || '').trim();
      if (!valid) throw new Error('review all cards and add evidence');
      state.days[id] = { ...value, done: true };
      persist();
    },
    getWeeklyDraft() {
      return { ...state.weeklyDraft };
    },
    saveWeeklyDraft(value) {
      state.weeklyDraft = { ...value };
      persist();
    }
  };
}
```

- [ ] **Step 4: Run tests and commit**

```powershell
node --test tests/learning-state.test.mjs
git add assets/js/learning-state.js tests/learning-state.test.mjs
git commit -m "feat: add local learning progress engine"
```

Expected: all learning-state tests pass.

---

### Task 4: Render learning data and a public knowledge-card page

**Files:**
- Modify: `scripts/templates/layout.mjs`
- Modify: `scripts/templates/pages.mjs`
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`
- Modify: `tests/public-pages.test.mjs`
- Generate: `learning/index.html`

**Interfaces:**
- Consumes: `learningCards`, `learningSources`, `learningSprints`.
- Produces: `learningPage(model)` and action-page JSON script tags `learning-sprint-data` and `learning-card-data`.

- [ ] **Step 1: Write failing build tests**

```js
test('生成公开学习卡片页并保留 NotebookLM 来源说明', async () => {
  const files = await buildSite({ write: false });
  const html = files.get('learning/index.html');
  assert.ok(html);
  assert.match(html, /NotebookLM/);
  assert.match(html, /OpenSpec/);
  assert.match(html, /gstack/);
  assert.match(html, /Spec Kit/);
  assert.match(html, /vibe-coding-cn/);
  assert.match(html, /data-card-group/);
});

test('行动页安全注入学习冲刺和知识卡 JSON', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  assert.match(html, /id="learning-sprint-data"/);
  assert.match(html, /id="learning-card-data"/);
  assert.doesNotMatch(html, /window\.LEARNING_/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/build.test.mjs tests/public-pages.test.mjs
```

Expected: FAIL because `learning/index.html` and injected learning data are missing.

- [ ] **Step 3: Add a Learning navigation entry**

In `scripts/templates/layout.mjs`, add:

```js
['learning', '学习卡', 'learning/']
```

Use the same depth-aware relative-link function as the existing navigation. Do not reorder the existing six entries except to place “学习卡” immediately before “今日行动”.

- [ ] **Step 4: Add the public learning page**

Implement `learningPage({ learningCards, learningSources })` in `pages.mjs`. Group cards by `group`, escape all text with `escapeHtml`, and render each answer inside a native `<details>` element:

```js
const learningCard = card => (
  '<article class="knowledge-card" data-card-group="' +
  escapeHtml(card.group) + '">' +
  '<p>' + escapeHtml(card.groupLabel) + '</p>' +
  '<h2>' + escapeHtml(card.front) + '</h2>' +
  '<details><summary>查看答案</summary>' +
  '<p>' + escapeHtml(card.back) + '</p>' +
  '<h3>为什么重要</h3><p>' + escapeHtml(card.why) + '</p>' +
  '<h3>常见误区</h3><p>' + escapeHtml(card.misconception) + '</p>' +
  '<small>来源：NotebookLM · ' +
  escapeHtml(card.provenance.notebook) + '</small></details></article>'
);
```

The page introduction must state that official links are further reading while formal card wording is compiled from NotebookLM snapshots.

- [ ] **Step 5: Inject learning JSON into the action page**

Change the action-page signature:

```js
function actionPage({ tasks, learningCards, learningSprints }) {
  const safeTasksJson = JSON.stringify(tasks).replaceAll('<', '\\u003c');
  const safeLearningCardsJson =
    JSON.stringify(learningCards).replaceAll('<', '\\u003c');
  const safeLearningSprintsJson =
    JSON.stringify(learningSprints).replaceAll('<', '\\u003c');
```

Add:

```html
<script type="application/json" id="learning-sprint-data">...</script>
<script type="application/json" id="learning-card-data">...</script>
```

- [ ] **Step 6: Register the generated page**

Add to `renderPages(model)`:

```js
['learning/index.html', learningPage(model)]
```

Update the build-count assertion from 8 to 9 generated pages.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/build.test.mjs tests/public-pages.test.mjs
git add scripts/templates/layout.mjs scripts/templates/pages.mjs scripts/build.mjs tests/build.test.mjs tests/public-pages.test.mjs
git commit -m "feat: publish NotebookLM knowledge card library"
```

---

### Task 5: Integrate learning into the action calendar

**Files:**
- Modify: `assets/js/action-page.js`
- Modify: `scripts/templates/pages.mjs`
- Modify: `assets/styles/site.css`
- Modify: `tests/action-page.test.mjs`

**Interfaces:**
- Consumes: `createLearningStore`, action tasks, learning sprints, and cards.
- Produces: calendar cells with independent action and learning entries plus `openLearning(sprint, trigger)`.

- [ ] **Step 1: Write failing calendar and page tests**

```js
test('月历同一天可以同时包含行动和学习入口', () => {
  const tasks = [{ id: 'd07', date: '2026-07-26', title: '周复盘' }];
  const learning = [{
    id: 'learn-d01',
    date: '2026-07-26',
    title: '全景认知'
  }];
  const cells = buildMonthCells(
    2026, 6, tasks, '2026-07-26', new Set(),
    learning, new Set()
  );
  const cell = cells.find(item => item?.day === 26);
  assert.equal(cell.task.id, 'd07');
  assert.equal(cell.learning.id, 'learn-d01');
});

test('行动页包含学习卡片、闭卷自测和打卡入口', async () => {
  const html = (await buildSite({ write: false })).get('action/index.html');
  for (const id of [
    'learning-overview',
    'learning-dialog',
    'learning-card-list',
    'learning-self-test',
    'learning-evidence',
    'complete-learning'
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/action-page.test.mjs
```

Expected: FAIL because calendar cells have no learning entry and page IDs are missing.

- [ ] **Step 3: Extend `buildMonthCells` without breaking current callers**

Use:

```js
export function buildMonthCells(
  year,
  month,
  tasks,
  todayIso,
  doneIds = new Set(),
  learningSprints = [],
  completedLearningIds = new Set()
) {
```

Each non-empty result becomes:

```js
{
  day,
  date,
  today: date === todayIso,
  task: tasks.find(task => task.date === date) || null,
  done: task ? doneIds.has(task.id) : false,
  learning: learningSprints.find(day => day.date === date) || null,
  learningDone: learning ? completedLearningIds.has(learning.id) : false
}
```

- [ ] **Step 4: Add learning markup to `actionPage()`**

Add a learning overview before the calendar and an accessible learning dialog. Required IDs:

```text
learning-overview
open-learning-today
learning-dialog
learning-dialog-title
learning-agenda
learning-card-list
learning-checklist
learning-self-test
learning-evidence
save-learning
complete-learning
```

Use labels explaining that content is public but learning answers and evidence stay in the current browser.

- [ ] **Step 5: Initialize and render the learning store**

At the top of `action-page.js`:

```js
import { createLearningStore } from './learning-state.js';
```

Inside `initActionPage`:

```js
const learningSprints = options.learningSprints ||
  JSON.parse(root.querySelector('#learning-sprint-data').textContent);
const learningCards = options.learningCards ||
  JSON.parse(root.querySelector('#learning-card-data').textContent);
const learningStore = createLearningStore({
  storage,
  key: 'mrcharm-learning-v1',
  sprints: learningSprints,
  cards: learningCards
});
```

Render each card as a button-controlled disclosure. The answer container starts hidden and is revealed with `aria-expanded`. Mark a card reviewed when its answer is opened; provide “会讲” and “需复习” buttons that call `setCardLevel`.

- [ ] **Step 6: Render dual entries inside calendar cells**

Render the day cell as a non-button container. Append separate buttons:

```html
<button class="calendar-entry action-entry" data-task-id="d07">行动 · 周复盘</button>
<button class="calendar-entry learning-entry" data-learning-id="learn-d01">学习 · 全景认知</button>
```

The global click handler must route `data-task-id` to `openTask` and `data-learning-id` to `openLearning`.

- [ ] **Step 7: Add responsive styles**

Add styles for:

```css
.learning-overview
.calendar-entry
.learning-entry
.learning-dialog
.learning-card-button
.learning-card-answer
.learning-level-controls
.learning-self-test
```

At widths below 720px, stack learning overview content, keep calendar entries readable, and prevent horizontal overflow.

- [ ] **Step 8: Run action and visual-contract tests**

```powershell
node --test tests/action-page.test.mjs tests/visual-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit the learning UI**

```powershell
git add assets/js/action-page.js scripts/templates/pages.mjs assets/styles/site.css tests/action-page.test.mjs
git commit -m "feat: add daily learning cards to action calendar"
```

---

### Task 6: Export privacy-safe weekly material

**Files:**
- Create: `assets/js/weekly-export.js`
- Create: `tests/weekly-export.test.mjs`
- Modify: `scripts/templates/pages.mjs`
- Modify: `assets/js/action-page.js`
- Modify: `tests/action-page.test.mjs`

**Interfaces:**
- Consumes: explicit public summary fields, action store, learning store, tasks, and sprints.
- Produces: `buildWeeklyExport(input) -> object` and a downloaded `mrcharm-weekly-input-YYYY-MM-DD.json`.

- [ ] **Step 1: Write failing privacy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyExport } from '../assets/js/weekly-export.js';

test('周报导出只包含公开摘要和完成标题', () => {
  const payload = buildWeeklyExport({
    weekEnding: '2026-07-31',
    publicDraft: {
      headline: '第一次完成规格驱动学习',
      did: '完成三天学习冲刺',
      learned: '规格是人与 AI 的协议层',
      revised: '工具越多不等于流程越可靠',
      next: '用一个真实需求比较两套规格框架',
      links: ['https://example.com/public']
    },
    completedTasks: [{ title: '公开任务', evidence: '私人证据' }],
    completedLearning: [{
      title: 'OpenSpec 与 Spec Kit',
      selfTestAnswers: ['私人答案']
    }]
  });
  const text = JSON.stringify(payload);
  assert.match(text, /第一次完成规格驱动学习/);
  assert.match(text, /公开任务/);
  assert.doesNotMatch(text, /私人证据/);
  assert.doesNotMatch(text, /私人答案/);
});

test('缺少核心公开摘要时拒绝导出', () => {
  assert.throws(() => buildWeeklyExport({
    weekEnding: '2026-07-31',
    publicDraft: {},
    completedTasks: [],
    completedLearning: []
  }), /public weekly fields are required/);
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/weekly-export.test.mjs
```

Expected: FAIL because `weekly-export.js` does not exist.

- [ ] **Step 3: Implement `buildWeeklyExport`**

```js
const requiredFields = ['headline', 'did', 'learned', 'revised', 'next'];

export function buildWeeklyExport({
  weekEnding,
  publicDraft,
  completedTasks,
  completedLearning
}) {
  if (requiredFields.some(field => !String(publicDraft[field] || '').trim())) {
    throw new Error('public weekly fields are required');
  }
  return {
    version: 1,
    weekEnding,
    exportedAt: new Date().toISOString(),
    public: {
      headline: publicDraft.headline.trim(),
      did: publicDraft.did.trim(),
      learned: publicDraft.learned.trim(),
      revised: publicDraft.revised.trim(),
      next: publicDraft.next.trim(),
      links: (publicDraft.links || []).filter(Boolean)
    },
    completedTaskTitles: completedTasks.map(item => item.title),
    completedLearningTitles: completedLearning.map(item => item.title)
  };
}
```

- [ ] **Step 4: Add the weekly-material form**

Add five text fields and one link field to the action page:

```text
weekly-headline
weekly-did
weekly-learned
weekly-revised
weekly-next
weekly-links
export-weekly
```

Copy must say: “只有这里填写的内容和完成标题会进入导出；私人证据、复盘和自测答案不会导出。”

- [ ] **Step 5: Wire local draft persistence and download**

On field input, call `learningStore.saveWeeklyDraft`. On export, call `buildWeeklyExport`, create a JSON blob, and download:

```js
link.download = 'mrcharm-weekly-input-' + localDateISO() + '.json';
```

Show an error toast if required fields are missing.

- [ ] **Step 6: Run tests and commit**

```powershell
node --test tests/weekly-export.test.mjs tests/action-page.test.mjs
git add assets/js/weekly-export.js tests/weekly-export.test.mjs scripts/templates/pages.mjs assets/js/action-page.js tests/action-page.test.mjs
git commit -m "feat: export privacy-safe weekly report material"
```

---

### Task 7: Generate weekly-report Markdown with fail-closed validation

**Files:**
- Create: `scripts/generate-weekly-report.mjs`
- Create: `tests/weekly-report.test.mjs`
- Modify: `scripts/lib/content.mjs`
- Generate at runtime: `content/posts/YYYY-MM-DD-weekly.md`

**Interfaces:**
- Consumes: version-1 weekly export JSON.
- Produces: `validateWeeklyInput(value)` and `generateWeeklyMarkdown(value)`.

- [ ] **Step 1: Write failing generator tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateWeeklyMarkdown,
  validateWeeklyInput
} from '../scripts/generate-weekly-report.mjs';

const input = {
  version: 1,
  weekEnding: '2026-07-31',
  exportedAt: '2026-07-31T09:00:00.000Z',
  public: {
    headline: '把 AI 编程方法论讲清楚',
    did: '完成三天学习冲刺。',
    learned: '规格是人与 AI 的协议层。',
    revised: '工具数量不是产出质量。',
    next: '用真实需求比较 OpenSpec 与 Spec Kit。',
    links: ['https://mrcharm.github.io/cat-grok-website/learning/']
  },
  completedTaskTitles: ['建立个人知识库首页'],
  completedLearningTitles: ['OpenSpec 与 Spec Kit']
};

test('有效公开素材生成可索引的周报 Markdown', () => {
  const markdown = generateWeeklyMarkdown(input);
  assert.match(markdown, /title: 猫哥周报 · 2026-07-31/);
  assert.match(markdown, /status: published/);
  assert.match(markdown, /category: 周报/);
  assert.match(markdown, /哪个判断被推翻/);
  assert.match(markdown, /下周唯一重点/);
});

test('非周五、旧导出或未知字段时失败关闭', () => {
  assert.throws(() => validateWeeklyInput({
    ...input,
    weekEnding: '2026-08-01'
  }), /weekEnding must be Friday/);
  assert.throws(() => validateWeeklyInput({
    ...input,
    privateReview: '不应出现'
  }), /unknown weekly input field/);
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/weekly-report.test.mjs
```

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement strict validation and rendering**

The validator must:

- accept only top-level fields `version`, `weekEnding`, `exportedAt`, `public`, `completedTaskTitles`, `completedLearningTitles`;
- require version `1`;
- require `weekEnding` to be a Friday;
- require all five public text fields;
- reject links not beginning with `https://`;
- reject input exported more than seven days before `weekEnding`;
- reject strings containing `ghp_`, `github_pat_`, `账户密码`, `银行卡号`, or `内部表名`.

The renderer must return:

```markdown
---
title: 猫哥周报 · 2026-07-31
slug: weekly-2026-07-31
date: 2026-07-31
summary: 把 AI 编程方法论讲清楚
status: published
category: 周报
---

## 本周一句话

把 AI 编程方法论讲清楚

## 做成了什么

完成三天学习冲刺。

## 学到了什么

规格是人与 AI 的协议层。

## 哪个判断被推翻

工具数量不是产出质量。

## 下周唯一重点

用真实需求比较 OpenSpec 与 Spec Kit。
```

Append completed-title lists and public links only when non-empty.

- [ ] **Step 4: Add a command-line interface**

Support:

```powershell
node scripts/generate-weekly-report.mjs --input "C:\Users\Administrator\Downloads\mrcharm-weekly-input-2026-07-31.json" --check
node scripts/generate-weekly-report.mjs --input "C:\Users\Administrator\Downloads\mrcharm-weekly-input-2026-07-31.json" --write
```

`--check` validates without writing. `--write` writes exactly one file under `content/posts/` and fails if that week’s slug already exists with different content.

- [ ] **Step 5: Run tests and commit**

```powershell
node --test tests/weekly-report.test.mjs tests/public-pages.test.mjs
git add scripts/generate-weekly-report.mjs tests/weekly-report.test.mjs scripts/lib/content.mjs
git commit -m "feat: add guarded weekly report generator"
```

---

### Task 8: Full verification, visual QA, publishing, and automation

**Files:**
- Modify if required by QA: only files introduced or touched in Tasks 1–7.
- Create external state: one Codex recurring automation.

**Interfaces:**
- Consumes: complete static site and weekly-report generator.
- Produces: deployed website and active Friday automation.

- [ ] **Step 1: Run the full local gate**

```powershell
pnpm check
pnpm audit --prod
git diff --check
git status --short
```

Expected:

```text
all tests pass
build generates 9 pages
No known vulnerabilities found
no diff-check errors
only intentional feature files changed before commit
```

- [ ] **Step 2: Run browser QA**

Verify at desktop 1440×900 and mobile 390×844:

1. Action page shows the 30-day task and the learning sprint independently.
2. July 26–28 calendar cells show both entries where applicable.
3. Clicking a learning entry opens the correct day.
4. Card answers start closed and are keyboard accessible.
5. “会讲 / 需复习” survives refresh.
6. Incomplete study cannot be marked complete.
7. Weekly export excludes private evidence, review, and self-test text.
8. Learning library groups mandatory and additional topics.
9. No console errors or horizontal overflow.

- [ ] **Step 3: Commit final generated pages and fixes**

```powershell
git add .
git diff --cached --check
git commit -m "feat: launch NotebookLM learning sprint and weekly reports"
```

Do not commit NotebookLM browser state, cookies, tokens, Downloads files, or local logs.

- [ ] **Step 4: Push and verify GitHub Pages**

```powershell
git push origin main
```

Verify:

```text
https://mrcharm.github.io/cat-grok-website/action/
https://mrcharm.github.io/cat-grok-website/learning/
https://mrcharm.github.io/cat-grok-website/writing/
```

Required online markers:

```text
3 天学习冲刺
NotebookLM
OpenSpec
Spec Kit
导出周报素材
```

- [ ] **Step 5: Create the Friday Codex automation**

Resolve the saved project with `list_projects`, then create one active local cron automation named `猫哥每周成长周报` for Fridays at 18:30 Asia/Shanghai.

Use this automation prompt:

```text
在 cat-grok-website 项目执行猫哥每周成长周报发布。

先确认当前日期是 Asia/Shanghai 时区的周五，并计算当天 YYYY-MM-DD。
1. 检查 git status --porcelain；若工作区不干净，停止且报告，不覆盖任何修改。
2. 在 C:\Users\Administrator\Downloads 中寻找最近 7 天修改的 mrcharm-weekly-input-*.json，选择最新文件。
3. 若没有素材，停止且提醒猫哥在网站“今日行动”中填写并导出周报素材；不得编造或发布空周报。
4. 运行 node scripts/generate-weekly-report.mjs --input <文件> --check。
5. 运行 node scripts/generate-weekly-report.mjs --input <文件> --write。
6. 检查生成文章只包含公开字段、完成标题和公开链接，不包含私人证据、复盘、自测答案、凭据或内部标识。
7. 运行 pnpm check 和 pnpm audit --prod；任一失败则停止。
8. 检查 diff，只允许本周 Markdown、构建生成页面和索引发生预期变化。
9. 提交消息使用 docs: publish weekly report YYYY-MM-DD，推送 main。
10. 等待 GitHub Pages 部署并验证 writing/ 和本周文章公开可访问。
任何门禁失败都不得推送，并清楚报告缺少什么。
```

- [ ] **Step 6: Inspect automation and online deployment**

Use the automation view operation to confirm:

- name is correct;
- status is active;
- cadence is Friday 18:30 in Asia/Shanghai;
- project is the saved `cat-grok-website` project;
- prompt includes all fail-closed gates.

Finally fetch remote `main`, confirm local and remote SHAs match, and repeat online marker checks.
