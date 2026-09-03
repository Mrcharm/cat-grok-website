---
name: trading-analysis
description: "A股单票交易判断：判断某只股票能不能买、买点是否有效、买盘是否在控、次日候选哪个最符合用户风格、是否仍在第一个有效机会窗口。Use when the user asks for 买点判断, 能不能买, 可以买入吗, 止损止盈, 仓位建议, 买盘控盘, 首个有效机会, 核心股判断, or a concise buy/sell/hold/watch verdict on a specific A-share stock."
agent_created: true
source: E:/skill/trading-analysis @ 2026-08-31；触发词迁移自 ashare-short-term-trading / stock-research-trading-review（均已退役）
installed_date: 2026-09-01
---

# Trading Analysis

## 与 a-share-fupan 的分工

- 本技能：**单票窄判断**（短输出，最终动作 BUY/SELL/HOLD/WATCH + 一行理由 + 一行风险 + 触发条件）。
- 指定日期的完整市场复盘（大盘/龙虎榜/情绪/政策）**redirect 到 `a-share-fupan`**，不要展开成长复盘。

## WorkBuddy 环境数据源优先级

数据完整性一节的要求不变；可用来源按以下顺序尝试，全部不可用时按"已知/缺失/待确认"三段返回：

1. 用户提供的截图 / 文件
2. 本地技能：`westockdata`、`neodata-financial-search`
3. 金融类 MCP 连接器（tdx-connector / wind-finance 等，多为 disconnected，不可用则跳过）
4. WebSearch / WebFetch 浏览器验证的公开数据（须带日期戳）

# Trading Analysis（原文）

## Scope

Keep this skill narrow and action-oriented.

Only use the eight roles below and only the minimum data required to make a trading judgment.

| Role | ID | Alias | Phase |
|---|---|---|---|
| technical analyst | market-analyst | technical | 1 parallel |
| fundamentals analyst | fundamentals-analyst | fundamentals | 1 parallel |
| sentiment analyst | sentiment-analyst | sentiment | 1 parallel |
| bull researcher | bull-researcher | bull | 2 sequential |
| bear researcher | bear-researcher | bear | 2 sequential |
| aggressive risk analyst | aggressive-risk-analyst | aggressive-risk | 3 parallel |
| conservative risk analyst | conservative-risk-analyst | conservative-risk | 3 parallel |
| risk manager | risk-manager | final-risk | 3 sequential |

## User Trading Style

Merge the user's trading style into every answer:

- buy core
- buy main rise
- buy repair
- buy when buyers are in control
- pay more for confirmation rather than less for falling prices
- act early on the first confirmed opportunity, not after the story is fully exhausted
- question every assumption before accepting it
- reduce every judgment to first principles: price, position, catalyst, volume, and control

Hard preference:

1. Is the stock still in the first wave of discovery, or has buying power already been exhausted?
2. What story is the stock telling, and is it part of the main line?
3. Is it the core stock, and is it the most active intraday name in its sector?
4. Is it in the main uptrend? If not, do not look at it.

Do not talk the user into mediocre setups. If the stock is not core, not main-line, or not in the main uptrend, say so directly.

## Buy-Point Gate

Check this gate before any long debate:

1. The stock is a core stock.
2. The stock is still in the main uptrend, or is actively repairing within a still-valid main trend.
3. Buyers are in control now.

If any one item fails, the answer is `no buy point`.

Short-circuit rule:

- if the gate fails, do not run the full long-short-risk chain
- return `invalid buy point` or `watch only` immediately unless the user explicitly asks for a deeper post-mortem
- only expand into the full chain when the gate passes or when the user asks for a comparison

## Valid And Invalid Buy Points

Treat these as valid only after confirmation:

- first confirmed attack in a main-line core stock
- active repair after selling pressure clearly weakens
- second attack that breaks the prior rebound high with volume
- weak-to-strong reversal only after buyer control is visible

Never treat these as valid buy points:

- failed first spike
- first rebound after panic
- high-level pullback that is still under seller pressure
- limit-down open or deep-water bargain as a standalone reason
- "it was strong yesterday" without present confirmation

Buyer control means:

- price reclaims the intraday average line
- deep-water names usually also reclaim previous close
- first pullback shrinks in volume and does not make a new low
- second attack breaks the prior rebound high with volume
- re-seal or reversal happens through active buy orders

First failed spike means:

- first attack makes a high and cannot hold it
- price falls back under the intraday average line
- second attempt cannot break the first high
- rebound volume shrinks while selling expands
- lows keep moving down after the attack

## Intraday Timing Limits

Use the user's hard timing limits:

- do not buy high-level pullback, deep-water, or near-limit-down candidates before `10:00`
- do not buy the first stop-fall attempt
- do not buy the first rebound
- only buy the second active attack after confirmation
- if no confirmation appears that day, prefer no trade

