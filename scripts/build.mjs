import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enginePath = resolve(root, "engine.js");
const sitePath = resolve(root, "sites/youtube.user.js");
const packagePath = resolve(root, "package.json");
const distPath = resolve(root, "dist/youtube.user.js");
const extensionDir = resolve(root, "extension");
const extensionScriptPath = resolve(extensionDir, "youtube.user.js");
const extensionManifestPath = resolve(extensionDir, "manifest.json");

const engine = (await readFile(enginePath, "utf8")).trimEnd();
const site = await readFile(sitePath, "utf8");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

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

const userscript = `${header}

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

const manifest = {
  manifest_version: 3,
  name: "YouTube Vim Keybinds",
  version: packageJson.version,
  description: packageJson.description,
  permissions: ["clipboardWrite"],
  host_permissions: ["https://www.youtube.com/*"],
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["youtube.user.js"],
      run_at: "document_idle",
    },
  ],
  browser_specific_settings: {
    gecko: {
      id: "youtube-vim-keybinds@mattias.local",
      strict_min_version: "109.0",
    },
  },
};

await mkdir(dirname(distPath), { recursive: true });
await writeFile(distPath, userscript);
console.log(`Built ${distPath}`);

await mkdir(extensionDir, { recursive: true });
await writeFile(extensionScriptPath, userscript);
await writeFile(extensionManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${extensionDir}`);
