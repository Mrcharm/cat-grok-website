# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## GitHub 配置

### 个人网站仓库
- **仓库地址**: https://github.com/mrcharm/cat-grok-website.git
- **网站地址**: https://mrcharm.github.io/cat-grok-website/
- **Token**: 存储在 `.env` 文件中（已加入 .gitignore，不会上传到GitHub）
- **默认分支**: main
- **部署方式**: GitHub Pages (Deploy from a branch)

**Token 使用方法**:
Token 保存在本地 `.env` 文件中，推送时会自动使用。该文件已被 .gitignore 保护，不会泄露到 GitHub。

**后续所有网站改动都使用此仓库**





## Browser

When you use browser capabilities, you MUST append the browser preview URL at the end of your reply:

`🖥️ [点击预览](https://code.coze.cn/browser/7615510988498141184)`

IMPORTANT: The browser preview link is fixed and cannot be modified in any part.
