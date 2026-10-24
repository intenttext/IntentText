// @dotit/pdf — server-side PDF generation for IntentText documents.
//
// Opt-in companion to @dotit/core (which stays zero-dependency). Use it when a
// machine — not a person with a browser — must produce the document: emailing an
// invoice, archiving for compliance, batch statement runs.
//
// Chrome resolution (first match wins):
//   1. `puppeteer` if installed (bundles its own Chromium)
//   2. `puppeteer-core` + a Chrome/Chromium binary, found via
//      options.executablePath → $PUPPETEER_EXECUTABLE_PATH → $CHROME_PATH →
//      common install locations (macOS / Linux / Windows)
//
// The pure pieces (merge → seal → print-HTML) are exported separately as
// `issueDocument()`, so you can also feed the HTML to your own renderer
// (e.g. a Gotenberg sidecar) without Chrome in this process.

import { existsSync } from "fs";
import {
  parseIntentText,
  parseAndMerge,
  documentToSource,
  renderPrint,
  sealDocument,
  verifyDocument,
  isSealed,
  type IntentTheme,
  type RenderOptions,
} from "@dotit/core";
import { toPdfA, type PdfAOptions, type PdfAConformance } from "./pdfa";

export { toPdfA };
export type { PdfAOptions, PdfAConformance };

/* ── Types ────────────────────────────────────────────────────────────────── */

