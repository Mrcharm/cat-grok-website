---
name: etl-md-write
description: Use when 需要查看、保存、更新plan.md或record.md时。
---

# etl-md-write

## 技能定位

将用户输入或执行结果写入、更新 Markdown 文件，并调用 `publishArtifact` 展示。

Markdown 文件读写使用平台提供的文件能力，不固定工具名；只有前端展示固定调用 `publishArtifact`。

触发场景：

- 完整 ETL 到 SQL 长链路需要更新计划或记录；
- 用户明确要求将内容保存、查看计划或查看记录；
- 非长链路执行阶段，用户直接要求记录任意内容时，通过 `source_payload.content` 写入 RECORD.md

简单直接任务且用户未要求写 Markdown 时不得调用此技能。

`evidence_card.card_type=SIMPLE_QUERY` 时不写入 PLAN 或 RECORD，由 MAIN 直接向用户展示查询结果。

## 原子职责

技能只负责：

1. 接收当前阶段的产出结果（或用户明确要求的内容）；
2. 决定 PLAN 或 RECORD 中需要更新的具体章节；
3. 将当前有效结果按模板格式要求写入 Markdown；
4. 展示时优先调用前端 `publishArtifact` 展示。

## 调用输入

- `UPDATE_PLAN`：初始化或更新六步主计划，并按当前阶段 JSON 更新存在的 Skill 子计划；
- `UPDATE_RECORD`：按当前阶段 JSON 写入或更新需求卡片、证据卡片、SQL 构造记录或检核结论。

一次请求可同时包含两项操作。

包含 `UPDATE_PLAN` 时必须传顶层 `current_stage`，仅用于定位需要更新的计划阶段。

`source_payload` 是唯一业务内容来源；

内容必须按 `references/markdown-templates.md` 的 Markdown 结构输出。

## 读取说明

入口必读（每次执行）：

1. `references/md-write-input.schema.json`：唯一输入结构(参考)；
2. `references/md-write-output.schema.json`：唯一输出结构。

按需加载：

- `references/markdown-templates.md`：渲染 PLAN/RECORD 具体章节时读取；
- `references/source-json-mapping.md`：把各 Skill 原始 JSON 映射到 Markdown 章节时读取。

## 执行流程

1. 参考输入 Schema，保留 source_payload 原始结构；
2. 校验 operations 与当前结构化内容是否足以完成对应写入；
3. 根据 source_payload 确定 PLAN、RECORD 本轮需要替换或追加的章节内容；
4. 按 References/markdown-templates.md 及/source-json-mapping.md生成内容;
5. 更新前先读取目标文件；已有唯一目标章节时原位替换，章节不存在时追加，空文件或首次建立时直接写入；
6. 同时更新 PLAN 和 RECORD 时分别保持幂等，不得产生重复章节；
7. 返回符合输出 Schema 的最小 JSON，其中包含实际更新文件、推荐展示内容和错误。
8. 展示时内容优先调用前端 `publishArtifact` 展示。

## 失败处理与幂等

- 同一 Skill 的同类章节只保留一个；再次写入时原位更新，不追加旧版本；



## 停止条件与错误返回

- 只有部分操作成功：`PARTIAL`；
- 全部成功：`SUCCESS`。
- 输入无效：`INPUT_INVALID`；全部工具操作失败或发生不可恢复错误：`ERROR`。


## 输出边界

- 更新了哪个文件，就返回并展示哪个文件的本轮可读内容；同时更新 PLAN 和 RECORD 时返回并展示两项；
- RECORD 保留完整当前结果；
- 不随意编造内容；
- 不记录数据库内部 SQL、内部标识、逐次重试历史或已被当前结果替换的旧内容；
- 阶段勾选、阻塞或返工状态由平台维护，本技能只渲染当前有效的 Skill 子计划；
- `current_stage` 不得写入 PLAN、RECORD 或 `display_content`。
