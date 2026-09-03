# JARVIS 站点协作约定

本仓库同时有 **Codex**（架构方）和 **WorkBuddy**（内容方）在工作。为避免互相覆盖，按文件分层协作。

## 一、文件分层：哪些能改，哪些不能

| 层 | 路径 | 能否手工改 | 说明 |
|---|---|---|---|
| 内容源 | `data/blog.json`、`data/skills.json` | ✅ 改这里 | build 的输入，永不覆盖 |
| 页面模板 | `scripts/templates/*.mjs` | ✅ 架构方主导 | 改页面结构走这里 |
| 构建/校验 | `scripts/build.mjs`、`validate-content.mjs` | ✅ 架构方主导 | |
| 测试 | `tests/*.test.mjs` | ✅ 架构方主导 | 改动需保证 `pnpm test` 通过 |
| 首页源 | `index.html` | ⚠️ 可改 | 会被 `normalizeHomeDocument()` 规范化 |
| 前端逻辑 | `assets/js/*.js` | ✅ 可改 | 不参与生成 |
| 静态资源 | `content/`、`downloads/` | ✅ 改这里 | 不参与生成，安全 |
| **生成产物** | `articles/index.html`、`skills/index.html`、`portfolio/index.html` | ❌ **禁止手工编辑** | 一跑 `pnpm build` 就被覆盖 |

**结论：要改子页面内容 → 改 `data/*.json`，不要改子页 HTML。**

## 二、分工

- **Codex（架构方）**：`scripts/`、`templates/`、`tests/`、`assets/js/site.js` 的架构性改动、SPA/持久化导航等能力建设
- **WorkBuddy（内容方）**：`data/*.json`（技能与文章内容）、`content/`（技能 SKILL.md）、`downloads/`（技能包 zip）

重叠区域（`scripts/templates/`、`data/` 的 schema 变更）**先沟通再改**，避免一方改模板、另一方改数据结构导致渲染断裂。

## 三、硬规则（双方共同遵守）

1. **禁止手工编辑生成产物**（三个子页的 `index.html`）。发现被手工改过，以重新 `pnpm build` 的结果为准。
2. **改内容只改 `data/*.json`**，然后 `pnpm validate && pnpm build`。
3. **动手前先 `git fetch origin main && git status -sb`**，确认是否落后。
4. **绝不 `git push --force`** —— 会抹掉对方已推送的 commit。落后时 `git reset --hard origin/main` 后重新应用自己的改动。
5. 提交信息写清楚改了哪一层，便于对方判断是否需要重新 build。

## 四、改完 HTML 前的自检（必做）

```bash
node -e "import('./scripts/build.mjs').then(async m=>{const f=await m.buildSite({write:false});const fs=await import('node:fs/promises');for(const[n,c]of f){let cur='';try{cur=await fs.readFile(n,'utf8')}catch{};console.log((cur===c?'ok':'DIFF')+' '+n)}})"
```

输出 `DIFF` = 你正在改生成产物，立刻停手，去改 `data/*.json`。

## 五、发布约定

- 线上地址：https://mrcharm.github.io/cat-grok-website/ （GitHub Pages，main 分支根目录，push 后自动构建）
- 仓库根有 `.nojekyll`：Jekyll 会把带 frontmatter 的 `.md` 转成 `.html`，删掉会导致 `content/skills/*/SKILL.md` 下载 404
- 技能包：`downloads/skills/<name>.zip`（单技能）+ `downloads/skills-<cat>.zip`（分类）
- 卡片 `data-zip` 的值是**技能名**，JS 解析到 `downloads/skills/<name>.zip`
- **上传任何文件前必须脱敏**：本地绝对路径、API key 片段、系统用户名、手机号
- 第三方开源技能（如 `frontend-slides`，作者 zarazhangrui）**只分发 SKILL.md**，不打包其完整模板库
- 排除清单：`_skillhub_meta.json`、`.env-record.md`、二进制与图标文件
