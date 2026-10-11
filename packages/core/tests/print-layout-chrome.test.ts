// Letterhead layout (`image:` width / float) and `keep: previous`, through REAL Chrome:
// renderPrint → PDF / print-media layout, then measured.
//
//   • a letterhead — the logo has the requested width, sits on the requested side
//     (`float: end` is the LEFT in Arabic, the RIGHT in English) and the company lines
//     sit beside it on the other side, above the divider;
//   • a long ledger whose signatures would be orphaned on a page of their own — with
//     `keep: previous` the last page holds the last rows AND the signatures; without it
//     the orphan still happens (old output is unchanged).
//
// Skips without Chrome (CHROME_PATH / PUPPETEER_EXECUTABLE_PATH, the puppeteer cache,
// or the system install) and, for the ledger, without poppler's `pdftotext`.
// print-layout-keep.test.ts holds the CI-safe markup proofs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseIntentText, renderPrint } from "../src/index";

function findChrome(): string | undefined {
  for (const env of [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH]) {
    if (env && existsSync(env)) return env;
  }
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
const hasPdftotext = spawnSync("pdftotext", ["-v"]).status === 0;

// A solid 8x8 PNG (fictional logo), written next to the page — the renderer does not
// load data: URIs, so the document points at a relative file.
const LOGO = "./logo.png";
const LOGO_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNgYPj/nxLMMGoAKQYMBgMAmuX/AUlGxc4AAAAASUVORK5CYII=";

type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Page = {
  setContent(html: string, o: object): Promise<void>;
  goto(url: string, o: object): Promise<unknown>;
  emulateMediaType(t: string): Promise<void>;
  setViewport(v: object): Promise<void>;
  pdf(o: object): Promise<Uint8Array>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
};
type Browser = { newPage(): Promise<Page>; close(): Promise<void> };

const LETTERHEADS = {
  en: [
    "page: | size: A4 | margin: 12mm",
    `image: Horizon Trading logo | src: ${LOGO} | width: 32mm | height: 36mm | float: end`,
    "text: Horizon Trading Co.",
    "text: 12 Example Street, Doha",
    "text: info@example.qa · +974 0000 0000",
    "divider:",
    "text: Invoice INV-0042",
  ].join("\n"),
  ar: [
    "page: | size: A4 | margin: 12mm",
    "meta: | dir: rtl",
    `image: شعار شركة الأفق | src: ${LOGO} | width: 32mm | height: 36mm | float: end`,
    "text: شركة الأفق للتجارة",
    "text: شارع المثال 12، الدوحة",
    "text: info@example.qa · +974 0000 0000",
    "divider:",
    "text: فاتورة INV-0042",
  ].join("\n"),
};

function ledger(lang: "en" | "ar", rows: number, keep: boolean): string {
  const tail = keep ? " | keep: previous" : "";
  const ar = lang === "ar";
  return [
    "page: | size: A4 | margin: 12mm",
    ar ? "meta: | dir: rtl" : "",
    ar ? "headers: م | البند | المبلغ" : "headers: # | Item | Amount",
    ...Array.from(
      { length: rows },
      (_, i) => `row: ${i + 1} | ${ar ? "قيد" : "Entry"} ${i + 1} | ${(i + 1) * 10}.00`,
    ),
    `signline: SIGA ${ar ? "المحاسب" : "Accountant"} | role: ${ar ? "أعدّه" : "Prepared"}${tail}`,
    `signline: SIGB ${ar ? "المدير" : "Manager"} | role: ${ar ? "اعتمده" : "Approved"}${tail}`,
  ]
    .filter(Boolean)
    .join("\n");
}

describe.skipIf(!chrome)("letterhead + keep: previous through real Chrome", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    browser = (await puppeteer.launch({
      executablePath: chrome,
      args: ["--no-sandbox"],
      protocolTimeout: 120_000,
    })) as unknown as Browser;
    dir = mkdtempSync(join(tmpdir(), "it-layout-"));
    writeFileSync(join(dir, "logo.png"), Buffer.from(LOGO_PNG.split(",")[1], "base64"));
  }, 120_000);

  /** Open print HTML from a file beside logo.png (so the relative logo loads). */
  async function open(page: Page, html: string, name: string) {
    const file = join(dir, `${name}.html`);
    writeFileSync(file, html);
    await page.goto(`file://${file}`, { waitUntil: "load" });
  }

  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  for (const lang of ["en", "ar"] as const) {
    it(`the logo has the requested width, sits on the end side, the company lines beside it (${lang})`, async () => {
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      await page.setViewport({ width: 703, height: 1100 }); // A4 − 2×12mm at 96dpi
      await open(page, renderPrint(parseIntentText(LETTERHEADS[lang])), `letterhead-${lang}`);
      const m = await page.evaluate(() => {
        const box = (r: DOMRect) => ({
          left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        });
        const doc = document.querySelector(".intent-document") as HTMLElement;
        const img = document.querySelector("img") as HTMLElement;
        const hr = document.querySelector(".intent-divider") as HTMLElement;
        // the company text: every paragraph above the divider
        const lines = Array.from(document.querySelectorAll("p.intent-text"))
          .filter((p) => !!(p.compareDocumentPosition(hr) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((p) => {
            const range = document.createRange();
            range.selectNodeContents(p);
            return box(range.getBoundingClientRect());
          });
        return {
          doc: box(doc.getBoundingClientRect()),
          img: box(img.getBoundingClientRect()),
          lines,
          divider: box(hr.getBoundingClientRect()),
        } as { doc: Rect; img: Rect; lines: Rect[]; divider: Rect };
      });
      await page.close();

      const mm = 96 / 25.4;
      expect(Math.abs(m.img.width - 32 * mm)).toBeLessThan(1); // 32mm
      expect(Math.abs(m.img.height - 36 * mm)).toBeLessThan(1);
      if (lang === "en") {
        expect(m.img.right).toBeGreaterThan(m.doc.right - 3); // the right edge
        for (const l of m.lines) expect(l.right).toBeLessThanOrEqual(m.img.left + 0.5);
      } else {
        expect(m.img.left).toBeLessThan(m.doc.left + 3); // the left edge (inline-end in RTL)
        for (const l of m.lines) expect(l.left).toBeGreaterThanOrEqual(m.img.right - 0.5);
      }
      // the company lines start at the top, beside the logo (not below it) ...
      expect(m.lines.length).toBeGreaterThan(0);
      for (const l of m.lines) expect(l.top).toBeLessThan(m.img.bottom);
      expect(m.lines[0].top).toBeLessThan(m.img.top + 20);
      // ... and the divider sits below both
      expect(m.divider.top).toBeGreaterThanOrEqual(m.img.bottom - 0.5);
      expect(m.divider.top).toBeGreaterThanOrEqual(m.lines[m.lines.length - 1].bottom - 0.5);
    }, 60_000);
  }

  const RANGE = Array.from({ length: 9 }, (_, i) => 54 + i);

  /** Text of the last page of a printed ledger. */
  async function lastPage(lang: "en" | "ar", rows: number, keep: boolean) {
    const page = await browser.newPage();
    await page.setContent(renderPrint(parseIntentText(ledger(lang, rows, keep))), { waitUntil: "load" });
    const file = join(dir, `ledger-${lang}-${rows}-${keep}.pdf`);
    writeFileSync(file, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    await page.close();
    const pages = Number(spawnSync("pdfinfo", [file]).stdout.toString().match(/Pages:\s+(\d+)/)?.[1]);
    const text = spawnSync("pdftotext", ["-f", String(pages), "-l", String(pages), "-layout", file, "-"])
      .stdout.toString();
    return { pages, text };
  }

  // The last row is found by its amount (digits survive pdftotext's RTL reordering).
  const hasRow = (text: string, _lang: string, n: number) =>
    new RegExp(`(?<![\\d.])${n * 10}\\.00`).test(text);

  for (const lang of ["en", "ar"] as const) {
    it.skipIf(!hasPdftotext)(
      `keep: previous keeps the signatures with the last rows; without it they orphan (${lang})`,
      async () => {
        let orphaned = 0;
        for (const rows of RANGE) {
          const plain = await lastPage(lang, rows, false);
          const sigOnly = plain.text.includes("SIGA") && !hasRow(plain.text, lang, rows);
          if (sigOnly) orphaned++;
          const kept = await lastPage(lang, rows, true);
          expect(kept.text, `${lang} ${rows} rows`).toContain("SIGA");
          expect(kept.text, `${lang} ${rows} rows`).toContain("SIGB");
          expect(hasRow(kept.text, lang, rows), `${lang} ${rows} rows: last row on the last page`).toBe(true);
        }
        // the red-before evidence: unchanged documents still orphan at these counts
        expect(orphaned).toBeGreaterThan(0);
      },
      600_000,
    );
  }
});
