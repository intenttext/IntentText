// Demo 3 — "same .it, three themes"
//
// One source document, rendered three ways. The point: an `.it` file carries the
// document's *intent* (sections, totals, signatures), and the theme decides how it
// *looks* — corporate, legal, or editorial — with zero edits to the content. Run:
//   node demo/enterprise-themes/showcase.mjs   (or: pnpm demo:themes)
// then open demo/enterprise-themes/out.themes.html.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIntentText, renderHTML } from "../../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "contract.it"), "utf8");
const doc = parseIntentText(source);

// Three enterprise looks for the same document.
const THEMES = [
  ["corporate", "Corporate — clean, business-default"],
  ["legal", "Legal — formal serif, dense"],
  ["editorial", "Editorial — refined, readable"],
];

const escAttr = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const panels = THEMES.map(([theme, label]) => {
  const html = renderHTML(doc, { theme });
  return `<section class="panel">
      <header class="panel__label"><b>${theme}</b> — ${label.split("—")[1].trim()}</header>
      <iframe class="panel__frame" srcdoc="${escAttr(html)}" title="${theme}"></iframe>
    </section>`;
}).join("\n");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>IntentText — same .it, three themes</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #eef1f5; color: #1a1a2e; }
  .head { padding: 22px 28px 8px; }
  .head h1 { margin: 0 0 4px; font-size: 20px; }
  .head p { margin: 0; color: #6b7280; }
  .head code { background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 1px 5px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 16px 28px 28px; align-items: start; }
  .panel { background: #fff; border: 1px solid #dfe3e8; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .panel__label { padding: 9px 12px; font-size: 12px; color: #475569; border-bottom: 1px solid #eef0f3; background: #fafbfc; }
  .panel__frame { width: 100%; height: 1180px; border: 0; display: block; background: #fff; }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="head">
    <h1>Same <code>.it</code>, three themes</h1>
    <p>One source document (<code>contract.it</code>) — the theme decides how it looks. No content edits.</p>
  </div>
  <div class="grid">
${panels}
  </div>
</body>
</html>`;

const out = join(here, "out.themes.html");
writeFileSync(out, page);
console.log(`Rendered ${THEMES.length} themes → ${out}`);
console.log(THEMES.map(([t]) => `  • ${t}`).join("\n"));
