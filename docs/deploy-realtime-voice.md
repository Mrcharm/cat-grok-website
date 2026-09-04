# JARVIS 实时语音代理部署

## 上线前提

本服务必须部署到支持持久 WebSocket 的 Node.js 或容器平台，不能放在 GitHub Pages，也不应部署到会随时终止长连接的普通函数服务。

在火山引擎控制台撤销所有曾出现在聊天、截图或日志里的旧凭据，重新创建凭据。新值只能由站点所有者直接填入托管平台的 Secret/Environment Variables 页面，不要写进本仓库、工单或聊天。

## 服务端环境变量

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `DOUBAO_WS_URL` | 是 | 火山引擎控制台或官方文档提供的实时对话 WebSocket 地址 |
| `DOUBAO_APP_ID` | 是 | 新应用标识，仅服务端保存 |
| `DOUBAO_ACCESS_KEY` | 是 | 新访问凭据，仅服务端保存 |
| `DOUBAO_MODEL_NAME` | 是 | 控制台显示的已开通模型名称，用于配置核对 |
| `DOUBAO_SPEAKER` | 否 | 已开通且适用于实时对话的音色 ID |
| `ALLOWED_ORIGINS` | 是 | 逗号分隔的精确 Origin；正式环境至少包含 `https://mrcharm.github.io` |
| `PORT` | 否 | 托管平台注入的监听端口，缺省为 8787 |
| `MAX_SESSION_MS` | 否 | 单次会话上限，缺省 900000 毫秒 |
| `MAX_CONNECTIONS_PER_IP` | 否 | 单 IP 并发上限，缺省 2 |

`X-Api-Resource-Id` 和官方 App Key 由协议适配器按官方 speech-dialog 协议设置，不接受前端覆盖。当前直连协议使用访问凭据，不使用用户曾提供的 Secret Key 字段。

## 容器启动与检查

从仓库根目录构建容器，托管平台运行 `Dockerfile` 的默认命令。服务启动后检查：

```text
GET https://<代理域名>/healthz
```

预期 HTTP 200，正文只有：

```json
{"ok":true}
```

健康检查不代表豆包鉴权成功。必须再从允许的正式网站 Origin 发起 `/voice` WebSocket 会话，收到 `server.ready` 才能证明上游握手和 StartSession 成功。

## 连接首页

代理服务取得公开 HTTPS 域名后，把首页 `#voiceDock` 的 `data-voice-endpoint` 设置为对应的 `wss://<代理域名>/voice`。该地址是公开信息，页面中仍不得出现任何豆包凭据。

修改后依次执行：

```text
pnpm validate
pnpm test
pnpm build
pnpm smoke
```

最后使用真实浏览器验证首次点击授权、连续三轮中文对话、流式字幕、边生成边播放、语音打断、主动停止、权限拒绝和离开页面后麦克风释放。

## 日志与故障定位

生产日志仅允许记录随机请求 ID、公开错误码、连接状态和耗时。禁止记录请求头、环境变量、原始上游错误、音频内容和字幕。鉴权失败时在火山引擎控制台核对应用、已开通资源、模型名称和音色，不要把凭据复制到日志中。
