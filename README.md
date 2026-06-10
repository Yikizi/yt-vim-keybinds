# yt-vim-keybinds

Vim-style keyboard navigation for YouTube, packaged as both a userscript and a standard WebExtension.

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
- `extension/` — unpacked WebExtension for Helium/Chromium/Firefox browsers
- `scripts/build.mjs` — bundles engine + site script and writes extension files

## Build

```bash
pnpm build
```

This writes:

- `dist/youtube.user.js`
- `extension/manifest.json`
- `extension/youtube.user.js`

## Safari Userscripts

```bash
pnpm install:safari-userscripts
```

Safari Userscripts live path:

```text
~/Library/Containers/com.userscripts.macos.Userscripts-Extension/Data/Documents/scripts/youtube.user.js
```

## Chromium / Helium / Brave / Chrome / Edge

1. Run `pnpm build`.
2. Open the browser extensions page, e.g. `chrome://extensions`.
3. Enable developer mode.
4. Choose **Load unpacked**.
5. Select this folder:

```text
/Users/mattias/projects/yt-vim-keybinds/extension
```

## Firefox

Temporary dev install:

1. Run `pnpm build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select:

```text
/Users/mattias/projects/yt-vim-keybinds/extension/manifest.json
```

Permanent Firefox install requires packaging/signing an `.xpi` through Mozilla Add-ons, unless using a Firefox build/profile that allows unsigned extensions.

## Package WebExtension zip

```bash
pnpm package:extension
```

Output:

```text
dist/yt-vim-keybinds-extension.zip
```
