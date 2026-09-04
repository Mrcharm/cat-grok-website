# Doubao RTC O2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provisional PCM WebSocket path with an official Volcengine RTC room running Doubao O2.0 after one homepage click.

**Architecture:** The browser obtains a short-lived RTC token from Render and joins first. Render then signs `StartVoiceChat`; live audio flows through RTC, while all long-lived credentials remain server-side.

**Tech Stack:** Node.js 20+, `@volcengine/openapi`, `@volcengine/rtc`, esbuild, Volcengine RTC OpenAPI `2025-06-01`, Node test runner, GitHub Pages, Render.

## Global Constraints

- Use `Provider=volcano`, `OutputMode=0`, `model=1.2.1.1`, `SubtitleMode=1`.
- Never expose RTC AppKey, IAM credentials, or S2S Access Token to the browser.
- Previously pasted credentials are compromised and cannot be reused.
- Join the RTC room before calling `StartVoiceChat`.
- Starting voice pauses background music; stopping does not restart it.
- No recording, persistence, RAG, web search, tools, vision, multi-user room, or voice cloning.
- Do not hand-edit generated subpages.
- Completion requires three real live turns, not only tests.

---

### Task 1: RTC configuration and dependencies

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `server/config.mjs`; create `tests/rtc-config.test.mjs`.

**Produces:** `loadRtcConfig(env)` returning RTC, IAM and S2S server configuration plus origin and session limits.

- [ ] Write failing tests requiring `RTC_APP_ID`, `RTC_APP_KEY`, `VOLC_ACCESS_KEY_ID`, `VOLC_SECRET_ACCESS_KEY`, `S2S_APP_ID`, `S2S_ACCESS_TOKEN`, and `ALLOWED_ORIGINS`.
- [ ] Run `node --test tests/rtc-config.test.mjs`; expect missing-export failure.
- [ ] Implement strict trimmed values, `sessionTtlMs=Math.min(Number(RTC_SESSION_TTL_MS||900000),900000)`, and `maxConnectionsPerIp=Number(MAX_CONNECTIONS_PER_IP||2)`.
- [ ] Add production dependency `@volcengine/openapi`; add development dependencies `@volcengine/rtc` and `esbuild`.
- [ ] Do not wire `build:rtc` yet because its entry file is created in Task 5; the normal build must remain green after this task.
- [ ] Run `pnpm install && node --test tests/rtc-config.test.mjs`; expect PASS and no credential values.
- [ ] Commit: `feat: configure secure RTC voice service`.

### Task 2: Short-lived RTC token generator

**Files:** Create `server/rtc-token.mjs`, `tests/rtc-token.test.mjs`.

**Produces:** `createRtcToken({appId,appKey,roomId,userId,nowSeconds,ttlSeconds,nonce})`.

