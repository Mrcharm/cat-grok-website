---
name: etl-evidence-collect
description: Use when 需要查询或补齐 ETL 相关的表、字段、Schema、键、数据项、码值、策略、算子或表规模证据。
---

# etl-evidence-collect

## 技能定位

把查询要求或 ETL 需求卡片中的取证事项转换为受控查询计划，调用批准的数据库查询工具，并把当前有效结果汇总为唯一结构化 `evidence_card`。

## 调用输入

直接读取当前可见的：

- 简单查询要求（例如：帮我查询某字段的数据项编号、某码值）；
- 复杂的多项证据收集要求；
- `etl-requirement-clarify` 结构化需求卡片；
- 上一轮返回的完整 `query_plan` 和 `evidence_card` 检查点；
- 用户补充、候选选择或确认跳过信息。


## 读取说明

入口必读（每次执行）：

1. `references/evidence-rules.md`：语义判定规则（查询规划、状态判定、证据合并、终态判定）；
2. `references/evidence-collect-output.schema.json`：唯一输出结构。

按需加载：

- `references/whitelist-query-routing.md`：实际规划查询、确定各 `query_purpose` 查哪张表及参数时读取。

## 数据库查询约束

每次调用都必须显式传入 `datasourceName: "底座数据库"`，该值固定，不得覆盖、改名或使用近义词替代。业务查询只传递 `whitelist-query-routing.md` 规定的结构化 `query_purpose` 与规范参数。

`database_query` 最终失败时，对应查询项记为 `FAILED`，不改用其他工具。

## 执行流程

1. 判断是首次长链路、简单查询、检查点续跑还是用户补充。
2. 首次长链路只生成计划并返回；简单查询可直接规划并执行。
3. 续跑必须取得完整 `query_plan` 和 `evidence_card`，不得从需求或 Markdown 重新规划。
4. 每轮最多执行 3 个依赖已满足且彼此独立的 `PENDING` 查询项。
5. 使用固定“底座数据库”，按 `evidence-rules.md` 完成查询、状态判定、依赖传递和证据合并。
6. 判定顶层状态，按 Schema 返回完整 `query_plan` 和 `evidence_card`。

## 停止条件

- 简单查询中，任一查询项转为 `NEED_CONFIRMATION` 后立即返回 `NEED_USER_INPUT`，其他未执行项保持 `PENDING`。
- 仍有当前可执行的 `PENDING`：返回 `IN_PROGRESS`。
- 没有当前可执行的 `PENDING`，但存在 `NEED_CONFIRMATION`：返回 `NEED_USER_INPUT`。
- 不存在 `PENDING` 且不存在 `NEED_CONFIRMATION`：返回 `COMPLETED`。
- 只传入 `query_plan` 或 `evidence_card` 其中一项：返回 `INPUT_INVALID`。
- 没有可识别查询或取证要求：返回 `INPUT_INVALID`。
- Skill 输出无法通过 Schema，或执行流程发生不可恢复的自身错误：返回 `ERROR`。

`FAILED` 与 `CONFIRMED_SKIP` 不阻断收口，但下游不得用推测补齐相应缺失值。

## 输出边界

- 只返回符合 `references/evidence-collect-output.schema.json` 的 JSON，不附加 Markdown。
- `query_plan.items[]` 是查询状态唯一主本；`evidence_card` 只保存已取得的真实证据和待用户回答的问题。
- 公共字段固定保留，其他现有字段查到什么输出什么；不使用 `null` 或空数组占位。
- 需求卡片场景在 `evidence_card.requirement_card` 中原样保留完整需求卡片，包括 `shared_rules`、`field_mapping_groups` 及其全部 `mappings`；除用户明确修订外不得概括、删减或重建，物理证据放入 `tables` 等证据字段。
- 简单查询只返回查询要求及相关证据，不填充脚本、场景、步骤、规则等无关 ETL 空字段。
- 不创建、读取或更新调用方的 Markdown 文件；Markdown 由调用方负责展示或持久化，且不得作为下一次调用的参数来源。
- 不直接连接数据库，不查询真实业务表、系统目录或授权范围外对象。
- 不把样例 SQL、工具请求、重试次数或内部错误历史展示给用户。
- 不自行选择多个候选，不把空结果解释成「不存在」。
- 不生成、解释、校验或优化业务 SQL。
- 不控制调用方如何向用户展示结果。
