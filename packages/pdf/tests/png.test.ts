// @dotit/pdf 3.5.0 — page image (PNG) from the SAME renderer as the PDF, and AbortSignal
// on every entry point. Real Chrome (skipped without it); pdftoppm/pdftotext (poppler)
// are used ONLY here, to compare the PNG against the PDF's own rasterisation.
import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { htmlToPDF, htmlToPNG, renderPDF, renderPNG, issuePDF, createPdfRenderer } from "../src/index";

const chrome = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p)) as string | undefined;
const hasPoppler = spawnSync("pdftoppm", ["-v"]).status !== null;

const FIX = join(__dirname, "../../core/tests/print-fixtures");
const AR = readFileSync(join(FIX, "invoice-ar.it"), "utf8");
const EN = readFileSync(join(FIX, "invoice-en.it"), "utf8");
const longOf = (src: string) => {
  const rows = Array.from({ length: 70 }, (_, i) => `| ${i + 4} | بند ${i + 4} | 1 | 10.00 | 10.00 |`);
  return src.replace(/^\| 3 \|.*$/m, (r) => [r, ...rows].join("\n"));
};
const opts = { executablePath: chrome, launchArgs: ["--no-sandbox"] };

/* ── tiny PNG decoder (8-bit, non-interlaced) → grey ───────────────────────── */
function decodePng(buf: Buffer): { w: number; h: number; grey: Uint8Array } {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  let p = 8, w = 0, h = 0, ct = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 0;
  if (!bpp) throw new Error("unsupported png colour type " + ct);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const out = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let r = v;
      if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * stride + x] = r & 255;
    }
  }
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = bpp === 1 ? out[i] : Math.round(0.299 * out[i * bpp] + 0.587 * out[i * bpp + 1] + 0.114 * out[i * bpp + 2]);
  return { w, h, grey };
}

async function pagePx(pdf: Buffer, n: number, scale: number) {
  const doc = await PDFDocument.load(pdf);
  const { width, height } = doc.getPage(n - 1).getSize();
  return { w: Math.round(((width * 96) / 72) * scale), h: Math.round(((height * 96) / 72) * scale) };
}