- [ ] Write deterministic failing tests asserting prefix `001`, bound room/user, expiry, publish privilege `0`, and subscribe privilege `4`.
- [ ] Run `node --test tests/rtc-token.test.mjs`; expect module-not-found failure.
- [ ] Port the official demo format: little-endian fields, HMAC-SHA256, global expiry, publish and subscribe privileges. Inject clock and nonce for tests; never log inputs.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: issue short-lived RTC room tokens`.

### Task 3: Signed VoiceChat adapter

**Files:** Create `server/rtc-openapi.mjs`, `tests/rtc-openapi.test.mjs`.

**Produces:** `createRtcOpenApi({config,fetchImpl,SignerClass})` with `startVoiceChat(session)` and `stopVoiceChat(session)`.

- [ ] Write failing tests that inspect the signed POST body and query.
- [ ] Assert host `rtc.volcengineapi.com`, service `rtc`, region `cn-north-1`, and version `2025-06-01`.
- [ ] Assert `TargetUserId=[session.userId]`, `UserId=session.botUserId`, `OutputMode=0`, `model=1.2.1.1`, and `SubtitleMode=1`.
- [ ] Implement `Signer` from `@volcengine/openapi` and the exact O2.0 body, including JARVIS name, concise Chinese role, warm steady style, and `zh_male_yunzhou_jupiter_bigtts`.
- [ ] Implement `StopVoiceChat` with only AppId, RoomId and TaskId.
- [ ] Map failures to `RTC_PERMISSION`, `RTC_QUOTA`, or `RTC_UPSTREAM`; never return signed headers or raw bodies.
- [ ] Run `node --test tests/rtc-openapi.test.mjs`; expect PASS.
- [ ] Commit: `feat: start signed RTC O2 voice tasks`.

### Task 4: Two-phase session API

**Files:** Create `server/rtc-session-store.mjs`, `tests/rtc-session-api.test.mjs`; modify `server/index.mjs`.

**Produces:** `POST /rtc/session`, `POST /rtc/session/:sessionId/start`, `DELETE /rtc/session/:sessionId`, and existing `GET /healthz`.

- [ ] Write failing tests for exact origin allowlist, two sessions per IP, response secret exclusion, start idempotency, stop idempotency, start-failure rollback, and 15-minute cleanup.
- [ ] Run focused tests; expect RED.
- [ ] Generate opaque IDs using `crypto.randomUUID()` with `room_`, `user_`, `bot_`, and `task_` prefixes.
- [ ] `POST /rtc/session` returns only `{sessionId,appId,roomId,userId,botUserId,taskId,token,expiresAt}` and does not start AI.
- [ ] `POST /start` starts once only after browser join; `DELETE` stops and removes the task idempotently.
- [ ] Limit JSON to 8 KiB, emit `Cache-Control: no-store`, apply exact CORS, and store no audio or transcripts.
- [ ] Keep obsolete WebSocket modules present but unreferenced until Task 6.
- [ ] Run `node --test tests/rtc-session-api.test.mjs`; expect PASS.
- [ ] Commit: `feat: manage two-phase RTC voice sessions`.

### Task 5: Browser RTC controller

**Files:** Create `assets/js/voice/rtc-controller.js`, `assets/js/voice/rtc-entry.js`, `tests/rtc-controller.test.mjs`; modify `index.html` and only necessary shared template/style files.

**Produces:** `RtcVoiceController` with `start()` and `stop()` and states `idle`, `permission`, `preparing`, `joining`, `starting`, `listening`, `speaking`, `stopped`, `error`.

- [ ] Write failing tests proving event order `prepare-session -> join-room -> start-ai`.
- [ ] Test permission denial, remote bot audio, subtitle updates, autoplay failure, disconnect limit, stop, page hide, and unload cleanup.
- [ ] In `rtc-entry.js`, import `createEngine` and required enums from `@volcengine/rtc`.
- [ ] Add `build:rtc` to bundle `assets/js/voice/rtc-entry.js` to `assets/dist/rtc-voice.js`, and make the existing build run it first.
- [ ] Join with audio-only auto-publish and auto-subscribe, then call the server start route.
- [ ] Map SDK events to visible status and `aria-live`; stop must call DELETE, leave room, destroy engine, and release microphone.
- [ ] Switch homepage from provisional `realtime-voice.js` to `assets/dist/rtc-voice.js`; keep only the public Render origin in HTML.
- [ ] Run `pnpm build:rtc` and focused homepage/controller tests.
- [ ] Run the generated-page comparison; every page must report `ok`.
- [ ] Commit: `feat: connect homepage to Doubao RTC O2 voice`.

### Task 6: Remove obsolete PCM path and harden deployment

**Files:** Delete obsolete Doubao binary-protocol, PCM capture/player/worklet and provisional controller modules; rewrite their tests; modify deployment docs and smoke tests.

- [ ] First change tests to require the RTC bundle and reject the old `/voice` path; verify RED.
- [ ] Remove `server/doubao-protocol.mjs`, `server/doubao-session.mjs`, PCM modules, provisional controller and obsolete tests.
- [ ] Document exactly seven variables: the six RTC/IAM/S2S credentials plus `ALLOWED_ORIGINS`, without example values.
- [ ] Update smoke checks for the two-phase RTC API and homepage bundle.
- [ ] Run `pnpm check`, `git diff --check origin/main...HEAD`, and a credential-value scan.
- [ ] Accept name-only matches in tests/docs; reject any credential value or recognizable fragment.
- [ ] Commit: `chore: retire provisional PCM voice proxy`.

### Task 7: Render and live acceptance

**Files:** Modify `index.html` only after the backend URL is healthy.

- [ ] Push the feature branch without force.
- [ ] Recreate or update the Render free service using build `pnpm install --frozen-lockfile` and start `pnpm start:voice`.
- [ ] The site owner directly enters freshly rotated values; the agent never types or receives them.
- [ ] Set `ALLOWED_ORIGINS=https://mrcharm.github.io`.
- [ ] Deploy and verify `/healthz` before changing GitHub Pages.
- [ ] Create a session, join RTC, start O2.0, stop it, and verify sanitized Render logs.
- [ ] Put the verified Render origin in `data-voice-endpoint`, rerun `pnpm check`, compare generated pages, and commit.
- [ ] Update from `origin/main`, merge without force, push main, and wait for GitHub Pages.
- [ ] In a real browser verify first-click permission, three Chinese turns, quick subtitles, O2.0 remote audio, interruption, explicit stop, denial fallback, mobile layout, and microphone release.
- [ ] Declare completion only if backend health, signed StartVoiceChat, three turns, interruption, cleanup, secret scan, Pages deployment and browser QA all pass.
