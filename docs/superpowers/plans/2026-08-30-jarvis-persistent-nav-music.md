# JARVIS Persistent Navigation and Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one fixed `MR.C JARVIS` shell for 首页、文章、技能、作品集, preserve the current JARVIS homepage, and keep NetEase playlist `885054268` alive during no-refresh navigation.

**Architecture:** Keep every route as a complete static HTML document for direct access and SEO, but let `site.js` intercept the four same-origin navigation links and replace only `<main>`. Generate all four pages from one shell so header markup cannot drift; keep the NetEase iframe outside `<main>` and use an explicit music state controller with an honest click-to-unlock fallback.

**Tech Stack:** Node.js ESM, built-in `node:test`, static HTML/CSS/JavaScript, History API, Fetch API, DOMParser, GitHub Pages.

## Global Constraints

- Four public routes are exactly `index.html`, `articles/index.html`, `skills/index.html`, and `portfolio/index.html`.
- Header order is exactly brand, 首页, 文章, 技能, 作品集, 音乐.
- NetEase playlist ID is exactly `885054268`; initial iframe URL uses `auto=1`.
- The current homepage sphere, copy, voice dock, and JARVIS interaction must remain visually and behaviorally intact.
- The header and music iframe must never be replaced during enhanced navigation.
- The active navigation item may change color, border, and background only; it may not change font weight, font size, padding, or reserved width.
- Browser autoplay policy must not be bypassed or misrepresented. The UI may say “播放器已加载” or “没听到音乐？点击开启”, never “正在播放” without proof.
- Do not proxy, download, or redistribute NetEase audio.
- If enhanced navigation fails, perform a normal document navigation.
- Use test-first changes and commit after every task.
- The current branch starts with 14 stale tests from the abandoned six-page site contract. Task 1 replaces only those obsolete assertions; unrelated passing tests must stay unchanged.

---

## File Structure

- `scripts/templates/layout.mjs`: owns the only site shell, nav metadata, music markup, page metadata, and root-relative URLs.
- `scripts/templates/pages.mjs`: owns four page bodies; keeps route-specific HTML out of the shell and adds the portfolio body to generated output.
- `assets/styles/site.css`: owns shared header, stable geometry, music prompt, loading state, responsive behavior, and page-body themes.
- `assets/js/site.js`: owns mobile nav, enhanced page navigation, history updates, metadata swaps, and shared music state.
- `assets/js/jarvis-home.js`: exposes idempotent `initJarvisHome()` and `destroyJarvisHome()` lifecycle functions.
- `assets/js/articles.js`: exposes idempotent `initArticlesPage()`.
- `assets/js/skills.js`: exposes idempotent `initSkillsPage()`.
- `assets/js/page-lifecycle.js`: maps route paths to page initializers and cleanup functions.
- `tests/current-site-contract.test.mjs`: validates the four-page product contract and removes dependence on retired routes.
- `tests/site-navigation.test.mjs`: unit-tests same-origin interception, main-only replacement, history, fallback, and stable shell identity.
- `tests/music-controller.test.mjs`: unit-tests playlist URL, gesture recovery, session mute, and iframe persistence.
- `tests/visual-contract.test.mjs`: validates fixed header geometry rules and stable active-link sizing.

---

### Task 1: Replace the stale six-page test contract with the current four-page contract

**Files:**
- Create: `tests/current-site-contract.test.mjs`
- Modify: `tests/build.test.mjs`
- Modify: `tests/homepage.test.mjs`
- Modify: `tests/legacy-content.test.mjs`
- Modify: `tests/public-pages.test.mjs`
- Modify: `tests/repository-baseline.test.mjs`
- Modify: `tests/visual-contract.test.mjs`

**Interfaces:**
- Consumes: `buildSite({ write: false }): Promise<Map<string, string>>`.
- Produces: one authoritative four-route contract used by later tasks.

- [ ] **Step 1: Add the failing current-site contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from '../scripts/build.mjs';

const routes = [
  ['index.html', '首页'],
  ['articles/index.html', '文章'],
  ['skills/index.html', '技能'],
  ['portfolio/index.html', '作品集']
];

test('生成当前四个 JARVIS 公开页面', async () => {
  const files = await buildSite({ write: false });
  assert.deepEqual([...files.keys()].sort(), routes.map(([path]) => path).sort());
});

