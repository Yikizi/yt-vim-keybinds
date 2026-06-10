import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enginePath = resolve(root, "engine.js");
const sitePath = resolve(root, "sites/youtube.user.js");
const distPath = resolve(root, "dist/youtube.user.js");

const engine = (await readFile(enginePath, "utf8")).trimEnd();
const site = await readFile(sitePath, "utf8");

const [headerPart, restAfterHeader] = site.split("// ==/UserScript==");
if (!restAfterHeader) {
  throw new Error("sites/youtube.user.js is missing a userscript header terminator");
}

const [, siteBodyPart] = restAfterHeader.split("// --- end engine ---");
if (!siteBodyPart) {
  throw new Error("sites/youtube.user.js is missing the engine placeholder block");
}

const header = `${headerPart.trimEnd()}\n// ==/UserScript==`;
const siteBody = siteBodyPart.trim();

const highlightStyle = String.raw`
// Inject highlight styles once — using a stylesheet beats inline styles
// because YouTube's own styles can override normal outlines.
const style = document.createElement("style");
style.textContent = ` + "`" + String.raw`
  .keybinds-highlight {
    outline: 3px solid #58a6ff !important;
    outline-offset: 4px !important;
    border-radius: 8px;
    box-shadow: 0 0 0 6px rgba(88, 166, 255, 0.25) !important;
    position: relative;
    z-index: 10;
  }
` + "`" + String.raw`;
document.head.appendChild(style);
`.trim();

const output = `${header}

(function () {
  "use strict";

  // ═══════════════════════════════════════════
  // Engine
  // ═══════════════════════════════════════════

${engine}

  ${highlightStyle.replaceAll("\n", "\n  ")}

  // ═══════════════════════════════════════════
  // YouTube bindings
  // ═══════════════════════════════════════════

${siteBody}

})();
`;

await mkdir(dirname(distPath), { recursive: true });
await writeFile(distPath, output);
console.log(`Built ${distPath}`);