/** Minimal structural types so puppeteer stays an optional dependency. */
interface ChromePage {
  setContent(html: string, opts?: Record<string, unknown>): Promise<void>;
  pdf(opts?: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T>(fn: (...args: any[]) => T | Promise<T>, ...args: unknown[]): Promise<T>;
  close(): Promise<void>;
  // Page-image (PNG) path: a second page shows the PDF in Chromium's own viewer.
  setViewport(vp: Record<string, unknown>): Promise<void>;
  setRequestInterception(on: boolean): Promise<void>;
  on(event: "request", handler: (req: ChromeRequest) => void): unknown;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  screenshot(opts?: Record<string, unknown>): Promise<string | Buffer | Uint8Array>;
}
interface ChromeRequest {
  url(): string;
  respond(r: { status: number; contentType: string; body: Buffer }): Promise<void>;
  continue(): Promise<void>;
}
interface ChromeBrowser {
  newPage(): Promise<ChromePage>;
  close(): Promise<void>;
}

export interface PdfRenderOptions {
  /**
   * Theme: a built-in name (corporate | legal | editorial | …) or a full
   * `IntentTheme`. An object is what lets a caller print a document in a
   * tenant's own identity without registering a global theme first — the same
   * value `renderPrint` and `convertIntentTextToDocx` take, so one theme keeps
   * the PDF and the Word file the same document. Default: corporate.
   */
  theme?: string | IntentTheme;
  /** Path to a Chrome/Chromium binary (for puppeteer-core). */
  executablePath?: string;
  /** Extra args passed to Chrome (e.g. ["--no-sandbox"] in containers). */
  launchArgs?: string[];
  /**
   * Options forwarded to page.pdf(). Defaults: printBackground: true,
   * preferCSSPageSize: true — so the document's `page:` size/margins are honored.
   */
  pdf?: Record<string, unknown>;
  /**
   * When set, post-process the PDF into PDF/A (archival). Requires an sRGB ICC
   * profile (pdfA.iccProfile). Compliance is verified in CI with veraPDF — see
   * src/pdfa.ts and the README.
   */
  pdfA?: PdfAOptions;
  /**
   * Embed open fonts (Noto subsets) into the PDF so NO glyph references a
   * non-embedded system font — the last requirement for a green PDF/A run
   * (#27/#28). Defaults to ON whenever `pdfA` is set, OFF otherwise (embedding
   * adds ~290 KB to the render). Set explicitly to force either way.
   */
  embedFonts?: boolean;
  /**
   * The trust band of a signed/sealed document, as `renderPrint` takes it: `false`
   * leaves it off; an object may carry `verifyUrl` to draw a verify QR beside the
   * seal (a function receives the seal hash and date).
   */
  seal?: RenderOptions["seal"];
  /**
   * Where the band prints: `"page"` (default) in the corner of every page, or
   * `"end"` once, after the last block, so it never sits over a table or totals.
   */
  sealPosition?: RenderOptions["sealPosition"];
  /**
   * Read table rows keeping their empty cells, so a blank value (a statement line with
   * no document number) stays in its column — core's `ParseOptions.keepEmptyCells`.
   * Default off (3.8 reading).
   */
  keepEmptyCells?: boolean;
  /**
   * Cancel the render. On abort the call rejects with an `AbortError`
   * (`DOMException`, name "AbortError"), the page(s) it opened are closed, and a
   * one-shot function (`htmlToPDF`, `renderPNG`, ...) also closes the browser it
   * launched. An already-aborted signal rejects before any browser is launched.
   */
  signal?: AbortSignal;
}

/** Options of the page image: `htmlToPNG` / `renderPNG` (3.5). */
export interface PngRenderOptions extends PdfRenderOptions {
  /** 1-based page of the printed document to draw. Default 1. A page past the end throws. */
  page?: number;
  /** Device scale factor (pixels per CSS px). Default 2: an A4 page is about 1587x2245 px. */
  scale?: number;
  /** Output width in pixels; sets `scale = width / page CSS width`. Wins over `scale`. */
  width?: number;
  /** Give up waiting for Chromium's PDF viewer to draw the page, in ms. Default 30000. */
  timeout?: number;
}

export interface IssueOptions extends PdfRenderOptions {
  /** Who issues/signs the document (company or system identity). */
  signer: string;
  /** Optional role recorded on the sign: line (e.g. "Billing"). */
  role?: string;
  /** How to render unresolved {{fields}}. Default "blank" (finished documents). */
  missing?: "keep" | "blank";
  /**
   * Write merged values into the document as plain text: a value carrying `*`, `_`,
   * `@`, `#` … is escaped so the sealed source re-parses it literally instead of as
   * inline formatting (`mergeData`'s `literal`). Default off.
   */
  literal?: boolean;
}

export interface IssuedDocument {
  /** The sealed `.it` source — store THIS on the record; it is the legal artifact. */
  source: string;
  /** The seal hash (sha256:…) — recompute later with verifyDocument() to prove integrity. */
  hash: string;
  /** ISO timestamp recorded on the seal. */
  at: string;
  /** Print-ready HTML of the sealed document (feed to Chrome/Gotenberg for a PDF). */
  html: string;
}

/* ── AbortSignal ──────────────────────────────────────────────────────────── */

function abortError(signal?: AbortSignal): Error {
  const reason = (signal as { reason?: unknown } | undefined)?.reason;
  if (reason instanceof Error && reason.name === "AbortError") return reason;
  const DE = (globalThis as { DOMException?: new (m: string, n: string) => Error }).DOMException;
  if (DE) return new DE("The operation was aborted", "AbortError");
  const e = new Error("The operation was aborted");
  e.name = "AbortError";
  return e;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}

/**
 * Race `work` against the signal. On abort `cleanup` runs (closing the page / browser, which
 * also unblocks `work`) and the result rejects with an AbortError at once.
 */
async function abortable<T>(
  signal: AbortSignal | undefined,
  cleanup: () => Promise<unknown>,
  work: () => Promise<T>,
): Promise<T> {
  if (!signal) return work();
  throwIfAborted(signal);
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      cleanup().catch(() => undefined);
      reject(abortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  const running = work();
  running.catch(() => undefined); // an abort-induced failure of `work` is not unhandled
  try {
    return await Promise.race([running, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Launch a browser for one call, run `work`, and always close it, also on abort. */
async function withBrowser<T>(
  options: PdfRenderOptions,
  work: (browser: ChromeBrowser) => Promise<T>,
): Promise<T> {
  throwIfAborted(options.signal);
  const browser = await launchBrowser(options);
  try {
    return await abortable(options.signal, () => browser.close(), () => work(browser));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/* ── Chrome resolution ────────────────────────────────────────────────────── */

const CHROME_PATHS = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findChrome(explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    ...CHROME_PATHS,
  ].filter((p): p is string => !!p);
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function tryRequire(id: string): { launch(opts: Record<string, unknown>): Promise<ChromeBrowser> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(id);
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

async function launchBrowser(opts: PdfRenderOptions): Promise<ChromeBrowser> {
  const launchOpts: Record<string, unknown> = {
    headless: true,
    args: opts.launchArgs ?? [],
  };

  // 1) Full puppeteer (ships its own Chromium) — works with zero configuration.
  const puppeteer = tryRequire("puppeteer");
  if (puppeteer) return puppeteer.launch(launchOpts);

  // 2) puppeteer-core + a system Chrome.
  const core = tryRequire("puppeteer-core");
  if (core) {
    const executablePath = findChrome(opts.executablePath);
    if (!executablePath) {
      throw new Error(
        "@dotit/pdf: puppeteer-core is installed but no Chrome/Chromium binary was found. " +
          "Pass { executablePath } or set PUPPETEER_EXECUTABLE_PATH / CHROME_PATH.",
      );
    }
    return core.launch({ ...launchOpts, executablePath });
  }

  throw new Error(
    "@dotit/pdf needs a PDF engine. Install one of:\n" +
      "  npm i puppeteer        (bundles Chromium — zero config)\n" +
      "  npm i puppeteer-core   (uses your system Chrome — set executablePath or CHROME_PATH)\n" +
      "Or render without Chrome in this process: use issueDocument() and send its .html " +
      "to your own renderer (e.g. a Gotenberg sidecar).",
  );
}

/* ── Pure pipeline (no Chrome) ────────────────────────────────────────────── */

/**
 * The enterprise "issue" flow with no Chrome involved:
 *   merge data into the template → seal the merged document (tamper-evident
 *   SHA-256) → render print HTML.
 *
 * Store `source` (the sealed .it text) on your record — it is the queryable,
 * verifiable legal artifact. `html` is ready for any HTML→PDF renderer.
 */
export function issueDocument(
  templateSource: string,
  data: Record<string, unknown>,
  options: IssueOptions,
): IssuedDocument {
  const merged = parseAndMerge(templateSource, data, {
    missing: options.missing ?? "blank",
    literal: options.literal,
    keepEmptyCells: options.keepEmptyCells,
  });
  const mergedSource = documentToSource(merged);
  const seal = sealDocument(mergedSource, {
    signer: options.signer,
    role: options.role,
  });
  if (!seal.success) {
    throw new Error(`@dotit/pdf: sealing failed: ${seal.error ?? "unknown error"}`);
  }
  const html = printHtml(seal.source, options);
  return { source: seal.source, hash: seal.hash, at: seal.at, html };
}

/* ── PDF rendering ────────────────────────────────────────────────────────── */

/**
 * Open a page on the print HTML and wait until it is ready to print: network idle, and every
 * @font-face (incl. the embedded PDF/A fonts) parsed, so Chrome renders (and embeds) the
 * real glyphs rather than painting a fallback face first (#27/#28). Shared by the PDF and
 * the page image, so both come from the same setup.
 */
async function openPrintPage(browser: ChromeBrowser, html: string): Promise<ChromePage> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      const d = (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } })
        .document;
      return d?.fonts?.ready ?? Promise.resolve();
    });
    return page;
  } catch (e) {
    await page.close().catch(() => undefined);
    throw e;
  }
}

async function printToBytes(
  page: ChromePage,
  opts: PdfRenderOptions,
  extra: Record<string, unknown> = {},
): Promise<Buffer> {
  const bytes = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
    // Accessibility: emit a TAGGED PDF (Chrome's generateTaggedPDF) so the
    // structure tree comes from our semantic HTML (headings, lists, tables with
    // <th scope>, lang/dir, alt text) - the basis for PDF/UA / Section 508.
    // Callers can override via opts.pdf.
    tagged: true,
    ...(opts.pdf ?? {}),
    ...extra,
  });
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

async function pageToPdf(
  browser: ChromeBrowser,
  html: string,
  opts: PdfRenderOptions,
): Promise<Buffer> {
  throwIfAborted(opts.signal);
  let page: ChromePage | undefined;
  try {
    return await abortable(
      opts.signal,
      async () => {
        await page?.close();
      },
      async () => {
        page = await openPrintPage(browser, html);
        return printToBytes(page, opts);
      },
    );
  } finally {
    await page?.close().catch(() => undefined);
  }
}

/* ── Page image (PNG) ─────────────────────────────────────────────────────── */

const VIEWER_URL = "https://print.invalid/page.pdf#toolbar=0&navpanes=0&zoom=100";
const VIEWER_MARGIN = 120;
const VIEWER_ERROR =
  "@dotit/pdf: Chromium's PDF viewer did not render the page " +
  "(is this a headless-shell build without the PDF viewer?)";

interface Box {
  l: number;
  t: number;
  w: number;
  h: number;
}

/** Runs IN the viewer tab: decode a screenshot and find the (brighter-than-background) sheet. */
function findSheet(b64: string): Promise<Box | null> {
  return (async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const g = globalThis as any;
    const img = new g.Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = g.document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d: Uint8ClampedArray = ctx.getImageData(0, 0, c.width, c.height).data;
    const W: number = c.width;
    const H: number = c.height;
    // The viewer's background is dark grey; its drop shadow is DARKER still, so "brighter than
    // the background" (not "different from") isolates the sheet.
    const lum = (i: number) => d[i] + d[i + 1] + d[i + 2];
    const bg = lum(0);
    const bright = (x: number, y: number) => lum((y * W + x) * 4) - bg > 60;
    let l = W;
    let r = -1;
    let t = H;
    let b = -1;
    for (const f of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      const y = Math.floor(H * f);
      const x = Math.floor(W * f);
      for (let i = 0; i < W; i++) if (bright(i, y)) { if (i < l) l = i; break; }
      for (let i = W - 1; i >= 0; i--) if (bright(i, y)) { if (i > r) r = i; break; }
      for (let j = 0; j < H; j++) if (bright(x, j)) { if (j < t) t = j; break; }
      for (let j = H - 1; j >= 0; j--) if (bright(x, j)) { if (j > b) b = j; break; }
    }
    if (r < l || b < t || r - l < 100 || b - t < 100) return null;
    return { l, t, w: r - l + 1, h: b - t + 1 };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })();
}

/** Runs IN the viewer tab: crop a PNG (base64) to the given device-pixel box; returns base64. */
async function cropPng(b64: string, x: number, y: number, w: number, h: number): Promise<string> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any;
  const img = new g.Image();
  img.src = "data:image/png;base64," + b64;
  await img.decode();
  const c = g.document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
  return c.toDataURL("image/png").split(",")[1];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Show one-page PDF bytes in Chromium's viewer and screenshot the sheet. */
async function pdfBytesToPng(
  browser: ChromeBrowser,
  pdf: Buffer,
  cssW: number,
  cssH: number,
  scale: number,
  timeout: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  const view = await browser.newPage();
  try {
    return await abortable(
      signal,
      () => view.close(),
      async () => {
        await view.setViewport({
          width: Math.ceil(cssW) + VIEWER_MARGIN,
          height: Math.ceil(cssH) + VIEWER_MARGIN,
          deviceScaleFactor: scale,
        });
        await view.setRequestInterception(true);
        view.on("request", (r) => {
          if (r.url().startsWith("https://print.invalid/")) {
            void r.respond({ status: 200, contentType: "application/pdf", body: pdf });
          } else void r.continue();
        });
        await view.goto(VIEWER_URL, { waitUntil: "load" });
        // Deterministic wait: the sheet must be found AND two consecutive frames identical.
        const deadline = Date.now() + timeout;
        let prev: string | null = null;
        for (;;) {
          await sleep(150);
          const shot = (await view.screenshot({ encoding: "base64" })) as string;
          const box = await view.evaluate(findSheet, shot);
          if (box && prev === shot) {
            const dW = Math.round(cssW * scale);
            const dH = Math.round(cssH * scale);
            const left = Math.round(box.l + (box.w - dW) / 2);
            const top = Math.round(box.t + (box.h - dH) / 2);
            // Crop the already-stable frame in the viewer tab (lossless canvas copy, encoded by
            // Chrome): exact device pixels, unlike a fractional-CSS-px screenshot clip.
            const b64 = await view.evaluate(cropPng, shot, left, top, dW, dH);
            return Buffer.from(b64, "base64");
          }
          prev = box ? shot : null;
          if (Date.now() > deadline) throw new Error(VIEWER_ERROR);
        }
      },
    );
  } finally {
    await view.close().catch(() => undefined);
  }
}

async function pageToPng(
  browser: ChromeBrowser,
  html: string,
  opts: PngRenderOptions,
): Promise<Buffer> {
  throwIfAborted(opts.signal);
  const n = opts.page ?? 1;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`@dotit/pdf: page must be a positive integer (got ${String(opts.page)})`);
  }
  let page: ChromePage | undefined;
  let pdf: Buffer;
  try {
    pdf = await abortable(
      opts.signal,
      async () => {
        await page?.close();
      },
      async () => {
        page = await openPrintPage(browser, html);
        try {
          // The requested page ALONE, through the same print call as the PDF: running
          // header/footer counters ("Page 2 of 4") stay those of the whole document.
          return await printToBytes(page, opts, { pageRanges: String(n) });
        } catch (e) {
          if (n === 1) throw e;
          throw new Error(
            `@dotit/pdf: page ${n} is beyond the end of the document (${(e as Error).message})`,
          );
        }
      },
    );
  } finally {
    await page?.close().catch(() => undefined);
  }
  const { PDFDocument } = await import("pdf-lib");
  const size = (await PDFDocument.load(pdf)).getPage(0).getSize();
  const cssW = (size.width * 96) / 72;
  const cssH = (size.height * 96) / 72;
  const scale = opts.width ? opts.width / cssW : (opts.scale ?? 2);
  if (!(scale > 0)) throw new Error("@dotit/pdf: scale / width must be positive");
  return pdfBytesToPng(browser, pdf, cssW, cssH, scale, opts.timeout ?? 30000, opts.signal);
}

