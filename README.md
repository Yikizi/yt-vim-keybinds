# YouTube Vim Keybinds

Vim-style keyboard navigation for YouTube, packaged as a Safari Userscripts-compatible userscript.

## Shortcuts

- `h` / `l` — move previous/next video in visual order
- `j` / `k` — move down/up in the same visual column
- Numeric prefixes work: `10k`, `5j`, `3l`, ...
- `o` — open selected video
- `y` — copy selected video URL
- `w` — add selected video to Watch Later
- `x` — hide selected video / mark not interested when YouTube exposes that action
- `s` — go to Subscriptions
- `Esc` in text fields — blur back to normal navigation

## Files

- `engine.js` — generic keybinding/navigation engine
- `sites/youtube.user.js` — YouTube-specific bindings/actions
- `dist/youtube.user.js` — built userscript installed into Userscripts
- `scripts/build.mjs` — bundles engine + site script

## Build

```bash
npm run build
```

## Install into Safari Userscripts

```bash
npm run install:safari-userscripts
```

Safari Userscripts live path:

```text
~/Library/Containers/com.userscripts.macos.Userscripts-Extension/Data/Documents/scripts/youtube.user.js
```
