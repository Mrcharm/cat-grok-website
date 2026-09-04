# JARVIS 首页豆包 RTC O2.0 设计

## 决策与替代关系

本设计取代 `2026-09-03-doubao-realtime-voice-design.md` 中“浏览器 PCM 经 Render WebSocket 代理直连豆包语音协议”的运行架构。保留其中已确认的首页交互、安全边界、字幕、打断、背景音乐暂停和真实验收要求，但传输层改为火山引擎实时音视频 RTC，模型固定为豆包端到端实时语音 O2.0。

不再把现有 `server/doubao-protocol.mjs`、`server/doubao-session.mjs` 和浏览器 PCM 管线作为生产路径。它们在新链路通过测试前保留，便于回退；发布前再删除或明确隔离，避免两套协议同时生效。

## 目标与范围

用户首次点击首页“唤醒 JARVIS”后授权麦克风，浏览器加入一次性 RTC 房间。Render 服务启动纯端到端 VoiceChat 任务，豆包 O2.0 在房间内直接完成听、想、说。页面展示快速字幕，支持连续对话、用户打断、主动结束和异常清理。

本次只做首页一对一中文语音陪伴，不增加联网搜索、Function Calling、RAG、长期记忆、录音保存、多人房间、视频理解或声音复刻。

## 采用方案

### 官方 RTC 纯端到端模式（采用）

- `S2SConfig.Provider = "volcano"`
- `S2SConfig.OutputMode = 0`
- `S2SConfig.ProviderParams.dialog.extra.model = "1.2.1.1"`
- `SubtitleConfig.SubtitleMode = 1`

该方案与火山引擎“接入端到端实时语音大模型”文档一致，浏览器和 AI Bot 通过 RTC 房间交换实时音频，端到端模型直接生成文本和语音，延迟最低。

### 保留直接语音 WebSocket（不采用）

只修改旧会话参数的改动较小，但它不是用户指定的 RTC 接入方式，并且会继续维护自定义 PCM、上游二进制协议和播放队列。该路径仅作为实施期间可回退的旧分支，不进入最终首页。

## 系统结构

### 首页 RTC 控制器

首页加载火山 RTC Web SDK，但不自动申请权限。首次点击后：

1. 暂停背景音乐并解锁浏览器音频播放。
2. 请求麦克风权限。
3. 向 Render 请求一个短期会话，其中包含随机 `roomId`、真实用户 `userId`、AI Bot `userId`、一次性 `taskId`、RTC `appId` 和短期进房 Token。
4. 使用 RTC SDK 加入房间并发布麦克风音频。
5. 订阅 AI Bot 的远端音频和字幕事件。
6. 将页面状态映射为“连接中、聆听中、回复中、重连中、已结束、错误”。

浏览器永远不获得 RTC AppKey、火山 IAM Secret Key 或豆包 S2S Access Token。

### Render 会话服务

Render 从服务端环境变量读取长期凭据，提供以下最小接口。会话采用两阶段启动，确保真人已经进入 RTC 房间后再启动 AI Bot：

- `POST /rtc/session`：校验网页来源和限流，生成一次性房间标识、用户标识和短期 RTC Token，但不启动 AI Bot。
- `POST /rtc/session/:sessionId/start`：校验会话所有权，在浏览器确认入房后调用 `StartVoiceChat` 启动 AI Bot；重复调用返回同一会话状态，不创建第二个任务。
- `DELETE /rtc/session/:sessionId`：校验会话所有权并停止对应 VoiceChat 任务。
- `GET /healthz`：只返回服务健康状态，不暴露配置。

服务负责生成 RTC Token、签名调用火山引擎 RTC 服务端 API、创建与销毁 VoiceChat 任务。服务不代理实时音频，不保存字幕，也不把长期凭据下发给浏览器。

### 火山引擎 RTC 与豆包 O2.0

每个首页会话使用独立 `roomId` 和 `taskId`。真实用户与 AI Bot 使用不同 `userId` 加入同一房间。`StartVoiceChat` 请求包含：

