/**
 * Keybinds Engine — lightweight keyboard shortcut system for userscripts.
 *
 * Usage: loadKeybinds(siteConfig) where siteConfig is an array of binding objects.
 *
 * Binding shapes:
 *   { key: "s", action: "click", selector: 'a[href="/feed/subscriptions"]' }
 *   { key: "s", action: "navigate", url: "/feed/subscriptions" }
 *   { key: "p", action: (ctx) => { ... } }                       // custom JS
 *   { key: "l", action: "focusNext", group: 'div.g' }            // visual row next
 *   { key: "h", action: "focusPrev", group: 'div.g' }            // visual row previous
 *   { key: "j", action: "focusDown", group: 'div.g' }            // same-column down
 *   { key: "k", action: "focusUp", group: 'div.g' }              // same-column up
 *   Numeric prefixes are supported: 10j, 3k, 5l, ...
 */

function loadKeybinds(bindings) {
  const keyMap = new Map();

  for (const binding of bindings) {
    const normalizedKey = normalizeKey(binding);
    keyMap.set(normalizedKey, binding);
  }

  document.addEventListener("keydown", (e) => {
    if (shouldIgnoreEvent(e)) return;

    const pressed = normalizeKey({
      key: e.key.toLowerCase(),
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    });

    if (handleCountPrefix(e)) return;

    const binding = keyMap.get(pressed);
    if (!binding) {
      clearCount();
      return;
    }

    const count = consumeCount();

    e.preventDefault();
    e.stopPropagation();
    executeAction(binding, { count });
  }, true);
}

// --- action executors ---

const focusState = { group: null, index: -1, item: null };
const countState = { value: "", timer: null };
const COUNT_TIMEOUT_MS = 2000;
const MAX_COUNT = 999;

function executeAction(binding, { count = 1 } = {}) {
  const { action } = binding;

  if (typeof action === "function") {
    action({ focusState, binding, count });
    return;
  }

  switch (action) {
    case "click": {
      const el = document.querySelector(binding.selector);
      if (el) el.click();
      break;
    }

    case "navigate": {
      // Use YouTube's SPA navigation if available, otherwise pushState
      if (window.yt?.navigate) {
        window.yt.navigate(binding.url);
      } else {
        window.location.href = binding.url;
      }
      break;
    }

    case "focusNext":
    case "focusPrev":
    case "focusDown":
    case "focusUp": {
      const layout = getGridLayout(binding.group);
      const target = resolveGridTarget(layout, action, count);
      if (target) highlightItem(target, layout);
      break;
    }

    case "scroll": {
      const target = document.querySelector(binding.selector);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }

    default:
      console.warn(`[keybinds] Unknown action: ${action}`);
  }
}

// --- helpers ---

function normalizeKey({ key, ctrl, alt, shift, meta }) {
  const parts = [];
  if (ctrl) parts.push("ctrl");
  if (alt) parts.push("alt");
  if (shift) parts.push("shift");
  if (meta) parts.push("meta");
  parts.push(key.toLowerCase());
  return parts.join("+");
}

function isTextField(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT" && !["checkbox", "radio", "range", "button", "submit"].includes(el.type)) return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute("role");
  if (role === "textbox" || role === "searchbox") return true;
  return false;
}

function shouldIgnoreEvent(e) {
  // IME composition — never intercept
  if (e.isComposing) return true;

  const active = document.activeElement;

  // Escape blurs text fields to re-enter "normal mode"
  if (e.key === "Escape" && isTextField(active)) {
    active.blur();
    e.preventDefault();
    return true; // consume the escape, don't pass to bindings
  }

  // In a text field — let the keypress through
  if (isTextField(active)) return true;

  return false;
}

function handleCountPrefix(e) {
  if (!isPlainDigitEvent(e)) return false;

  // Vim-style counts start with 1-9; 0 is only part of an existing count.
  if (e.key === "0" && !countState.value) return false;

  countState.value = `${countState.value}${e.key}`.slice(0, 3);
  scheduleCountClear();

  e.preventDefault();
  e.stopPropagation();
  return true;
}

function isPlainDigitEvent(e) {
  return !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && /^\d$/.test(e.key);
}

function scheduleCountClear() {
  if (countState.timer) clearTimeout(countState.timer);
  countState.timer = window.setTimeout(clearCount, COUNT_TIMEOUT_MS);
}

function consumeCount() {
  const count = countState.value ? Math.min(MAX_COUNT, Math.max(1, Number(countState.value))) : 1;
  clearCount();
  return count;
}

function clearCount() {
  countState.value = "";
  if (countState.timer) {
    clearTimeout(countState.timer);
    countState.timer = null;
  }
}

