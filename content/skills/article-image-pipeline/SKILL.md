---
name: article-image-pipeline
description: 写稿+配图生产流水线的可复用经验。覆盖：write-down 派单铁律、ImageGen 不存在于 agent 侧必须自建生图
  MCP、豆包 Seedream 已知良好配置、PPT
  真实截图脱敏规则、配图审美决策（标题不夸张但吸引人/封面与正文统一/获奖材料聚焦产出去个人化）。当用户要写文章、用
  /write-down、要给文章配图出图、或有 PPT/申报材料素材要脱敏嵌入时使用。
disable: true
---

# 写稿配图生产流水线（经验沉淀）

本技能不是新流程，而是把"用 write-down 写文章 + 让 ian/封面技能真出图 + 安全用真实素材"这套打法里**踩过的坑和可复用配置**固化下来，下次直接照做，不再重走弯路。

---

## 一、最关键的一条：ImageGen 在 agent 侧不存在，必须自建生图 MCP

**踩坑**：WorkBuddy 的 ImageGen 是**平台内置原生能力**，只在对话层触发，**不在 agent 的函数列表里、不是 MCP、不是 pip/npm 包**。反复用 `Skill` 命令"调"ImageGen 是错的——Skill 只能加载技能文档，出不了图。

**解法**：自建一个通用生图 MCP server，让 ian/封面技能通过它出图：
- 用**纯 stdio JSON-RPC，零额外依赖（仅 httpx）**，不要用 fastmcp（mcp 2.x 重构后 `mcp.server.fastmcp` 不存在，会导致 MCP 进程启动即崩、-32000 Connection closed）。
- 读一组环境变量：`IMAGE_GEN_BASE_URL` / `IMAGE_GEN_API_KEY` / `IMAGE_GEN_MODEL` / `IMAGE_GEN_SIZE` / `IMAGE_GEN_OUT_DIR`。
- 兼容 OpenAI 生图接口风格，返回 `data[].b64_json` 或 `data[].url`（url 则下载保存本地）。
- 注册到**无点前缀**的 `mcp.json`（WorkBuddy 读的是 `mcp.json` 不是 `.mcp.json`）。

> 现成 server 位置：`~/.workbuddy/skills/ian-xiaohei-illustrations/imagegen_mcp_server.py`，ian 技能 SKILL.md 第 3 步已指向它。

---

## 二、豆包 Seedream 已知良好配置（写于 2026-08-09，实测稳定）

切换生图后端只改 `mcp.json` 的 `IMAGE_GEN_*` 三个变量，server 代码不动：

| 变量 | 值 |
|------|-----|
| `IMAGE_GEN_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3/images/generations` |
| `IMAGE_GEN_MODEL` | `doubao-seedream-4-5-251128` |
| `IMAGE_GEN_SIZE` | `1920x1920`（**硬约束**：Seedream 要求图片像素 ≥ 3686400，1024x1024 会被拒，必须用 1920x1920 或 2048x2048） |
| `IMAGE_GEN_API_KEY` | 豆包 ark Key（格式 `<你的豆包 API Key>`，火山方舟控制台获取） |

- server 会自动补 `response_format: url`，返回 TOS 临时链接后下载保存。
- **切换其他后端**（混元/OpenAI 兼容）：只改这三个变量。注意混元生图端点不是通用 `/v1/images/generations`，而是 `/v1/wand/hunyuan-image/v3-generation`，且 model 名需是控制台具体服务 ID，盲猜通用名会 400。
- 生图按张计费，调试别反复打接口耗额度。

---

## 三、write-down 派单铁律（已写进 write-down 技能）

- **封面** → 唯一调用 `/小红书爆款封面生成`（红狐 Key 需配用户级环境变量 `REDFOX_API_KEY`；该技能产出"方案+提示词"，不直接出图，出图靠 imagegen-mcp）
- **插图** → 唯一调用 `/ian-xiaohei-illustrations`（用 imagegen-mcp 出图）
- 二者**不可混用、不可互相替代、不可用文字/SVG 占位替代**。
- 架构图类（状态机/流程/布局示意）→ 手绘 SVG，用 `@resvg/resvg-js`（环境有 node 包）转 PNG，不依赖生图。

---

## 四、PPT/申报材料真实截图脱敏规则

把获奖申报 PPT、客户材料当素材时：
- **含客户名、企业名、个人姓名、客户编号、交易金额、账户信息的关系图/截图 → 不能原样贴**（安全规范 + 隐私）。
- **只有纯架构图、能力框架图、布局示意图（无敏感数据）可用原图**。
- 含敏感数据的图，要么先在源头打码，要么用 ian 小黑概念图 / 手绘 SVG 抽象示意替代。
- 提取 PPT 图片：`python-pptx` 遍历 `slide.shapes`，`shape_type==13` 即图片，`shape.image.blob` 写文件。

---

## 五、配图审美决策（用户偏好，已验证满意）

- **标题**：不要太夸张（去掉"踩坑/三年"标题党感），但要简单吸引人（一句大白话带反差，如"一家企业，为什么在三个系统里是三个不同的人"）。
- **封面**：跟正文插图统一调性（纯白底 + 小黑手绘风），不要用红底大字报强对比（跟小黑插图割裂、偏浮夸）。封面和插图视觉连贯比"爆款感"更重要。
- **获奖/项目材料**：聚焦产出本身，去掉公司名/个人名，改成"平台能力 + 踩坑 + 经验沉淀"视角，不写个人经历叙事。
- **内容立意选择**：用户要"踩坑/经验/能力沉淀"时，结构用"边界三层 → 收口底座 → 引擎取舍 → 场景落地 → 踩坑实录 → 产品判断沉淀"；要"聚焦产出"时，用"痛点 → 框架 → 能力 → 布局 → 场景 → 成效"。

---

## 六、执行检查清单

1. 红狐 Key 配了没（`REDFOX_API_KEY`）？封面技能要不要真查爆款数据？
2. imagegen-mcp 在 `mcp.json` 配了没？用户信任了没？生图后端用豆包还是别的？
3. 素材里有没有不能原样贴的敏感截图？
4. 标题/封面/立意按用户这轮的审美偏好定了没？
5. 出图后回贴主稿对应章节，重导 Word（注意原 docx 可能被占用，用 `_vN.docx` 新名存）。
