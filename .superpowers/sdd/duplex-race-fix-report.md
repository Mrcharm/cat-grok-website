# Duplex race fix report

## Scope

- `assets/js/voice/duplex-controller.js`
- `tests/duplex-browser.test.mjs`
- generated `assets/dist/duplex-voice.js`

The separately edited production endpoint in `index.html` is intentionally excluded from this change.

## Fixes

- Isolated microphone, capture context, player, frame buffers, timers, socket, and response state per session.
- Guarded permission, audio capture, WebSocket, timer, playback-error, failure, and cleanup callbacks by current session generation.
- Prevented stale permission completion and stale socket close from stopping or failing a restarted session.
- Marked the active response canceled on user speech and ignored delayed canceled audio until a new `response.created` event identifies a different response.
- Increased the browser connection deadline from 10 seconds to 75 seconds for Render free-tier cold starts; cancellation still closes the pending socket immediately.

## TDD and verification

- Regression tests were added first and observed failing for stale permission cleanup, stale socket close, and delayed canceled audio.
- `node --test tests/duplex-browser.test.mjs`: 8 passed, 0 failed.
- `pnpm build:voice`: generated `assets/dist/duplex-voice.js` successfully.
- `pnpm test`: 133 passed, 0 failed (after the concurrent deployment-contract correction was present in the shared worktree; that correction is not part of this commit).
- `git diff --check`: no whitespace errors.
# 补充验收（2026-09-05，最终状态）

- `e42b4e0` 已将取消门禁改为依据实际输出事件的 `response_id`，不再依赖 `response.created`。已取消 ID 的迟到事件被丢弃，新 ID 的文本或音频开始事件恢复新回复。
- ASR delta 是完整修订假设，现覆盖显示；最终转写覆盖临时结果。
- 聚焦测试 9 项通过，最终全量 134 项通过；独立复核无阻塞问题。
- 以下为首次修复时的历史记录，其中 8 项及 `response.created` 描述已被上述修订替代。
