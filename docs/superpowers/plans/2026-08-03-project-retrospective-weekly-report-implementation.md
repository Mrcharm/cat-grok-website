# Project Retrospective Weekly Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the weekly report from short activity summaries to a public-safe project retrospective with one featured deep review, supporting reviews, a weekly judgment, and reusable methods.

**Architecture:** Keep the current v1 public JSON and renderer behavior intact, and add a strict `mrcharm-weekly-public-v2` path inside the same generator. The Friday automation will create v2 directly from a token-capped cross-project task scan; the action-page v1 export remains a backward-compatible manual fallback.

**Tech Stack:** Node.js ESM, `node:test`, Markdown, PowerShell, Codex desktop automations, GitHub Pages.

## Global Constraints

- Exactly one v2 item must use `role: "featured"`; all others use `role: "supporting"`.
- The featured review renders challenge, creative idea, execution, validation, and value as distinct sections.
- The final report targets 1500–2500 Chinese characters, with at most five projects.
- Collection lists at most 50 tasks and selectively reads at most six completed candidate tasks, two turns and 2500 characters per task, with tool outputs excluded.
- Never publish raw conversations, prompts, code bodies, secrets, personal data, internal company/client data, absolute local paths, or fields named `evidence`, `review`, or `checks`.
- In-progress work, simulation, and unverified claims are excluded.
- Repository safety remains unchanged: `main`, clean tree, `git pull --ff-only`, no force push, no reset, and stop on any failed gate.

---

### Task 1: Lock the v2 contract with failing tests

**Files:**
- Modify: `tests/weekly-report.test.mjs`

**Interfaces:**
- Consumes: existing `buildWeeklyReport(input)` export.
- Produces: executable examples for `mrcharm-weekly-public-v2` and its rejection rules.

- [ ] **Step 1: Add a complete v2 fixture and rendering test**

Append this fixture and test to `tests/weekly-report.test.mjs`:

```js
const validV2 = {
  schema: 'mrcharm-weekly-public-v2',
  weekEnding: '2026-08-07',
  weekSummary: '本周最大的变化，是把零散交付升级为可验证、可复用的产品工作闭环。',
  methods: [
    '先识别真正阻塞交付的约束，再决定原型和验证范围。',
    '公开表达只保留已完成且可复核的结果。'
  ],
  items: [{
    id: 'codex-20260807-01',
    date: '2026-08-07',
    title: '完成数据产品方案与交互原型交付',
    phaseTitle: '产品设计与交付',
    role: 'featured',
    challenge: '需求来源分散，且方案、原型和验证容易彼此脱节。',
    creativeIdea: '把交付物组织成从需求覆盖到可用性验证的闭环，而不是只提交页面。',
    execution: '合并重复事项，形成产品方案、交互原型和配套校验材料。',
    validation: '完成关键路径、页面适配、SQL 语法和文件编码检查。',
    value: '沉淀出可复用的数据产品交付框架。'
  }, {
    id: 'codex-20260807-02',
    date: '2026-08-07',
    title: '修复 Windows 技能导入包',
    phaseTitle: 'AI 工具与工作流',
    role: 'supporting',
    challenge: '压缩包可解压但无法导入。',
    creativeIdea: '从导入器路径安全规则而非文件内容反查问题。',
    execution: '重建压缩包并统一内部路径。',
    validation: '验证根目录和路径分隔符符合导入要求。',
    value: '形成 Windows 技能包的兼容性检查方法。'
  }]
};

test('v2 生成项目复盘型周报', () => {
  const report = buildWeeklyReport(validV2);
  assert.match(report.markdown, /本周核心判断/);
  assert.match(report.markdown, /重点项目深复盘/);
  assert.match(report.markdown, /背景与难点/);
  assert.match(report.markdown, /核心创意/);
  assert.match(report.markdown, /验证结果/);
  assert.match(report.markdown, /其他成果/);
  assert.match(report.markdown, /方法论沉淀/);
  assert.match(report.markdown, /从导入器路径安全规则/);
});
```

- [ ] **Step 2: Add strict contract rejection tests**

Append:

