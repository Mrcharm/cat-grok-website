# Task 1 report

状态：DONE_WITH_CONCERNS

## 修改文件

- `package.json`
- `pnpm-lock.yaml`
- `server/config.mjs`
- `tests/rtc-config.test.mjs`

新增 `loadRtcConfig(env)`，按 RTC、IAM、S2S 分组返回服务端配置，并解析精确 Origin allowlist 与会话限制。所有必填字符串均在校验时 trim；会话 TTL 按要求封顶 900000ms，连接数使用要求的默认值。新增 RTC OpenAPI、RTC Web SDK 和 esbuild 依赖；`build` 先运行 `build:rtc`，再运行既有站点构建。

## TDD 证据

RED 命令：

```text
node --test tests/rtc-config.test.mjs
```

结果：失败，模块链接阶段报告 `server/config.mjs` 没有名为 `loadRtcConfig` 的导出；这是实现缺失导致的预期失败。

GREEN 命令：

```text
pnpm approve-builds --all
pnpm install && node --test tests/rtc-config.test.mjs
```

结果：通过，3 个测试全部通过；命令输出未包含任何凭据值。

回归命令：

```text
pnpm test
```

结果：通过，94 个测试全部通过。

## 自审与疑虑

- 生产配置仅读取服务端环境变量；没有把任何凭据写入测试、报告或构建产物。
- `build:rtc` 指向后续 Task 5 将创建的 `assets/js/voice/rtc-entry.js`，因此在 Task 5 合并前无法独立执行完整 RTC bundle；这是任务拆分造成的暂时性限制。
- 当前 pnpm 安装策略会在未批准依赖安装脚本时返回 `ERR_PNPM_IGNORED_BUILDS` 并生成临时 `pnpm-workspace.yaml`；已通过本地批准后完成安装，并删除该临时文件，未纳入提交。

Commit SHA：aa540113f1622c374d8e4fed4b62f43e6f9c9577
