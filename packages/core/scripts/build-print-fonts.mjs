#!/usr/bin/env node
/**
 * build-print-fonts.mjs — regenerate src/print-fonts.ts from upstream Noto fonts.
 *
 * PDF/A needs every glyph embedded (finding #27/#28). We ship SUBSETS of Google's
 * Noto family (SIL OFL 1.1) as woff2, base64-inlined into print-fonts.ts, so the
 * PDF render path (`renderPrint(doc, { embedFonts: true })`) is self-contained and
 * Chrome embeds a per-document subset into the PDF.
 *
 * Requires Python `fontTools` + `brotli` (for woff2):
 *   pip3 install fonttools brotli
 *
 * Usage:  node scripts/build-print-fonts.mjs
 *
 * The unicode ranges below are the SOURCE OF TRUTH for coverage. Widen a range
 * and re-run if a script/symbol a real document uses falls back to a system font
 * (which veraPDF flags as a non-embedded glyph).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE =
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf";

// [ constName, upstreamPath, unicode-ranges, keepAllLayoutFeatures ]
const FONTS = [
  ["SERIF_R", "NotoSerif/NotoSerif-Regular.ttf", LATIN(), true],
  ["SERIF_B", "NotoSerif/NotoSerif-Bold.ttf", LATIN(), true],
  ["NASKH_R", "NotoNaskhArabic/NotoNaskhArabic-Regular.ttf", ARABIC(), true],
  ["NASKH_B", "NotoNaskhArabic/NotoNaskhArabic-Bold.ttf", ARABIC(), true],
  ["MONO_R", "NotoSansMono/NotoSansMono-Regular.ttf", MONO(), true],
  ["SYMBOLS", "NotoSansSymbols2/NotoSansSymbols2-Regular.ttf", SYMBOLS(), false],
];

function LATIN() {
  return "U+0000-00FF,U+0100-024F,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2500-257F,U+25A0-25FF,U+2600-26FF,U+FB00-FB06";
}
function ARABIC() {
  return "U+0000-00FF,U+0600-06FF,U+0750-077F,U+08A0-08FF,U+2000-206F,U+FB50-FDFF,U+FE70-FEFF";
}
function MONO() {
  return "U+0000-00FF,U+0100-024F,U+2000-206F,U+20A0-20CF,U+2190-21FF,U+2500-257F";
}
function SYMBOLS() {
  return "U+2022,U+25A0-25CF,U+2610-2612,U+2713-2717";
}

const dir = mkdtempSync(join(tmpdir(), "it-fonts-"));
try {
  const b64 = {};
  for (const [name, path, unicodes] of FONTS) {
    const ttf = join(dir, name + ".ttf");
    const woff2 = join(dir, name + ".woff2");
    execFileSync("curl", ["-sL", "-o", ttf, `${BASE}/${path}`]);
    execFileSync("python3", [
      "-m", "fontTools.subset", ttf,
      `--unicodes=${unicodes}`,
      "--layout-features=*",
      "--flavor=woff2",
      `--output-file=${woff2}`,
      "--desubroutinize",
      "--notdef-outline",
    ]);
    b64[name] = readFileSync(woff2).toString("base64");
    console.error(`${name}: ${readFileSync(woff2).length} bytes woff2`);
  }

  const consts = Object.entries(b64)
    .map(([k, v]) => `const ${k} =\n  "${v}";`)
    .join("\n");

  const out = new URL("../src/print-fonts.ts", import.meta.url);
  const existing = readFileSync(out, "utf8");
  // Replace only the const block (between the markers) so the hand-written header
  // and the printFontFaceCSS() function are preserved.
  const start = existing.indexOf("/* prettier-ignore-start */");
  const fnIdx = existing.indexOf("function face(");
  const rebuilt =
    existing.slice(0, start) +
    "/* prettier-ignore-start */\n\n" +
    consts +
    "\n\n" +
    existing.slice(fnIdx);
  writeFileSync(out, rebuilt);
  console.error("wrote", out.pathname);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
