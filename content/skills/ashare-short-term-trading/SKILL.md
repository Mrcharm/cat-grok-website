---
name: ashare-short-term-trading
description: |
  A 股日内与短线决策辅助工具，覆盖盘后诊断、标的初筛、盘中节点评估三个高频环节。
  支持从交割单回溯每笔交易的买卖质量并输出结构化复盘报告，基于量能与形态规则
  从市场中初筛候选池，以及在日内关键时段对关注标的做多维强度评判。所有正式报告
  以自包含 HTML 交付，聊天仅给摘要。触发词包括复盘、交割单分析、选股、盘中推送、
  持仓强度、盯盘时间点等。
agent_created: true
version: 1.0.1
display_name: A股短线交易
display_name_en: A-Share Short-term Trading
description_zh: A股短线交易体系，支持交割单复盘分析、策略筛选选股、盘中关键时间点推送三大场景。
description_en: A-share short-term trading system with trade record review,
  strategy screening, and intraday push.
visibility: public
disable: true  # retired 2026-09-01 -> trading-analysis
---



> [retired 2026-09-01] 本技能已由 `trading-analysis` 替代，处于 30 天观察期（disable 状态）。恢复请删除本标注与 disable 字段。
> [retired 2026-09-01] 本技能已由 `trading-analysis` 替代，处于 30 天观察期（disable 状态）。恢复请删除本标注与 disable 字段。
# A 股短线决策工作流

## 能力总览

本 Skill 将 A 股短周期操作拆成三个独立环节，每个环节有明确的输入、处理逻辑和交付物：

| 环节 | 何时使用 | 产物 |
|---|---|---|
| 盘后诊断 | 收盘后提供交割单 | 逐笔质量评估 + HTML 诊断报告 |
| 标的初筛 | 用户要求选股或指定策略 | 候选股列表（HTML，含形态与关注条件） |
| 盘中节点评估 | 日内固定时段或用户询问 | 关注标的的强度评分与倾向判断（HTML） |

> **统一交付规范**：三个环节的正式输出均为自包含 `.html`；聊天窗口只放摘要与文件路径，不贴 HTML 正文。
>
> **HTML 生成规则**：
> 1. 读取对应的 `references/*_template.html` 后，由 Agent 通过 Write 工具**直接落盘完整 HTML**（填入实际数据与评述）
> 2. **不得**新建或运行任何 Python 脚本去拼接/渲染 HTML（如 `generate_*.py`、`render_report.py` 等）
> 3. `scripts/parse_trade_record.py` 和 `scripts/intraday_strength.py` 各自只负责交割单解析与强度计算，**不参与报告生成**
> 4. 遵循 wb-finance 约束；`review`/`stock_list`/`intraday` 使用本 Skill 提供的模板
>
> **前置步骤**：先加载 `wb-finance-skill` 的约束规则与 price-action 方法论，再获取行情数据。选股输出统一用「观察评级」措辞，禁止出现「建议买入/卖出」。

---

## 环节一：盘后诊断

### 输入条件
用户上传交割单（Excel/CSV/文本）或粘贴交易记录，并提及复盘、分析交易等意图。

### 处理流程

| 阶段 | 操作 | 说明 |
|---|---|---|
| 解析 | 调用 `scripts/parse_trade_record.py` 标准化字段 | 提取代码、名称、方向、时间、价格、数量、盈亏 |
| 取数 | 用 `westock-data` 拉取当日分时 | 每只标的 + 大盘（sh000001、sz399001）分时数据；需要换手率/成交额时补充 `quote` |
| 评分 | 按五维度打分（满分 100） | 见下方评分卡 |
| 输出 | 读取 `references/review_template.html`，Write 落盘 HTML | 路径建议：`{workspace}/trading/reports/review_YYYYMMDD.html` |

### 质量评分卡（五维度）

| 维度 | 分值 | 考察要点 |
|---|---|---|
| 进场时机 | 25 | 是否在回踩支撑、突破确认或下跌衰竭点进场 |
| 进场与大盘共振 | 15 | 进场时大盘方向是否配合（顺势/逆势） |
| 离场时机 | 25 | 是否在高位衰竭、量能萎缩或破支撑时离场 |
| 持仓效率 | 15 | 持仓区间是否为日内最优波动段 |
| 盈亏捕获率 | 20 | 实际盈亏占该时段最大潜在盈亏的比例 |

