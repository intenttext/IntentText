import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { renderPDF } from "../src/index";

/** Find a Chrome/Chromium binary (puppeteer cache or system) for the render step. */
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

// Accessibility: the rendered PDF must be TAGGED (a structure tree derived from
// the semantic HTML) — the basis for PDF/UA / Section 508. Requires real Chrome.
describe.skipIf(!chrome)("renderPDF emits a tagged (accessible) PDF", () => {
  it(
    "produces /MarkInfo Marked true + a /StructTreeRoot",
    async () => {
      const src = [
        "title: Accessible Report",
        "section: Findings",
        "text: A short paragraph of body content.",
        "columns: Item | Qty | Total",
        "row: Widget | 2 | 500",
      ].join("\n");
      const pdf = await renderPDF(src, {
        executablePath: chrome,
        launchArgs: ["--no-sandbox"],
      });
      const txt = Buffer.from(pdf).toString("latin1");
      expect(/%PDF-/.test(txt)).toBe(true);
      expect(/\/Marked\s+true/.test(txt)).toBe(true); // tagged
      expect(/\/StructTreeRoot/.test(txt)).toBe(true); // has a structure tree
    },
    120_000,
  );
});
