# Electric Street and Voice Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Implement approved electric-blue street visual direction on all four pages while preserving content; verify and correct inaudible Doubao output.

**Architecture:** Existing static build/template pipeline and persistent navigation stay. Visual changes are limited to homepage, shared styles and templates. Voice fixes stay in duplex controller and dedicated tests.

**Tech Stack:** HTML, CSS, JavaScript modules, Node tests, GitHub Pages, existing Render WebSocket proxy.

## Global Constraints

- Preserve data/, content/, downloads/, current portfolio screenshots, learning tasks and .nojekyll.
- Never hand-edit generated articles/index.html, skills/index.html, portfolio/index.html.
- Entering site attempts background music; clicking start voice immediately stops music. Browser autoplay limits must be reported honestly.
- User approved direction A: electric cobalt blue, white, ink black; street collage headphone cat, bold title. No replacement with fictional mockup content.
- No secrets in source or logs. Do not claim physical microphone/speaker acceptance from server-only tests.

## Task 1: Visual implementation

- [ ] Read current homepage, shared CSS/templates, navigation and visual tests. Record current content counts.
- [ ] Add regression assertions for electric street asset/style links and preserve existing content checks.
- [ ] Implement poster-like hero, accessible voice dock, unified fixed header, responsive shared subpage typography and content surfaces. Root supplies generated cat hero asset.
- [ ] Build and run relevant homepage/site/navigation/portfolio tests. Check generated outputs match build.
- [ ] Review visual desktop/mobile screenshots; preserve existing content and fix overflow.

## Task 2: Voice playback diagnosis and correction

- [ ] Reproduce live UI failure and inspect output path, AudioContext state, muted track policy and interruptions.
- [ ] Add focused regression for each confirmed defect; run failing test then minimal correction.
- [ ] Verify live upstream audio plus browser output scheduling; microphone muted state must not be misreported as provider failure.
- [ ] Keep default music and stop-on-voice behavior; verify music never unexpectedly restarts during voice.

## Task 3: Integrated release

- [ ] Run pnpm check, generated output compare, secret/content diff checks.
- [ ] Review bounded visual and voice diff, fix blocking issues.
- [ ] Merge preserving latest remote content, push without force, confirm Pages success and public UI.
- [ ] Report exact verified boundaries, including any device limitations.
