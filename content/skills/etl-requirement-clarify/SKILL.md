---
name: etl-requirement-clarify
description: Use when 任务包含自然语言、JSON、Excel 或混合形式的 ETL 加工需求，需要在查数取证或 SQL 生成前形成准确、精简、可追溯的需求澄清卡片。
---

# etl-requirement-clarify

## 技能定位

把当前需求文字、JSON、Excel 或它们的组合转译为标准 ETL 需求澄清卡片，区分已确认内容、待用户确认事项和需要后续取证的事项。

## 输入来源判定

先判「内容从哪里来」，再分流到对应规则。优先依据平台识别的内容类型，文件扩展名仅作为辅助线索。

四个并列输入来源：

| 来源 | 判定依据 | 处理 |
|---|---|---|
| 自然语言 | 用户消息正文 | 按自然语言规则拆解 |
| Excel | `.xlsx`/`.xls` 附件、平台解析表格 | 按 Excel 规则拆解 |
| 已有设计 | `etl_design` 工具返回结果 | 先做准入判断（见下），通过后按 JSON 规则拆解 |
| 用户 JSON | 用户直接提交的 JSON 正文 | 按 JSON 规则「通用 JSON」部分拆解 |

各来源对应的规则文件见「读取说明」。

## 读取说明

入口必读（每次执行）：

- `references/clarification-rules.md`：语义判定规则（缺口分类、单目标表限制、终态判定）；
- `references/requirement-clarify-output.schema.json`：唯一输出结构。

按需加载（按输入来源）：

- `references/natural-language-mixed-input-rules.md`：自然语言输入时读取；
- `references/excel-input-rules.md`：Excel 输入时读取；
- `references/json-input-rules.md`：`etl_design` 准入通过或用户提交 JSON 时读取。

## 附件读取

附件必须由平台提供可被对应读取工具接受的附件对象或附件引用；具体由平台按附件类型选择读取方式，技能不写死具体读取工具。

自然语言正文或平台已解析的结构化内容直接可见时，不调用附件工具。


## 执行流程

1. 每次新的需求分析首次执行时，调用 `etl_design` 获取当前脚本已有设计结果；后续澄清复用上一轮结果。严格使用工具真实返回内容，不得补造、改写或推测。
2. 按 `references/json-input-rules.md` 判断返回内容是否准入；通过后作为 JSON 来源，未取得或无有效内容时忽略该来源，不阻塞需求澄清。
3. 读取实际可用的自然语言、通过准入的 `etl_design` 结果和 Excel，按各自来源规则拆解。
4. 按附件、Sheet、连续业务区域或关键 JSONPath 建立精简的 `input_sources`。
5. 按介质规则提取脚本、场景、目标、来源、显式步骤和字段规则，并按混合输入规则合并。
6. 先合并多行或多介质中重复出现的同一最终目标表；若仍存在两个及以上不同的最终目标表，按 `clarification-rules.md`「单目标表限制」停止并返回。
7. 把跨字段重复条件提炼为 `shared_rules`，按目标字段组织 `field_mapping_groups`，保留原始业务细节。
8. 把业务决策缺口放入 `pending_confirmations`，本轮最多三项、优先带候选选项；把可查询验证的缺口放入 `evidence_requests`。
9. 缺口分类完成后直接返回 JSON，不再重复判断，也不展示分析过程。

## 多来源合并优先级

同一属性值一致时合并；存在冲突时保留候选，不静默覆盖。只有用户明确表示「以本次为准」或「替换」时才覆盖；既有用户确认优先于未确认输入。操作性文字不参与业务事实冲突。

## 停止条件

- 存在待用户决定且影响映射的事项：返回 `NEED_USER_INPUT`。
- 不再存在上述事项：返回 `READY_FOR_EVIDENCE`，允许仍有待取证事项。
- 存在两个及以上不同的最终目标表：返回 `INPUT_INVALID`，不生成需求卡片。
- 输入整体不可读：返回 `INPUT_INVALID`。
- 业务契约与 Schema 冲突：返回 `ERROR`。

## 输出边界

- 只返回符合 `references/requirement-clarify-output.schema.json` 的 JSON，不附加 Markdown。
- 唯一业务语义以 `references/clarification-rules.md` 为准；两文件冲突时返回 `ERROR`。
- 不重复书写多字段共用规则；映射组通过 `shared_rule_refs` 引用。
- 每个目标字段必须保留独立的字段映射，不得因分组压缩而遗漏。
- 无显式业务步骤时不虚构步骤。
- 按执行流程调用 `etl_design` 获取当前脚本已有设计结果。
- 不生成、解释、校验或优化 SQL。
- 不控制调用方如何向最终用户展示结果。