---

## 环节二：标的初筛

### 输入条件
用户表达选股意图，如「帮我看看明天的标的」「按某策略筛一下」等。

### 可用规则集

从 `references/strategy_definitions.md` 加载完整定义，核心规则如下：

| 编号 | 名称 | 核心判定 |
|---|---|---|
| S00 | 放量突破新高 | 非 ST + 3 日巨量 + 连续站上 MA5 + 3 日成交额 >24 亿 + 换手 ≤50% + 后复权新高（6 条全满足） |
| S01 | 量能验证突破 | 当日量 ≥ 5 日均量 150%，收盘突破近 10 日高点 |
| S02 | 低位均线回踩 | 股价贴近 30 日均线（±2%），20 日均量收缩 |
| S03 | 封板次日跟踪 | 当日涨停（非一字板）+ 换手 5-15% |
| S04 | 强势回调整理 | 近 10 日涨幅 >15%，当日缩量回调 ≤3% |
| S05 | 尾盘异动 | 14:30 后资金净流入 + 分时大幅拉升 |
| S06 | 缩量蓄势 | 5 日振幅 ≤3%，量能持续萎缩 |
| S07 | 板块内补涨 | 强势板块中挖掘涨幅落后的同细分标的 |

### 处理流程

| 阶段 | 操作 | 说明 |
|---|---|---|
| 定规则 | 确认启用哪些规则（可多选，默认 S00） | 用户可叠加多个规则 |
| 取数据 | 行情用 `westock-data`，筛选/排行用 `westock-tool` | 日线/K线/均线/换手率/成交额/后复权等 |
| 执行筛选 | 逐规则跑条件，去重合并，按综合得分排序 | 最终 5-10 只 |
| 输出 | 读取 `references/stock_list_template.html`，Write 落盘 HTML | 路径建议：`{workspace}/trading/reports/stock_list_YYYYMMDD.html` |

每只标的输出：代码 + 名称 + 触发规则 + 形态描述 + 观察评级（条件满足可跟踪/重点关注/回避）+ 关键价位（支撑/压力）。标注风险提示。

---

## 环节三：盘中节点评估

### 输入条件
用户在以下时段附近（±15 分钟）发消息或主动问当前状况：

| 时段 | 评估焦点 |
|---|---|
| 09:45 | 开盘 15 分钟：集合竞价方向是否延续，领涨标的强度 |
| 10:30 | 早盘第一波高点区：是否回调，主力资金方向确认 |
| 13:30 | 午后开盘：下午走势预判，持仓标的异动检查 |
| 14:30 | 尾盘前一小时：资金动向判断，仓位调整参考 |
| 14:55 | 收盘前 5 分钟：最终仓位决策节点 |

### 用户配置（trading_config.json）

首次使用按以下流程初始化：

1. **复制模板**：将 `assets/trading_config_template.json` 复制到 `{workspace}/trading/trading_config.json`
2. **引导填写**：请用户提供/确认以下内容：
   - **account**：总资金、最大总仓位比例、单票上限、最小交易金额
   - **holdings**：持仓标的（代码、名称、成本、数量、仓位比例、进场日期、理由、止损、目标）
   - **tracking**：观察池（代码、名称、关注理由、参考价、潜在止损/目标）
   - **strategies**：默认规则组、扩展规则组、弱势市规则组
   - **risk_rules**：单日最大亏损比例、强制减仓阈值等
3. **后续维护**：持仓变动或观察池调整时直接编辑 `trading_config.json`

模板字段说明见 `assets/trading_config_template.json` 内的 `_comment` 与各段示例。

### 处理流程

| 阶段 | 操作 | 说明 |
|---|---|---|
| 读配置 | 从 `{workspace}/trading/trading_config.json` 读取 | 若不存在，复制模板并引导用户填写 |
| 取数据 | 用 `westock-data` 拉取分时/实时行情/资金流向/筹码 | 持仓和观察池每只标的分时 + 大盘数据 + 板块排行 |
| 算强度 | 调用 `scripts/intraday_strength.py` 计算 0-100 分 | 五因子加权：相对大盘 30% + 量能 20% + 均线多空 20% + 资金 20% + 筹码 10% |
| 输出 | 读取 `references/intraday_push_template.html`，Write 落盘 HTML | 路径建议：`{workspace}/trading/reports/intraday_HHMM_YYYYMMDD.html` |

