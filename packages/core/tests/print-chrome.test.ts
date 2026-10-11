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
import { parseIntentText, renderPrint, sealDocument } from "../src/index";
import { getBuiltinTheme } from "../src/theme";
import * as legacy from "dotit-core-legacy";
import { decodeJsQR, decodeZXing } from "./helpers/qr-decode";

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

/**
 * The longest unbroken vertical dark run in a strip: a frame's side is one long
 * line, while letters near the margin are short strokes that never reach it.
 */
function frameRun(pgm: Buffer, fromMm: number, toMm: number): number {
  const header = pgm.toString("latin1", 0, 64).split(/\s+/);
  const [w, h] = [Number(header[1]), Number(header[2])];
  const data = pgm.subarray(pgm.length - w * h);
  let best = 0;
  for (let x = mm(fromMm); x <= mm(toMm); x++) {
    let run = 0;
    for (let y = 0; y < h; y++) {
      run = data[y * w + x] < 200 ? run + 1 : 0;
      best = Math.max(best, run);
    }
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
        const left = frameRun(pgm, 11, 13);
        const right = frameRun(pgm, 197, 199);
        expect(left).toBeGreaterThan(mm(15)); // the frames are there at all
        expect(right).toBeGreaterThan(left * 0.9);
      },
      120_000,
    );

    it.skipIf(!hasPdftoppm)(
      `prints the running footer in the theme's body font with footer-family: body, and as 3.8.0 without (${lang})`,
      async () => {
        const fontsOf = async (html: string, name: string) => {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "load" });
          const file = join(dir, `${name}-${lang}.pdf`);
          writeFileSync(file, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
          await page.close();
          return spawnSync("pdffonts", [file]).stdout.toString();
        };
        // Font names without the random subset tag, sorted.
        const names = (listing: string) =>
          listing.split("\n").slice(2).filter(Boolean)
            .map((l) => l.split(/\s+/)[0].replace(/^[A-Z]{6}\+/, "")).sort();
        const base = getBuiltinTheme("corporate")!;
        const themed = { ...base, print: { ...base.print, "header-family": "body", "footer-family": "body" } };
        // The content prints in the document's sans font; margin boxes inherit from
        // the page context and fall back to the browser's default serif — Times for
        // the Latin page numbers — unless the theme names a family.
        const withKey = await fontsOf(renderPrint(parseIntentText(src), { theme: themed }), "family");
        expect(withKey).not.toMatch(/Times|Georgia/i);
        // Without the key: exactly 3.8.0 (same CSS, same fonts).
        const html = renderPrint(parseIntentText(src));
        const old = legacy.renderPrint(legacy.parseIntentText(src));
        const fonts = await fontsOf(html, "plain");
        expect(names(fonts)).toEqual(names(await fontsOf(old, "legacy")));
        expect(fonts).toMatch(/Times/i);
      },
      180_000,
    );

    it(`draws the header rule from the theme's table-header-rule keys; without them as 3.8.0 (${lang})`, async () => {
      const ruleOf = async (html: string) => {
        const page = await browser.newPage();
        await page.emulateMediaType("print");
        await page.setContent(html, { waitUntil: "load" });
        // The fixtures declare `style: table | border: 1px solid #b8c2c7`.
        const rule = await page.evaluate(() => {
          const cs = getComputedStyle(document.querySelector("th") as HTMLElement);
          return `${cs.borderBottomWidth} ${cs.borderBottomColor}`;
        });
        await page.close();
        return rule;
      };
      const base = getBuiltinTheme("corporate")!;
      const themed = {
        ...base,
        print: { ...base.print, "table-header-rule-width": "1px", "table-header-rule-color": "#b8c2c7" },
      };
      expect(await ruleOf(renderPrint(parseIntentText(src), { theme: themed }))).toBe("1px rgb(184, 194, 199)");
      // No keys: the base black 2px rule, exactly as in 3.8.0.
      expect(await ruleOf(renderPrint(parseIntentText(src)))).toBe("2px rgb(0, 0, 0)");
      expect(await ruleOf(legacy.renderPrint(legacy.parseIntentText(src)))).toBe("2px rgb(0, 0, 0)");
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

/** A `pdftoppm -gray` page as gray pixels. */
function readPgm(buf: Buffer) {
  const [, w, h] = buf.toString("latin1", 0, 64).split(/\s+/).map(Number);
  return { gray: new Uint8ClampedArray(buf.subarray(buf.length - w * h)), width: w, height: h };
}

/** A sealed invoice long enough to print on several pages. */
function longSealed(lang: string): string {
  const src = readFileSync(join(__dirname, "print-fixtures", `invoice-${lang}.it`), "utf8");
  const rows = Array.from({ length: 70 }, (_, i) => `| ${i + 4} | Line ${i + 4} | 1 | 10.00 | 10.00 |`);
  const long = src.replace(/^\| 3 \|.*$/m, (row) => [row, ...rows].join("\n"));
  return sealDocument(long, { signer: "Billing", role: "Accounts" }).source;
}

describe.skipIf(!chrome || !hasPdftoppm)("core 3.9 through real Chrome: seal QR, seal position", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    browser = (await puppeteer.launch({
      executablePath: chrome,
      args: ["--no-sandbox"],
      protocolTimeout: 120_000,
    })) as unknown as Browser;
    dir = mkdtempSync(join(tmpdir(), "it-print-310-"));
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function printPdf(html: string, name: string): Promise<string> {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const file = join(dir, `${name}.pdf`);
    writeFileSync(file, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    await page.close();
    return file;
  }

  for (const lang of ["ar", "en"]) {
    it(`the QR printed in the PDF scans back to the verify link (${lang})`, async () => {
      const src = longSealed(lang);
      const url = lang === "ar" ? "https://example.qa/تحقق/INV-0042" : "https://example.qa/d/INV-0042/verify";
      const html = renderPrint(parseIntentText(src), {
        source: src,
        sealPosition: "end",
        seal: { verifyUrl: url },
      });
      const file = await printPdf(html, `qr-${lang}`);
      const pages = spawnSync("pdfinfo", [file]).stdout.toString().match(/Pages:\s+(\d+)/)?.[1];
      spawnSync("pdftoppm", ["-r", "200", "-gray", "-f", pages!, "-l", pages!, file, join(dir, `qr-${lang}`)]);
      const pgm = readdirSync(dir).find((f) => f.startsWith(`qr-${lang}`) && f.endsWith(".pgm"))!;
      const { gray, width, height } = readPgm(readFileSync(join(dir, pgm)));
      // The whole printed page — the decoders must find the code themselves.
      const z = decodeZXing(gray, width, height, false);
      expect(z && new TextDecoder().decode(Uint8Array.from(z))).toBe(url);
      const j = decodeJsQR(gray, width, height);
      expect(j && new TextDecoder().decode(Uint8Array.from(j))).toBe(url);
    }, 120_000);

    // A `qr:` block and a `seal:` placement, printed by Chrome and read back from the
    // rasterized WHOLE page by both decoders — the code that is printed is the code
    // that was asked for, byte for byte (Arabic UTF-8 included).
    for (const [name, verifyUrl] of [
      ["the qr: block", undefined],
      ["the seal: band QR", lang === "ar" ? "https://example.qa/تحقق/INV-0042" : "https://example.qa/d/INV-0042/verify"],
    ] as const) {
      it(`${name} printed in the PDF scans back to its payload, beside a seal: placement (${lang})`, async () => {
        const payload =
          lang === "ar" ? "https://example.qa/فاتورة/INV-0042 — شركة الأفق" : "https://example.qa/invoices/INV-0042";
        const base = readFileSync(join(__dirname, "print-fixtures", `invoice-${lang}.it`), "utf8").trimEnd();
        const label = lang === "ar" ? "امسح للتحقق" : "Scan to verify";
        const withQr = verifyUrl ? base : `${base}
qr: ${payload} | label: ${label} | size: 30mm | align: start | ecc: Q`;
        const src = sealDocument(`${withQr}
seal: | align: end
`, { signer: "Billing", role: "Accounts" }).source;
        const html = renderPrint(parseIntentText(src), { source: src, ...(verifyUrl ? { seal: { verifyUrl } } : {}) });
        const file = await printPdf(html, `blocks-${verifyUrl ? "band" : "qr"}-${lang}`);
        const text = spawnSync("pdftotext", ["-layout", file, "-"]).stdout.toString();
        expect(text).toContain("sha256"); // the band is on the paper, once
        expect(text.match(/sha256/g)).toHaveLength(1);
        const out = join(dir, `blocks-${verifyUrl ? "band" : "qr"}-${lang}`);
        spawnSync("pdftoppm", ["-r", "200", "-gray", "-f", "1", "-l", "1", file, out]);
        const pgm = readdirSync(dir).find((f) => f.startsWith(`blocks-${verifyUrl ? "band" : "qr"}-${lang}`) && f.endsWith(".pgm"))!;
        const { gray, width, height } = readPgm(readFileSync(join(dir, pgm)));
        const want = verifyUrl ?? payload;
        const z = decodeZXing(gray, width, height, false);
        expect(z && new TextDecoder().decode(Uint8Array.from(z))).toBe(want);
        const j = decodeJsQR(gray, width, height);
        expect(j && new TextDecoder().decode(Uint8Array.from(j))).toBe(want);
      }, 120_000);
    }

    it(`sealPosition "end" prints the band once, on the last page (${lang})`, async () => {
      const src = longSealed(lang);
      const text = (html: string, name: string) =>
        printPdf(html, name).then((file) =>
          spawnSync("pdftotext", ["-layout", file, "-"]).stdout.toString().split("\f").filter((p) => p.trim()),
        );
      const atEnd = await text(renderPrint(parseIntentText(src), { source: src, sealPosition: "end" }), `end-${lang}`);
      expect(atEnd.length).toBeGreaterThan(1);
      expect(atEnd.map((p) => p.includes("sha256"))).toEqual(atEnd.map((_, i) => i === atEnd.length - 1));
      const onEvery = await text(renderPrint(parseIntentText(src), { source: src }), `page-${lang}`);
      expect(onEvery.every((p) => p.includes("sha256"))).toBe(true);
    }, 120_000);
  }
});