- RTC 应用、房间、任务和双方用户标识；
- `Provider = volcano`、`OutputMode = 0`；
- S2S App ID 与对应 Access Token；
- O2.0 模型版本 `1.2.1.1`；
- `SubtitleMode = 1`；
- JARVIS 的 `bot_name`、`system_role` 和 `speaking_style`；
- O 系列精品音色，默认使用沉稳男声，最终以控制台已开通音色和真实请求结果为准。

## 凭据与部署配置

生产配置分为三类，名称在实施时以官方 SDK/API 的真实字段为准：

- RTC 应用：`RTC_APP_ID`、`RTC_APP_KEY`，用于客户端短期进房 Token。
- 火山服务端 API：IAM Access Key ID 与 Secret Access Key，用于签名调用 `StartVoiceChat` 和停止任务。
- 豆包端到端语音：`S2S_APP_ID`、`S2S_ACCESS_TOKEN`，只放入 `S2SConfig.ProviderParams.app`。

任何已经在聊天、日志或远程地址中出现过的凭据均视为泄露，不得进入 Render。站点所有者必须在相应控制台轮换后，直接填写到 Render 的 Secret 环境变量中，不经聊天转发。

当前 Render 新建服务表单不得直接提交。代码完成且凭据名称经过测试确认后，重新填写环境变量并部署，防止旧 WebSocket 服务先上线。

## 会话和错误处理

- 会话创建采用一次性随机标识，Token 有效期不超过会话上限。
- 每个来源 IP 同时最多保留两条会话；单会话默认最长 15 分钟。
- 创建失败时服务端主动清理已经启动的任务；停止请求可重复调用且结果幂等。
- 麦克风拒绝时保持文字说明，不启动 RTC 房间，不回退到本地假回复。
- RTC Token 过期或网络中断时只进行次数受限的重连；无法恢复则停止任务并释放麦克风。
- 用户离开页面、主动停止或会话超时，都执行停止任务、离开房间、关闭麦克风三个动作。
- 开始语音时暂停背景音乐，结束后不自动恢复。
- 对浏览器只返回稳定错误码和可读提示；日志只保留请求 ID、阶段、状态和耗时。

## 测试策略

### 自动化测试

- RTC Token 只能由服务端生成，短期 Token 响应不得包含任何长期密钥。
- `StartVoiceChat` 请求准确包含 `OutputMode=0`、`model=1.2.1.1` 和 `SubtitleMode=1`。
- 会话创建、重复停止、启动失败回滚、超时和限流均有测试。
- 首页状态机覆盖权限拒绝、入房成功、远端音频、字幕、打断、断线和清理。
- 公开构建和 Git 历史扫描不得出现任何长期凭据及其片段。
- 四页导航、首页布局、学习日历和背景音乐现有测试不得回归。

### 真实验收

只有同时满足以下条件才算完成：

1. 使用轮换后的 RTC、IAM 和 S2S 凭据完成真实 `StartVoiceChat`。
2. 正式 GitHub Pages 首页首次点击后成功入房并获得麦克风。
3. 连续完成至少三轮中文对话，远端音频来自豆包 O2.0。
4. 页面显示双方快速字幕，且字幕不会重复堆叠。
5. JARVIS 播报过程中用户开口能够打断。
6. 主动结束和离开页面后，RTC 房间、VoiceChat 任务和麦克风均释放。
7. Render 日志没有音频、字幕、Token、AppKey、Access Key 或原始上游错误。
8. 完整测试、构建、烟雾检查、线上健康检查和真实移动端布局检查通过。

## 已知前提

- 站点所有者需要在火山引擎创建并开通 RTC 应用，而豆包 S2S App ID 不能替代 RTC App ID。
- 正式环境必须由服务端生成 RTC Token；控制台临时 Token 只允许用于人工验证，不进入生产页面。
- 豆包端到端语音和 RTC 可能分别计费；Render 免费实例休眠会增加首次会话启动等待时间。
- 官方 API、SDK 包名和参数以实施时读取到的火山引擎当前文档与 SDK 类型定义为准，不凭记忆猜测。