test('四页使用同一品牌、导航和音乐歌单', async () => {
  const files = await buildSite({ write: false });
  for (const [path] of routes) {
    const html = files.get(path);
    assert.match(html, /<header class="site-header">/);
    assert.match(html, /<span>MR\.C <b>JARVIS<\/b><\/span>/);
    assert.match(html, /id="site-nav" class="nav"/);
    assert.match(html, /首页[\s\S]*文章[\s\S]*技能[\s\S]*作品集/);
    assert.match(html, /id=885054268&amp;auto=1/);
    assert.equal((html.match(/<main\b/g) || []).length, 1, path);
  }
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/current-site-contract.test.mjs`

Expected: FAIL because `portfolio/index.html` is not generated, the shell differs, and the iframe still uses `auto=0` or is absent.

- [ ] **Step 3: Rewrite only obsolete assertions in the six listed test files**

Use these exact current expectations:

```js
const currentRoutes = [
  'index.html',
  'articles/index.html',
  'skills/index.html',
  'portfolio/index.html'
];

assert.match(files.get('index.html'), /JARVIS/);
assert.match(files.get('articles/index.html'), /技术文章/);
assert.match(files.get('skills/index.html'), /技能库/);
assert.match(files.get('portfolio/index.html'), /作品集/);
```

Remove assertions that require retired `timeline/`, `writing/`, `projects/`, `about/`, or deleted blog-detail files. Keep canonical, Open Graph, safe-link, content validation, learning-plan, weekly-report, and privacy tests unchanged. Update the visual contract to assert `--jarvis-cyan`, `@media(max-width:640px)`, and `prefers-reduced-motion:reduce` instead of the retired bright-blue theme tokens.

- [ ] **Step 4: Run the contract group**

Run: `node --test tests/current-site-contract.test.mjs tests/build.test.mjs tests/homepage.test.mjs tests/legacy-content.test.mjs tests/public-pages.test.mjs tests/repository-baseline.test.mjs tests/visual-contract.test.mjs`

Expected: the new contract test remains RED only for missing implementation; no assertion refers to retired routes.

- [ ] **Step 5: Commit the test contract**

```powershell
git add tests/current-site-contract.test.mjs tests/build.test.mjs tests/homepage.test.mjs tests/legacy-content.test.mjs tests/public-pages.test.mjs tests/repository-baseline.test.mjs tests/visual-contract.test.mjs
git commit -m "test: define current JARVIS site contract"
```

---

### Task 2: Make the generator the source of truth for the current four-page shell

**Files:**
- Modify: `scripts/templates/layout.mjs`
- Modify: `scripts/templates/pages.mjs`
- Modify: `scripts/build.mjs`
- Modify: `index.html`
- Modify: `articles/index.html`
- Modify: `skills/index.html`
- Modify: `portfolio/index.html`
- Test: `tests/current-site-contract.test.mjs`

**Interfaces:**
- Consumes: `layout({ title, description, canonicalPath, depth, active, body, pageClass })`.
- Produces: identical persistent shell markup on all four generated documents and `renderPages(model): Map<string, string>` with exactly four routes.

- [ ] **Step 1: Extend the failing contract with active-route checks**

```js
test('每页只有对应导航项被选中', async () => {
  const files = await buildSite({ write: false });
  for (const [path, label] of routes) {
    const html = files.get(path);
    const current = html.match(/<a[^>]+aria-current="page"[^>]*>([^<]+)<\/a>/);
    assert.equal(current?.[1], label, path);
  }
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/current-site-contract.test.mjs`

Expected: FAIL for the portfolio route and inconsistent header markup.

- [ ] **Step 3: Replace `layout.mjs` nav and shell with one exact structure**

```js
const NAV_ITEMS = [
  ['home', '首页', 'index.html'],
  ['articles', '文章', 'articles/'],
  ['skills', '技能', 'skills/'],
  ['portfolio', '作品集', 'portfolio/']
];

const musicSrc = 'https://music.163.com/outchain/player?type=0&amp;id=885054268&amp;auto=1&amp;height=66';

const shell =
  '<header class="site-header">' +
    '<a class="brand" href="' + root + 'index.html">' +
      '<span class="brand-mark" aria-hidden="true"></span>' +
      '<span>MR.C <b>JARVIS</b></span>' +
    '</a>' +
    '<div class="topbar-right">' +
      '<nav id="site-nav" class="nav" data-open="false" aria-label="主导航">' + nav + '</nav>' +
      '<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">菜单</button>' +
      '<button class="music-btn" type="button" aria-expanded="true" aria-controls="music-panel">' +
        '<span class="bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>音乐</span>' +
      '</button>' +
    '</div>' +
  '</header>' +
  '<aside class="music-panel open" id="music-panel" aria-label="背景音乐">' +
    '<iframe title="网易云音乐歌单播放器" width="330" height="86" src="' + musicSrc + '"></iframe>' +
    '<button class="music-unlock" type="button" hidden>没听到音乐？点击开启</button>' +
    '<a class="music-external" href="https://music.163.com/#/playlist?id=885054268" target="_blank" rel="noopener noreferrer">在网易云打开</a>' +
  '</aside>';
```

Generate nav hrefs from `NAV_ITEMS` and add `aria-current="page"` without changing link text or structure.

- [ ] **Step 4: Make `pages.mjs` generate all four current bodies**

Keep the current homepage’s sphere, hero text, voice dock, and interaction markup unchanged by moving its existing `<main>` body into `homePage()`. Remove nested `id="main"` values so `layout()` is the only owner of `<main id="main">`.

Add the current portfolio cards as `portfolioPage()` and return exactly:

```js
export function renderPages(model) {
  return new Map([
    ['index.html', homePage(model)],
    ['articles/index.html', articlesPage(model)],
    ['skills/index.html', skillsPage(model)],
    ['portfolio/index.html', portfolioPage(model)]
  ]);
}
```

Keep route-specific module references as data attributes on `<main>` rather than nested executable scripts:

```js
body: '<div class="page-wrap" data-page-module="articles">...</div>'
```

- [ ] **Step 5: Build generated pages and verify GREEN**

Run: `pnpm build && node --test tests/current-site-contract.test.mjs`

Expected: `build: generated 4 pages`; all current-site contract tests PASS; the generated `index.html` still contains `coreCanvas`, hero mission copy, and voice dock.

- [ ] **Step 6: Commit the generated shell**

```powershell
git add scripts/templates/layout.mjs scripts/templates/pages.mjs scripts/build.mjs index.html articles/index.html skills/index.html portfolio/index.html
git commit -m "refactor: generate one persistent JARVIS shell"
```

---

### Task 3: Lock header geometry and remove page-to-page movement

**Files:**
- Modify: `assets/styles/site.css`
- Modify: `tests/visual-contract.test.mjs`

**Interfaces:**
- Consumes: `.site-header`, `.brand`, `.topbar-right`, `.nav`, `.music-btn`, `.music-panel` from Task 2.
- Produces: fixed 64px shell with invariant desktop geometry and stable scrollbar allocation.

- [ ] **Step 1: Add failing CSS contract assertions**

```js
test('固定页头和选中态不会改变导航几何', async () => {
  const css = await readFile('assets/styles/site.css', 'utf8');
  assert.match(css, /html\s*\{[^}]*scrollbar-gutter:\s*stable/s);
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.site-header\s*\{[^}]*height:\s*64px/s);
  assert.match(css, /\.nav a\s*\{[^}]*min-width:\s*64px/s);
  assert.doesNotMatch(css.match(/\.nav a\[aria-current[^}]*\}/s)?.[0] || '', /font-weight|padding|font-size|min-width/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/visual-contract.test.mjs`

Expected: FAIL because the header is sticky and no stable scrollbar gutter or reserved nav width exists.

- [ ] **Step 3: Implement invariant shell CSS**

```css
html { scroll-behavior: smooth; scrollbar-gutter: stable; }

.site-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 28px;
  background: rgba(3, 5, 10, .8);
  border-bottom: 1px solid rgba(56, 225, 255, .1);
  backdrop-filter: blur(20px);
}

body { padding-top: 64px; }
.topbar-right { display: flex; align-items: center; gap: 14px; flex: 0 0 auto; }
.nav { display: flex; align-items: center; gap: 4px; }
.nav a { display: inline-flex; justify-content: center; min-width: 64px; padding: 7px 13px; }
.nav a[aria-current="page"] { color: var(--jarvis-cyan); border-color: rgba(56,225,255,.35); background: rgba(56,225,255,.04); }
```

At `max-width:640px`, keep one DOM structure, hide `.nav` until `data-open="true"`, and keep the music button in `.topbar-right`.

- [ ] **Step 4: Run GREEN and build**

Run: `node --test tests/visual-contract.test.mjs && pnpm build`

Expected: PASS; generated pages retain the same shell markup.

- [ ] **Step 5: Commit geometry fix**

```powershell
git add assets/styles/site.css tests/visual-contract.test.mjs index.html articles/index.html skills/index.html portfolio/index.html
git commit -m "fix: keep JARVIS navigation geometry stable"
```

---

### Task 4: Add persistent same-document navigation and page lifecycles

**Files:**
- Create: `assets/js/page-lifecycle.js`
- Modify: `assets/js/site.js`
- Modify: `assets/js/jarvis-home.js`
- Modify: `assets/js/articles.js`
- Modify: `assets/js/skills.js`
- Modify: `tests/site-navigation.test.mjs`

**Interfaces:**
- Consumes: `data-page-module` in target `<main>` content.
- Produces: `createSiteNavigator({ document, window, fetchImpl, lifecycle }): { start(): void, navigate(url, options?): Promise<boolean>, destroy(): void }`.
- Produces: `createPageLifecycle(): { activate(document): void, deactivate(): void }`.

- [ ] **Step 1: Write failing persistent-navigation tests**

```js
test('站内导航只替换 main 并保留音乐 iframe 节点', async () => {
  const shell = createNavigationFixture();
  const originalHeader = shell.document.querySelector('.site-header');
  const originalFrame = shell.document.querySelector('.music-panel iframe');
  const navigator = createSiteNavigator(shell.dependencies);

  await navigator.navigate('https://example.test/articles/');

  assert.equal(shell.document.querySelector('.site-header'), originalHeader);
  assert.equal(shell.document.querySelector('.music-panel iframe'), originalFrame);
  assert.equal(shell.document.querySelector('main h1').textContent, '技术文章');
  assert.equal(shell.history.state.path, '/articles/');
});

test('目标获取失败时退回普通跳转', async () => {
  const shell = createNavigationFixture({ fetchRejects: true });
  const navigator = createSiteNavigator(shell.dependencies);
  assert.equal(await navigator.navigate('https://example.test/skills/'), false);
  assert.equal(shell.location.assigned, 'https://example.test/skills/');
});
```

The fixture must use real small DOM objects rather than mocks of internal methods. Use an installed DOM implementation only if already present; otherwise model only browser-standard boundary objects passed through dependency injection.

- [ ] **Step 2: Run RED**

Run: `node --test tests/site-navigation.test.mjs`

Expected: FAIL because `createSiteNavigator` and lifecycle exports do not exist.

- [ ] **Step 3: Implement route recognition and document swaps**

```js
const PUBLIC_PATHS = new Set(['/', '/index.html', '/articles/', '/skills/', '/portfolio/']);

export function createSiteNavigator({ document, window, fetchImpl = fetch, lifecycle }) {
  let controller;

  async function navigate(input, { push = true } = {}) {
    const url = new URL(input, window.location.href);
    if (url.origin !== window.location.origin || !PUBLIC_PATHS.has(url.pathname.replace('/cat-grok-website', '') || '/')) return false;
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetchImpl(url.href, { signal: controller.signal });
      if (!response.ok) throw new Error('navigation ' + response.status);
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextMain = next.querySelector('main');
      if (!nextMain) throw new Error('missing main');
      lifecycle.deactivate();
      document.querySelector('main').replaceWith(nextMain);
      document.title = next.title;
      syncMeta(document, next);
      syncCurrentNav(document, url);
      if (push) window.history.pushState({ path: url.pathname }, '', url.href);
      lifecycle.activate(document);
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelector('main h1')?.focus({ preventScroll: true });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      window.location.assign(url.href);
      return false;
    }
  }

  return { start, navigate, destroy };
}
```

`start()` must ignore external links, downloads, targets, non-left clicks, and clicks with Ctrl/Meta/Shift/Alt. `popstate` calls `navigate(location.href, { push:false })`.

- [ ] **Step 4: Implement idempotent page lifecycle exports**

```js
export function initArticlesPage(root = document) {
  const filters = root.querySelector('.filters');
  if (!filters || filters.dataset.initialized === 'true') return;
  filters.dataset.initialized = 'true';
  filters.addEventListener('click', handleArticleFilter);
}

export function initSkillsPage(root = document) {
  const library = root.querySelector('.skill-grid');
  if (!library || library.dataset.initialized === 'true') return;
  library.dataset.initialized = 'true';
  library.addEventListener('click', handleSkillAction);
}
```

`initJarvisHome()` returns a cleanup function that cancels its animation frame, timers, pending speech, and event listeners. `createPageLifecycle()` calls the matching initializer based on `[data-page-module]` and invokes the prior cleanup before activating the next page.

- [ ] **Step 5: Run navigation tests and full build**

Run: `node --test tests/site-navigation.test.mjs && pnpm build`

Expected: PASS; generated HTML contains no route-specific `<script>` inside `<main>`; the shared `site.js` loads lifecycle modules.

- [ ] **Step 6: Commit persistent navigation**

```powershell
git add assets/js/page-lifecycle.js assets/js/site.js assets/js/jarvis-home.js assets/js/articles.js assets/js/skills.js tests/site-navigation.test.mjs index.html articles/index.html skills/index.html portfolio/index.html
git commit -m "feat: preserve the JARVIS shell across page navigation"
```

---

### Task 5: Add honest autoplay attempt and user-gesture recovery

**Files:**
- Modify: `assets/js/site.js`
- Modify: `assets/styles/site.css`
- Create: `tests/music-controller.test.mjs`
- Test: `tests/current-site-contract.test.mjs`

**Interfaces:**
- Consumes: `.music-btn`, `#music-panel`, `.music-unlock`, `.music-external`, and iframe from Task 2.
- Produces: `createMusicController({ root, storage, schedule, cancel }): { start(): void, toggle(open?: boolean): void, unlock(): void, destroy(): void }`.

- [ ] **Step 1: Write failing music-state tests**

```js
test('首次加载立即使用指定歌单和 auto=1', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  assert.match(fixture.frame.src, /id=885054268/);
  assert.match(fixture.frame.src, /auto=1/);
  assert.equal(fixture.panel.classList.contains('open'), true);
});

test('1.5 秒后提供点击开启且不声称正在播放', () => {
  const fixture = createMusicFixture();
  createMusicController(fixture.dependencies).start();
  fixture.runTimer(1500);
  assert.equal(fixture.unlock.hidden, false);
  assert.equal(fixture.button.textContent.includes('正在播放'), false);
});

test('用户点击开启时重建 iframe 且站内切页保持节点', () => {
  const fixture = createMusicFixture();
  const controller = createMusicController(fixture.dependencies);
  controller.start();
  const firstFrame = fixture.panel.querySelector('iframe');
  controller.unlock();
  const unlockedFrame = fixture.panel.querySelector('iframe');
  assert.notEqual(unlockedFrame, firstFrame);
  assert.match(unlockedFrame.src, /auto=1/);
  assert.equal(fixture.storage.getItem('jarvis-music-unlocked'), '1');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/music-controller.test.mjs`

Expected: FAIL because `createMusicController` does not exist.

- [ ] **Step 3: Implement the controller**

```js
const PLAYLIST_URL = 'https://music.163.com/outchain/player?type=0&id=885054268&auto=1&height=66';
const SESSION_UNLOCKED = 'jarvis-music-unlocked';
const SESSION_MUTED = 'jarvis-music-muted';

export function createMusicController({ root = document, storage = sessionStorage, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const panel = root.querySelector('#music-panel');
  const button = root.querySelector('.music-btn');
  const unlockButton = root.querySelector('.music-unlock');
  let promptTimer;

  function replaceFrame() {
    const oldFrame = panel.querySelector('iframe');
    const frame = oldFrame.cloneNode(false);
    frame.src = PLAYLIST_URL;
    oldFrame.replaceWith(frame);
    return frame;
  }

  function unlock() {
    replaceFrame();
    storage.setItem(SESSION_UNLOCKED, '1');
    storage.removeItem(SESSION_MUTED);
    unlockButton.hidden = true;
    panel.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
  }

  function start() {
    if (storage.getItem(SESSION_MUTED) === '1') toggle(false);
    else panel.querySelector('iframe').src = PLAYLIST_URL;
    if (storage.getItem(SESSION_UNLOCKED) !== '1') {
      promptTimer = schedule(() => { unlockButton.hidden = false; }, 1500);
    }
  }

  return { start, toggle, unlock, destroy };
}
```

`toggle(false)` stores `SESSION_MUTED`, closes the panel, and replaces the iframe with an unloaded placeholder so audio stops. `toggle(true)` calls `unlock()`. `destroy()` removes controller-owned listeners and cancels `promptTimer`; it is used only on complete document teardown, not on route swaps.

- [ ] **Step 4: Add recovery presentation**

```css
.music-unlock {
  display: block;
  width: 100%;
  padding: 8px 12px;
  color: var(--jarvis-cyan);
  background: rgba(3,5,10,.92);
  border-top: 1px solid rgba(56,225,255,.15);
  font: 11px var(--font-mono);
}
.music-unlock[hidden] { display: none; }
.music-external { display: block; padding: 5px 12px; color: var(--jarvis-dim); font-size: 11px; text-align: right; }
```

- [ ] **Step 5: Run GREEN**

Run: `node --test tests/music-controller.test.mjs tests/current-site-contract.test.mjs && pnpm build`

Expected: PASS; every generated page has playlist `885054268`, `auto=1`, and honest recovery copy.

- [ ] **Step 6: Commit music behavior**

```powershell
git add assets/js/site.js assets/styles/site.css tests/music-controller.test.mjs index.html articles/index.html skills/index.html portfolio/index.html
git commit -m "feat: add persistent NetEase music recovery"
```

---

### Task 6: Full regression and live browser acceptance

**Files:**
- Modify only if a test exposes a root-cause defect in files already listed above.
- Verify: generated pages and GitHub Pages preview.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: evidence that the generated site is stable before publication.

- [ ] **Step 1: Run the complete local gate**

Run: `pnpm check`

Expected: validation, all tests, four-page build, and smoke checks PASS with no stale six-page failures.

- [ ] **Step 2: Verify generated files are reproducible**

Run: `git diff --exit-code -- index.html articles/index.html skills/index.html portfolio/index.html`

Expected: exit code 0 immediately after `pnpm build`.

- [ ] **Step 3: Start the local static preview**

Run: `python -m http.server 4173`

Expected: server listens on `http://127.0.0.1:4173/`; if the Windows Python alias is unavailable, use the bundled Node runtime with an existing static-server dependency rather than installing new software.

- [ ] **Step 4: Desktop browser acceptance at 1280px**

Visit 首页 → 文章 → 技能 → 作品集 → 首页 using the visible navigation. For every route record `getBoundingClientRect()` for `.brand`, `#site-nav`, and `.music-btn`.

Expected:

- Each x/y/width/height differs by no more than 1px across routes.
- URL, title, `<main>` content, and `aria-current` update.
- The exact same `.site-header` and `#music-panel iframe` DOM nodes remain after route changes.
- Browser back and forward restore the correct route without a full refresh.

- [ ] **Step 5: Music acceptance**

Expected:

- On first load the panel is open and the iframe URL includes `id=885054268&auto=1`.
- After 1.5 seconds the recovery prompt appears without claiming playback.
- Clicking recovery replaces the iframe once and hides the prompt.
- Navigating all four routes preserves that iframe node.
- If NetEase still produces a cross-origin failure, the external playlist link works and the limitation is reported rather than hidden.

- [ ] **Step 6: Mobile acceptance at 390px**

Expected: brand, menu, and music remain visible; menu opens vertically; selecting a route closes it; content is not hidden beneath the fixed header; music panel fits between 12px side margins.

- [ ] **Step 7: Commit any root-cause corrections and final generated output**

```powershell
git add assets scripts tests index.html articles/index.html skills/index.html portfolio/index.html
git commit -m "test: verify persistent JARVIS navigation and music"
```

Do not create an empty commit if no corrections were needed.

## Release Gate

- Do not push until `pnpm check` is green and browser geometry evidence passes.
- Pushing the branch or merging into `main` is a separate publication action after implementation review.
- The previously exposed GitHub token must not appear in source, git configuration, logs, tests, or documentation.