```js
test('v2 必须恰好包含一个重点项目', () => {
  const none = structuredClone(validV2);
  none.items.forEach(item => { item.role = 'supporting'; });
  assert.throws(() => buildWeeklyReport(none), /exactly one featured item/);

  const many = structuredClone(validV2);
  many.items[1].role = 'featured';
  assert.throws(() => buildWeeklyReport(many), /exactly one featured item/);
});

test('v2 拒绝未知字段和私密字段', () => {
  const unknown = structuredClone(validV2);
  unknown.items[0].extra = 'not allowed';
  assert.throws(() => buildWeeklyReport(unknown), /unsupported weekly item field/);

  const privateInput = structuredClone(validV2);
  privateInput.items[0].review = 'private';
  assert.throws(() => buildWeeklyReport(privateInput), /private field/);
});

test('v1 继续兼容原有公开素材', () => {
  const report = buildWeeklyReport(valid);
  assert.match(report.markdown, /完成机会判断表/);
});
```

- [ ] **Step 3: Run the focused tests and confirm the new behavior fails**

Run:

```powershell
node --test tests/weekly-report.test.mjs
```

Expected: existing v1 tests pass; v2 tests fail with `invalid weekly schema`.

- [ ] **Step 4: Commit the red tests**

```powershell
git add tests/weekly-report.test.mjs
git commit -m "test: define retrospective weekly report v2"
```

---

### Task 2: Implement strict v2 validation and Markdown rendering

**Files:**
- Modify: `scripts/generate-weekly-report.mjs`
- Test: `tests/weekly-report.test.mjs`

**Interfaces:**
- Consumes: `mrcharm-weekly-public-v1` or `mrcharm-weekly-public-v2` objects.
- Produces: unchanged `{ slug, title, markdown }` from `buildWeeklyReport(input)`.

- [ ] **Step 1: Add v2 field whitelists and reusable validators**

Add beside the existing constants:

```js
const V2_TOP_FIELDS = new Set(['schema', 'weekEnding', 'weekSummary', 'methods', 'items']);
const V2_ITEM_FIELDS = new Set([
  'id', 'date', 'title', 'phaseTitle', 'role', 'challenge',
  'creativeIdea', 'execution', 'validation', 'value'
]);

const assertAllowedKeys = (value, allowed, label) => {
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) throw new Error(`unsupported ${label} field: ${key}`);
  }
};

const requireMethods = value => {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    throw new Error('methods must contain 2 or 3 items');
  }
  return value.map((method, index) => requireText(method, `methods[${index}]`, 240));
};
```

- [ ] **Step 2: Keep the existing v1 implementation in place**

Do not move or rewrite the current v1 validation and Markdown assembly. Add the v2 helper before the exported function, then route to it before the current v1 schema check. This minimizes regression risk and keeps `generatedAt` tolerated for v1 compatibility.

- [ ] **Step 3: Implement the v2 renderer**

Add `buildV2WeeklyReport(input)` with these exact rules:

