---
name: frontend-skill
display_name: Frontend 视觉约束
version: 1.0.0
description: 当任务要求生成视觉强的落地页、网站、App、原型、demo 或游戏 UI 时使用。强制克制构图、影像主导的层级、 cohesive 内容结构与有品味的动效，避免通用卡片、弱品牌与 UI 杂乱。本技能作为"视觉层规则注入"，供 prd-to-prototype 等原型生成技能在产出 HTML 时调用。
entrypoint: SKILL.md
disable: false
agent_created: true
source_note: 本地自建（2026-09-01 盘点确认无外部来源标记，补登记）
---

# Frontend Skill

当工作质量取决于艺术指导、层级、克制、影像与动效，而非组件数量时使用本技能。

目标：交付感觉 deliberate、premium、current 的界面。

默认朝向奖项级构图：一个大创意、强影像、稀疏文案、严谨间距、少量令人印象深刻的动效。

## Working Model

构建前先写三件事：
- visual thesis：一句话描述情绪、材质与能量
- content plan：hero、support、detail、final CTA
- interaction thesis：2-3 个改变页面质感的动效想法

每个 section 只有一项工作、一个主导视觉创意、一个主要 takeaway 或动作。

## Beautiful Defaults

- 从构图开始，而非组件。
- 偏好 full-bleed hero 或 full-canvas 视觉锚点。
- 让品牌或产品名成为最大声的文字。
- 文案短到几秒可扫完。
- 在加 chrome 前先用留白、对齐、缩放、裁切、对比。
- 限制系统：最多两种字体，默认一个 accent 色。
- 默认无卡片布局。用 section、column、divider、list、media block 替代。
- 把第一视口当海报，而非文档。

## Landing Pages

默认序列：
1. Hero：品牌或产品、承诺、CTA、一个主导视觉
2. Support：一个具体特性、offer 或 proof point
3. Detail：氛围、工作流、产品深度或故事
4. Final CTA：转化、开始、访问或联系

Hero 规则：
- 仅一个构图。
- full-bleed 图片或主导视觉平面。
- 品牌第一、标题第二、正文第三、CTA 第四。
- 默认无 hero 卡片、stat strip、logo cloud、pill soup 或浮动 dashboard。
- 标题桌面约 2-3 行，移动端一眼可读。
- 文字列窄且锚定在图片的 calm 区域。
- 图片上所有文字必须强对比、清晰点击目标。
- 若移掉图片后第一屏仍成立，图片太弱。若隐藏导航后品牌消失，层级太弱。

Viewport budget：
- 若首屏含 sticky/fixed header，该 header 计入 hero。header + hero 内容须适配常见桌面与移动尺寸的初始视口。
- 用 100vh/100svh hero 时，减去持久 UI chrome（calc(100svh - header-height)）或将 header 叠加而非正常流堆叠。

## Apps

默认 Linear 式克制：
- calm surface 层级
- 强字体与间距
- 少色彩
- 密集但可读的信息
- 最小 chrome
- 仅当卡片本身是交互时才用卡片

App UI 围绕组织：
- primary workspace
- navigation
- secondary context 或 inspector
- 一个清晰的 action/state accent

避免：
- dashboard-card mosaic
- 每个区域都加粗边框
- 常规产品 UI 后的装饰性渐变
- 多个竞争 accent 色
- 不改善扫读的装饰图标

若一个 panel 去掉卡片处理仍不失意义，则去掉卡片。

## B 端（企业级中后台）专属规则

B 端产品原型默认采用**三段式布局**，而非营销页构图：
- **顶部模块导航**：横向切换一级模块（如 简历库 / 用户与权限 / 系统设置）。
- **左侧模块内菜单**：当前模块下的二级功能导航。
- **中间工作区**：主操作区（列表 / 表单 / 详情 / 仪表盘）。
- 右侧可叠加说明面板（prd-to-prototype 的编号功能说明）。

视觉与密度：
- 信息密度优先于"视觉立意"；表格、表单、筛选栏是主角，不是 hero。
- 参考 Ant Design / Arco / Element Plus 的企业级组件语言：统一圆角、统一间距栅格（8px 基准）、中性灰底 + 单品牌 accent。
- 列表页标配：搜索/筛选栏 + 批量操作条 + 分页 + 空/加载/失败态。
- 表单页标配：字段分组、必填标记、行内校验、提交/取消。
- 权限相关页用矩阵或树形勾选呈现角色×资源。
- 不追求落地页的"full-bleed 影像"，B 端用图标 + 文字导航即可。
- 动效仅用于状态反馈（展开、Toast、加载），不用于装饰。

## Imagery

影像必须做叙事工作。
- 品牌、场所、编辑页、生活方式产品至少用一张强、真实感图片。
- 偏好 in-situ 摄影而非抽象渐变或假 3D 物体。
- 选择或裁切带稳定色调区域的图片供文字使用。
- 不用带嵌入标识、logo 或排版杂乱的图片与 UI 竞争。
- 不用内置 UI 框架、split、卡片或 panel 的生成图。
- 若需多个 moment，用多张图，而非一张拼贴。
- 第一视口需要真实视觉锚点。装饰纹理不够。

