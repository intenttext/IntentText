// Print fidelity through REAL Chrome: the fixtures in tests/print-fixtures/ are
// printed to PDF exactly as an ERP prints them (renderPrint → Chrome), then measured.
//
//   • the frame — a full-width table's right border must reach the paper, not only
//     its left one (Chrome cut it at the page area's inline end);
//   • the money columns — a |---:| column must line its amounts up on the decimal
//     point (3,211.50 under 11,245.00), in Arabic and English.
//
// Skips without Chrome (CHROME_PATH / PUPPETEER_EXECUTABLE_PATH, the puppeteer cache,
// or the system install) and, for the frame, without poppler's `pdftoppm`.
// print-fidelity.test.ts holds the CI-safe proofs of the same fixes.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
const hasPdftoppm = spawnSync("pdftoppm", ["-v"]).status === 0;

const PAPERS = ["ar", "en"].map((lang) => ({
  lang,
  src: readFileSync(join(__dirname, "print-fixtures", `invoice-${lang}.it`), "utf8"),
}));

// A4 with `margin: 12mm` (the fixtures' page box), rasterized at DPI.
const DPI = 300;
const mm = (v: number) => Math.round((v * DPI) / 25.4);

/** Darkest-column ink in a vertical strip: the length of the longest frame line there. */
function columnInk(pgm: Buffer, fromMm: number, toMm: number): number {
  const header = pgm.toString("latin1", 0, 64).split(/\s+/);
  const [w, h] = [Number(header[1]), Number(header[2])];
  const data = pgm.subarray(pgm.length - w * h);
  let best = 0;
  for (let x = mm(fromMm); x <= mm(toMm); x++) {
    let ink = 0;
    for (let y = 0; y < h; y++) if (data[y * w + x] < 200) ink++;
    best = Math.max(best, ink);
  }
  return best;
}

type Browser = {
  newPage(): Promise<{
    setContent(html: string, o: object): Promise<void>;
    emulateMediaType(t: string): Promise<void>;
    setViewport(v: object): Promise<void>;
    pdf(o: object): Promise<Uint8Array>;
    evaluate<T>(fn: () => T): Promise<T>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
};

describe.skipIf(!chrome)("print through real Chrome (fixtures: ar + en invoices)", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    browser = (await puppeteer.launch({
      executablePath: chrome,
      args: ["--no-sandbox"],
      protocolTimeout: 120_000,
    })) as unknown as Browser;
    dir = mkdtempSync(join(tmpdir(), "it-print-"));
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  for (const { lang, src } of PAPERS) {
    it.skipIf(!hasPdftoppm)(
      `draws the right border of every frame, not only the left (${lang})`,
      async () => {
        const page = await browser.newPage();
        await page.setContent(renderPrint(parseIntentText(src)), { waitUntil: "load" });
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        await page.close();
        const file = join(dir, `invoice-${lang}`);
        writeFileSync(`${file}.pdf`, pdf);
        spawnSync("pdftoppm", ["-r", String(DPI), "-gray", "-f", "1", "-l", "1", `${file}.pdf`, file]);
        const pgm = readFileSync(`${file}-1.pgm`);

        // Content box: 12mm → 198mm. A frame line on one edge has its twin on the other.
        const left = columnInk(pgm, 11, 13);
        const right = columnInk(pgm, 197, 199);
        expect(left).toBeGreaterThan(mm(40)); // the frames are there at all
        expect(right).toBeGreaterThan(left * 0.9);
      },
      120_000,
    );

    it(`draws the header rule from style: rules, not the base black rule (${lang})`, async () => {
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      await page.setContent(renderPrint(parseIntentText(src)), { waitUntil: "load" });
      // The fixtures declare `style: table | border: 1px solid #b8c2c7`.
      const rule = await page.evaluate(() => {
        const th = document.querySelector("th") as HTMLElement;
        const cs = getComputedStyle(th);
        return `${cs.borderBottomWidth} ${cs.borderBottomColor}`;
      });
      await page.close();
      expect(rule).toBe("1px rgb(184, 194, 199)");
    }, 60_000);

    it(`lines a |---:| money column up on its decimal point (${lang})`, async () => {
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      await page.setViewport({ width: 703, height: 1100 }); // A4 − 2×12mm at 96dpi
      await page.setContent(renderPrint(parseIntentText(src)), { waitUntil: "load" });
      // x of the "." in every cell of the items table's last column.
      const points = await page.evaluate(() => {
        const table = document.querySelectorAll("table")[1];
        return Array.from(table.querySelectorAll("tbody tr td:last-child")).map((td) => {
          const node = td.firstChild as Text;
          const range = document.createRange();
          const at = node.data.indexOf(".");
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          return range.getBoundingClientRect().left;
        });
      });
      await page.close();
      expect(points).toHaveLength(3);
      for (const x of points) expect(Math.abs(x - points[0])).toBeLessThan(0.5);
    }, 60_000);
  }
});