```js
const buildV2WeeklyReport = input => {
  assertAllowedKeys(input, V2_TOP_FIELDS, 'weekly');
  const weekEnding = requireText(input.weekEnding, 'weekEnding', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnding)) throw new Error('invalid week ending');
  const weekSummary = requireText(input.weekSummary, 'weekSummary', 600);
  const methods = requireMethods(input.methods);
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 5) {
    throw new Error('v2 items must contain 1 to 5 projects');
  }

  const items = input.items.map((item, index) => {
    assertAllowedKeys(item, V2_ITEM_FIELDS, 'weekly item');
    if (!['featured', 'supporting'].includes(item.role)) {
      throw new Error(`items[${index}].role is invalid`);
    }
    return {
      id: requireText(item.id, `items[${index}].id`, 30),
      date: requireText(item.date, `items[${index}].date`, 10),
      title: requireText(item.title, `items[${index}].title`, 120),
      phaseTitle: requireText(item.phaseTitle, `items[${index}].phaseTitle`, 120),
      role: item.role,
      challenge: requireText(item.challenge, `items[${index}].challenge`, 600),
      creativeIdea: requireText(item.creativeIdea, `items[${index}].creativeIdea`, 600),
      execution: requireText(item.execution, `items[${index}].execution`, 800),
      validation: requireText(item.validation, `items[${index}].validation`, 600),
      value: requireText(item.value, `items[${index}].value`, 600)
    };
  });

  const featured = items.filter(item => item.role === 'featured');
  if (featured.length !== 1) throw new Error('v2 requires exactly one featured item');
  const supporting = items.filter(item => item.role === 'supporting');
  const slug = `weekly-${weekEnding}`;
  const title = `AI 产品经理成长周报 · ${weekEnding}`;

  const featuredMarkdown = [
    `### ${featured[0].date} · ${featured[0].title}`,
    '', '#### 背景与难点', '', featured[0].challenge,
    '', '#### 核心创意', '', featured[0].creativeIdea,
    '', '#### 关键实现', '', featured[0].execution,
    '', '#### 验证结果', '', featured[0].validation,
    '', '#### 长期价值', '', featured[0].value
  ].join('\n');

  const supportingMarkdown = supporting.map(item => [
    `### ${item.date} · ${item.title}`,
    '', `**难点与亮点：** ${item.challenge}${item.creativeIdea}`,
    '', `**结果与价值：** ${item.execution}${item.validation}${item.value}`
  ].join('\n')).join('\n\n');

  const markdown = [
    '---',
    `title: ${yamlText(title)}`,
    `slug: ${slug}`,
    `date: ${weekEnding}`,
    `summary: ${yamlText(weekSummary)}`,
    'status: published',
    'category: AI 产品成长周报',
    '---', '',
    '## 本周核心判断', '', weekSummary, '',
    '## 重点项目深复盘', '', featuredMarkdown,
    ...(supporting.length ? ['', '## 其他成果', '', supportingMarkdown] : []),
    '', '## 方法论沉淀', '',
    ...methods.map(method => `- ${method}`),
    '', '## 仍然保留的边界', '',
    '- 不公开原始对话、私人复盘、公司内部数据或未核实的业务结果。',
    '- 进行中的工作不计入本周成果，验证尚未完成的结论会延后记录。',
    ''
  ].join('\n');

  return { slug, title, markdown };
};
```

- [ ] **Step 4: Route v2 after the private-field scan and before the v1 check**

Change only the opening of `buildWeeklyReport` to:

```js
export function buildWeeklyReport(input) {
  assertNoPrivateFields(input);
  if (input?.schema === 'mrcharm-weekly-public-v2') return buildV2WeeklyReport(input);
  if (input?.schema !== 'mrcharm-weekly-public-v1') {
    throw new Error('invalid weekly schema');
  }

  // Keep the current v1 item validation and Markdown assembly below this line unchanged.
}
```

- [ ] **Step 5: Run focused and full tests**

Run:

```powershell
node --test tests/weekly-report.test.mjs
pnpm check
```

Expected: all weekly tests pass; validation, full test suite, build, and smoke tests pass.

- [ ] **Step 6: Commit the generator implementation**

```powershell
git add scripts/generate-weekly-report.mjs tests/weekly-report.test.mjs
git commit -m "feat: render project retrospective weekly reports"
```

---

### Task 3: Document v2 and verify backward compatibility

**Files:**
- Modify: `docs/weekly-report-runbook.md`
- Test: `tests/weekly-report.test.mjs`

**Interfaces:**
- Consumes: v1 manual action-page export and v2 automation export.
- Produces: operator guidance for both supported inputs and unchanged publish command.

- [ ] **Step 1: Update the runbook**

Document these exact facts:

```markdown
## 支持的公开素材

- `mrcharm-weekly-public-v1`：行动页手动导出的简版公开素材，保持兼容。
- `mrcharm-weekly-public-v2`：自动任务生成的项目复盘素材，必须恰好包含一个 `featured` 项目、2～3 条方法论和不超过 5 个项目。
- 两种格式都禁止 `evidence`、`review`、`checks`，也不得包含原始对话、内部数据或未验证结论。

