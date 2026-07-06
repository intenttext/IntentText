import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { renderPDF } from "../src/index";

/**
 * #27/#28 — PDF/A font embedding, proven end-to-end through REAL Chrome.
 *
 * PDF/A forbids referencing a font that isn't embedded. `renderPDF(..., {
 * embedFonts: true })` (auto-on for pdfA) serves open Noto subsets as @font-face
 * data URIs and forces every surface onto them, so Chrome embeds a per-document
 * subset. This test renders a document that exercises every surface — Latin +
 * Arabic (RTL shaping) + a table + a task list (ballot boxes) + a code block —
 * and asserts, via pdf-lib, that EVERY font descriptor carries an embedded font
 * program, that the fonts are our Noto subsets (not a system substitute), and
 * that the default render does NOT smuggle them in (proving it's opt-in).
 *
 * Skips when no Chrome is available; CI installs one (and also runs veraPDF).
 */
function findChrome(): string | undefined {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  const cache = join(homedir(), ".cache", "puppeteer", "chrome");
  if (existsSync(cache)) {
    for (const ver of readdirSync(cache)) {
      for (const sub of ["chrome-mac-x64", "chrome-mac-arm64", "chrome-linux64"]) {
        for (const bin of [
          "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
          "chrome",
        ]) {
          const p = join(cache, ver, sub, bin);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  const sys = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return existsSync(sys) ? sys : undefined;
}

const chrome = findChrome();
// If full puppeteer is installed but its bundled Chromium isn't downloaded, it
// would ignore executablePath and fail; PUPPETEER_EXECUTABLE_PATH makes it use the
// Chrome we found. (CI installs a browser, so this is a no-op there.)
if (chrome && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  process.env.PUPPETEER_EXECUTABLE_PATH = chrome;
}

/** Every /FontDescriptor in the PDF and whether it embeds a font program. */
async function fontDescriptors(
  bytes: Uint8Array,
): Promise<Array<{ name: string; embedded: boolean }>> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out: Array<{ name: string; embedded: boolean }> = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (obj.get(PDFName.of("Type"))?.toString() !== "/FontDescriptor") continue;
    const embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) =>
      obj.has(PDFName.of(k)),
    );
    const name = obj.get(PDFName.of("FontName"))?.toString() ?? "?";
    out.push({ name, embedded });
  }
  return out;
}

const SOURCE = [
  "title: Service Agreement — اتفاقية خدمة",
  "section: Terms",
  "text: The parties agree to the “terms” below for €1,250 — effective today.",
  "text: تلتزم الأطراف بالشروط المذكورة في هذه الاتفاقية.",
  "headers: Item | Amount",
  "row: Setup | 500",
  "row: Monthly | 750",
  "task: Countersign the agreement",
  "done: Initial review complete",
  "code: const total = 1250; // fee",
].join("\n");

describe.skipIf(!chrome)("renderPDF embeds all fonts for PDF/A (#27/#28)", () => {
  const opts = { executablePath: chrome, launchArgs: ["--no-sandbox"] };

  it(
    "every font is embedded, and they are our Noto subsets (no system font)",
    async () => {
      const pdf = await renderPDF(SOURCE, { ...opts, embedFonts: true });
      const fonts = await fontDescriptors(pdf);

      // There ARE fonts, and every one embeds its program.
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((f) => f.embedded)).toBe(true);

      // They are the bundled Noto subsets — proof Chrome used the @font-face faces,
      // not a system substitute (which on a headless box would not embed at all).
      const names = fonts.map((f) => f.name).join(",");
      expect(names).toMatch(/Noto(Serif|NaskhArabic|SansMono|SansSymbols)/);
      // No Apple/system faces leaked through.
      expect(names).not.toMatch(/SFNS|SFArabic|SFPro|Helvetica|Menlo|Arial|Times/i);
    },
    120_000,
  );

  it(
    "RED-TEAM: default render does NOT embed our fonts (opt-in, no bloat)",
    async () => {
      const pdf = await renderPDF(SOURCE, opts); // no embedFonts
      const names = (await fontDescriptors(pdf)).map((f) => f.name).join(",");
      // The Noto subsets appear ONLY when embedFonts is on.
      expect(names).not.toMatch(/NotoSerif|NotoNaskhArabic|NotoSansMono/);
    },
    120_000,
  );
});