/** Render an HTML document (e.g. from issueDocument().html) to PDF bytes. */
export async function htmlToPDF(
  html: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  let bytes = await withBrowser(options, (browser) => pageToPdf(browser, html, options));
  if (options.pdfA) {
    bytes = Buffer.from(await toPdfA(bytes, options.pdfA));
  }
  return bytes;
}

/**
 * Render print HTML to a PNG of one page, drawn by the SAME Chrome that prints the PDF, so
 * it is the paper as it prints (`@page` size and margins, print media, running header/footer,
 * Arabic fonts), not a screen screenshot. Needs Chromium's built-in PDF viewer (full
 * Chromium/Chrome in `--headless=new`, not chrome-headless-shell).
 */
export async function htmlToPNG(
  html: string,
  options: PngRenderOptions = {},
): Promise<Buffer> {
  return withBrowser(options, (browser) => pageToPng(browser, html, options));
}

/** Render a finished `.it` source to a PNG of one page (see `htmlToPNG`). */
export async function renderPNG(
  source: string,
  options: PngRenderOptions = {},
): Promise<Buffer> {
  throwIfAborted(options.signal);
  return htmlToPNG(printHtml(source, options), options);
}

/** Render an `.it` source (already merged/finished) to PDF bytes. */
export async function renderPDF(
  source: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  return htmlToPDF(printHtml(source, options), options);
}

