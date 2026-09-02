# 《鲜花》背景音乐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用隐藏的网易云《鲜花》单曲替换可见歌单播放器，并提供默认播放、点击停止和首次交互恢复。

**Architecture:** 公共布局只输出音乐按钮和不可见单曲 iframe。`createMusicController` 维护当前开关状态，并通过注入的交互目标监听首次用户手势；现有 SPA 导航继续保留公共外壳，因此音乐实例不会因换页重建。

**Tech Stack:** 静态 HTML、原生 JavaScript、Node.js test runner、现有构建脚本。

## Global Constraints

- 网易云官方单曲 ID 固定为 `2086327879`，播放器类型固定为 `type=2`。
- 不提交歌曲音频文件，不保证浏览器首次无交互有声播放。
- 本次不改 JARVIS 回复朗读音色。

---

### Task 1: 单曲布局契约

**Files:**
- Modify: `scripts/templates/layout.mjs`
- Modify: `assets/styles/site.css`
- Test: `tests/current-site-contract.test.mjs`
- Test: `tests/visual-contract.test.mjs`

**Interfaces:**
- Produces: `.music-btn` 与 `#background-music-frame`。

- [ ] 写失败测试，断言四页使用 `type=2&id=2086327879&auto=1`，且不存在 `music-panel`、`music-unlock` 和旧歌单 ID。
- [ ] 运行 `node --test tests/current-site-contract.test.mjs tests/visual-contract.test.mjs`，确认因旧布局而失败。
- [ ] 修改公共布局和样式，只保留按钮与隐藏 iframe。
- [ ] 运行相同测试，确认通过。
- [ ] 提交 `feat: replace playlist panel with Flowers background track`。

### Task 2: 播放控制与首次交互恢复

**Files:**
- Modify: `assets/js/site.js`
- Test: `tests/music-controller.test.mjs`

**Interfaces:**
- Consumes: `.music-btn` 与 `#background-music-frame`。
- Produces: `createMusicController({ root, interactionTarget })`，返回 `start()`、`toggle()`、`play()`、`stop()`、`destroy()`。

- [ ] 重写失败测试，覆盖默认播放、点击停止、再次播放、首次交互重试和停止后不重试。
- [ ] 运行 `node --test tests/music-controller.test.mjs`，确认旧控制器无法满足新契约。
- [ ] 以最小状态机实现播放控制和交互恢复，动态更新 `aria-pressed` 与 `aria-label`。
- [ ] 运行音乐控制器测试，确认通过。
- [ ] 运行 `pnpm build && pnpm check`，确认生成物和全量检查通过。
- [ ] 提交 `feat: control Flowers background playback`。

### Task 3: 真实页面验收

**Files:**
- Verify: generated `index.html`, `articles/index.html`, `skills/index.html`, `portfolio/index.html`

- [ ] 启动本地静态站点并打开首页。
- [ ] 验证默认按钮为开启、点击后停止、再次点击恢复。
- [ ] 验证切换四页时 iframe 节点保持同一实例。
- [ ] 运行 `pnpm check`、`git diff --check` 和敏感信息扫描。