function getGridLayout(group) {
  const nodes = Array.from(document.querySelectorAll(group))
    .map((el, sourceIndex) => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        sourceIndex,
        rect,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    })
    .filter(({ el, rect }) => isVisibleItem(el, rect))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left || a.sourceIndex - b.sourceIndex);

  const rows = [];
  for (const node of nodes) {
    const row = rows[rows.length - 1];
    if (row && isSameRow(node, row)) {
      addToRow(row, node);
    } else {
      rows.push(createRow(node));
    }
  }

  const flat = [];
  rows.forEach((row, rowIndex) => {
    row.items.sort((a, b) => a.rect.left - b.rect.left || a.sourceIndex - b.sourceIndex);
    row.items.forEach((node, colIndex) => {
      node.rowIndex = rowIndex;
      node.colIndex = colIndex;
      flat.push(node);
    });
  });

  return { group, rows, flat };
}

function isVisibleItem(el, rect) {
  if (rect.width < 20 || rect.height < 20) return false;
  if (el.closest("[hidden], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function createRow(node) {
  return {
    items: [node],
    top: node.rect.top,
    bottom: node.rect.bottom,
    centerY: node.centerY,
    avgHeight: node.rect.height,
  };
}

function addToRow(row, node) {
  row.items.push(node);
  row.top = Math.min(row.top, node.rect.top);
  row.bottom = Math.max(row.bottom, node.rect.bottom);
  row.centerY = row.items.reduce((sum, item) => sum + item.centerY, 0) / row.items.length;
  row.avgHeight = row.items.reduce((sum, item) => sum + item.rect.height, 0) / row.items.length;
}

function isSameRow(node, row) {
  const overlap = Math.min(node.rect.bottom, row.bottom) - Math.max(node.rect.top, row.top);
  const minHeight = Math.min(node.rect.height, row.avgHeight);
  if (overlap > minHeight * 0.35) return true;

  const threshold = Math.max(24, minHeight * 0.45);
  return Math.abs(node.centerY - row.centerY) <= threshold;
}

function resolveGridTarget(layout, action, count = 1) {
  if (!layout.flat.length) return null;

  if (focusState.group !== layout.group) {
    focusState.group = layout.group;
    focusState.index = -1;
    focusState.item = null;
  }

  const steps = Math.min(MAX_COUNT, Math.max(1, Number(count) || 1));
  const current = getCurrentNode(layout);
  let target = current || layout.flat[0];
  let remaining = current ? steps : Math.max(0, steps - 1);
  const preferredX = target.centerX;

  while (remaining > 0) {
    const next = getGridStepTarget(layout, target, action, preferredX);
    if (!next || next === target) break;
    target = next;
    remaining -= 1;
  }

  return target.el;
}

function getGridStepTarget(layout, current, action, preferredX) {
  if (action === "focusNext") return getHorizontalTarget(layout, current, 1);
  if (action === "focusPrev") return getHorizontalTarget(layout, current, -1);
  if (action === "focusDown") return getVerticalTarget(layout, current, 1, preferredX);
  if (action === "focusUp") return getVerticalTarget(layout, current, -1, preferredX);
  return current;
}

function getCurrentNode(layout) {
  const highlighted = document.querySelector(".keybinds-highlight");
  const currentEl = highlighted || focusState.item;
  return layout.flat.find((node) => node.el === currentEl) || null;
}

function getHorizontalTarget(layout, current, direction) {
  const row = layout.rows[current.rowIndex].items;
  const nextCol = current.colIndex + direction;

  if (row[nextCol]) return row[nextCol];

  const nextRow = layout.rows[current.rowIndex + direction];
  if (!nextRow) return current;

  return direction > 0 ? nextRow.items[0] : nextRow.items[nextRow.items.length - 1];
}

function getVerticalTarget(layout, current, direction, preferredX = current.centerX) {
  const nextRow = layout.rows[current.rowIndex + direction];
  if (!nextRow) return current;

  return nextRow.items.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.centerX - preferredX);
    const candidateDistance = Math.abs(candidate.centerX - preferredX);
    return candidateDistance < bestDistance ? candidate : best;
  }, nextRow.items[0]);
}

function highlightItem(target, layout) {
  // Remove previous highlights
  document.querySelectorAll(".keybinds-highlight").forEach((el) => {
    el.classList.remove("keybinds-highlight");
    el.style.removeProperty("outline");
    el.style.removeProperty("outline-offset");
  });

  if (!target) return;

  target.classList.add("keybinds-highlight");
  target.style.outline = "2px solid #58a6ff";
  target.style.outlineOffset = "2px";
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  focusState.item = target;
  focusState.index = layout.flat.findIndex((node) => node.el === target);

  // Try to focus the first link inside for accessibility
  const link = target.querySelector("a[href]");
  if (link) link.focus({ preventScroll: true });
}