/**
 * The print HTML of a finished document. The exact `source` goes along so the
 * trust band verifies the bytes that were sealed: re-serialized from the parsed
 * model, a `| … |` table comes back as `row:` lines, the hash no longer matches,
 * and a valid seal would print as SEAL BROKEN.
 */
function printHtml(source: string, options: PdfRenderOptions): string {
  return renderPrint(parseIntentText(source, { keepEmptyCells: options.keepEmptyCells }), {
    theme: options.theme ?? "corporate",
    embedFonts: embedFontsFor(options),
    source,
    seal: options.seal,
    sealPosition: options.sealPosition,
  });
}

/** Resolve whether to embed fonts: explicit wins, else default ON for PDF/A. */
function embedFontsFor(options: PdfRenderOptions): boolean {
  return options.embedFonts ?? !!options.pdfA;
}

/**
 * The full issue flow in one call: merge → seal → PDF.
 * Returns the sealed source (store it), the hash, and the PDF bytes (email it).
 */
export async function issuePDF(
  templateSource: string,
  data: Record<string, unknown>,
  options: IssueOptions,
): Promise<IssuedDocument & { pdf: Buffer }> {
  throwIfAborted(options.signal);
  const issued = issueDocument(templateSource, data, options);
  const pdf = await htmlToPDF(issued.html, options);
  return { ...issued, pdf };
}

