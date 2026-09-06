---
name: etl-sql-create
description: Use when 需要进行SQL语句生成 或需要结合当前草案和明确反馈定向修订进行SQL改写优化。
---

# etl-sql-create

## 技能定位

把已经满足 SQL 准入的结构化事实转换为可检核的 SQL 草案；已有草案时，根据用户反馈或结构化检核问题生成SQL新草案。

## 调用输入

首次构造从以下两种结构化事实中二选一：

- 当前有效且已经确认的 `evidence_card`；
- 用户直接提供且已经确认的 `direct_input`。

定向修订还必须读取当前 `sql_draft`，以及至少一项用户反馈或结构化检核问题。

方言未提供时默认 `POSTGRESQL`。


## 读取说明

入口必读（每次执行）：

1. `references/sql-create-rule.md`：输入、准入、生成步骤；
2. `references/sql-create-input.schema.json`：唯一输入结构；
3. `references/sql-create-output.schema.json`：唯一输出结构。

按需加载：

- `references/postgresql-generation-rules.md`：实际生成 SQL 语句、会话级临时表或渲染占位符时读取。


## 执行流程

1. 识别 `evidence_card` 或 `direct_input`，按是否同时存在 `sql_draft` 和反馈或检核问题判断首次构造或定向修订。
2. 校验所有会改变 SQL 语义的目标表、目标字段、来源表、来源字段、映射、关联、过滤和聚合均已确定；
3. 按业务规则和输出 Schema 建立固定 Step 1～8 的 `generation_plan`。
4. 按加工粒度规划全局步骤，必要时增加会话级临时表。
5. 为每步规划目标、来源、JOIN、WHERE、GROUP BY、HAVING、ORDER BY、子查询、策略和算子等。
6. 逐个目标字段生成可追溯表达式，完成 INSERT 与 SELECT 数量及顺序对账。
7. 生成注释，渲染 `${来源Schema}`、`${目标Schema}` 和运行参数占位符，拼装 PostgreSQL SQL 草案。
8. 执行生成前自检；修订时同时核对反馈是否已处理。
9. 按 Schema 只返回一个 JSON 对象并结束。
10.完整脚本生成完毕后优先调用前端组件presentPerlScript 展示
## 停止条件

- 草案生成且自检通过：返回 `COMPLETED`。
- 缺少可由取证补齐的表、字段、Schema、目标表业务日期字段或必要码值等物理事实：返回 `NEED_EVIDENCE`。
- 缺少必须由用户决定的业务口径，或用户反馈改变既有需求事实：返回 `NEED_USER_INPUT`。
- 输入无法形成有效 ETL 生成请求：返回 `INPUT_INVALID`。
- 契约、Schema 或技能自身发生不可恢复错误：返回 `ERROR`。

## 输出边界

- 严格按照输入的事实生成SQL，不新增证据外的生产表、目标字段、来源字段或业务条件。
- 可以创建仅服务当前脚本的会话级临时表，但必须给出拆分原因并完整追溯其字段来源。
- 生成的是待独立检核的 SQL 草案；自检通过不等于最终检核通过。
- 缺少 SQL 必需事实时只能按契约返回 `NEED_EVIDENCE` 或 `NEED_USER_INPUT`。
- 不调用数据库、元数据、知识库、外部检核或 Markdown 写入能力。
- 不维护返工轮次，不从展示文本恢复内部参数。
