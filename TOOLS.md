# 猫哥个人站维护说明

这是一个直接发布到 GitHub Pages 的静态网站。公开页面由结构化数据、Markdown 内容和模板生成，生成后的 HTML 一并提交到仓库。

## 本地环境

- Node.js 20 或更高版本
- pnpm 11
- Python 3（仅用于启动本地静态服务器）

## 常用命令

```text
pnpm install
pnpm validate
pnpm test
pnpm build
pnpm check
python -m http.server 4173
```

本地预览地址为 `http://127.0.0.1:4173/`。

## 内容入口

- `data/profile.json`：个人定位、当前状态和公开链接
- `data/roadmap.json`：2026—2031 路线图
- `data/tasks.json`：30 天固定任务、方法、资料和完成标准
- `data/timeline.json`：职业、学习与生活的已确认节点
- `content/posts/`：公开写作源文件
- `content/projects/`：作品档案源文件

更新源文件后运行 `pnpm check`，确认测试和静态构建全部通过，再提交生成页面。

## 隐私边界

不要提交访问令牌、账号凭证、客户或公司内部信息、真实业务数据、私人行动证据和本机环境说明。行动页的清单、证据和复盘只存储在访问者自己的浏览器中。