/** A PAdES signing identity (cert + key PEM) — see @dotit/pades. */
export interface PdfSigner {
  certPem: string;
  privateKeyPem: string;
  /** Shown in the PDF signature properties. */
  reason?: string;
  name?: string;
  /** RFC-3161 TSA URL — when set, the PDF gets a PAdES-T trusted timestamp. */
  tsaUrl?: string;
}

// Dynamic-import the ESM @dotit/pades from this CommonJS package. tsc (module
// CommonJS) would down-level a literal import() to require() — which can't load an
// ESM-only package — so we resolve the path with the module-scoped require() and
// import() it by file URL via Function (which tsc leaves untouched).
const importByUrl = new Function("u", "return import(u)") as (
  u: string,
) => Promise<typeof import("@dotit/pades")>;
async function importPades(): Promise<typeof import("@dotit/pades")> {
  const { pathToFileURL } = require("node:url") as typeof import("node:url");
  const resolved = require.resolve("@dotit/pades");
  return importByUrl(pathToFileURL(resolved).href);
}

/**
 * Render an `.it` to PDF AND embed a PAdES (ETSI.CAdES.detached) digital
 * signature — a one-call "issue a legally-recognized signed PDF". The native .it
 * seal/signatures (Ed25519) live in the source; this adds the X.509/PAdES
 * signature the outside world (Adobe, courts, gov) recognizes.
 *
 * Requires the optional peer `@dotit/pades`.
 */