自动任务优先生成 v2；手动导出的 v1 仍可通过同一发布脚本发布。
```

Keep the existing PowerShell command and repository safety instructions unchanged.

- [ ] **Step 2: Run documentation-adjacent verification**

Run:

```powershell
pnpm check
git diff --check
```

Expected: all checks pass and no whitespace errors are reported.

- [ ] **Step 3: Commit the runbook**

```powershell
git add docs/weekly-report-runbook.md
git commit -m "docs: document retrospective weekly report input"
```

---

### Task 4: Update the single Friday automation

**Files:**
- Update through Codex automation API: `automation-4`
- Update: `C:\Users\Administrator\.codex\automations\automation-4\memory.md`

**Interfaces:**
- Consumes: at most 50 current-week task summaries plus at most six selective task reads.
- Produces: `C:\Users\Administrator\Downloads\mrcharm-weekly-public-<WeekEnding>.json` using v2 and then invokes the existing publish script.

- [ ] **Step 1: Replace only the collection and JSON-writing portions of the automation prompt**

Require:

```text
- List at most 50 tasks once and filter to the current Monday-through-Friday window in Asia/Shanghai.
- Shortlist completed tasks from list summaries; selectively read at most 6 tasks, 2 recent turns, includeOutputs=false, maxOutputCharsPerItem=2500.
- Select exactly one featured project using delivery, difficulty, creative judgment, verification, and reusability.
- Publish at most 5 projects.
- Generate mrcharm-weekly-public-v2 with weekSummary, 2-3 methods, and the exact item fields id/date/title/phaseTitle/role/challenge/creativeIdea/execution/validation/value.
- Featured content must support 500-800 Chinese characters in the rendered report; supporting items support 180-300 characters each; total target 1500-2500 Chinese characters.
- Missing facts stay omitted by excluding the project; never fill length with generic prose.
```

Preserve the Friday 18:30 schedule, low reasoning setting, repository gates, PowerShell command, Pages wait, and concise final notification.

- [ ] **Step 2: Verify the saved automation configuration**

Read the saved configuration as UTF-8 and assert it contains:

```text
mrcharm-weekly-public-v2
最多 50
最多 6
恰好一个 featured
1500～2500
publish-weekly-report.ps1
BYHOUR=18;BYMINUTE=30
reasoning_effort = "low"
```

Expected: all assertions are true and no `automation-5` configuration exists.

- [ ] **Step 3: Record the configuration change in automation memory**

Append the run time, v2 decision, token caps, and verification result. Do not claim publication occurred.

---

### Task 5: Regenerate and inspect the richer dry-run preview

**Files:**
- Replace: `C:\Users\Administrator\Documents\renewme\weekly-preview-2026-08-07\mrcharm-weekly-public-2026-08-07.preview.json`
- Replace: `C:\Users\Administrator\Documents\renewme\weekly-preview-2026-08-07\weekly-2026-08-07.md`

**Interfaces:**
- Consumes: the previously selected completed public-safe outcomes.
- Produces: a local-only v2 JSON and exact Markdown preview; no repository publication.

- [ ] **Step 1: Rewrite the preview JSON as v2**

Use “数据产品方案与交互原型交付” as the single featured project. Use the Windows import-package fix and 90-day growth system as supporting projects. Write specific challenge, creative idea, execution, validation, and value text from verified task summaries; exclude active ETL-SQL and PPT work.

- [ ] **Step 2: Generate Markdown with the real script**

Run:

```powershell
node scripts/generate-weekly-report.mjs `
  C:\Users\Administrator\Documents\renewme\weekly-preview-2026-08-07\mrcharm-weekly-public-2026-08-07.preview.json `
  C:\Users\Administrator\Documents\renewme\weekly-preview-2026-08-07
```

Expected: `weekly-2026-08-07.md` is generated without modifying `content/posts`.

- [ ] **Step 3: Validate content and safety**

Check that the preview contains all required section headings, exactly one featured project, two supporting projects, two or three methods, and none of:

```text
evidence
review
checks
C:\
E:\
```

Count Chinese characters and require 1500–2500. If below 1500, add only verified context, decisions, or validation details; do not add generic encouragement.

- [ ] **Step 4: Run final repository verification**

Run:

```powershell
pnpm check
git status --short
git log -4 --oneline
```

Expected: checks pass; the repository is clean; commits show the approved design, v2 tests/implementation, and runbook update. The preview remains outside the repository and nothing is pushed or published during the dry run.
