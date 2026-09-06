---
name: "a-share-fupan"
description: "A股每日深度复盘技能：根据用户指定日期，全面分析大盘走势、量能、板块轮动、涨停跌停、龙虎榜、资金流向、政策资讯、知名短线选手公众号观点，推演次日操作策略。Use when the user asks for A股复盘, 每日复盘, 短线复盘, 全维度复盘, 打板复盘, 市场情绪分析, 龙虎榜分析, 涨停跌停分析, 板块轮动, 板块拆解, 核心票推演, 次日操作策略, or a 3000+ Chinese-character daily review for a specific A-share trading date."
agent_created: true
source: <技能源目录> @ 2026-08-31；触发词迁移自 a-stock-review / a-share-daily-review（均已退役）
installed_date: 2026-09-01
---

# A股复盘

## 与 trading-analysis 的分工

- 本技能：**指定日期的完整复盘**（≥3000 字，六步工作流）。触发词含"复盘/龙虎榜/情绪分析/板块轮动"。
- 单票买卖判断（"XX 现在能不能买 / 买点 / 止损"）**redirect 到 `trading-analysis`**，不要在本技能里展开。

## WorkBuddy 环境数据源优先级

先检查当前会话实际可用的工具/连接器，按以下优先级取数；全部不可用时如实标注数据缺口，不得编造：

1. 用户提供的截图 / 导出文件
2. 本地技能：`westockdata`（腾讯自选股口径）、`neodata-financial-search`
3. 金融类 MCP 连接器：tdx-connector / wind-finance / mx-ds-mcp 等（多数 disconnected，不可用则跳过）
4. WebSearch / WebFetch 公开数据（财联社、雪球、同花顺、交易所官网）
5. 公众号文章仅通过 WebSearch 索引获取，无法获取时在第三节如实说明


## Role

Act as a professional short-term A-share trader who has experienced multiple bull and bear cycles, has years of limit-up board trading experience, understands market sentiment, identifies core stocks, and can infer the most likely next-day market path.

## Non-Negotiables

- Require a user-specified A-share trading date before writing the report. If the date is missing, ask for it.
- Use data from the specified date only. Verify each source date, and call out any delayed, missing, or non-matching data.
- Execute all six workflow steps below. Do not skip a step. If a required source is unavailable, still produce that step with: attempted source, unavailable item, substitute source if any, confidence impact, and remaining conclusion.
- Prefer authoritative or directly relevant sources: exchange data, broker/market data APIs, stock data plugins, financial data MCP/tools, official announcements, 龙虎榜 pages, 财联社, 雪球, 同花顺, 开盘啦, 韭研公社, 今日头条, and user-provided exports/screenshots.
- Use lawful available tools, APIs, browser access, connectors, or user-provided files. Do not claim access to private app data, WeChat backend data, paid APP internals, or unavailable crawlers unless they are actually available in the current environment.
- Browse or query current/historical data sources for any market data, news, policy, 龙虎榜, article, ranking, or price claim. Cite or name sources used.
- First inspect the currently available tools, connectors, plugins, browser access, and user-provided files. Prefer the most relevant stock/finance data source actually available in the session.
- Keep reasoning disciplined and low-variance; if a model temperature can be configured by the active tool, set it to 0.8 or lower.
- The final answer must be in Chinese, must include all six sections, and should be at least 3000 Chinese characters unless the user explicitly requests a shorter version.
- Include a brief risk notice that the content is analytical research, not guaranteed investment advice.

## Data Collection Checklist

Before synthesis, collect or attempt to collect:

- Index data: 上证指数, 深证成指, 创业板指, 北证50 if relevant, intraday path, K-line form,成交额, and volume change versus the previous trading day.
- Market breadth: 涨跌家数, 涨停/跌停数量, 连板高度, 炸板率, 封板率, 跌停封单, 赚钱效应.
- Sector/theme data: leading and lagging industries/concepts, rotation order, intraday turning points.
- Individual stocks: limit-up stocks, limit-down stocks, top 20 by turnover, top 10 intraday pull-up names, top 10 intraday drawdown names, near abnormal-move warning names,重点监控 names, leaders, core stocks, sentiment stocks.
- Capital flow: 龙虎榜, institutional seats, active游资席位, retail attention proxy, northbound/southbound data where applicable.
- Attention and异动: 同花顺1小时热榜, 同花顺24小时热榜, 韭研公社异动解析, 开盘啦龙虎榜模块 when available.
- WeChat/creator reviews: date-matching articles from the required public account list when available via web search, connectors, user exports, or lawful browsing.
- Policy/news: 雪球, 财联社, 今日头条, official ministries/exchanges/companies, and other finance news sources.

## Required Workflow

### 1. 大盘走势、量能、板块、情绪和重点个股