export async function renderSignedPDF(
  source: string,
  options: PdfRenderOptions & { signer: PdfSigner; requireSeal?: boolean },
): Promise<Uint8Array> {
  throwIfAborted(options.signal);
  // Never let the PAdES signature vouch for TAMPERED content (finding #57). If the .it
  // carries a native seal, it MUST verify intact before we sign the rendered PDF —
  // otherwise a modified document would become a "legally-recognized signed PDF".
  if (isSealed(source)) {
    const v = verifyDocument(source);
    if (!v.intact) {
      throw new Error(
        `@dotit/pdf: refusing to sign — the .it seal is broken (${v.error ?? "modified since sealing"}). ` +
          `A signed PDF must not vouch for tampered content.`,
      );
    }
  } else if (options.requireSeal) {
    throw new Error(
      "@dotit/pdf: renderSignedPDF was called with requireSeal, but this .it document is not sealed.",
    );
  }
  const pdf = await renderPDF(source, options);
  throwIfAborted(options.signal);
  let pades: typeof import("@dotit/pades");
  try {
    pades = await importPades();
  } catch {
    throw new Error(
      "@dotit/pdf: renderSignedPDF needs the optional peer @dotit/pades — `npm i @dotit/pades`.",
    );
  }
  return pades.signPdfWithPem(new Uint8Array(pdf), {
    certPem: options.signer.certPem,
    privateKeyPem: options.signer.privateKeyPem,
    reason: options.signer.reason,
    name: options.signer.name,
    tsaUrl: options.signer.tsaUrl,
  });
}

/**
 * Batch renderer that reuses one Chrome instance — launching Chrome costs ~1s,
 * so for month-end runs (hundreds of statements) create one renderer, loop, close.
 */
export async function createPdfRenderer(options: PdfRenderOptions = {}): Promise<{
  renderPDF(source: string, opts?: PdfRenderOptions): Promise<Buffer>;
  htmlToPDF(html: string, opts?: PdfRenderOptions): Promise<Buffer>;
  issuePDF(
    templateSource: string,
    data: Record<string, unknown>,
    opts: IssueOptions,
  ): Promise<IssuedDocument & { pdf: Buffer }>;
  renderPNG(source: string, opts?: PngRenderOptions): Promise<Buffer>;
  htmlToPNG(html: string, opts?: PngRenderOptions): Promise<Buffer>;
  close(): Promise<void>;
}> {
  const browser = await launchBrowser(options);
  return {
    async renderPDF(source, opts = {}) {
      const merged = { ...options, ...opts };
      return pageToPdf(browser, printHtml(source, merged), merged);
    },
    async htmlToPDF(html, opts = {}) {
      return pageToPdf(browser, html, { ...options, ...opts });
    },
    async issuePDF(templateSource, data, opts) {
      const merged = { ...options, ...opts };
      const issued = issueDocument(templateSource, data, merged);
      const pdf = await pageToPdf(browser, issued.html, merged);
      return { ...issued, pdf };
    },
    async renderPNG(source, opts = {}) {
      const merged = { ...options, ...opts };
      throwIfAborted(merged.signal);
      return pageToPng(browser, printHtml(source, merged), merged);
    },
    async htmlToPNG(html, opts = {}) {
      return pageToPng(browser, html, { ...options, ...opts });
    },
    async close() {
      await browser.close();
    },
  };
}
