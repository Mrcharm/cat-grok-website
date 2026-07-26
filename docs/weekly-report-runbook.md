# 每周五周报发布说明

1. 在网站“今日行动”中，给适合公开的已完成任务填写“可公开周报素材”。
2. 每周五下班前点击“导出本周公开素材”，浏览器会下载
   `mrcharm-weekly-public-YYYY-MM-DD.json`。
3. 周五自动任务只读取这个文件。没有素材、文件名日期不对、仓库有未提交改动或测试失败时，发布会停止并提示处理。
4. 私人证据、每日复盘、Checklist 和完整进度备份不会进入周报文件。

手动执行：

```powershell
.\scripts\publish-weekly-report.ps1 -WeekEnding 2026-07-31
```
