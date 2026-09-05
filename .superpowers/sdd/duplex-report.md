# 豆包双工语音迁移报告

## 结果

- 线上入口由 RTC 控制面改为 `/voice` WebSocket 代理，服务端只要求 `DOUBAO_API_KEY` 与 `ALLOWED_ORIGINS`。
- `session.create` 对齐本地已验证 demo：模型 `1.2.6.1`，输入 PCM16/16kHz/单声道，输出 PCM/24kHz，云舟男声；收到 `session.created` 后自动提交 JARVIS 开场白。
- 首页保留原有视觉、语音按钮、状态、字幕和背景音乐暂停；新增 20ms 音频帧、PCM 播放、文字发送及 `response.cancel` 打断。
- 安全边界包含精确 Origin 白名单、单进程全局最多 2 会话、最长 15 分钟、消息大小与背压限制、10 秒上游握手超时、清理超时后强制终止、对外错误脱敏。
- 麦克风仅在浏览器持续报告音轨 `muted` 或 `ended` 时提示并结束；普通安静不会误判。`session.created` 前不上行音频，停止期间迟到的权限结果不能复活旧连接。
- 首页的 `data-voice-endpoint` 仍为空，未读取、写入或提交任何真实密钥。

## 验证

- 生成页一致性自检：4 个页面全部 `ok`。
- `pnpm check`：通过；内容校验通过，129 项测试全部通过，语音 bundle 与 4 个页面构建通过，双工 WebSocket 冒烟通过。
- `git diff --check`：通过，无空白错误。

## 尚未验证

- 未使用真实 `DOUBAO_API_KEY`，因此本提交不声称 Render 到豆包的真实握手、开场白音频、连续对话、字幕或打断已在线完成。
- Render 环境变量、公开 HTTPS/WSS 地址和首页 endpoint 由站点所有者在后续真实验收后配置。