function raster(pdf: Buffer, page: number, scale: number) {
  const dir = mkdtempSync(join(tmpdir(), "itpng-"));
  try {
    writeFileSync(join(dir, "a.pdf"), pdf);
    const r = spawnSync("pdftoppm", ["-r", String(96 * scale), "-f", String(page), "-l", String(page), "-gray", join(dir, "a.pdf"), join(dir, "o")]);
    expect(r.status).toBe(0);
    const f = spawnSync("sh", ["-c", `ls ${dir}/o*.pgm`]).stdout.toString().trim();
    const b = readFileSync(f);
    // P5 header: "P5\nW H\n255\n"
    const m = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(b.subarray(0, 40).toString("latin1"))!;
    return { w: +m[1], h: +m[2], grey: new Uint8Array(b.subarray(b.length - +m[1] * +m[2])) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Fraction of pixels differing by > 40 grey levels, at the best shift within ±2 px. */
function bestDiff(a: { w: number; h: number; grey: Uint8Array }, b: { w: number; h: number; grey: Uint8Array }) {
  let best = 1;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    let bad = 0, n = 0;
    for (let y = 4; y < Math.min(a.h, b.h) - 4; y += 2) for (let x = 4; x < Math.min(a.w, b.w) - 4; x += 2) {
      const bx = x + dx, by = y + dy;
      if (bx < 0 || by < 0 || bx >= b.w || by >= b.h) continue;
      n++; if (Math.abs(a.grey[y * a.w + x] - b.grey[by * b.w + bx]) > 40) bad++;
    }
    best = Math.min(best, bad / n);
  }
  return best;
}

describe.skipIf(!chrome)("renderPNG / htmlToPNG (Chrome required)", () => {
  for (const [lang, src] of [["ar", AR], ["en", EN]] as const) {
    it(`A4 at scale 2 and width: 1000 have exact sizes (${lang})`, async () => {
      const pdf = await renderPDF(src, opts);
      const exp = await pagePx(pdf, 1, 2);
      expect(Math.abs(exp.w - 1587)).toBeLessThanOrEqual(1);
      expect(Math.abs(exp.h - 2245)).toBeLessThanOrEqual(1);
      const png = await renderPNG(src, opts);
      const d = decodePng(png);
      expect([d.w, d.h]).toEqual([exp.w, exp.h]);
      const png1k = await renderPNG(src, { ...opts, width: 1000 });
      const e1 = await pagePx(pdf, 1, 1000 / ((595.28 * 96) / 72));
      const d1 = decodePng(png1k);
      expect(d1.w).toBe(1000);
      expect(Math.abs(d1.h - e1.h)).toBeLessThanOrEqual(1);
    }, 120000);
  }

  it("a page: | size: … document gets its own size (80mm receipt)", async () => {
    const src = "page: | size: 80mm 200mm | margin: 4mm\ntitle: Receipt\ntext: شركة الأفق — example.qa\n";
    const pdf = await renderPDF(src, opts);
    const exp = await pagePx(pdf, 1, 2);
    const d = decodePng(await renderPNG(src, opts));
    expect([d.w, d.h]).toEqual([exp.w, exp.h]);
    expect(Math.abs(d.w - Math.round((80 / 25.4) * 96 * 2))).toBeLessThanOrEqual(2);
    expect(d.w).toBeLessThan(d.h);
  }, 120000);

  for (const [lang, src] of [["ar", AR], ["en", EN]] as const) {
    it.skipIf(!hasPoppler)(`matches pdftoppm of the same PDF page, footer printed (${lang})`, async () => {
      const pdf = await renderPDF(src, opts);
      const d = decodePng(await renderPNG(src, opts));
      const diff = bestDiff(d, raster(pdf, 1, 2));
      console.log(`fidelity ${lang}: ${(diff * 100).toFixed(2)}% pixels differ > 40`);
      expect(diff).toBeLessThan(0.05);
      // running footer: ink in the bottom 7% of the sheet (a screen screenshot has none)
      let ink = 0;
      for (let y = Math.floor(d.h * 0.93); y < d.h; y++) for (let x = 0; x < d.w; x++) if (d.grey[y * d.w + x] < 160) ink++;
      expect(ink).toBeGreaterThan(200);
    }, 120000);
  }

  it.skipIf(!hasPoppler)("page: 2 renders page 2; page: 99 throws", async () => {
    const src = longOf(AR);
    const pdf = await renderPDF(src, opts);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(2);
    const p1 = decodePng(await renderPNG(src, { ...opts, page: 1 }));
    const p2 = decodePng(await renderPNG(src, { ...opts, page: 2 }));
    expect([p2.w, p2.h]).toEqual([p1.w, p1.h]);
    expect(bestDiff(p2, raster(pdf, 2, 2))).toBeLessThan(0.05);
    expect(bestDiff(p1, p2)).toBeGreaterThan(0.01);
    await expect(renderPNG(src, { ...opts, page: 99 })).rejects.toThrow(/page 99/i);
  }, 180000);

  it("htmlToPNG takes print HTML like htmlToPDF", async () => {
    const html = "<html><body style='font-family:sans-serif'><h1>Hello example.qa</h1></body></html>";
    const d = decodePng(await htmlToPNG(html, opts));
    const pdf = await htmlToPDF(html, opts);
    const e = await pagePx(pdf, 1, 2);
    expect([d.w, d.h]).toEqual([e.w, e.h]);
  }, 120000);

  it("an already-aborted signal rejects with AbortError before launching", async () => {
    const pc = createRequire(import.meta.url)("puppeteer-core");
    const pp = createRequire(import.meta.url)("puppeteer");
    const s1 = vi.spyOn(pc.default ?? pc, "launch"), s2 = vi.spyOn(pp.default ?? pp, "launch");
    const signal = AbortSignal.abort();
    for (const call of [
      () => htmlToPDF("<p>x</p>", { ...opts, signal }),
      () => renderPDF(EN, { ...opts, signal }),
      () => renderPNG(EN, { ...opts, signal }),
      () => htmlToPNG("<p>x</p>", { ...opts, signal }),
      () => issuePDF("title: x\n", {}, { ...opts, signer: "Billing", signal }),
    ]) await expect(call()).rejects.toMatchObject({ name: "AbortError" });
    expect(s1).not.toHaveBeenCalled();
    expect(s2).not.toHaveBeenCalled();
    s1.mockRestore(); s2.mockRestore();
  });

  it("aborting mid-render rejects with AbortError and the one-shot browser is closed", async () => {
    const ac = new AbortController();
    const t0 = Date.now();
    const p = renderPNG(longOf(EN), { ...opts, signal: ac.signal });
    setTimeout(() => ac.abort(), 400);
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(Date.now() - t0).toBeLessThan(10000);
    const ac2 = new AbortController();
    const q = renderPDF(longOf(EN), { ...opts, signal: ac2.signal });
    setTimeout(() => ac2.abort(), 400);
    await expect(q).rejects.toMatchObject({ name: "AbortError" });
  }, 60000);

  it("the renderer's PNG uses its own browser (no new launch) and survives aborts", async () => {
    const pc = createRequire(import.meta.url)("puppeteer-core");
    const pp = createRequire(import.meta.url)("puppeteer");
    const r = await createPdfRenderer(opts);
    const s1 = vi.spyOn(pc.default ?? pc, "launch"), s2 = vi.spyOn(pp.default ?? pp, "launch");
    try {
      const d = decodePng(await r.renderPNG(EN));
      expect(d.w).toBeGreaterThan(1500);
      expect(decodePng(await r.htmlToPNG("<p>x</p>")).w).toBeGreaterThan(100);
      const ac = new AbortController();
      const p = r.renderPNG(longOf(AR), { signal: ac.signal });
      setTimeout(() => ac.abort(), 300);
      await expect(p).rejects.toMatchObject({ name: "AbortError" });
      const ac2 = new AbortController();
      const q = r.renderPDF(longOf(AR), { signal: ac2.signal });
      setTimeout(() => ac2.abort(), 300);
      await expect(q).rejects.toMatchObject({ name: "AbortError" });
      // still healthy after aborts
      expect(decodePng(await r.renderPNG(EN)).w).toBe(d.w);
      expect((await r.renderPDF(EN)).subarray(0, 4).toString()).toBe("%PDF");
      expect(s1).not.toHaveBeenCalled();
      expect(s2).not.toHaveBeenCalled();
    } finally { s1.mockRestore(); s2.mockRestore(); await r.close(); }
  }, 180000);
});