## Data Integrity

Every factual claim must have a clear source and date.

Acceptable sources:

- user-provided screenshots or files
- exchange data
- broker or market data
- longhu data or board data with a clear date stamp
- browser-verified public data

If a source is missing, stale, or conflicting, stop and ask the user instead of guessing.

If the user asks for a judgment but the source cannot be verified, return:

- what is known
- what is missing
- what must be confirmed before acting

## Stop-Loss Rules

Use hard invalidation, not vague patience.

Exit or reject if any of these appear:

- price stays under the intraday average line and rebound highs keep falling
- board or theme does not repair first
- the stock stops being a core name
- the next day fails to give the expected confirmation
- the failed setup is still being defended by hope rather than order flow

The user's mistake pattern to avoid:

- buying too early in high-level pullbacks
- buying while selling pressure is still being released
- treating "cheap" as "safe"
- confusing "possible reversal" with "already reversed"

## Hard Priority

Collect in this order when available:

1. latest A-share price and intraday structure
2. longhu and obvious capital-flow evidence
3. limit-up, broken-board, and limit-down structure
4. sector strength and whether the stock is the active core name

If the user asks for broader macro, policy, public-account, or long-form market review work, keep the answer short and redirect to the dedicated review skill instead of expanding this one.

## Operating Rules

### Collect only the minimum data

Use only what is needed to answer the question:

- latest or specified-date A-share OHLC and percentage change
- limit-up, limit-down, and board structure
- longhu and obvious capital flow
- one or two related sector leaders
- enough price structure to decide buyer control and failed spike versus weak-to-strong

Do not expand into large multi-source research unless the user explicitly asks for it.

### Keep reasoning compact

Avoid:

- multi-page workflow narration
- repeated scenario branching
- exhaustive theme expansion
- long public-account synthesis
- unnecessary model-like debate between many sub-roles

Prefer a short result with a clear verdict, one main candidate, and the key invalidation condition.

## Role Execution

### Phase 1: Parallel

Run the first three roles together.

- `market-analyst`: judge the chart, price structure, and current trend
- `fundamentals-analyst`: only check whether there is a real catalyst, filing, or business support
- `sentiment-analyst`: only check heat, longhu, and broad capital flow

Each role must stay compact:

- one conclusion
- up to three evidence bullets
- one invalidation condition

### Phase 2: Sequential

Combine long and short logic.

- `bull-researcher`: build the best long case
- `bear-researcher`: attack the long case and expose failure points

Each role must avoid re-litigating the same evidence twice.

### Phase 3: Parallel risk review

Use both risk roles in parallel.

- `aggressive-risk-analyst`: identify where upside may be underpriced
- `conservative-risk-analyst`: identify where downside may be underestimated

### Phase 3 end: Risk manager

`risk-manager` gives the final action:

- `BUY`
- `SELL`
- `HOLD`
- `WATCH`

Use `HOLD` only for an existing position whose thesis is not yet broken. For fresh capital, prefer `BUY` or `WATCH` instead of a vague `HOLD`.

Risk manager output must be the shortest layer:

- final action
- 1-line reason
- 1-line risk
- 1-line trigger

## Output Shape

Return a short structure:

1. final action
2. one-line reason
3. buy-point verdict: `valid buy point` / `watch only` / `invalid buy point`
4. key supporting evidence
5. key risk or invalidation
6. source and date used
7. suggested position size and trigger

Use qualitative position sizing unless the user explicitly asks for numbers:

- `trial`
- `normal`
- `aggressive`

## What This Skill Can Decide

Use this skill to make one of these decisions:

- `BUY`: core, main-line, first confirmed opportunity, buyers in control, trigger appeared
- `HOLD`: existing position is still valid, but the next trigger has not fully appeared yet
- `SELL`: buyer control failed, core status is lost, or the next-day confirmation did not show up
- `WATCH`: story is good, but the stock is not yet in the first valid entry window

What it should not do:

- chase after the crowd has fully recognized the move
- buy because a stock looks cheap after it has already broken structure
- wait for perfect hindsight confirmation when the first confirmed move is already visible
- expand into unrelated macro or public-account narrative unless explicitly asked

## Token Discipline

This skill must stay lean.

- do not simulate 12-person research
- do not force 5 phases on every question
- do not generate long research essays unless the user explicitly asks
- do not repeat the same conclusion in multiple forms
- do not waste context on unrelated market history

## Core Standard

If the user only wants one thing, answer one thing.

If the user wants a candidate, prioritize:

1. current price action
2. longhu and capital flow
3. board structure
4. buyer control and failed-spike filter
5. main uptrend only
6. only then fundamentals
