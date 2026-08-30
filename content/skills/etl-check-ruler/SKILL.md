---
name: etl-check-ruler
description: Use when 需要检核一段独立 SQL，或长链路中必须对 etl-sql-create 生成及修订后的 SQL 草案执行高危、超高危检查。
---

# etl-check-ruler

## 技能定位

调平台工具 `checkSqlUsingPOST` 检核 SQL，只返回**高危和超高危**问题；平台告知工具不可用或未接入时用固定静态规则兜底。不执行 SQL、不改写 SQL。

触发场景：

- 已有一段 SQL 要检核（用户直接提交的 `sql_text`，或长链路的 `sql_draft`）；
- SQL 根据上一轮检核问题修订后，需要重新检核。

没有有效 SQL、只要求生成 SQL、要求执行 SQL 或查询数据时不触发。

## 调用输入

- 独立检核传 `sql_text`（可不传 `evidence_card`）；
- 长链路检核必须同时传当前 `sql_draft` 和已确认的 `evidence_card`（判越权用）。

`sql_text` 与 `sql_draft` 二选一；空文本或明显不是 SQL → `INPUT_INVALID`。

## 读取说明

入口必读（每次执行）：

- `references/check-rules.md`：检核处理流程；
- `references/check-ruler-input.schema.json`、`check-ruler-output.schema.json`：输入/输出字段结构。

## 执行流程

1. 校验输入并取得待检核 SQL。
2. 按 `check-rules.md` 执行接口检核、结果过滤和风险映射。
3. 平台明确告知工具不可用或未接入时，按其中的静态规则兜底。
4. 按输出 Schema 返回当前检核结果。

## 停止条件

- 未发现高危或超高危：返回 `PASS`。
- 存在高危或超高危：返回 `FAILED`。
- 输入无效（空文本、非 SQL、参数错误）：返回 `INPUT_INVALID`。
- 工具检核和静态检核均无法完成：返回 `ERROR`。

## 输出边界

- 不执行 SQL，不改写或修复 SQL。
- 不把「工具不可用」解释成「SQL 通过」。
- 不把中低风险升级为高危或超高危。
- 不输出中低危问题或普通优化建议。