## Copy

- 用产品语言，而非设计评论。
- 让标题承载意义。
- 支撑文案通常一句话。
- 删掉 section 间重复。

## Motion（克制）

- 默认少量 deliberate 动效：staggered reveal、hover 微交互、scroll-triggered。
- 不做无意义弹跳、不堆叠入场动画。
- 动效服务于"理解"，而非炫技。

## 反 Slop 质检段（吸收自 taste-skill 0.D，仅取反默认清单）

生成任何前端界面（含 prd-to-prototype 的原型 HTML）前，逐项对照，命中即改：

- ❌ AI 紫渐变（purple-gradient hero / 紫蓝 mesh 背景）
- ❌ 居中大标题压在暗色网格/光斑上（centered hero over dark mesh）
- ❌ 三个等宽特性卡片一字排开（three equal feature cards）
- ❌ 处处玻璃拟态（glassmorphism on everything）
- ❌ 无限循环的微动画（infinite-loop micro-animations everywhere）
- ❌ Inter + slate-900 默认字体配色组合
- ❌ 豆腐块布局 / 千篇一律的 Google Fonts 精选字体对
- ❌ 纯色背景 + 无层级

替代方向：dominant color + sharp accent 配色、精选字体对、编排动效（staggered reveal）、hover 微交互、scroll-triggered 动画、真实影像锚点。先有视觉立意，再写组件。

> 注：本反 Slop 质检段与 `frontend-slides` 技能 §0.2 同源（均来自 taste-skill 0.D + 选型方法论）。`frontend-slides` §0 是面向幻灯片生成的单一维护源；本段为 `prd-to-prototype` 注入原型视觉规则时保留，二者保持一致即可，勿分叉。

## 去 AI 味方法论（与 frontend-slides 同源，单一信息源在 frontend-slides §0）

> **职责边界**：本技能是给 `prd-to-prototype` 等**产品原型**技能注入的视觉规则层（B 端 / App 原型），不负责生成幻灯片。生成 HTML *幻灯片/演示* 的统一入口已合并到 **`frontend-slides`** 技能（其 §0 内置了与本段同源的反 Slop 质检 + composition-first 护栏）。两处逻辑同源，以 `frontend-slides` §0 为单一维护源；本段保留 B 端特有的密度/组件约束。

原选型方法论（已上移至 frontend-slides，此处仅保留 B 端特化要点）：

- **先定约束，再匹配，不默认一套**：生成原型前，先明确该原型的 `occasion`（内部推敲 / 评审汇报）、`mood`（写实企业系统 / 线框文档感）、`density`（密 / 疏）、`scheme`（浅 / 深）。按约束选视觉，而非直接套默认组件库审美。
- **禁止"默认组件库感"**：不要所有状态都用圆角 pills、不要所有强调都用一个蓝色 accent、不要所有区块都用同款卡片阴影。真实企业系统的层级靠**间距、字重、分隔线、灰度阶**建立，不靠装饰。
- **弱化统一 accent**：accent 色只在真正的关键操作（主按钮、当前选中）出现一次，不处处高亮。
- **密实优于稀疏**：B 端信息密度高，宁可用紧凑表格+细分隔线，也不要留白堆砌的"呼吸感"卡片。

## 与 prd-to-prototype 的关系

当 prd-to-prototype 生成原型 HTML 时，本技能的规则自动生效：
- 原型视觉遵循 composition-first，不堆卡片。
- 品牌/产品名作为最响亮文字。
- 右侧说明面板与左侧原型共用一套间距/字体系统，不割裂。
- 交互原型本身的动效克制、有目的。
- 反 Slop 质检段在出 HTML 前自动跑一遍，命中即改。

## 设计哲学补充（合并自 frontend-design，2026-09-01）

完整方法论见 `references/frontend-design.md`，做新 UI 或重塑视觉方向时先读它。四条核心精神：

1. **先钉住主题再设计**：brief 没写清产品是什么，就自己定一个具体主体+受众+页面唯一职责，并说出来。独特的视觉选择来自主题自身的世界（材料、器物、行话），不是来自通用模板。
2. **英雄区即论点**：开场放主题世界里最有特征的东西；"大数字+小标签+渐变强调"是模板答案，除非真的是最优解不要用。结构装置（编号/分隔/标签）必须编码内容的真实信息，不做装饰。
3. **大胆只花一处**：签名元素只留一个，其余安静克制。构建时自审（能截图就截图），"出门前照镜子摘掉一件配饰"。
4. **文案是设计材料**：从终端用户视角命名（"管理通知"而非"webhook 配置"），主动语态，动作名全流程一致（按钮 "Publish" → toast "Published"）。

回归约定：本技能被 prd-to-prototype 依赖（5 处引用），本次只追加不改动既有规则，引用关系未断。