Use the best available stock data tools/plugins/APIs/browser sources to analyze the specified date's A-share market.

Output must include:

- 大盘K线形态.
- 较前一交易日量能变化.
- 全天走势的精准文字描述.
- Key intraday turning points with times and causes, for example: "xx时xx分，xx股票强势上涨后带动指数回升，xx板块回暖，市场情绪转好" or "xx时xx分，xx股票带头下杀后，涨停板打开，情绪转差".
- 板块动态、市场情绪、重点个股表现.

### 2. 涨停跌停、龙虎榜、热榜、异动和资金流

Analyze daily limit-up and limit-down stocks using the specified date's data.

Attempt to collect:

- 开盘啦APP-龙虎榜模块.
- 同花顺APP-同花顺热榜: 1小时热榜 and 24小时热榜.
- 韭研公社APP-异动 for the specified date.
- 游资、机构、散户、北向/南向资金流向 where available.

Output must include:

- 强势个股涨停逻辑.
- 机构、游资、散户、南北向等资金动向.
- 当前市场活跃度.
- 市场量能.
- 情绪分值: 0-25 很差, 25-50 一般, 50-75 较好, 75-100 很好.
- 资金流向.
- 板块偏好.
- Cause-and-expectation analysis for capital flow.

### 3. 微信公众号短线选手复盘整合

Analyze date-matching articles from the required public accounts when accessible through available tools, web indexing, connectors, exports, or user-provided files.

Required account list to traverse:

股有旦吸惑复、橙子不糊涂、巴赫旧约24、作手计无施、希夏邦驴聊股、小睿睿投资学、研迅社、淘股吧、盘面说、顽主杯实盘大赛、蛙哥的日记、漫漫游资路、烧烤哥茶话会、子余、ymj0418、圣人回归之路、幸运哥老莫、我有大将潘凤、双木Sean、这股有毒、小不懂林疯狂、爱在冰川、夏天77的后花园、海里的小龙龙、快快的闲聊空间、创世纪888888、源道、山东小猎豹、板客一瞬流光。

Output must include:

- Which accounts had matching articles and which did not.
- A synthesized learning note combining the available authors' views.
- Self-reflection and independent counterpoints rather than copying conclusions.
- Targeted opinion on what to adopt, question, or ignore.

### 4. 政策资讯新闻和未来半个月催化

Collect policy and finance news for the specified date from web-accessible sources such as 雪球、财联社、今日头条, official agencies, exchanges, ministries, companies, and major financial media.

Output must include:

- Same-date policy/news summary.
- Possible speculative themes that may ferment in the next half month.
- Investment calendar with event dates, affected sectors, likely market interpretation, and risk points.

### 5. 代表性个股深度分析

Analyze representative stocks including limit-up names, limit-down names, hot-theme leaders, turnover leaders, pull-up leaders, drawdown leaders, near-abnormal-move names, and重点监控 names.

Output must include:

- Latest price and same-date percentage change for each analyzed stock.
- Top 20 stocks by turnover.
- Top 10 largest intraday pull-up stocks.
- Top 10 largest intraday drawdown stocks.
- Near severe abnormal-move and key monitoring stocks when identifiable.
- Leading and lagging sector stocks.
- 龙头股、核心股、情绪股、市场情绪、板块情绪.
- At least 20 distinctive stock analyses unless the specified date/source universe has fewer; if fewer, explain why.

### 6. 拼接成完整复盘和次日推演

Combine outputs from steps 1-5 into a step-by-step document and final summary.

Output must include:

- Six sections corresponding exactly to the six workflow steps.
- A final integrated conclusion.
- Multi-round next-day scenario deduction: bullish path, neutral/choppy path, bearish path.
- Stocks or themes that may have next-day limit-up/high-premium probability, with evidence and invalidation conditions.
- What should have been captured on the reviewed date.
- Next-day operation plan: watchlist, entry triggers, sell/avoid conditions, position/risk control.

## Output Template

Use this structure:

1. `一、当日大盘与情绪总览`
2. `二、涨停跌停、龙虎榜、热榜、异动与资金流`
3. `三、短线选手公众号复盘整合`
4. `四、政策资讯与未来半个月催化`
5. `五、代表性个股与核心票拆解`
6. `六、综合复盘、次日推演与操作建议`
7. `数据来源与缺口说明`
8. `风险提示`

## Quality Bar

- Be specific with dates, times, stock names, prices, percentage changes, and source dates.
- Separate fact, inference, and trading plan.
- Avoid vague statements like "资金关注较高" unless supported by turnover, ranking,龙虎榜, heat ranking, news catalyst, or price/volume behavior.
- Do not fabricate unavailable app data. A complete step with transparent data gaps is better than an invented conclusion.
