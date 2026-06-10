// ==UserScript==
// @name        Keybinds — YouTube
// @namespace   keybinds
// @match       https://www.youtube.com/*
// @grant       none
// @version     0.3.0
// @author      mattias
// @run-at      document-idle
// @description Keyboard shortcuts for YouTube navigation
// ==/UserScript==

// --- inline engine (will be bundled later) ---
// ENGINE_PLACEHOLDER
// --- end engine ---

const VIDEO_SELECTOR = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer";

const MENU_BUTTON_RE = /more actions|more options|action menu|veel toiminguid|rohkem|toiming/i;
const WATCH_LATER_RE = /watch later|hiljem vaat|vaadatavate videote hulka/i;
const REMOVE_RE = /remove|eemalda/i;
const HIDE_RE = /\b(hide|peida)\b|not interested|ei ole huvitatud/i;

function getSelectedVideoCard() {
  return document.querySelector(".keybinds-highlight") || document.querySelector(VIDEO_SELECTOR);
}

function getVideoUrl(card = getSelectedVideoCard()) {
  if (!card) return null;

  const selectors = [
    "a#video-title-link[href*='/watch']",
    "a#video-title[href*='/watch']",
    "a.ytLockupMetadataViewModelTitle[href*='/watch']",
    "a#thumbnail[href*='/watch']",
    "a[href*='/watch']",
    "a[href*='/shorts/']",
  ];

  for (const selector of selectors) {
    const link = card.querySelector(selector);
    const url = normalizeYouTubeUrl(link?.href || link?.getAttribute("href"));
    if (url) return url;
  }

  return null;
}

function normalizeYouTubeUrl(href) {
  if (!href) return null;

  const url = new URL(href, location.origin);
  const videoId = url.searchParams.get("v");
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;

  if (url.pathname.startsWith("/shorts/")) {
    return `${url.origin}${url.pathname}`;
  }

  return null;
}

function openSelectedVideo() {
  const card = getSelectedVideoCard();
  if (!card) return;

  const link = card.querySelector("a#video-title-link, a#video-title, a#thumbnail, a.ytLockupMetadataViewModelTitle, a[href*='/watch'], a[href*='/shorts/']");
  if (link) link.click();
}

async function copySelectedVideoUrl() {
  const url = getVideoUrl();
  if (!url) {
    showKeybindsToast("No video link found", "error");
    return;
  }

  try {
    await copyText(url);
    showKeybindsToast("Copied video link");
  } catch (error) {
    console.warn("[keybinds] Copy failed", error);
    showKeybindsToast("Copy failed", "error");
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback. Safari can be picky here.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("document.execCommand('copy') returned false");
}

function addSelectedVideoToWatchLater() {
  clickSelectedVideoMenuAction({
    patterns: [WATCH_LATER_RE],
    rejectPatterns: [REMOVE_RE],
    success: "Added to Watch later",
    failure: "Watch later action not found",
  });
}

function hideSelectedVideo(ctx) {
  clickSelectedVideoMenuAction({
    patterns: [HIDE_RE],
    success: "Hidden",
    failure: "Hide action not found",
    afterClick: (card) => {
      card.classList.remove("keybinds-highlight");
      if (ctx?.focusState) {
        ctx.focusState.item = null;
        ctx.focusState.index = -1;
      }
    },
  });
}

async function clickSelectedVideoMenuAction({ patterns, rejectPatterns = [], success, failure, afterClick }) {
  const card = getSelectedVideoCard();
  if (!card) {
    showKeybindsToast("No selected video", "error");
    return;
  }

  const menuButton = getVideoMenuButton(card);
  if (!menuButton) {
    showKeybindsToast("Video menu not found", "error");
    return;
  }

  menuButton.click();

  const item = await waitForMenuItem(patterns, rejectPatterns);
  if (!item) {
    closeYouTubeMenu();
    showKeybindsToast(failure, "error");
    return;
  }

  item.click();
  afterClick?.(card);
  showKeybindsToast(success);
}

function getVideoMenuButton(card) {
  const candidates = Array.from(card.querySelectorAll("button, tp-yt-paper-icon-button, [role='button']"))
    .filter((el) => !el.closest("#inline-preview-player, .html5-video-player, a[href], ytd-thumbnail"));

  return candidates.find((el) => MENU_BUTTON_RE.test(getElementLabel(el)))
    || card.querySelector("ytd-menu-renderer button, ytd-menu-renderer tp-yt-paper-icon-button, yt-lockup-metadata-view-model button");
}

function waitForMenuItem(patterns, rejectPatterns = [], timeoutMs = 1500) {
  return new Promise((resolve) => {
    const started = Date.now();

    const tick = () => {
      const item = findMenuItem(patterns, rejectPatterns);
      if (item) {
        resolve(item);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }

      window.setTimeout(tick, 50);
    };

    tick();
  });
}

function findMenuItem(patterns, rejectPatterns = []) {
  const roots = Array.from(document.querySelectorAll("ytd-popup-container tp-yt-iron-dropdown, ytd-popup-container ytd-menu-popup-renderer"))
    .filter(isActivePopupRoot);

  return roots
    .flatMap((root) => Array.from(root.querySelectorAll("yt-list-item-view-model, ytd-menu-service-item-renderer, ytd-toggle-menu-service-item-renderer, tp-yt-paper-item, [role='menuitem']")))
    .find((el) => {
      const label = getElementLabel(el);
      return patterns.some((pattern) => pattern.test(label)) && !rejectPatterns.some((pattern) => pattern.test(label));
    });
}

function isActivePopupRoot(root) {
  const style = window.getComputedStyle(root);
  return root.getAttribute("aria-hidden") !== "true" && style.display !== "none" && style.visibility !== "hidden";
}

function getElementLabel(el) {
  return [
    el.getAttribute("aria-label"),
    el.getAttribute("title"),
    el.textContent,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function closeYouTubeMenu() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

function showKeybindsToast(message, kind = "ok") {
  document.querySelector(".keybinds-toast")?.remove();

  const toast = document.createElement("div");
  toast.className = "keybinds-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483647;
    padding: 10px 14px;
    border-radius: 999px;
    background: ${kind === "error" ? "#8b1e1e" : "#111827"};
    color: white;
    font: 600 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  `;

  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1400);
}

loadKeybinds([
  { key: "s", action: "navigate", url: "/feed/subscriptions" },
  { key: "h", action: "focusPrev", group: VIDEO_SELECTOR },
  { key: "j", action: "focusDown", group: VIDEO_SELECTOR },
  { key: "k", action: "focusUp", group: VIDEO_SELECTOR },
  { key: "l", action: "focusNext", group: VIDEO_SELECTOR },
  { key: "o", action: openSelectedVideo },
  { key: "y", action: copySelectedVideoUrl },
  { key: "w", action: addSelectedVideoToWatchLater },
  { key: "x", action: hideSelectedVideo },
]);
