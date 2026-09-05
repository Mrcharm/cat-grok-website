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
