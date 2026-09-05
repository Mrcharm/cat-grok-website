---
name: ppt-slide-restyle
description: 参照已有单页PPT生成同版式新页。当用户说"参照这个PPT/附件生成一页，样式布局一致、仅文字更改"时使用。核心是复制原文件+按shape_id替换文字，保留全部格式。
agent_created: true
---

# PPT 单页复刻改字（保持版式）

适用场景：用户给一页参考 pptx，要"样式布局一致，仅文字上更改"的新页。

## 流程

1. **复制原文件**为新文件（不要从头用 pptxgenjs 重建，版式无法 100% 复刻）。
2. **盘点结构**：用 python-pptx 打印每页每个 shape 的 `shape_id / name / 位置 / 尺寸 / 全部 run 文本`（含字号、bold）。
3. **按 shape_id 映射新文案**，两种替换方式：
   - `set_runs(shape, [t1, t2, ...])`：逐 run 替换，保留 run 间换行/混合格式（用于标题、混排强调行）。
   - `set_lines(shape, [行1, 行2, ...])`：逐段落替换，每段只保留第一个 run 的格式、删除多余 run；段不够时 deepcopy 最后一段补齐；多余段删除。注意会丢失段内混排加粗。
   - **混排加粗恢复**（需要保留"关键词加粗"样式时）：以该段 run0 的 XML 为模板，删除全部 run 后按 `[(文本, 是否加粗)]` 分段 deepcopy 模板逐个 append，再 `run.font.bold = True/None`。模板选自原段第一个 run 以继承字号/颜色/字体。
4. **保存后必须回读校验**：重新打开打印全部文本，重点核对：
   - 序号框（纯数字的小 shape）和标题框是**不同 shape**，别张冠李戴。**此坑已踩两次**（均为第8步：标题误写进序号框43，真正标题框是44）。构造 steps 映射表时必须从第2步盘点输出逐个复制 shape_id，禁止凭"id连续"推测；渲染预览后逐个序号核对再交付。
   - 输入框等小框文字是否会换行溢出（按 字号pt × 0.014 英寸/字 估算行宽；10.5pt 窄框约12字/行封顶，14pt 宽框约55字/行）。
   - 横向长文本框（如闭环行）字数超框宽会被 LibreOffice 裁掉尾字：可去掉箭头两侧空格、删冗余前缀，或直接加宽纯文本框（无边框的文本框加宽不影响视觉）。
5. **渲染预览**：`"C:/Program Files/LibreOffice/program/soffice.exe" --headless --convert-to png --outdir <dir> <pptx>`， Read 图片检查溢出/错位后再交付。

## 环境

- python-pptx 已装在托管 venv：`C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe`
- LibreOffice 在本机 `C:/Program Files/LibreOffice/program/soffice.exe`，Windows 下 stdout 有 `<prefix>` 警告但转换正常；输出目录落盘为 `<临时目录>\...`（$TEMP 解析差异），用 ls 确认实际路径。

## 文案设计

- 先读用户知识库/附件确认术语（如本用户的 加工映射设计、CommitId、版本基线、灵码、3.0研发智能体），不要用通用词替代业务词。
- 流程页步骤数 = 参考页序号框个数；蛇形走位（上行左→右，下行右→左）时注意序号与位置的对应。
- **用户可能在自己改文件**：每轮修改前先回读目标文件核对当前内容（横幅/步骤标题可能已被用户手改），只动用户要求改的部分；文件被 PowerPoint 占用报 PermissionError 时另存新文件名，勿反复重试。