---

## 行情数据路由

本 Skill 统一经以下数据通道获取信息，按场景分发：

| 数据类型 | 通道 | 典型调用 |
|---|---|---|
| 个股实时/日线/分时/均线/换手/成交额/后复权 | `westock-data` | `quote` / `kline --fq qfq` / `minute` / `technical --group ma` |
| 筹码成本分布 | `westock-data` | `chip <代码>`（仅 A 股） |
| 财务多期对比 | `westock-data` | `finance <代码> --num N` |
| 资金流向（主力/散户） | `westock-data` | `fund flow <代码>` |
| 全市场筛选/排行/板块排行 | `westock-tool` | `filter` / `strategy` / `ranking` / `label` |
| 市场情绪/新闻/公告 | `neodata-financial-search` | `python3 scripts/query.py --query "..."` |
| 技术分析框架（形态/量价关系/支撑压力） | `wb-finance-skill` | 参考 `references/price-action-tools.md` 等 |

### 取数优先级

1. 个股精确数据（行情/分时/K线/财务/筹码/资金流向）→ `westock-data`
2. 全市场筛选/排行 → `westock-tool`
3. 市场情绪/新闻/公告 → `neodata-financial-search`
4. 分析框架（形态识别/量价关系判定等）→ `wb-finance-skill`

若 `westock-data` 不可用，Skill 无法运行，需提示用户检查该 Skill 是否已安装。

---

## 文件索引

| 文件 | 使用时机 |
|---|---|
| `assets/trading_config_template.json` | 首次初始化时复制到 `{workspace}/trading/trading_config.json` |
| `{workspace}/trading/trading_config.json` | 盘中评估、选股仓位建议、风控校验前必读 |
| `references/strategy_definitions.md` | 执行标的初筛前 |
| `references/review_template.html` | 盘后诊断：Agent 按模板 Write HTML |
| `references/stock_list_template.html` | 标的初筛：Agent 按模板 Write HTML |
| `references/intraday_push_template.html` | 盘中评估：Agent 按模板 Write HTML |
| `references/ta_signals.md` | 分析买卖质量时参考技术形态 |
| `scripts/parse_trade_record.py` | 仅解析交割单 → JSON，不生成报告 |
| `scripts/intraday_strength.py` | 仅计算强度分，不生成 HTML |

### 报告输出约定

- 三个环节的正式交付物均为独立 HTML，样式内联；Agent 用 Write 直写，**禁止脚本生成 HTML**
- 颜色遵循 A 股习惯：红涨绿跌（模板中 `.up`=红，`.down`=绿）
- 盘后诊断报告需包含首屏摘要区；硬约束见 wb-finance
- 文件落盘到 `{workspace}/trading/reports/`，文件名含日期（盘中评估含时段）
- 对话中只回复一句摘要 + 文件路径

---

## 注意事项

- **数据时效**：分时数据需在交易时段获取，盘后诊断建议在收盘 15 分钟后再执行
- **免责**：本 Skill 提供分析框架，不构成投资建议。所有买卖决策由用户自行判断
- **仓位约束**：每次操作建议前确认用户仓位规则，避免超仓建议
- **止损优先**：任何分析若发现持仓标的明显破位，优先输出止损提醒

---

## 前置依赖

### 数据通道 Skills

本 Skill 的三个环节均依赖以下数据通道：

| 用途 | 通道 | 说明 |
|---|---|---|
| 个股行情/分时/K线/均线/换手/成交额/后复权/筹码/财务/资金流向 | `westock-data` | A 股核心数据源，覆盖沪深京 |
| 全市场筛选/板块排行/规则选股/资金排行 | `westock-tool` | 批量筛选入口 |
| 市场情绪/新闻/公告 | `neodata-financial-search` | 自然语言金融数据搜索 |
| 技术分析框架 | `wb-finance-skill` | 形态识别/量价分析等框架与脚本 |

- 若 `westock-data` 不可用，Skill 无法运行，需提示用户先安装

### Python 依赖

- `openpyxl`：解析 `.xlsx`/`.xls` 交割单时的可选依赖。安装：`pip install openpyxl`
- 其余依赖均为 Python 标准库（`sys`、`json`、`argparse`、`re`、`pathlib`、`datetime`、`dataclasses`、`typing`），无需额外安装
