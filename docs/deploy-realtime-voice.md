# JARVIS 豆包 3.0 实时语音服务部署

## 运行边界

首页通过 Render 上的 Node.js WebSocket 代理连接豆包端到端实时语音。长期 API Key 只保存在服务端；浏览器只发送 16kHz、单声道、PCM16 的 20ms 音频帧，并播放豆包返回的 24kHz PCM。服务不保存音频或字幕，也不启用工具、联网、位置、音乐、声音复刻或录音。

## 服务端环境变量

只有以下两项必填；表中不提供任何密钥示例值。

| 名称 | 用途 |
| --- | --- |
| `DOUBAO_API_KEY` | 豆包端到端实时语音 API Key，仅服务端保存 |
| `ALLOWED_ORIGINS` | 允许连接 `/voice` 的网页 Origin 白名单，多个值用逗号分隔 |

服务固定连接 `wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue`，模型为 `1.2.6.1`。会话最长 15 分钟，单进程全局最多两个并发连接。可选设置只能向下收紧这两个上限，不能突破硬上限。

## Render 配置

使用已有 Free 服务与 feature branch：

```text
Build Command: pnpm install --frozen-lockfile
Start Command: pnpm start:voice
Health Check Path: /healthz
```

健康检查返回 `{"ok":true}` 只证明进程可访问，不证明豆包鉴权或音频链路成功。部署时不要记录请求头、环境变量、音频、字幕或上游原始错误。

## 连接首页

后端完成真实验证前，保留首页 `data-voice-endpoint=""`。验证通过后只填 Render 的公开 HTTPS Origin，不带 `/voice`；浏览器代码会转换为 WSS 并追加该路径。仓库和页面中都不得出现 API Key。

## 验收

先执行 `pnpm check`。之后在真实浏览器验证：首次点击授权、连接后无需说话即可听到 JARVIS 开场白、连续中文对话、字幕、开口打断、主动停止、页面离开后麦克风释放，以及权限拒绝或系统静音时的明确提示。当前本地自动测试不等于这些真实链路已经完成。
