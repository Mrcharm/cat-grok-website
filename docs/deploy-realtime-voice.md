# JARVIS RTC 实时语音服务部署

## 上线前提

本服务是纯 HTTP 的 RTC 会话控制面，部署在 Node.js 或容器平台；实时音频由浏览器与火山引擎 RTC 房间直接传输。服务不代理或存储音频、字幕，不接入 RAG 或工具调用。

在火山引擎控制台撤销所有曾出现在聊天、截图或日志里的旧凭据，重新创建凭据。所有长期凭据只能由站点所有者直接填入托管平台的 Secret/Environment Variables 页面，不得写入仓库、工单、聊天或浏览器页面。

## 服务端环境变量

部署只需配置以下七项。表内仅给出名称和用途，不提供示例值。

| 名称 | 用途 |
| --- | --- |
| `RTC_APP_ID` | RTC 应用标识，用于签发短期进房 Token |
| `RTC_APP_KEY` | RTC 应用密钥，仅服务端保存 |
| `VOLC_ACCESS_KEY_ID` | 火山引擎 IAM 访问标识，仅服务端保存 |
| `VOLC_SECRET_ACCESS_KEY` | 火山引擎 IAM 访问密钥，仅服务端保存 |
| `S2S_APP_ID` | 豆包端到端语音应用标识，仅服务端保存 |
| `S2S_ACCESS_TOKEN` | 豆包端到端语音访问令牌，仅服务端保存 |
| `ALLOWED_ORIGINS` | 允许调用会话接口的网页 Origin 白名单，多个 Origin 用逗号分隔 |

## 安装与启动

仓库固定使用与 `pnpm@11.9.0` 兼容的 Node.js 运行时，并且只允许 esbuild 执行依赖安装脚本。Render 安装和启动命令分别为：

```text
pnpm install --frozen-lockfile
pnpm start:voice
```

也可以从仓库根目录构建 `Dockerfile`。容器以非 root 用户启动，只安装生产依赖。

## 健康检查与两阶段会话

服务启动后先请求健康检查：

```text
GET https://<服务域名>/healthz
```

预期 HTTP 200，正文只有：

```json
{"ok":true}
```

健康检查只证明进程可访问，不证明 RTC、IAM 或豆包鉴权成功。完整会话必须按以下顺序验证：

1. 网页向 `POST /rtc/session` 申请短期 RTC 会话。
2. 网页使用响应中的短期 Token 加入 RTC 房间。
3. 入房成功后调用 `POST /rtc/session/:sessionId/start`，启动 VoiceChat 任务。
4. 用户主动结束或离开页面时调用 `DELETE /rtc/session/:sessionId`，停止任务并释放麦克风。

旧 `/voice` WebSocket 路径已停用，并明确返回 404。健康检查或静态测试通过都不能替代真实 `StartVoiceChat`、中文多轮对话、字幕、远端音频、打断和清理验收。

## 连接首页

后端完成真实验收前，不修改首页当前为空的 `data-voice-endpoint`。后端确认健康且会话链路可用后，再把这里设置为服务的公开 HTTPS Origin；不要附加旧 `/voice` 路径。该 Origin 是公开信息，页面仍不得包含任何长期凭据。

修改后依次执行：

```text
pnpm check
```

最后使用真实浏览器验证首次点击授权、连续三轮中文对话、快速字幕、远端音频、语音打断、主动停止、权限拒绝、移动端布局和离开页面后的麦克风释放。

## 日志与故障定位

生产日志只允许记录随机请求 ID、公开错误码、连接状态和耗时。禁止记录请求头、环境变量、签名材料、上游原始响应、音频内容或字幕。鉴权失败时只在火山引擎控制台核对应用、资源开通和权限关系，不要把任何凭据复制到日志中。
